// Контур — программа для Windows.
// Внутри — та же программа, что и в браузере (web/kontur.html), а вокруг неё то, что умеют «настоящие» программы:
// своё окно и значок, меню, открытие файлов из Проводника (двойной щелчок по .kontur, «Открыть с помощью»), сохранение прямо в файл,
// недавние файлы (в списке переходов на панели задач), вопрос «Сохранить изменения?» при закрытии. Ссылки открываются во внешнем браузере.
// Близнец программы для Mac (mac/служебное/main.js); отличия Windows: меню внутри окна (без меню с именем программы), файлы приходят
// в командной строке (а не событием open-file), «● » в заголовке страницы превращается в «*Имя — Контур», при закрытии окна программа завершается.
'use strict';
const { app, BrowserWindow, Menu, dialog, ipcMain, shell, session } = require('electron');
const path = require('path'), fs = require('fs');

const PAGE = path.join(__dirname, 'app', 'kontur.html');   // при сборке сюда кладутся программа и vendor/ (шрифты, библиотеки)
const VENDOR = path.join(__dirname, 'app', 'vendor');
const SITE = 'https://fotomagazin.github.io/kontur/', CHANNEL = 'https://t.me/fotomag_app';
const OPENABLE = /\.(kontur|pdf|ai|cdr|jpe?g|png|webp|gif|bmp|avif|ico|svg|heic|heif|tiff?)$/i;
const filesIn = argv => argv.filter(a => OPENABLE.test(a) && !a.startsWith('--'));

app.setName('Контур');
if (process.platform === 'win32') app.setAppUserModelId('app.kontur.desktop');   // значок на панели задач и список переходов — от «Контура»
// для проверок — отдельная папка настроек (FM_PROFILE), чтобы тесты не трогали автосохранение настоящей программы
if (process.env.FM_PROFILE) app.setPath('userData', process.env.FM_PROFILE);
// программа запускается в одном экземпляре: две копии делили бы одну базу автосохранения и могли её повредить.
// Двойной щелчок по второму файлу в Проводнике передаёт его в уже открытую программу
if (!app.requestSingleInstanceLock()) { app.quit(); }
app.on('second-instance', (e, argv) => {
  const files = filesIn(argv.slice(1));
  if (files.length) return openPaths(files);
  const w = focused(); if (w) { if (w.isMinimized()) w.restore(); w.focus(); } else if (app.isReady()) createWindow();
});

// ---------- окна ----------
let firstWindow = true;
function createWindow() {
  const win = new BrowserWindow({ width: 1440, height: 900, minWidth: 1000, minHeight: 620, title: 'Контур', backgroundColor: '#0e0e11', show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: false } });
  // «Есть незаконченная работа» предлагаем только в первом окне — иначе новое окно предложит восстановить работу соседнего
  win.loadFile(PAGE, { query: { restore: firstWindow ? '1' : '0' } }); firstWindow = false;
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  win.ready = new Promise(ok => win.webContents.once('did-finish-load', ok));
  // ссылки — во внешнем браузере (Telegram, сайт, скачивание новой версии)
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^(https?|mailto|tg):/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); } });
  // заголовок окна как у программ Windows: «Проект — Контур», со звёздочкой, пока есть несохранённые изменения
  win.on('page-title-updated', (e, title) => {
    e.preventDefault(); const edited = title.startsWith('● '), name = title.replace(/^● /, '');
    win.setTitle((edited ? '*' : '') + (name === 'Контур' ? 'Контур' : name + ' — Контур'));
  });
  // закрытие окна с несохранёнными изменениями — спрашиваем
  win.webContents.on('will-prevent-unload', e => {
    const choice = dialog.showMessageBoxSync(win, { type: 'warning', buttons: ['Сохранить', 'Отмена', 'Не сохранять'], defaultId: 0, cancelId: 1, noLink: true,
      title: 'Контур', message: 'Сохранить изменения в проекте?', detail: 'Если не сохранить, изменения пропадут.' });
    if (choice === 2) e.preventDefault();   // «Не сохранять» — закрываем
    else if (choice === 0) run(win, 'saveProject(false)').then(() => run(win, '!dirty')).then(saved => { if (saved) win.close(); });
  });
  return win;
}
const run = (win, code) => win.webContents.executeJavaScript(code, true).catch(() => null);
const focused = () => BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null;
const inPage = code => () => { const w = focused(); if (w) run(w, code); };

