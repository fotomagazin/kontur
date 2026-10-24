// Проверка окна «Расчёт плёнки» (замеры, раскладка, тираж, стоимость): node tools/test-calc.mjs "$PWD/web/kontur.html"
// В браузере кнопки «Расчёт» нет (она только в программах для Mac и Windows) — окно открывается напрямую, через openCalc().
import { open, sleep } from './cdp.mjs';
const b = await open({ w: 1440, h: 900 }); const E = x => b.ev(x), SH = n => b.shot(`${process.env.SP}/shots/calc-${n}.png`);
let bad = 0; const ok = (c, m) => { console.log((c ? 'ок  ' : 'ОШИБКА ') + m); if (!c) bad++; };
const near = (a, b, d) => Math.abs(a - b) <= d;
await b.go('file://' + process.argv[2]); await sleep(500);
ok(await E(`getComputedStyle(document.querySelector('#calcBtn')).display==='none'`), 'в браузерной версии кнопки «Расчёт» нет');

// фигуры: прямоугольник 100×50, кольцо (круг R50 с дыркой R30), квадрат 20×20
await E(`(()=>{const add=(nm,sp)=>{const o=newPath(nm);o.sp=sp;o.fill='#000';o.stroke=null;S.objects.push(o);return o};
 add('Прямоугольник',[{c:true,n:shapeNodes('rect',10,10,100,50)}]);
 add('Кольцо',[{c:true,n:shapeNodes('ellipse',10,80,100,100)},{c:true,n:shapeNodes('ellipse',30,100,60,60)}]);
 add('Квадрат',[{c:true,n:shapeNodes('rect',130,10,20,20)}]);commit('фигуры');render();panel()})()`);
await E(`localStorage.removeItem('kt-calc');Object.assign(CA,{mode:'roll',rw:1220,dir:'h',mg:10,gap:3,n:1,rot:'90',nest:true,u:'mm',pf:0,pfu:'m2',pc:0})`);

// 1. замеры одного прямоугольника
await E(`sel=[S.objects[0].id];openCalc()`); await sleep(2200);
let m = await E(`({...caMs[0]})`);
ok(near(m.per, 300, .01) && near(m.net, 5000, .01) && near(m.out, 5000, .01) && m.hole < .01, `прямоугольник 100×50: длина ${m.per.toFixed(2)} (300), площадь ${m.net.toFixed(1)} (5000)`);
await E(`closeCalc()`);
// 2. кольцо: площадь с дыркой
await E(`sel=[S.objects[1].id];openCalc()`); await sleep(2200);
m = await E(`({...caMs[0]})`);
const ringNet = Math.PI * (2500 - 900), ringOut = Math.PI * 2500, ringPer = 2 * Math.PI * 80;
ok(near(m.net, ringNet, ringNet * .002) && near(m.out, ringOut, ringOut * .002) && near(m.hole, Math.PI * 900, 10), `кольцо: площадь ${m.net.toFixed(0)} (${ringNet.toFixed(0)}), внешняя ${m.out.toFixed(0)}, дырка ${m.hole.toFixed(0)}`);
ok(near(m.per, ringPer, ringPer * .003), `кольцо: длина реза ${m.per.toFixed(1)} (${ringPer.toFixed(1)} — оба круга)`);
await E(`closeCalc()`);

// 3. всё, тираж 5, рулон 300 мм (чтобы шло в несколько рядов), стоимость
await E(`sel=[];Object.assign(CA,{rw:300,n:5,pf:500,pfu:'m2',pc:40,u:'m'});openCalc()`); await sleep(2600);
let r = await E(`({busy:caBusy,n:caRes.res.length,fail:caRes.fail.length,len:caRes.len,meas:document.querySelector('#caMeas').innerText,res:document.querySelector('#caRes').innerText,go:!document.querySelector('#caGo').disabled})`);
ok(!r.busy && r.n === 15 && r.fail === 0 && r.go, `тираж 5 × 3 детали на рулоне 300 мм: разложено ${r.n}, длина ${r.len.toFixed(0)} мм`);
ok(/× 5 шт/.test(r.meas) && /Итого/.test(r.res), 'в замерах колонка «× 5 шт.», в итоге есть стоимость');
console.log(r.res.replace(/\n/g, ' | '));
await SH('roll');
// стоимость вручную: площадь куска × 500 + длина реза (м) × 40
const cost = await E(`(()=>{const D=caDoc(caRes),per=caMs.reduce((a,m)=>a+m.per,0)*5;return{exp:D.w*D.h/1e6*500+per/1000*40,txt:document.querySelector('#caRes .tot').textContent}})()`);
ok(near(parseFloat(cost.txt.replace(/\s/g, '').replace(',', '.')), cost.exp, .02), `итог ${cost.txt} = ${cost.exp.toFixed(2)} ₽`);

