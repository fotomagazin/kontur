// Проверка верхней панели на разной ширине окна: всё ли помещается. node tools/topbar.mjs "$PWD/web/kontur.html" [new — с кнопкой «Новая версия»]
import { open, sleep } from './cdp.mjs';
const b = await open({ port: 9491, w: 1440, h: 800 }); await b.go('file://' + process.argv[2]); await sleep(500);
await b.ev(`(async()=>{AS.time=0;$('#asState').textContent='Автосохранено 19:27';if(${JSON.stringify(process.argv[3]==='new')}){UPD.r={tag:'v0.12.0'};UPD.state='done';renderUpd()}})()`);
for (const w of [1920, 1700, 1600, 1500, 1440, 1366, 1280, 1200, 1100, 1000, 900]) { await b.size(w, 800); await sleep(150);
  const r = await b.ev(`(()=>{const t=document.querySelector('#top');const last=[...t.children].filter(e=>e.offsetParent).pop().getBoundingClientRect();return {over:t.scrollWidth>t.clientWidth,right:Math.round(last.right),w:innerWidth}})()`);
  console.log(w, r.over ? 'НЕ ВЛЕЗАЕТ' : 'ok', r.right); if (w === 1440 || w === 1000 || w === 1280) await b.shot(`${process.env.SP}/shots/top-${w}.png`, { x: 0, y: 0, width: w, height: 50 }); }
console.log(process.env.SP); b.close(); process.exit(0);
