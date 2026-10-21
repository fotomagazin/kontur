// Совместимость: проект, собранный и сохранённый СТАРОЙ версией, открывается в НОВОЙ без изменений, и экспорт совпадает байт-в-байт.
// Запуск из папки 04_Контур:
//   node tools/compat.mjs <путь к старой версии kontur.html> "$PWD/kontur.html"
//   (исходный прототип от 05.10.2026 хранится локально: git --git-dir=archive/история-до-публикации.git show b84df30:kontur.html)
import { open, sleep } from './cdp.mjs';
import { readdirSync, readFileSync, rmSync, mkdirSync, renameSync } from 'node:fs';
const [, , OLD, NEW] = process.argv, DL = process.env.SP + '/dl';
async function run(file, port, proj, build) {
  rmSync(DL, { recursive: true, force: true }); mkdirSync(DL);
  const b = await open({ port, w: 1440, h: 900 }); await b.go('file://' + file); await sleep(400); const E = x => b.ev(x);
  if (build) await E(build);
  else if (!proj) await E(`(async()=>{
    const mk=(t,x,y,w,h,f,s)=>{const o=newPath(t);o.sp=[{c:true,n:shapeNodes(t,x,y,w,h)}];o.fill=f;o.stroke=s;o.sw=.5;S.objects.push(o);return o};
    mk('rect',20,20,60,40,'#1e88e5','#0d47a1');opts.sides=7;mk('star',100,20,60,60,'#fdd835',null);const e=mk('ellipse',30,90,50,70,null,'#e53935');e.op=.6;
    const c=document.createElement('canvas');c.width=300;c.height=200;const x=c.getContext('2d');x.fillStyle='#3a7';x.fillRect(0,0,300,200);x.fillStyle='#fff';x.fillRect(50,50,100,60);
    const bl=await new Promise(r=>c.toBlob(r,'image/png'));await importFiles([new File([bl],'фото.png',{type:'image/png'})]);
    const im=S.objects.find(o=>o.type==='image');im.f.br=130;im.rot=15;im.lock=true;im.op=.5;
    qrOpen(null);document.querySelector('#qrFields [data-f=u]').value='example.com/kontur';qrApply();
    S.objects[0].hid=true;S.objects[1].name='Звёздочка «тест»';commit();render();panel()})()`);
  else await E(`dirty=false;loadProject(new File([${JSON.stringify(proj)}],'старый.kontur'))`);
  await sleep(1500);
  await E('window.showSaveFilePicker=undefined');
  for (const f of ['exportSVG', 'exportPDF', 'exportEPS', 'exportDXF', 'exportPNG']) { await E(f + '()'); await sleep(f === 'exportPNG' ? 2500 : 500); }
  if (!proj || build) { await E('saveProject(false)'); await sleep(800); }
  const snap = await E('snap()');
  await b.shot(`${process.env.SP}/shots/compat-${proj ? 'new' : 'old'}.png`);
  const out = {}; for (const f of readdirSync(DL)) out[f.split('.').pop()] = readFileSync(DL + '/' + f);
  console.log(file.split('/').pop(), Object.entries(out).map(([k, v]) => k + ':' + v.length).join(' '), b.logs.filter(l => !l.includes('dpi')).join(' | '));
  b.close(); return { out, snap };
}
const A = await run(OLD, 9460), proj = A.out.kontur.toString('utf8');
const B = await run(NEW, 9461, proj);
console.log('проект из старой версии открылся без изменений:', A.snap === B.snap);
for (const k of ['svg', 'pdf', 'eps', 'dxf', 'png']) console.log(' ', k, A.out[k].equals(B.out[k]) ? 'байт-в-байт одинаково' : 'РАЗЛИЧАЕТСЯ ' + A.out[k].length + ' / ' + B.out[k].length);
// обратно: проект НОВОЙ версии (надписи, направляющие, результат «Вычесть») открывается в СТАРОЙ — надписи кривыми, экспорт одинаковый
const C = await run(NEW, 9462, null, `(async()=>{const t={...textOpt,f:'Montserrat',b:true,t:'Вывеска «Ёлка»\\nAV №1',al:'center',m:[1,0,0,1,105,60]};await useFont(t);const o=newPath('Текст');o.fill='#123';o.txt=t;S.objects.push(o);regenText(o);
  const mk=(k,x,y,w,h)=>{const q=newPath('Ф');q.sp=[{c:true,n:shapeNodes(k,x,y,w,h)}];q.fill='#c33';S.objects.push(q);return q};const a=mk('rect',30,150,60,40),c=mk('ellipse',60,160,40,40);sel=[a.id,c.id];await boolOp('sub');
  S.page.g=[{v:true,p:105}];commit('тест');render()})()`);
const D = await run(OLD, 9463, C.out.kontur.toString('utf8'));
const strip = j => JSON.stringify(JSON.parse(j).objects.map(o => { const c = { ...o }; delete c.txt; return c; }));
console.log('проект новой версии в старой: объекты (без «памятки» текста) совпали:', strip(C.snap) === strip(D.snap), '· надпись видна кривыми:', JSON.parse(D.snap).objects[0].sp.length, 'контуров');
for (const k of ['svg', 'pdf', 'eps', 'dxf', 'png']) console.log(' ', k, C.out[k].equals(D.out[k]) ? 'байт-в-байт одинаково' : 'РАЗЛИЧАЕТСЯ ' + C.out[k].length + ' / ' + D.out[k].length);
process.exit(0);
