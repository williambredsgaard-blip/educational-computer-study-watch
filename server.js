const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const OPERATOR_KEY = process.env.OPERATOR_KEY || 'changeme';
const PORT = process.env.PORT || 3000;

const clients = new Map();
const operators = new Set();

app.use(express.json({ limit: '50mb' }));

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

io.on('connection', (socket) => {
  socket.on('operator:register', (key) => {
    if (key !== OPERATOR_KEY) {
      socket.emit('operator:error', 'invalid key');
      return socket.disconnect();
    }
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
    if (c) {
      c.lastFrame = data;
      io.to([...operators]).emit('frame', { id: socket.id, data });
    }
  });

  socket.on('operator:cmd', ({ targetId, cmd }) => {
    if (!operators.has(socket.id)) return;
    const c = clients.get(targetId);
    if (c) c.socket.emit('cmd', cmd);
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