// ---------- открыть файлы (Проводник: двойной щелчок, «Открыть с помощью»; список переходов на панели задач) ----------
async function openPaths(paths) {
  paths = paths.filter(p => OPENABLE.test(p) && fs.existsSync(p)); if (!paths.length) return;
  let win = focused();
  if (win) { await win.ready; if (!(await run(win, 'S.objects.length === 0 && !dirty'))) win = null; }   // в окне уже работа — открываем в новом
  if (!win) { win = createWindow(); await win.ready; }
  const files = paths.map(p => ({ name: path.basename(p), path: p, data: fs.readFileSync(p) }));
  win.webContents.send('open-files', files); if (win.isMinimized()) win.restore(); win.focus();
  paths.forEach(p => app.addRecentDocument(p));
}

// ---------- связь со страницей (preload.js → window.fmNative) ----------
// «Сохранить»: пишем прямо в файл проекта; первый раз или «Сохранить как» — окно выбора места
ipcMain.handle('save-file', async (e, { data, path: p, name }) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (!p) {
    const r = await dialog.showSaveDialog(win, { title: 'Сохранить проект', defaultPath: path.join(app.getPath('documents'), name || 'Без имени.kontur'),
      filters: [{ name: 'Проект Контура', extensions: ['kontur'] }] });
    if (r.canceled || !r.filePath) return null; p = r.filePath;
  }
  fs.writeFileSync(p, Buffer.from(data)); app.addRecentDocument(p);
  return p;
});
ipcMain.on('opened', (e, p) => { if (p && fs.existsSync(p)) app.addRecentDocument(p); });
ipcMain.on('doc-path', () => { });   // путь к файлу в заголовке окна — только на Mac
// шрифты изнутри программы — только из папки vendor (никаких других файлов страница так получить не может)
ipcMain.handle('vendor', (e, rel) => {
  const p = path.resolve(VENDOR, String(rel));
  if (!p.startsWith(VENDOR + path.sep) || !fs.existsSync(p)) return null;
  return new Uint8Array(fs.readFileSync(p));
});

