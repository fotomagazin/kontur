// Контур — программа для Mac.
// Внутри — та же программа, что и в браузере (web/kontur.html), а вокруг неё то, что умеют «настоящие» программы:
// своё окно и значок, меню Mac, открытие файлов из Finder и с Dock, сохранение прямо в файл, недавние файлы,
// вопрос «Сохранить изменения?» при закрытии. Ссылки (Telegram, новая версия) открываются во внешнем браузере.
// Сделано по образцу Фотомагазина (01_Фотомагазин/desktop/, рецепт — 01_Фотомагазин/docs/рецепт-программа-для-mac.md).
'use strict';
const { app, BrowserWindow, Menu, dialog, ipcMain, shell, session } = require('electron');
const path = require('path'), fs = require('fs');

const PAGE = path.join(__dirname, 'app', 'kontur.html');   // при сборке сюда кладутся программа и vendor/ (шрифты, библиотеки)
const VENDOR = path.join(__dirname, 'app', 'vendor');
const SITE = 'https://fotomagazin.github.io/kontur/', CHANNEL = 'https://t.me/fotomag_app';
const OPENABLE = /\.(kontur|pdf|ai|cdr|jpe?g|png|webp|gif|bmp|avif|ico|svg|heic|heif|tiff?)$/i;

app.setName('Контур');
// для проверок — отдельная папка настроек (FM_PROFILE), чтобы тесты не трогали автосохранение настоящей программы
if (process.env.FM_PROFILE) app.setPath('userData', process.env.FM_PROFILE);
// программа запускается в одном экземпляре: две копии делили бы одну базу автосохранения и могли её повредить.
// Повторный запуск (например, из Терминала с файлом) передаёт файлы в уже открытую программу и закрывается
if (!app.requestSingleInstanceLock()) { app.quit(); }
app.on('second-instance', (e, argv) => {
  const files = argv.filter(a => OPENABLE.test(a));
  if (files.length) return openPaths(files);
  const w = focused(); if (w) { if (w.isMinimized()) w.restore(); w.focus(); } else if (app.isReady()) createWindow();
});
app.setAboutPanelOptions({ applicationName: 'Контур', applicationVersion: app.getVersion(), version: '',
  copyright: '© 2026 Контур (Contour). Бесплатный векторный редактор. От создателей Фотомагазина.',
  credits: 'Шрифты — Fontsource / Google Fonts (SIL Open Font License, Apache 2.0). Библиотеки — paper.js, opentype.js, UTIF, heic2any (MIT), qrcode-generator (MIT).' });

// ---------- окна ----------
let firstWindow = true;
function createWindow() {
  const win = new BrowserWindow({ width: 1440, height: 900, minWidth: 1000, minHeight: 620, title: 'Контур', backgroundColor: '#0e0e11', show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: false } });
  // «Есть незаконченная работа» предлагаем только в первом окне — иначе новое окно предложит восстановить работу соседнего
  win.loadFile(PAGE, { query: { restore: firstWindow ? '1' : '0' } }); firstWindow = false;
  win.once('ready-to-show', () => win.show());
  win.ready = new Promise(ok => win.webContents.once('did-finish-load', ok));
  // ссылки — во внешнем браузере (Telegram, сайт, скачивание новой версии)
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^(https?|mailto|tg):/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); } });
  // «● » в начале заголовка — есть несохранённые изменения: точка в красной кнопке окна, как у всех программ Mac
  win.on('page-title-updated', (e, title) => win.setDocumentEdited(title.startsWith('● ')));
  // закрытие окна с несохранёнными изменениями — спрашиваем по-маковски
  win.webContents.on('will-prevent-unload', e => {
    const choice = dialog.showMessageBoxSync(win, { type: 'warning', buttons: ['Сохранить', 'Отмена', 'Не сохранять'], defaultId: 0, cancelId: 1,
      message: 'Сохранить изменения в проекте?', detail: 'Если не сохранить, изменения пропадут.' });
    if (choice === 2) e.preventDefault();   // «Не сохранять» — закрываем
    else if (choice === 0) run(win, 'saveProject(false)').then(() => run(win, '!dirty')).then(saved => { if (saved) win.close(); });
  });
  return win;
}
const run = (win, code) => win.webContents.executeJavaScript(code, true).catch(() => null);
const focused = () => BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null;
const inPage = code => () => { const w = focused(); if (w) run(w, code); };

