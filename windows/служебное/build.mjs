// Сборка программы для Windows (делается на Mac):  cd windows/служебное && node build.mjs [--dir]
//   результат — установщик Kontur-windows-setup.exe: кладётся наверх, в папку windows/ (и в служебное/dist/) (64-битная Windows 10/11; на Windows для процессоров ARM
//   тоже работает — через встроенную совместимость). Установка в один щелчок, без прав администратора, ярлыки на рабочем столе и в «Пуске»,
//   файлы .kontur открываются двойным щелчком.
//   1) кладёт в служебное/app/ саму программу (../web/kontur.html) и vendor/ — шрифты и библиотеки, чтобы программа работала без интернета
//      (берутся из mac/служебное/vendor/, если программа для Mac уже собиралась, иначе скачиваются);
//   2) рисует значок через Chrome (если его ещё нет в служебное/build/);
//   3) собирает программу и установщик. Подписи Microsoft нет — при первом запуске Windows покажет «Windows защитил ваш компьютер»
//      → «Подробнее» → «Выполнить в любом случае».
// --dir — только папка с программой (win-unpacked) без установщика. Номер версии берётся из APP_BUILD в программе.
// Близнец mac/служебное/build.mjs (образец — 01_Фотомагазин/desktop/).
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, cpSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = join(HERE, '..', '..'), TOP = join(HERE, '..');   // ROOT — папка 04_Контур, TOP — папка windows/
const DIR_ONLY = process.argv.includes('--dir');
const html = readFileSync(join(ROOT, 'web', 'kontur.html'), 'utf8');
const VERSION = html.match(/const APP_BUILD='([\d.]+)'/)[1];
const FONTS = [...html.match(/const FONTS=\[([\s\S]*?)\];/)[1].matchAll(/\['([^']+)','([^']+)',(\d),(\d)\]/g)].map(m => [m[1], m[2], +m[3], +m[4]]);
const FS_VER = html.match(/\$\{id\}@([\d.]+)\/files/)[1];
console.log(`Контур ${VERSION} для Windows${DIR_ONLY ? ' · только папка с программой' : ''} · шрифтов в программе: ${FONTS.length}`);

// ---------- 1. шрифты и библиотеки внутрь программы ----------
const VENDOR = join(HERE, 'vendor'), MAC_VENDOR = join(ROOT, 'mac', 'служебное', 'vendor');
async function get(url) {
  for (const host of ['https://cdn.jsdelivr.net/npm/', 'https://unpkg.com/']) {
    try { const r = await fetch(host + url); if (r.ok) return Buffer.from(await r.arrayBuffer()); } catch (e) { }
  }
  throw Error('не удалось скачать ' + url);
}
const LIBS = { 'paper-core.min.js': 'paper@0.12.18/dist/paper-core.min.js', 'opentype.min.js': 'opentype.js@1.3.4/dist/opentype.min.js',
  'UTIF.js': 'utif@3.1.0/UTIF.js', 'heic2any.min.js': 'heic2any@0.0.4/dist/heic2any.min.js',
  'pdf.min.js': 'pdfjs-dist@3.11.174/build/pdf.min.js', 'pdf.worker.min.js': 'pdfjs-dist@3.11.174/build/pdf.worker.min.js',
  'clipper.js': 'clipper-lib@6.4.2/clipper.js' };   // Clipper — «Контур с отступом» в окне «Расчёт плёнки»   // pdf.js — открытие PDF и .ai кривыми
if (existsSync(MAC_VENDOR)) cpSync(MAC_VENDOR, VENDOR, { recursive: true, force: false, errorOnExist: false });   // готовое — из программы для Mac
if (true) {   // докачиваем только недостающее (новые шрифты/библиотеки появятся сами при следующей сборке)
  mkdirSync(join(VENDOR, 'fonts'), { recursive: true }); mkdirSync(join(VENDOR, 'libs'), { recursive: true }); let got = 0;
  for (const [name, id, bold, italic] of FONTS)   // те же начертания, что запрашивает программа: обычный, жирный (если есть), курсив (если есть)
    for (const w of bold ? [400, 700] : [400]) for (const st of italic ? ['normal', 'italic'] : ['normal']) for (const sub of ['latin', 'cyrillic']) {
      const f = `${id}-${sub}-${w}-${st}.woff`; if (!existsSync(join(VENDOR, 'fonts', f))) { writeFileSync(join(VENDOR, 'fonts', f), await get(`@fontsource/${id}@${FS_VER}/files/${f}`)); got++; }
    }
  for (const [n, f] of Object.entries(LIBS)) if (!existsSync(join(VENDOR, 'libs', n))) { writeFileSync(join(VENDOR, 'libs', n), await get(f)); got++; }
  if (got) console.log('скачано файлов:', got);
  writeFileSync(join(VENDOR, 'LICENSES.txt'), 'Внутри программы лежат копии сторонних файлов, чтобы она работала без интернета:\n' +
    '• Шрифты ' + FONTS.map(f => f[0]).join(', ') + ' — Google Fonts через Fontsource, SIL Open Font License 1.1 / Apache 2.0.\n' +
    '• paper.js 0.12.18 (MIT), opentype.js 1.3.4 (MIT), UTIF.js 3.1.0 (MIT), heic2any 0.0.4 (MIT), pdf.js 3.11.174 (Apache 2.0), Clipper 6.4.2 (Angus Johnson, Boost Software License 1.0).\n');
}
rmSync(join(HERE, 'app'), { recursive: true, force: true }); mkdirSync(join(HERE, 'app'));
writeFileSync(join(HERE, 'app', 'kontur.html'), html);
cpSync(VENDOR, join(HERE, 'app', 'vendor'), { recursive: true });
console.log('файлов шрифтов:', readdirSync(join(VENDOR, 'fonts')).length, '· библиотек:', readdirSync(join(VENDOR, 'libs')).length);