// 4. применить и проверить: детали не пересекаются, зазор ≥ 3 мм, отступ ≥ 10 мм, страница = кусок плёнки
const sg0 = await E(`S.objects.map(o=>Math.sign(polyA(flatSp(o.sp[0]).p))).join()`);
await E(`caApply()`); await sleep(300);
ok(await E(`S.objects.slice(0,3).map(o=>Math.sign(polyA(flatSp(o.sp[0]).p))).join()`) === sg0, 'детали не зеркалятся (рулон вправо)');
r = await E(`(()=>{const ps=S.objects.map(o=>o.sp.map(flatSp).flatMap(s=>s.p));let md=1e9;
 for(let i=0;i<ps.length;i++)for(let j=i+1;j<ps.length;j++){const A=ps[i],B=ps[j];for(const a of A)for(const b of B){const d=Math.hypot(a.x-b.x,a.y-b.y);if(d<md)md=d}}
 const B=boxOf2(S.objects);return{n:S.objects.length,md,B,pw:S.page.w,ph:S.page.h,hist:hn[hi]}})()`);
ok(r.n === 15 && r.hist === 'Раскладка на плёнке', `на странице ${r.n} деталей, шаг истории «${r.hist}»`);
ok(r.md >= 3 - .05, `наименьшее расстояние между деталями ${r.md.toFixed(2)} мм (≥ 3)`);
ok(r.B.x <= 10.5 && r.B.y <= 10.5, `раскладка начинается в верхнем левом углу: ${r.B.x.toFixed(1)}, ${r.B.y.toFixed(1)}`);
ok(near(r.ph, 300, .01) && r.B.y >= 10 - .05 && r.B.y + r.B.h <= 290 + .05 && r.B.x >= 10 - .05 && r.B.x + r.B.w <= r.pw - 10 + .05, `страница ${r.pw.toFixed(0)} × ${r.ph} мм (рулон вправо), детали внутри отступа 10 мм`);
await SH('applied');
await E(`undo()`); ok(await E(`S.objects.length===3&&S.page.w===210`), 'Ctrl+Z возвращает как было');

// 5. вложения: квадраты встают внутрь кольца
await E(`sel=[S.objects[1].id,S.objects[2].id];Object.assign(CA,{rw:118,n:3,nest:true,mg:5,gap:2});openCalc()`); await sleep(2500);
const inRing = await E(`(()=>{let k=0;const R=caRes;const ring=R.res.find(p=>p.it.o.name.startsWith('Кольцо'));const o=clone(ring.it.o);mapObj(o,caF(ring,R.cfg));const B=objBox(o),c={x:B.x+B.w/2,y:B.y+B.h/2};
 for(const p of R.res){if(!p.it.o.name.startsWith('Квадрат'))continue;const q=clone(p.it.o);mapObj(q,caF(p,R.cfg));const b=objBox(q);if(Math.hypot(b.x+b.w/2-c.x,b.y+b.h/2-c.y)<30)k++}return{k,len:R.len}})()`);
ok(inRing.k >= 1, `с «вложениями» квадратов внутри кольца: ${inRing.k}`);
await SH('nest');
await E(`document.querySelector('#caNest').click()`); await sleep(2500);
const noNest = await E(`caRes.len`);
ok(noNest >= inRing.len, `без вложений плёнки уходит не меньше: ${noNest.toFixed(0)} мм против ${inRing.len.toFixed(0)} мм`);
await E(`closeCalc()`);

// 6. листы: 6 колец на листе 250×250 — должно выйти несколько листов
await E(`sel=[S.objects[1].id];Object.assign(CA,{mode:'sheet',sw:250,sh:250,dir:'v',n:6,mg:5,gap:3,nest:true});openCalc()`); await sleep(2500);
r = await E(`({s:caRes.sheets,n:caRes.res.length,txt:document.querySelector('#caRes').innerText})`);
ok(r.s >= 2 && r.n === 6, `лист 250×250, 6 колец: листов ${r.s}, разложено ${r.n}`);
await SH('sheets');
await E(`caApply()`); await sleep(300);
r = await E(`({w:S.page.w,h:S.page.h,g:(S.page.g||[]).length})`);
ok(r.w === 250 && r.h === 250 * Math.ceil(r.h / 250) && r.g >= 1, `страница ${r.w} × ${r.h}, направляющих на границах листов: ${r.g}`);
await E(`undo()`);