// ---------- открыть файлы (Finder, Dock, «Открыть недавние») ----------
const pending = [];
async function openPaths(paths) {
  paths = paths.filter(p => OPENABLE.test(p) && fs.existsSync(p)); if (!paths.length) return;
  if (!app.isReady()) { pending.push(...paths); return; }
  let win = focused();
  if (win) { await win.ready; if (!(await run(win, 'S.objects.length === 0 && !dirty'))) win = null; }   // в окне уже работа — открываем в новом
  if (!win) { win = createWindow(); await win.ready; }
  const files = paths.map(p => ({ name: path.basename(p), path: p, data: fs.readFileSync(p) }));
  win.webContents.send('open-files', files); win.focus();
  paths.forEach(p => app.addRecentDocument(p));
}
app.on('open-file', (e, p) => { e.preventDefault(); openPaths([p]); });

// ---------- связь со страницей (preload.js → window.fmNative) ----------
// «Сохранить»: пишем прямо в файл проекта; первый раз или «Сохранить как» — окно выбора места
ipcMain.handle('save-file', async (e, { data, path: p, name }) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (!p) {
    const r = await dialog.showSaveDialog(win, { title: 'Сохранить проект', defaultPath: path.join(app.getPath('documents'), name || 'Без имени.kontur'),
      filters: [{ name: 'Проект Контура', extensions: ['kontur'] }], properties: ['createDirectory', 'showOverwriteConfirmation'] });
    if (r.canceled || !r.filePath) return null; p = r.filePath;
  }
  fs.writeFileSync(p, Buffer.from(data)); app.addRecentDocument(p); win.setRepresentedFilename(p);
  return p;
});
ipcMain.on('opened', (e, p) => { if (p && fs.existsSync(p)) { app.addRecentDocument(p); BrowserWindow.fromWebContents(e.sender)?.setRepresentedFilename(p); } });
ipcMain.on('doc-path', (e, p) => BrowserWindow.fromWebContents(e.sender)?.setRepresentedFilename(p || ''));
// шрифты изнутри программы — только из папки vendor (никаких других файлов страница так получить не может)
ipcMain.handle('vendor', (e, rel) => {
  const p = path.resolve(VENDOR, String(rel));
  if (!p.startsWith(VENDOR + path.sep) || !fs.existsSync(p)) return null;
  return new Uint8Array(fs.readFileSync(p));
});

