// Сборка программы для Mac:  cd mac/служебное && node build.mjs [--arch arm64|x64|universal] [--dir]
//   готовая программа «Контур.app» (для процессора этого Mac) кладётся наверх — в папку mac/, рядом со «служебным»;
//   установщики для выпуска — два: mac/служебное/dist/Kontur-mac-apple.dmg (процессоры Apple M1…) и dist/Kontur-mac-intel.dmg
//   1) кладёт в служебное/app/ саму программу (../web/kontur.html — браузерная версия) и vendor/ — шрифты (16 шрифтов с кириллицей во всех начертаниях)
//      и библиотеки (paper.js, opentype.js, UTIF, heic2any), чтобы программа работала без интернета
//      (скачиваются один раз, дальше берутся из служебное/vendor/);
//   2) рисует значок и фон окна установщика через Chrome (если их ещё нет в служебное/build/);
//   3) собирает «Контур.app» и установщики .dmg; подпись — «ad-hoc» (без сертификата Apple).
// --dir — только .app без .dmg (быстрее, для проверки). Номер версии берётся из APP_BUILD в программе.
// Образец — 01_Фотомагазин/desktop/build.mjs (рецепт — 01_Фотомагазин/docs/рецепт-программа-для-mac.md).
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, cpSync, readdirSync, renameSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = join(HERE, '..', '..'), TOP = join(HERE, '..');   // ROOT — папка 04_Контур, TOP — папка mac/
const args = process.argv.slice(2), opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const ARCHS = opt('--arch') ? [opt('--arch')] : ['arm64', 'x64'], ARCH = ARCHS.join('+'), DIR_ONLY = args.includes('--dir');
const html = readFileSync(join(ROOT, 'web', 'kontur.html'), 'utf8');
const VERSION = html.match(/const APP_BUILD='([\d.]+)'/)[1];
// список шрифтов берём из самой программы: [название, id в Fontsource, есть жирный, есть курсив]
const FONTS = [...html.match(/const FONTS=\[([\s\S]*?)\];/)[1].matchAll(/\['([^']+)','([^']+)',(\d),(\d)\]/g)].map(m => [m[1], m[2], +m[3], +m[4]]);
const FS_VER = html.match(/@fontsource\/'\]\.map\(h=>`\$\{h\}\$\{id\}@([\d.]+)\//)?.[1] || html.match(/\$\{id\}@([\d.]+)\/files/)[1];
console.log(`Контур ${VERSION} · архитектура ${ARCH}${DIR_ONLY ? ' · только .app' : ''} · шрифтов в программе: ${FONTS.length} (Fontsource ${FS_VER})`);

// ---------- 1. шрифты и библиотеки внутрь программы ----------
const VENDOR = join(HERE, 'vendor');
async function get(url) {
  for (const host of ['https://cdn.jsdelivr.net/npm/', 'https://unpkg.com/']) {
    try { const r = await fetch(host + url); if (r.ok) return Buffer.from(await r.arrayBuffer()); } catch (e) { }
  }
  throw Error('не удалось скачать ' + url);
}
const LIBS = { 'paper-core.min.js': 'paper@0.12.18/dist/paper-core.min.js', 'opentype.min.js': 'opentype.js@1.3.4/dist/opentype.min.js',
  'UTIF.js': 'utif@3.1.0/UTIF.js', 'heic2any.min.js': 'heic2any@0.0.4/dist/heic2any.min.js',
  'pdf.min.js': 'pdfjs-dist@3.11.174/build/pdf.min.js', 'pdf.worker.min.js': 'pdfjs-dist@3.11.174/build/pdf.worker.min.js' };   // pdf.js — открытие PDF и .ai кривыми
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
    '• paper.js 0.12.18 (MIT), opentype.js 1.3.4 (MIT), UTIF.js 3.1.0 (MIT), heic2any 0.0.4 (MIT), pdf.js 3.11.174 (Apache 2.0).\n');
}
rmSync(join(HERE, 'app'), { recursive: true, force: true }); mkdirSync(join(HERE, 'app'));
writeFileSync(join(HERE, 'app', 'kontur.html'), html);
cpSync(VENDOR, join(HERE, 'app', 'vendor'), { recursive: true });
console.log('файлов шрифтов:', readdirSync(join(VENDOR, 'fonts')).length, '· библиотек:', readdirSync(join(VENDOR, 'libs')).length);

