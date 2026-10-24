// Проверка собранной программы для Mac изнутри (без кликов по окнам):  cd mac/служебное && node test-app.mjs [путь к .app]
// По умолчанию — mac/Контур.app (та, что лежит наверху, рядом со «служебным»). Программа запускается с отладкой и с проектом в командной строке; проверяется:
// признак «программа для Mac», открытие проекта при запуске, шрифты и библиотеки изнутри (интернет на время проверки «отключён»),
// надписи, «Вычесть» и .ai без интернета, сохранение прямо в файл и пересохранение на то же место (⌘S), точка «есть изменения»
// в заголовке, «Скопировать» из меню «Правка», защита мостика (чужие файлы не читаются), журнал без ошибок.
import { spawn } from 'node:child_process';
import { statSync, existsSync, rmSync, writeFileSync, readFileSync, mkdtempSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = process.argv[2] || join(HERE, '..', 'Контур.app');
const TMP = mkdtempSync(join(tmpdir(), 'kt-app-test-')), PROFILE = join(TMP, 'profile'), IN = join(TMP, 'Проба.kontur'), OUT = join(TMP, 'Сохранено.kontur');
const sleep = ms => new Promise(r => setTimeout(r, ms));
writeFileSync(IN, JSON.stringify({ app: 'Kontur', v: 1, page: { w: 210, h: 297 }, objects: [
  { id: 'r1', type: 'path', name: 'Квадрат', sp: [{ c: true, n: [[20, 20], [80, 20], [80, 80], [20, 80]].map(([x, y]) => ({ x, y, a: null, b: null, s: false })) }], fill: '#3d8bfd', stroke: null, sw: 0, op: 1 },
  { id: 'r2', type: 'path', name: 'Квадрат 2', sp: [{ c: true, n: [[50, 50], [110, 50], [110, 110], [50, 110]].map(([x, y]) => ({ x, y, a: null, b: null, s: false })) }], fill: '#ff6b6b', stroke: null, sw: 0, op: 1 }], assets: {} }));
// отдельная папка настроек (FM_PROFILE): проверка не трогает автосохранение и не мешает открытой программе
const proc = spawn(join(APP, 'Contents', 'MacOS', 'Контур'), ['--remote-debugging-port=0', IN], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, FM_PROFILE: PROFILE } });
let logs = ''; proc.stdout.on('data', d => logs += d); proc.stderr.on('data', d => logs += d);
let t; for (let i = 0; i < 80 && !t; i++) { try { const port = +readFileSync(join(PROFILE, 'DevToolsActivePort'), 'utf8').split('\n')[0];
  t = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(x => x.type === 'page'); } catch { } if (!t) await sleep(250); }
