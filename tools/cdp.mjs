// Мини-обвязка над Chrome DevTools Protocol (headless Chrome) для проверок Контура.
// Временные файлы (профиль, скачанное, скриншоты) — в папке из переменной SP, иначе во временной папке системы.
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
if (!process.env.SP) process.env.SP = mkdtempSync(tmpdir() + '/kontur-test-');
mkdirSync(process.env.SP + '/shots', { recursive: true });
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export async function open({ port = 9444, w = 1440, h = 900, dpr = 1 } = {}) {
  const prof = mkdtempSync(process.env.SP + '/prof-');
  // порт выбирает сам Chrome (0) и пишет его в DevToolsActivePort — так не подключимся к чужому/старому Chrome
  const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${prof}`, '--hide-scrollbars', '--force-color-profile=srgb', `--window-size=${w},${h}`, 'about:blank'], { stdio: 'ignore' });
  const kill = () => { try { chrome.kill('SIGKILL'); } catch { } };
  process.on('exit', kill); process.on('uncaughtException', e => { console.error(e); kill(); process.exit(1); }); process.on('unhandledRejection', e => { console.error(e); kill(); process.exit(1); });
  let target;
  for (let i = 0; i < 80 && !target; i++) { try { port = +readFileSync(prof + '/DevToolsActivePort', 'utf8').split('\n')[0]; const l = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); target = l.find(t => t.type === 'page'); } catch { } if (!target) await sleep(250); }
  const ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pend = new Map(), logs = [];
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { const { ok, no } = pend.get(d.id); pend.delete(d.id); d.error ? no(Error(JSON.stringify(d.error))) : ok(d.result); }
    else if (d.method === 'Runtime.exceptionThrown') logs.push('EXC ' + JSON.stringify(d.params.exceptionDetails).slice(0, 600));
    else if (d.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(d.params.type)) logs.push(d.params.type + ' ' + d.params.args.map(a => a.value ?? a.description).join(' '));
    else if (d.method === 'Page.javascriptDialogOpening') { send('Page.handleJavaScriptDialog', { accept: true, promptText: d.params.defaultPrompt || '' }); logs.push('dialog ' + d.params.type + ': ' + d.params.message); } };
  const send = (method, params = {}) => new Promise((ok, no) => { const i = ++id; pend.set(i, { ok, no }); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dpr, mobile: false });
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: process.env.SP + '/dl', eventsEnabled: true }).catch(() => {});
  const api = {
    send, logs,
    async size(w, h) { await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dpr, mobile: false }); await sleep(200); },
    async go(url) { await send('Page.navigate', { url }); await sleep(900); },
    async ev(expr) { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails).slice(0, 800)); return r.result.value; },
    async shot(file, clip) { const r = await send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip: { ...clip, scale: 1 } } : {}) }); writeFileSync(file, Buffer.from(r.data, 'base64')); },
    async mouse(type, x, y, o = {}) { await send('Input.dispatchMouseEvent', { type, x, y, button: o.button || 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: o.count || 1, modifiers: o.mod || 0 }); },
    async drag(x0, y0, x1, y1, o = {}) { await api.mouse('mouseMoved', x0, y0); await api.mouse('mousePressed', x0, y0, o); const n = o.steps || 8; for (let i = 1; i <= n; i++) await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0 + (x1 - x0) * i / n, y: y0 + (y1 - y0) * i / n, button: 'left', buttons: 1, modifiers: o.mod || 0 }); await api.mouse('mouseReleased', x1, y1, o); await sleep(60); },
    async click(x, y, o = {}) { await api.mouse('mouseMoved', x, y); await api.mouse('mousePressed', x, y, o); await api.mouse('mouseReleased', x, y, o); await sleep(60); },
    async key(key, o = {}) { const code = o.code || (key.length === 1 ? 'Key' + key.toUpperCase() : key); await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, modifiers: o.mod || 0, windowsVirtualKeyCode: o.vk || 0, text: o.text }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, modifiers: o.mod || 0 }); await sleep(40); },
    close() { try { ws.close(); } catch { } kill(); }
  };
  return api;
}