// ---------- 2. значок и фон установщика (рисует Chrome) ----------
const BUILD = join(HERE, 'build'); mkdirSync(BUILD, { recursive: true });
async function render(htmlCode, w, h, scale, file) {   // HTML → PNG с прозрачным фоном
  const prof = join(tmpdir(), 'kt-render-' + process.pid);
  const ch = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${prof}`, '--hide-scrollbars', '--force-color-profile=srgb', 'about:blank'], { stdio: 'ignore' });
  const sleep = ms => new Promise(r => setTimeout(r, ms)); let t;
  try {
    for (let i = 0; i < 80 && !t; i++) { try { const port = +readFileSync(join(prof, 'DevToolsActivePort'), 'utf8').split('\n')[0];
      t = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(x => x.type === 'page'); } catch { } if (!t) await sleep(250); }
    const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
    let id = 0; const pend = new Map(); ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d.result); pend.delete(d.id); } };
    const send = (method, params = {}) => new Promise(ok => { const i = ++id; pend.set(i, ok); ws.send(JSON.stringify({ id: i, method, params })); });
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: scale, mobile: false });
    await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
    const tmp = join(tmpdir(), 'kt-render.html'); writeFileSync(tmp, htmlCode);
    await send('Page.enable'); await send('Page.navigate', { url: 'file://' + tmp }); await sleep(1200);
    const r = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: w, height: h, scale: 1 } });
    writeFileSync(file, Buffer.from(r.data, 'base64')); ws.close();
  } finally { ch.kill('SIGKILL'); rmSync(prof, { recursive: true, force: true }); }
}
if (!existsSync(join(BUILD, 'icon.icns'))) {
  // значок по сетке Apple: скруглённый квадрат 824×824 в поле 1024; как логотип Контура — плитка бирюзовый → синий → фиолетовый,
  // на ней тёмная кривая Безье и два белых узла (родственно значку Фотомагазина: та же плитка, но кривая вместо «окошка»)
  await render(`<!doctype html><style>html,body{margin:0;background:transparent}
    .b{position:absolute;left:100px;top:100px;width:824px;height:824px;border-radius:186px;overflow:hidden;
      background:linear-gradient(45deg,#19d3a2,#3d8bfd 50%,#a35bff);box-shadow:0 18px 36px rgba(0,0,0,.28)}
    .b::before{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.3),rgba(255,255,255,0) 45%);mix-blend-mode:soft-light}
    svg{position:absolute;inset:0;width:824px;height:824px}</style>
    <div class="b"><svg viewBox="0 0 24 24"><path d="M6 17.5C8.5 6 15.5 18 18 6.5" fill="none" stroke="#141418" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M6 17.5 7.6 10.1M18 6.5 16.4 13.9" stroke="#fff" stroke-width=".42" stroke-opacity=".8"/><circle cx="7.6" cy="10.1" r=".8" fill="#fff"/><circle cx="16.4" cy="13.9" r=".8" fill="#fff"/>
    <rect x="4.1" y="15.6" width="3.8" height="3.8" rx=".8" fill="#fff"/><rect x="16.1" y="4.6" width="3.8" height="3.8" rx=".8" fill="#fff"/></svg></div>`, 1024, 1024, 1, join(BUILD, 'icon-1024.png'));
  const set = join(tmpdir(), 'kontur.iconset'); rmSync(set, { recursive: true, force: true }); mkdirSync(set);
  for (const s of [16, 32, 128, 256, 512]) for (const k of [1, 2])
    execFileSync('sips', ['-z', String(s * k), String(s * k), join(BUILD, 'icon-1024.png'), '--out', join(set, `icon_${s}x${s}${k > 1 ? '@2x' : ''}.png`)], { stdio: 'ignore' });
  execFileSync('iconutil', ['-c', 'icns', set, '-o', join(BUILD, 'icon.icns')]);
  console.log('значок готов');
}
if (!existsSync(join(BUILD, 'dmg-bg.png'))) {
  // фон окна установщика: куда перетащить и как открыть в первый раз (светлый — подписи значков в Finder тёмные)
  await render(`<!doctype html><style>html,body{margin:0;width:540px;height:380px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,sans-serif}
    body{background:linear-gradient(160deg,#ffffff,#eef2f7)}
    .t{position:absolute;top:26px;width:100%;text-align:center;font-size:21px;font-weight:700;letter-spacing:-.02em;color:#1d1d1f}
    .t b{background:linear-gradient(90deg,#19d3a2,#3d8bfd,#a35bff);-webkit-background-clip:text;color:transparent}
    .a{position:absolute;left:214px;top:174px;width:112px;height:3px;border-radius:2px;background:linear-gradient(90deg,#19d3a2,#3d8bfd)}
    .a::after{content:'';position:absolute;right:-4px;top:-7px;border-left:14px solid #3d8bfd;border-top:8px solid transparent;border-bottom:8px solid transparent}
    .h{position:absolute;top:238px;width:100%;text-align:center;font-size:13px;color:#6e6e73}
    .n{position:absolute;left:28px;right:28px;bottom:20px;padding:10px 14px;border-radius:12px;background:#fff;box-shadow:0 1px 0 rgba(0,0,0,.06),0 0 0 1px rgba(0,0,0,.06);
      font-size:11.5px;line-height:1.45;color:#424245}
    .n b{color:#1d1d1f}</style>
    <div class="t">Установка <b>Контура</b></div><div class="a"></div>
    <div class="h">Перетащите значок в папку «Программы»</div>
    <div class="n"><b>Первый запуск.</b> Если macOS пишет, что не удалось проверить разработчика,
    откройте «Системные настройки» → «Конфиденциальность и безопасность» и внизу нажмите «Открыть всё равно».</div>`, 540, 380, 2, join(BUILD, 'dmg-bg.png'));
  console.log('фон установщика готов');
}

// ---------- 3. сборка .app и .dmg ----------
const pkg = JSON.parse(readFileSync(join(HERE, 'package.json'), 'utf8')); pkg.version = VERSION; writeFileSync(join(HERE, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
const IMAGES = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif', 'ico', 'svg', 'heic', 'heif', 'tif', 'tiff'];
const config = {
  appId: 'app.kontur.desktop', productName: 'Контур', copyright: '© 2026 Контур (Contour)',
  directories: { output: 'dist', buildResources: 'build' },
  files: ['main.js', 'preload.js', 'package.json', 'app/**/*'], asar: true, electronLanguages: ['ru', 'en'],
  mac: { target: [{ target: DIR_ONLY ? 'dir' : 'dmg', arch: ARCHS }], category: 'public.app-category.graphics-design', icon: 'build/icon.icns',
    identity: null, hardenedRuntime: false, gatekeeperAssess: false, darkModeSupport: true,
    extendInfo: { CFBundleDevelopmentRegion: 'ru', CFBundleLocalizations: ['ru'],
      UTExportedTypeDeclarations: [{ UTTypeIdentifier: 'app.kontur.project', UTTypeDescription: 'Проект Контура', UTTypeConformsTo: ['public.data'],
        UTTypeIconFile: 'icon.icns', UTTypeTagSpecification: { 'public.filename-extension': ['kontur'] } }] } },
  fileAssociations: [
    { ext: ['kontur'], name: 'Проект Контура', role: 'Editor', rank: 'Owner', icon: 'build/icon.icns' },
    { ext: IMAGES, name: 'Изображение', role: 'Viewer', rank: 'Alternate' },
    { ext: ['ai', 'pdf', 'cdr'], name: 'Векторный рисунок', role: 'Viewer', rank: 'Alternate' } ],   // «Открыть с помощью → Контур»: .ai и PDF — кривыми
  dmg: { title: 'Контур', background: 'build/dmg-bg.png', iconSize: 92, window: { width: 540, height: 380 },
    contents: [{ x: 150, y: 176, type: 'file' }, { x: 390, y: 176, type: 'link', path: '/Applications' }] },
  artifactName: 'Kontur-mac-${arch}.${ext}',
  afterSign: ctx => {   // подпись «ad-hoc»: без неё macOS на процессорах Apple считает программу повреждённой
    const appPath = join(ctx.appOutDir, ctx.packager.appInfo.productFilename + '.app');
    execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath]); console.log('подписано (ad-hoc):', basename(appPath));
  },
};
const { build } = await import('electron-builder');
await build({ config, mac: [], publish: 'never' });
// понятные имена файлов: arm64 → apple (процессоры M1…M4), x64 → intel, universal → без приставки
for (const f of readdirSync(join(HERE, 'dist'))) { const m = f.match(/^Kontur-mac-(arm64|x64|universal)\.(dmg|dmg\.blockmap)$/);
  if (m) renameSync(join(HERE, 'dist', f), join(HERE, 'dist', `Kontur-mac${{ arm64: '-apple', x64: '-intel', universal: '' }[m[1]]}.${m[2]}`)); }
// наверх, в папку mac/, — готовая программа для процессора этого Mac (её и запускают двойным щелчком)
const mine = join(HERE, 'dist', process.arch === 'arm64' ? 'mac-arm64' : 'mac', 'Контур.app');
if (existsSync(mine)) { rmSync(join(TOP, 'Контур.app'), { recursive: true, force: true }); execFileSync('ditto', [mine, join(TOP, 'Контур.app')]); console.log('Контур.app → папка mac/'); }
console.log('готово → mac/служебное/dist/', readdirSync(join(HERE, 'dist')).filter(f => f.endsWith('.dmg') || f.startsWith('mac')).join(', '));