// ---------- меню (в окне) ----------
// Клавиши, которые программа и так понимает сама (Ctrl+Z, Ctrl+S, Ctrl+O…), в меню только подписаны (registerAccelerator: false),
// чтобы нажатие не срабатывало дважды. «Вырезать/Копировать/Вставить» — стандартные: они нужны и в полях ввода.
const K = (label, accelerator, code) => ({ label, accelerator, registerAccelerator: false, click: inPage(code) });
function about() {
  dialog.showMessageBox(focused(), { type: 'info', title: 'О программе', noLink: true, buttons: ['Закрыть', 'Сайт Контура'],
    message: 'Контур ' + app.getVersion() + ' (бета)',
    detail: 'Бесплатный векторный редактор: макеты для печати и резки, вывески, наклейки, логотипы и QR-коды. От создателей Фотомагазина.\n\n' +
      '© 2026 Контур (Contour).\nШрифты — Fontsource / Google Fonts (SIL Open Font License, Apache 2.0). Библиотеки — paper.js, opentype.js, UTIF, heic2any, qrcode-generator (MIT).' })
    .then(r => { if (r.response === 1) shell.openExternal(SITE); });
}
function buildMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: '&Файл', submenu: [
      { label: 'Новый документ', accelerator: 'Ctrl+N', click: inPage('newDoc()') },
      { label: 'Новое окно', accelerator: 'Ctrl+Shift+N', click: () => createWindow() },
      K('Открыть…', 'Ctrl+O', 'openProject()'),
      { type: 'separator' },
      K('Импорт фото или логотипа…', 'Ctrl+I', "$('#fImg').click()"),
      { label: 'QR-код…', click: inPage('qrOpen(null)') },
      { type: 'separator' },
      K('Сохранить', 'Ctrl+S', 'saveProject(false)'),
      K('Сохранить как…', 'Ctrl+Shift+S', 'saveProject(true)'),
      K('Экспорт (SVG, PDF, EPS, DXF, PNG)…', 'Ctrl+E', 'openExport()'),
      { type: 'separator' },
      { label: 'Закрыть окно', accelerator: 'Ctrl+W', role: 'close' },
      { label: 'Выход', role: 'quit' } ] },
    { label: '&Правка', submenu: [
      K('Отменить', 'Ctrl+Z', 'undo()'),
      K('Повторить', 'Ctrl+Y', 'redo()'),
      { type: 'separator' },
      { label: 'Вырезать', role: 'cut' }, { label: 'Копировать', role: 'copy' }, { label: 'Вставить', role: 'paste' },
      K('Дублировать', 'Ctrl+D', 'dup()'),
      K('Выделить всё', 'Ctrl+A', "finishPen(); sel = vis().filter(o => !o.lock).map(o => o.id); render(); panel()"),
      { type: 'separator' },
      K('Объединить контуры', 'Ctrl+L', 'combine()'),
      K('Разъединить', 'Ctrl+K', 'breakApart()'),
      { label: 'Текст в кривые', click: inPage('textToCurves()') } ] },
    { label: '&Вид', submenu: [
      K('Страница целиком', 'Ctrl+0', 'fit()'),
      { label: 'Увеличить', accelerator: 'Ctrl+=', click: inPage('zoomC(1.25)') },
      { label: 'Уменьшить', accelerator: 'Ctrl+-', click: inPage('zoomC(.8)') },
      { type: 'separator' },
      { label: 'Сетка', click: inPage('GRID.show = !GRID.show; snapUI(); render(); panel()') },
      { label: 'Привязка', click: inPage("$('#snapBtn').click()") },
      { type: 'separator' },
      { label: 'Во весь экран', accelerator: 'F11', role: 'togglefullscreen' },
      ...(process.env.FM_DEV ? [{ label: 'Инструменты разработчика', role: 'toggleDevTools' }] : []) ] },
    { label: '&Справка', submenu: [
      { label: 'Сайт Контура', click: () => shell.openExternal(SITE) },
      { label: 'Предложить идею или сообщить об ошибке…', click: inPage("openFb('idea')") },
      { label: 'Новости — Telegram-канал', click: () => shell.openExternal(CHANNEL) },
      { type: 'separator' },
      { label: 'Проверить обновления…', click: inPage("$('#updBtn').click()") },
      { label: 'О программе «Контур»', click: about } ] },
  ]));
}

// ---------- запуск ----------
app.whenReady().then(() => {
  buildMenu();
  // экспорт идёт как «скачивание» — показываем обычное окно «Сохранить»: картинки (PNG) — в «Изображения», остальное — в «Документы»
  session.defaultSession.on('will-download', (e, item) => {
    const n = item.getFilename(), pic = /\.png$/i.test(n);
    item.setSaveDialogOptions({ title: pic ? 'Сохранить картинку' : 'Сохранить файл', defaultPath: path.join(app.getPath(pic ? 'pictures' : 'documents'), n) });
  });
  const argv = filesIn(process.argv.slice(1));   // двойной щелчок по файлу в Проводнике: «Kontur.exe "C:\…\Проект.kontur"»
  if (argv.length) openPaths(argv); else createWindow();
});
app.on('window-all-closed', () => app.quit());   // в Windows программа завершается, когда закрыто последнее окно