// 7. деталь шире рулона
await E(`sel=[S.objects[0].id];Object.assign(CA,{mode:'roll',rw:60,n:1,mg:5,rot:'0'});openCalc()`); await sleep(1500);
r = await E(`({fail:caRes.fail.length,go:document.querySelector('#caGo').disabled,prev:document.querySelector('#caPrev').innerText})`);
ok(r.fail === 1 && r.go, `деталь шире рулона: «не помещается», кнопка «Разложить» выключена (${r.prev.slice(0, 40)}…)`);
await E(`closeCalc()`);

// 8. скорость: 40 разных звёзд × тираж 10 = 400 деталей на рулоне 1220, любой угол
await E(`(()=>{S.objects=[];for(let i=0;i<40;i++){opts.sides=5+i%4;const o=newPath('Звезда');const s=20+i*3;o.sp=[{c:true,n:shapeNodes('star',0,0,s,s*(.6+(i%5)/5))}];o.fill='#000';S.objects.push(o)}commit('звёзды');render();sel=[]})()`);
await E(`Object.assign(CA,{rw:1220,n:10,mg:10,gap:3,rot:'15',nest:true})`);
const t0 = Date.now(); await E(`openCalc()`);
for (let i = 0; i < 200 && await E(`caBusy`); i++) await sleep(200);
r = await E(`({n:caRes.res.length,len:caRes.len,busy:caBusy})`);
ok(!r.busy && r.n === 400, `400 деталей, любой угол: ${((Date.now() - t0) / 1000).toFixed(1)} с, плёнки ${r.len.toFixed(0)} мм`);
await SH('stars');
await E(`caLayout(true)`); await sleep(9000);
const r2 = await E(`({len:caRes.len,st:document.querySelector('#caState').textContent})`);
ok(r2.len <= r.len, `«Искать плотнее»: ${r2.len.toFixed(0)} мм (было ${r.len.toFixed(0)}) — ${r2.st}`);
await E(`closeCalc()`);


// ---------- время, врезки, смета, выборка (вкладка «Расчёт и раскладка») ----------
const shapes = `S={page:{w:210,h:297},objects:[]};(()=>{const add=(nm,sp)=>{const o=newPath(nm);o.sp=sp;o.fill='#000';o.stroke=null;S.objects.push(o);return o};
 add('Прямоугольник',[{c:true,n:shapeNodes('rect',10,10,100,50)}]);add('Кольцо',[{c:true,n:shapeNodes('ellipse',10,80,100,100)},{c:true,n:shapeNodes('ellipse',30,100,60,60)}]);
 add('Квадрат',[{c:true,n:shapeNodes('rect',130,10,20,20)}]);sel=[];commit('фигуры');render()})()`;