// ---------- 2. значок (рисует Chrome) ----------
const BUILD = join(HERE, 'build'); mkdirSync(BUILD, { recursive: true });
async function render(htmlCode, w, h, file) {   // HTML → PNG с прозрачным фоном
  const prof = join(tmpdir(), 'kt-render-' + process.pid);
  const ch = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${prof}`, '--hide-scrollbars', '--force-color-profile=srgb', 'about:blank'], { stdio: 'ignore' });
  const sleep = ms => new Promise(r => setTimeout(r, ms)); let t;
  try {
    for (let i = 0; i < 80 && !t; i++) { try { const port = +readFileSync(join(prof, 'DevToolsActivePort'), 'utf8').split('\n')[0];
      t = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(x => x.type === 'page'); } catch { } if (!t) await sleep(250); }
    const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
    let id = 0; const pend = new Map(); ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d.result); pend.delete(d.id); } };
    const send = (method, params = {}) => new Promise(ok => { const i = ++id; pend.set(i, ok); ws.send(JSON.stringify({ id: i, method, params })); });
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
    await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
    const tmp = join(tmpdir(), 'kt-render.html'); writeFileSync(tmp, htmlCode);
    await send('Page.enable'); await send('Page.navigate', { url: 'file://' + tmp }); await sleep(1200);
    const r = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: w, height: h, scale: 1 } });
    writeFileSync(file, Buffer.from(r.data, 'base64')); ws.close();
  } finally { ch.kill('SIGKILL'); rmSync(prof, { recursive: true, force: true }); }
}
if (!existsSync(join(BUILD, 'icon.png'))) {
  // значок Windows: та же плитка, что у программы для Mac, но почти во весь квадрат (у Windows нет «сетки» с полями, как у Apple)
  await render(`<!doctype html><style>html,body{margin:0;background:transparent}
    .b{position:absolute;left:24px;top:24px;width:976px;height:976px;border-radius:200px;overflow:hidden;background:linear-gradient(45deg,#19d3a2,#3d8bfd 50%,#a35bff)}
    .b::before{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.3),rgba(255,255,255,0) 45%);mix-blend-mode:soft-light}
    svg{position:absolute;inset:0;width:976px;height:976px}</style>
    <div class="b"><svg viewBox="0 0 24 24"><path d="M6 17.5C8.5 6 15.5 18 18 6.5" fill="none" stroke="#141418" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M6 17.5 7.6 10.1M18 6.5 16.4 13.9" stroke="#fff" stroke-width=".42" stroke-opacity=".8"/><circle cx="7.6" cy="10.1" r=".8" fill="#fff"/><circle cx="16.4" cy="13.9" r=".8" fill="#fff"/>
    <rect x="4.1" y="15.6" width="3.8" height="3.8" rx=".8" fill="#fff"/><rect x="16.1" y="4.6" width="3.8" height="3.8" rx=".8" fill="#fff"/></svg></div>`, 1024, 1024, join(BUILD, 'icon.png'));
  console.log('значок готов');
}

// ---------- 3. сборка программы и установщика ----------
const pkg = JSON.parse(readFileSync(join(HERE, 'package.json'), 'utf8')); pkg.version = VERSION; writeFileSync(join(HERE, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
const config = {
  appId: 'app.kontur.desktop', productName: 'Контур', copyright: '© 2026 Контур (Contour)',
  directories: { output: 'dist', buildResources: 'build' },
  files: ['main.js', 'preload.js', 'package.json', 'app/**/*'], asar: true, electronLanguages: ['ru', 'en-US'],
  win: { target: [{ target: DIR_ONLY ? 'dir' : 'nsis', arch: ['x64'] }], icon: 'build/icon.png', executableName: 'Kontur' },
  nsis: { oneClick: true, perMachine: false, runAfterFinish: true, createDesktopShortcut: 'always', createStartMenuShortcut: true,
    shortcutName: 'Контур', uninstallDisplayName: 'Контур', language: '1049', deleteAppDataOnUninstall: false },
  // только свои проекты: картинки (JPG, PNG…) не трогаем — иначе Контур открывал бы их вместо привычного просмотрщика
  fileAssociations: [{ ext: 'kontur', name: 'Проект Контура', description: 'Проект Контура', role: 'Editor' }],
  artifactName: 'Kontur-windows-setup.${ext}',
};
const { build } = await import('electron-builder');
await build({ config, win: [], publish: 'never' });
// наверх, в папку windows/, — готовый установщик (его и передают людям)
if (!DIR_ONLY) { cpSync(join(HERE, 'dist', 'Kontur-windows-setup.exe'), join(TOP, 'Kontur-windows-setup.exe')); console.log('Kontur-windows-setup.exe → папка windows/'); }
console.log('готово → windows/служебное/dist/', readdirSync(join(HERE, 'dist')).filter(f => f.endsWith('.exe') || f.endsWith('unpacked')).join(', '));