const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map(); ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } };
const send = (method, params = {}) => new Promise(ok => { const i = ++id; pend.set(i, ok); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async code => { const r = await send('Runtime.evaluate', { expression: code, awaitPromise: true, returnByValue: true }); return r.result?.exceptionDetails ? 'ОШИБКА: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 300) : r.result?.result?.value; };
let fails = 0; const ok = (name, cond, extra = '') => { if (!cond) fails++; console.log((cond ? '✓ ' : '✗ ') + name + (extra ? ' — ' + extra : '')); };
await sleep(2000);

ok('программа для Mac', await ev(`!!window.fmNative && !!NATIVE`), await ev(`diagInfo()`));
ok('проект из запуска открыт', (await ev(`S.objects.length`)) === 2 && (await ev(`projectPath`)) === IN, await ev(`projName + ' · ' + projectPath`));
ok('заголовок окна — имя проекта', (await ev(`document.title`)) === 'Проба', await ev(`document.title`));
// дальше «без интернета»: любые запросы в сеть падают — шрифты и библиотеки должны найтись внутри программы
await ev(`window.__f = window.fetch; window.fetch = (u, o) => /^https?:/.test(String(u)) ? Promise.reject(new TypeError('нет интернета (проверка)')) : window.__f(u, o)`);
await ev(`for (const s of document.scripts) if (/^https?:/.test(s.src)) s.remove(), 0`);
const fonts = await ev(`(async () => { const r = []; for (const [f, b, i] of [['Montserrat', 1, 1], ['Lobster', 0, 0], ['PT Serif', 1, 0], ['Great Vibes', 0, 0]]) { await useFont({ ...textOpt, f, b: !!b, i: !!i }); r.push(f + (b ? ' жирный' : '') + (i ? ' курсив' : '')) } return r.join(', ') })()`);
ok('шрифты изнутри программы, без интернета', !String(fonts).startsWith('ОШИБКА'), fonts);
ok('модуль текста изнутри программы', await ev(`[...document.scripts].some(s => s.src.includes('vendor/libs/opentype.min.js'))`));
const txt = await ev(`(async () => { const t = { ...textOpt, f: 'Montserrat', b: true, t: 'Вывеска AV', m: [1, 0, 0, 1, 20, 150] }; await useFont(t); const o = newPath('Текст'); o.fill = '#000'; o.txt = t; S.objects.push(o); regenText(o); commit('Новый текст'); render(); return o.sp.length })()`);
ok('надпись без интернета — буквы кривыми', txt > 5, txt + ' контуров');
const bo = await ev(`(async () => { sel = ['r1', 'r2']; await boolOp('sub'); return S.objects.length + ' объекта, узлов у результата ' + byId('r1').sp[0].n.length })()`);
ok('«Вычесть» без интернета (paper.js изнутри)', String(bo).startsWith('2 объекта') && await ev(`[...document.scripts].some(s => s.src.includes('vendor/libs/paper-core.min.js'))`), bo);
await sleep(600); ok('точка «есть изменения» в заголовке', (await ev(`document.title`)).startsWith('● '), await ev(`document.title`));
rmSync(OUT, { force: true }); await ev(`projectPath = ${JSON.stringify(OUT)}; saveProject(false)`); await sleep(500);
const saved = existsSync(OUT) && JSON.parse(readFileSync(OUT, 'utf8'));
ok('«Сохранить» — прямо в файл', saved && saved.app === 'Kontur' && saved.objects.length === 2 && !(await ev(`dirty`)), existsSync(OUT) ? Math.round(statSync(OUT).size / 1024) + ' КБ' : 'файла нет');
await sleep(600); ok('после сохранения точки нет', !(await ev(`document.title`)).startsWith('● '), await ev(`document.title`));
const t0 = statSync(OUT).mtimeMs; await ev(`act('rotR')`); await sleep(1100); await ev(`saveProject(false)`); await sleep(500);
ok('⌘S — на то же место, без вопросов', statSync(OUT).mtimeMs > t0 && !(await ev(`dirty`)));
ok('«Скопировать» из меню «Правка»', await ev(`clip = null; sel = S.objects.map(o => o.id); document.body.dispatchEvent(new ClipboardEvent('copy', { bubbles: true, cancelable: true })); !!clip && clip.length === 2`));
ok('мостик не отдаёт чужие файлы', (await ev(`fmNative.vendor('../../main.js').then(b => b === null)`)) && (await ev(`fmNative.vendor('fonts/lobster-latin-400-normal.woff').then(b => b && b.length > 1000)`)));
const ai = await ev(`(async () => { const n0 = S.objects.length; await importFiles([new File([buildPDF()], 'проба.ai')]); return (S.objects.length - n0) + ' · ' + document.querySelector('#toast').textContent })()`);
ok('файл Illustrator (.ai) — кривыми, без интернета', /Открыто кривыми/.test(ai) && await ev(`[...document.scripts].some(s => s.src.includes('vendor/libs/pdf.min.js'))`), ai);
const ca = await ev(`(async () => { const vis = getComputedStyle(document.querySelector('#calcBtn')).display !== 'none'; sel = []; Object.assign(CA, { mode: 'roll', rw: 600, n: 3, mg: 10, gap: 3, rot: '90', nest: true, pf: 450, pfu: 'm2', pc: 35 }); openCalc();
  for (let i = 0; i < 100 && (caBusy || !caRes); i++) await new Promise(r => setTimeout(r, 100)); const t = document.querySelector('#caRes .tot'); const r = { vis, n: caRes && caRes.res.length, all: caObjs.length * 3, t: t && t.textContent }; closeCalc(); return r })()`);
ok('«Расчёт плёнки»: кнопка есть, раскладка и стоимость', ca && ca.vis && ca.n > 0 && ca.n === ca.all && !!ca.t, ca && `${ca.n} из ${ca.all} деталей, итого ${ca.t}`);
const off = await ev(`(async () => { const r = S.objects.find(o => o.type === 'path' && !o.txt); sel = [r.id]; Object.assign(CA, { tab: '2', off: 2, offIn: false, offAll: true, offFill: false, offJ: 'round' }); openCalc(); const n0 = S.objects.length; await caOffset();
  const o = S.objects.find(o => o.name.startsWith('Контур +')); const ok = !!o && S.objects.length === n0 + 1 && [...document.scripts].some(s => s.src.includes('vendor/libs/clipper.js')); if (o) undo(); return ok })()`);
ok('«Контур с отступом» без интернета (Clipper изнутри)', off === true);
const arch = await ev(`fmNative.arch`); ok('процессор и установщик для обновления', !!arch, arch + ' → Kontur-mac-' + (arch === 'arm64' ? 'apple' : 'intel') + '.dmg');
ws.close(); proc.kill(); await sleep(400); rmSync(TMP, { recursive: true, force: true });
const errs = logs.split('\n').filter(l => /error|ошибк/i.test(l) && !/DevTools|GPU process|gles|Gpu|DevToolsActivePort/i.test(l));
ok('журнал программы без ошибок', !errs.length, errs.slice(0, 5).join(' | '));
console.log(fails ? `\nОШИБОК: ${fails}` : '\nВСЁ ОК');
process.exit(0);