await E(shapes);
await E(`localStorage.removeItem('kt-calc');Object.assign(CA,{mode:'roll',rw:200,dir:'h',mg:10,gap:3,n:2,rot:'0',nest:false,u:'m',pf:500,pfu:'m2',pc:40,pp:2,ph:600,mk:10,min:0,v:40,tp:.5,weed:'none',tab:'1'});openCalc()`);
for (let i = 0; i < 50 && await E('caBusy'); i++) await sleep(100);
r = await E(`(()=>{const t=document.querySelector('#caRes').innerText;return{t,meas:document.querySelector('#caMeas').innerText}})()`);
ok(/Врезок\s*8/.test(r.t) && /Время резки\s*≈/.test(r.t) && /Наценка 10 %/.test(r.t) && /Работа плоттера/.test(r.t), 'врезки 8 (4 контура × 2), время резки, работа плоттера, наценка');
console.log(r.t.replace(/\n/g, ' | '));
await E(`$('#caMin').value=100000;caChanged()`); await sleep(100);
ok(/100\s000 ₽/.test(await E(`document.querySelector('#caRes .tot').textContent`)) && /минимума/.test(await E(`document.querySelector('#caRes').innerText`)), 'минимум заказа: итог поднят до 100 000 ₽');
await E(`closeCalc();sel=[S.objects[2].id];Object.assign(CA,{min:0,n:10,weed:'grid'});openCalc()`); for (let i = 0; i < 50 && await E('caBusy'); i++) await sleep(100);
ok(/с выборкой/.test(await E(`document.querySelector('#caRes').innerText`)), 'выборка включена — длина реза «с выборкой»');
await SH('weed-prev');
await E(`caApply()`); await sleep(200);
r = await E(`(()=>{const w=S.objects.find(o=>o.name.startsWith('Выборка'));const sq=S.objects.filter(o=>o.name.startsWith('Квадрат')),parts=sq.map(objBox),F=w&&w.sp[0].n;
 const hit=w?w.sp.slice(1).filter(s=>{const[a,b]=s.n;return parts.some(B=>{const x0=Math.min(a.x,b.x),x1=Math.max(a.x,b.x),y0=Math.min(a.y,b.y),y1=Math.max(a.y,b.y);return x0<B.x+B.w&&x1>B.x&&y0<B.y+B.h&&y1>B.y})}).length:-1;
 const fb=w&&objBox({type:'path',sp:[w.sp[0]]}),all=boxOf2(sq);return{w:!!w,lines:w?w.sp.length-1:0,hit,inside:fb&&inside(all,fb)}})()`);
ok(r.w && r.lines >= 1 && r.hit === 0 && r.inside, `выборка: рамка вокруг всех деталей, линий ${r.lines}, ни одна не задевает детали`);
await SH('weed-applied'); await E(`undo()`);

