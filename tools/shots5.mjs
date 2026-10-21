// Скриншоты новых окон (автосохранение, история, экспорт, версия, обратная связь): node tools/shots5.mjs "$PWD/kontur.html"
import { open, sleep } from './cdp.mjs';
const b = await open({ port: 9490, w: 1440, h: 900 }); const E = x => b.ev(x), SH = n => b.shot(`${process.env.SP}/shots/f-${n}.png`);
await b.go('file://' + process.argv[2]); await sleep(600);
await E(`window.fetch=async(u,o)=>{window.__f=(window.__f||[]);window.__f.push([u,o&&o.body]);return /releases/.test(u)?new Response('{}',{status:404}):new Response('{"ok":true}',{status:200})}`);
await SH('empty');
await E(`(()=>{const mk=(t,x,y,w,h,f,s)=>{const o=newPath(t);o.sp=[{c:true,n:shapeNodes(t,x,y,w,h)}];o.fill=f;o.stroke=s;S.objects.push(o);commit('Новая фигура «'+o.name+'»');return o};
 mk('rect',30,40,80,50,'#1e88e5','#0d47a1');mk('star',110,120,70,70,'#fdd835','#f57f17');mk('ellipse',40,150,60,90,'#e53935',null);sel=[S.objects[1].id];render();panel();fit()})()`);
await sleep(300); await E(`document.querySelector('#histBtn').click()`); await sleep(200); await SH('hist');
await E(`closeMenus();openExport()`); await sleep(800); await SH('export-pdf');
await E(`document.querySelector('#exFmt [data-f=png]').click()`); await sleep(1200); await SH('export-png');
await E(`closeExport();checkUpdate(true)`); await sleep(1200); await E(`popup('updMenu')`); await sleep(200); await SH('upd');
await E(`closeMenus();popup('fbMenu')`); await sleep(200); await SH('fbmenu');
await E(`closeMenus();openFb('idea')`); await sleep(200); await SH('fb');
await sleep(4500); console.log('автосохранение:', await E(`kv('get','autosave').then(a=>a&&a.n)`), await E(`document.querySelector('#asState').textContent`));
console.log(b.logs.join('\n') || 'консоль чистая'); b.close(); process.exit(0);