// ---------- меню Mac ----------
// Клавиши, которые программа и так понимает сама (⌘Z, ⌘S, ⌘O…), в меню только подписаны (registerAccelerator: false),
// чтобы нажатие не срабатывало дважды. «Вырезать/Скопировать/Вставить» — стандартные: они нужны и в полях ввода.
const K = (label, accelerator, code) => ({ label, accelerator, registerAccelerator: false, click: inPage(code) });
function buildMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Контур', submenu: [
      { label: 'О программе «Контур»', role: 'about' },
      { label: 'Проверить обновления…', click: inPage("$('#updBtn').click()") },
      { type: 'separator' },
      { label: 'Скрыть Контур', role: 'hide' }, { label: 'Скрыть остальные', role: 'hideOthers' }, { label: 'Показать все', role: 'unhide' },
      { type: 'separator' },
      { label: 'Завершить Контур', role: 'quit' } ] },
    { label: 'Файл', submenu: [
      { label: 'Новый документ', accelerator: 'CmdOrCtrl+N', click: inPage('newDoc()') },
      { label: 'Новое окно', accelerator: 'Shift+CmdOrCtrl+N', click: () => createWindow() },
      K('Открыть…', 'CmdOrCtrl+O', 'openProject()'),
      { label: 'Открыть недавние', role: 'recentDocuments', submenu: [{ label: 'Очистить меню', role: 'clearRecentDocuments' }] },
      { type: 'separator' },
      K('Импорт фото или логотипа…', 'CmdOrCtrl+I', "$('#fImg').click()"),
      { label: 'QR-код…', click: inPage('qrOpen(null)') },
      { type: 'separator' },
      K('Сохранить', 'CmdOrCtrl+S', 'saveProject(false)'),
      K('Сохранить как…', 'Shift+CmdOrCtrl+S', 'saveProject(true)'),
      K('Экспорт (SVG, PDF, EPS, DXF, PNG)…', 'CmdOrCtrl+E', 'openExport()'),
      { label: 'Расчёт плёнки (длина реза, площадь, раскладка, стоимость)…', click: inPage('openCalc()') },
      { type: 'separator' },
      { label: 'Закрыть окно', role: 'close' } ] },
    { label: 'Правка', submenu: [
      K('Отменить', 'CmdOrCtrl+Z', 'undo()'),
      K('Повторить', 'Shift+CmdOrCtrl+Z', 'redo()'),
      { type: 'separator' },
      { label: 'Вырезать', role: 'cut' }, { label: 'Скопировать', role: 'copy' }, { label: 'Вставить', role: 'paste' },
      K('Дублировать', 'CmdOrCtrl+D', 'dup()'),
      K('Выделить всё', 'CmdOrCtrl+A', "finishPen(); sel = vis().filter(o => !o.lock).map(o => o.id); render(); panel()"),
      { type: 'separator' },
      K('Объединить контуры', 'CmdOrCtrl+L', 'combine()'),
      K('Разъединить', 'CmdOrCtrl+K', 'breakApart()'),
      { label: 'Текст в кривые', click: inPage('textToCurves()') } ] },
    { label: 'Вид', submenu: [
      K('Страница целиком', 'CmdOrCtrl+0', 'fit()'),
      { label: 'Увеличить', accelerator: 'CmdOrCtrl+Plus', click: inPage('zoomC(1.25)') },
      { label: 'Уменьшить', accelerator: 'CmdOrCtrl+-', click: inPage('zoomC(.8)') },
      { type: 'separator' },
      { label: 'Сетка', click: inPage('GRID.show = !GRID.show; snapUI(); render(); panel()') },
      { label: 'Привязка', click: inPage("$('#snapBtn').click()") },
      { type: 'separator' },
      { label: 'Полноэкранный режим', role: 'togglefullscreen' },
      ...(process.env.FM_DEV ? [{ label: 'Инструменты разработчика', role: 'toggleDevTools' }] : []) ] },
    { label: 'Окно', role: 'windowMenu', submenu: [
      { label: 'Свернуть', role: 'minimize' }, { label: 'Изменить масштаб', role: 'zoom' },
      { type: 'separator' }, { label: 'Все окна — на передний план', role: 'front' } ] },
    { label: 'Справка', role: 'help', submenu: [
      { label: 'Сайт Контура', click: () => shell.openExternal(SITE) },
      { label: 'Предложить идею или сообщить об ошибке…', click: inPage("openFb('idea')") },
      { label: 'Новости — Telegram-канал', click: () => shell.openExternal(CHANNEL) } ] },
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
  const argv = process.argv.slice(1).filter(a => OPENABLE.test(a));   // файлы из командной строки (`open -a Контур проект.kontur`)
  if (pending.length || argv.length) openPaths([...pending.splice(0), ...argv]); else createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });   // клик по значку в Dock, когда окон нет
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });   // на Mac программа остаётся в Dock