// ---------- вкладка «Подготовка к резке» ----------
// контур с отступом: кольцо R50 с дыркой R30, наружу 2 мм → R52 и дырка R28
await E(shapes); await E(`sel=[S.objects[1].id];Object.assign(CA,{tab:'2',off:2,offIn:false,offJ:'round',offAll:true,offFill:false});openCalc()`); await sleep(300);
await SH('tab2');
await E(`caOffset()`); for (let i = 0; i < 40 && await E(`!S.objects.some(o=>o.name.startsWith('Контур'))`); i++) await sleep(150);
r = await E(`(()=>{const o=S.objects.find(o=>o.name.startsWith('Контур'));if(!o)return null;const bs=o.sp.map(s=>objBox({type:'path',sp:[s]})).sort((a,b)=>b.w-a.w);return{n:o.sp.length,w0:bs[0].w,w1:bs[1]&&bs[1].w,i:S.objects.indexOf(o),hist:hn[hi]}})()`);
ok(r && r.n === 2 && near(r.w0, 104, .05) && near(r.w1, 56, .05) && r.i === 1, `контур +2 мм: наружный ${r && r.w0.toFixed(2)} (104), дырка ${r && r.w1 && r.w1.toFixed(2)} (56), лежит под кольцом`);
await E(`undo()`); await E(`sel=[S.objects[1].id];Object.assign(CA,{offIn:true,offFill:true,offJ:'miter'});openCalc();caOffset()`); for (let i = 0; i < 40 && await E(`!S.objects.some(o=>o.name.startsWith('Контур'))`); i++) await sleep(150);
r = await E(`(()=>{const o=S.objects.find(o=>o.name.startsWith('Контур'));return o&&{n:o.sp.length,w:objBox(o).w}})()`);
ok(r && r.n === 1 && near(r.w, 96, .05), `внутрь 2 мм, без дырок: один контур шириной ${r && r.w.toFixed(2)} (96)`);
await E(`undo()`);
// рамка и линии выборки вокруг выделенного
await E(`sel=[];Object.assign(CA,{wOff:3,wMode:'grid'});openCalc();caWeed()`);
r = await E(`(()=>{const w=S.objects.find(o=>o.name.startsWith('Выборка'));return w&&{n:w.sp.length,fr:objBox({type:'path',sp:[w.sp[0]]}),all:boxOf2(S.objects.filter(o=>o!==w))}})()`);
ok(r && near(r.fr.x, r.all.x - 3, .01) && near(r.fr.w, r.all.w + 6, .01) && r.n >= 2, `рамка с отступом 3 мм и ${r && r.n - 1} линий`);
await E(`undo()`);
// тираж заполнением: квадрат 20 на A4, отступ 5, зазор 3 → 8 × 12 = 96
await E(`sel=[S.objects[2].id];Object.assign(CA,{fN:0,fGap:3,fMg:5,fChess:false,fShare:false});openCalc();caFillPage()`);
r = await E(`({n:S.objects.filter(o=>o.name.startsWith('Квадрат')).length,h:S.page.h})`);
ok(r.n === 96 && r.h === 297, `заполнение A4 квадратами 20 мм: ${r.n} (96)`);
await E(`undo()`); await E(`sel=[S.objects[2].id];Object.assign(CA,{fN:100});openCalc();caFillPage()`);
r = await E(`({n:S.objects.filter(o=>o.name.startsWith('Квадрат')).length,h:S.page.h})`);
ok(r.n === 100 && near(r.h, 306, .01), `100 штук: страница удлинилась до ${r.h} мм (306)`);
await E(`undo()`); await E(`sel=[S.objects[2].id];Object.assign(CA,{fN:0,fChess:true});openCalc();caFillPage()`);
r = await E(`(()=>{const q=S.objects.filter(o=>o.name.startsWith('Квадрат')).map(objBox);const xs0=q.filter(b=>near(b.y,5)).map(b=>b.x),xs1=q.filter(b=>near(b.y,28)).map(b=>b.x);function near(a,b){return Math.abs(a-b)<.01}return{a:Math.min(...xs0),b:Math.min(...xs1),n:q.length}})()`);
ok(near(r.b - r.a, 11.5, .01), `шахматка: второй ряд сдвинут на ${(r.b - r.a).toFixed(1)} мм (полкопии), всего ${r.n}`);
await E(`undo()`);
// общий рез: прямоугольник 100×50 → 2 × 5 = 10 наклеек, 6 горизонтальных + 3 вертикальные линии, длина 1950 вместо 3000
await E(`sel=[S.objects[0].id];Object.assign(CA,{fN:0,fChess:false,fShare:true,fMg:5});openCalc();caFillPage()`);
r = await E(`(()=>{const o=S.objects.find(o=>o.name.startsWith('Прямоугольный'));return o&&{n:o.sp.length,len:measure(o).per,rect:S.objects.some(x=>x.name.startsWith('Прямоугольник'))}})()`);
ok(r && r.n === 9 && near(r.len, 1950, .01) && !r.rect, `общий рез: ${r && r.n} линий, длина реза ${r && r.len} мм вместо 3000`);
await E(`undo()`);
// чистка: квадрат из 4 отдельных отрезков (один с лишним узлом посередине) + копия кольца
await E(`(()=>{const L=(pts)=>{const o=newPath('Отрезок');o.fill=null;o.sp=[{c:false,n:pts.map(p=>mkN({x:p[0],y:p[1]}))}];S.objects.push(o)};
 L([[150,150],[175,150],[200,150]]);L([[200,150],[200,200]]);L([[150,200],[200,200]]);L([[150,200],[150,150]]);
 const c=clone(S.objects[1]);c.id=nid();S.objects.push(c);sel=[];commit('мусор');render()})()`);
await E(`Object.assign(CA,{tab:'2'});openCalc();caCleanFind()`);
const rep = await E(`document.querySelector('#caCleanRep').innerText`);
ok(/одинаковых объектов/.test(rep) && /разорванных стыков/.test(rep) && /лишних узлов/.test(rep), 'проверка нашла: ' + rep);
await SH('clean');
await E(`caCleanGo()`);
r = await E(`(()=>{const sq=S.objects.filter(o=>o.name.startsWith('Отрезок'));const rings=S.objects.filter(o=>o.name.startsWith('Кольцо'));return{sq:sq.length,closed:sq[0]&&sq[0].sp.length===1&&sq[0].sp[0].c,nodes:sq[0]&&sq[0].sp[0].n.length,rings:rings.length,hist:hn[hi]}})()`);
ok(r.sq === 1 && r.closed && r.nodes === 4 && r.rings === 1 && r.hist === 'Чистка макета', `после чистки: квадрат — один замкнутый контур из ${r.nodes} узлов, копия кольца удалена`);
await E(`undo()`); ok(await E(`S.objects.length`) === 8, 'Ctrl+Z возвращает мусор');
console.log(b.logs.join('\n') || 'консоль чистая');
console.log(bad ? `ОШИБОК: ${bad}` : 'ВСЁ ОК', '· снимки:', process.env.SP + '/shots');
b.close(); process.exit(bad ? 1 : 0);
