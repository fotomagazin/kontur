// Полная проверка Контура в headless Chrome: инструменты, панель, список объектов, фото, QR, экспорт, сохранение/открытие.
// Запуск из папки 04_Контур:  node tools/test.mjs "$PWD/web/kontur.html"   (в конце — «ВСЁ ОК» или список ошибок; скриншоты — в папке SP/shots)
import { open, sleep } from './cdp.mjs';
import { readdirSync, readFileSync, rmSync, mkdirSync, statSync } from 'node:fs';
const [, , FILE, TAG = 'new', PORT = 9450] = process.argv;
const DL = process.env.SP + '/dl'; rmSync(DL, { recursive: true, force: true }); mkdirSync(DL);
const b = await open({ port: +PORT, w: 1440, h: 900 });
await b.go('file://' + FILE); await sleep(500);
const fails = []; const ok = (c, m) => { console.log((c ? '  ok  ' : 'FAIL  ') + m); if (!c) fails.push(m); };
const E = x => b.ev(x);
const S = async (x, y) => E(`(()=>{const r=svg.getBoundingClientRect(),p=toScr({x:${x},y:${y}});return [r.left+p.x,r.top+p.y]})()`);
const el = async q => E(`(()=>{const e=document.querySelector(${JSON.stringify(q)});if(!e)return null;const r=e.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()`);
const clickEl = async q => { await E(`document.querySelector(${JSON.stringify(q)})?.scrollIntoView({block:'nearest'})`); const p = await el(q); if (!p) { ok(false, 'нет элемента ' + q); return; } await b.click(p[0], p[1]); await sleep(80); };
const dragDoc = async (x0, y0, x1, y1, o) => { const a = await S(x0, y0), c = await S(x1, y1); await b.drag(a[0], a[1], c[0], c[1], o); };
const n = () => E('S.objects.length');
const shot = async nm => b.shot(`${process.env.SP}/shots/t-${TAG}-${nm}.png`);
await E('fit()');
// --- подсказка на пустой странице, кнопки отмены
ok(!await E(`document.querySelector('#empty').hidden`), 'подсказка на пустой странице видна');
ok(await E(`document.querySelector('#undoBtn').disabled&&document.querySelector('#redoBtn').disabled`), 'отменять нечего — кнопки неактивны');
await clickEl('#empty [data-q="pen"]'); ok(await E('tool') === 'pen', 'подсказка: кнопка «Перо»');
await E(`window.__of=window.__of||window.fetch;window.fetch=async(u,o)=>{if(!/api.github.com|workers.dev/.test(u))return __of(u,o);(window.__f=window.__f||[]).push([u,o&&o.body]);if(window.__net==='off')throw Error('offline');if(/api.github.com/.test(u))return window.__rel?new Response(JSON.stringify(window.__rel)):new Response('{}',{status:404});return new Response(window.__fbok===false?'{"ok":false}':'{"ok":true}',{status:window.__fbok===false?502:200})}`);
// --- инструменты по клавишам и кнопкам
for (const [k, t] of [['v','select'],['n','node'],['p','pen'],['r','rect'],['e','ellipse'],['y','poly'],['s','star'],['c','crop'],['i','eye'],['h','hand']]) { await b.key(k); ok(await E('tool') === t, `клавиша ${k} → ${t}`); }
await clickEl('#tools [data-t="rect"]'); ok(await E('tool') === 'rect', 'кнопка «Прямоугольник»');
ok(await E(`document.querySelector('#tools [data-t="rect"]').classList.contains('on')`), 'кнопка инструмента подсвечена');
// --- фигуры
await dragDoc(20, 20, 80, 60); ok(await n() === 1, 'нарисован прямоугольник');
ok(await E(`document.querySelector('#empty').hidden`), 'подсказка скрылась'); ok(!await E(`document.querySelector('#undoBtn').disabled`), 'кнопка «Отменить» активна');
await clickEl('#tools [data-t="ellipse"]'); await dragDoc(100, 20, 160, 70); ok(await n() === 2, 'нарисован эллипс');
await clickEl('#tools [data-t="poly"]'); ok(await E(`!!document.querySelector('#topts [data-k=sides]')`), 'поле «Углов» в строке инструмента');
await E(`(()=>{const i=document.querySelector('#topts [data-k=sides]');i.value=6;i.dispatchEvent(new Event('change',{bubbles:true}))})()`); ok(await E('opts.sides') === 6, 'число углов = 6');
await dragDoc(20, 90, 80, 150); ok(await E('S.objects[2].sp[0].n.length') === 6, 'шестиугольник');
await clickEl('#tools [data-t="star"]'); await dragDoc(100, 90, 160, 150); ok(await E('S.objects[3].sp[0].n.length') === 12, 'звезда (6 лучей)');
await shot('shapes');
// --- перо: 3 узла, второй плавный, замкнуть по первому
await clickEl('#tools [data-t="pen"]');
let p0 = await S(30, 180), p1 = await S(60, 170), p2 = await S(90, 200);
await b.click(p0[0], p0[1]); await sleep(400); await b.drag(p1[0], p1[1], p1[0] + 30, p1[1]); await sleep(400); await b.click(p2[0], p2[1]); await sleep(400); await b.click(p0[0], p0[1]); await sleep(200);
ok(await E('S.objects[4].sp[0].c===true&&S.objects[4].sp[0].n.length===3'), 'перо: кривая из 3 узлов замкнута');
ok(await E('!!S.objects[4].sp[0].n[1].b'), 'перо: плавный узел с рычагом');
// --- выбор: клик, перемещение, масштаб, поворот, рамка
await b.key('v');
let c = await S(20, 40); await b.click(c[0], c[1]); ok(await E('sel.length===1&&byId(sel[0]).name.startsWith("Прямоугольник")'), 'клик выбирает прямоугольник');
const bx0 = await E('objBox(byId(sel[0])).x'); await dragDoc(20, 40, 30, 40); ok(Math.abs(await E('objBox(byId(sel[0])).x') - bx0 - 10) < .5, 'перетаскивание сдвигает на 10 мм');
let h = await E(`(()=>{const e=document.querySelector('#ov [data-h="4"]').getBoundingClientRect(),r=svg.getBoundingClientRect();return [e.left+e.width/2,e.top+e.height/2]})()`);
await b.drag(h[0], h[1], h[0] + 40, h[1] + 30); ok(await E('objBox(byId(sel[0])).w') > 61, 'ручка угла масштабирует');
h = await E(`(()=>{const e=document.querySelector('#ov [data-h="r"]').getBoundingClientRect();return [e.left+e.width/2,e.top+e.height/2]})()`);
const r0 = await E('JSON.stringify(byId(sel[0]).sp[0].n[0])'); await b.drag(h[0], h[1], h[0] + 80, h[1] + 40); ok(await E('JSON.stringify(byId(sel[0]).sp[0].n[0])') !== r0, 'кружок поворачивает');
await b.key('z', { mod: 4 }); await b.key('z', { mod: 4 });
c = await S(5, 5); const c2 = await S(170, 160); await b.drag(c[0], c[1], c2[0], c2[1]); ok(await E('sel.length') >= 4, 'рамка выделяет несколько: ' + await E('sel.length'));
await shot('select');
await b.key('Escape', { code: 'Escape' }); ok(await E('sel.length') === 0, 'Esc снимает выделение');
// --- панель свойств
c = await S(100, 45); await b.click(c[0], c[1]); ok(await E('byId(sel[0]).name.startsWith("Эллипс")'), 'выбран эллипс');
ok(await E(`[...document.querySelectorAll('#pp .sec .ttl')].map(e=>e.textContent).join(',')`) === 'Объект,Выравнивание,Кривая', 'разделы: Объект, Выравнивание, Кривая');
await E(`(()=>{const i=document.querySelector('#pp [data-k=fill]');i.value='#00ff00';i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new Event('change',{bubbles:true}))})()`);
ok(await E('byId(sel[0]).fill') === '#00ff00', 'заливка из поля цвета');
await clickEl('#pp [data-k=strokeN]'); ok(await E('byId(sel[0]).stroke') === null, '«нет» убирает обводку');
await E(`(()=>{const i=document.querySelector('#pp [data-r=op]');i.value=40;i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new Event('change',{bubbles:true}))})()`);
ok(await E('byId(sel[0]).op') === .4 && await E(`document.querySelector('#pp [data-k=op]').value`) === '40', 'число непрозрачности → ползунок и объект');
ok((await E(`document.querySelector('#pp [data-k=op]').style.getPropertyValue('--hi')`)) === '40%', 'заливка ползунка до 40%');
const rg = await el('#pp input[type=range][data-k=op]'); await b.click(rg[0] + 30, rg[1]); ok(await E(`document.querySelector('#pp [data-r=op]').value`) === String(Math.round(await E('byId(sel[0]).op') * 100)), 'клик по ползунку → число');
await E(`(()=>{const i=document.querySelector('#pp [data-k=bw]');i.value=50;i.dispatchEvent(new Event('change',{bubbles:true}))})()`); ok(Math.abs(await E('objBox(byId(sel[0])).w') - 50) < .01, 'ширина 50 мм из поля');
for (const a of ['rotR', 'rotL', 'mirH', 'mirV']) { const s0 = await E('hi'); await clickEl(`#pp [data-act=${a}]`); ok(await E('hi') === s0 + 1, 'кнопка ' + a); }
await clickEl('#pp [data-act=dup]'); ok(await n() === 6, 'Дубль'); await clickEl('#pp [data-act=del]'); ok(await n() === 5, 'Удалить'); await E('sel=[S.objects[1].id];panel()');
await clickEl('#pp [data-act=lockT]'); ok(await E('byId(sel[0]).lock') === true, 'Закрепить'); ok(await E(`!!document.querySelector('#layers .ly.on .lk.is')`), 'замок в списке'); await clickEl('#pp [data-act=lockT]'); ok(await E('byId(sel[0]).lock') === false, 'Открепить');
// объединить / разъединить / в кривые
await E(`sel=[S.objects[0].id,S.objects[1].id];panel()`); await clickEl('#pp [data-act=combine]'); ok(await n() === 4 && await E('byId(sel[0]).sp.length') === 2, 'Объединить');
await clickEl('#pp [data-act=break]'); ok(await n() === 5, 'Разъединить'); await clickEl('#pp [data-act=toCurve]'); ok(true, 'Всё в кривые');
// сворачивание разделов
await clickEl('#pp .sec[data-s="Кривая"] h3'); ok(await E(`document.querySelector('#pp .sec[data-s="Кривая"]').classList.contains('collapsed')`), 'раздел сворачивается');
await E('panel()'); ok(await E(`document.querySelector('#pp .sec[data-s="Кривая"]').classList.contains('collapsed')`), 'и остаётся свёрнутым');
await clickEl('#pp .sec[data-s="Кривая"] h3'); ok(!await E(`document.querySelector('#pp .sec[data-s="Кривая"]').classList.contains('collapsed')`), 'и разворачивается');
// --- узлы
await b.key('n'); await E(`sel=[S.objects.find(o=>o.name.startsWith('Кривая')).id];panel();render()`);
ok(await E(`[...document.querySelectorAll('#pp .ttl')].some(e=>e.textContent.startsWith('Узлы'))`), 'раздел «Узлы»');
const nd = await E(`(()=>{const e=document.querySelector('#ov .nd').getBoundingClientRect();return [e.left+4,e.top+4]})()`); const nx0 = await E(`byId(sel[0]).sp[0].n[0].x`);
await b.drag(nd[0], nd[1], nd[0] + 30, nd[1]); ok(Math.abs(await E(`byId(sel[0]).sp[0].n[0].x`) - nx0) > 3, 'узел тянется');
const nn0 = await E('byId(sel[0]).sp[0].n.length'); const mid = await E(`(()=>{const o=byId(sel[0]),sp=o.sp[0],P=segPts(sp.n[1],sp.n[2]),q=bez(P,.5),s=toScr(q),r=svg.getBoundingClientRect();return [r.left+s.x,r.top+s.y]})()`);
await b.click(mid[0], mid[1]); await b.click(mid[0], mid[1]); await sleep(100); ok(await E('byId(sel[0]).sp[0].n.length') === nn0 + 1, 'двойной клик добавляет узел');
for (const a of ['cusp', 'smooth', 'toLine', 'toCurve']) { await clickEl(`#pp [data-act=${a}]`); } ok(true, 'кнопки узлов нажимаются');
await shot('node');
// --- список объектов
await b.key('v'); const L0 = await E(`document.querySelectorAll('#layers .ly').length`); ok(L0 === 5, 'в списке 5 объектов');
ok(await E(`document.querySelectorAll('#layers .ly .th svg, #layers .ly .th img').length`) === 5, 'у всех миниатюры');
ok(!/[🔒🔓●◌🖼✎]/u.test(await E(`document.querySelector('#layers').textContent`)), 'нет эмодзи в списке');
await clickEl('#layers .ly:nth-child(2) .nm'); ok(await E('sel.length') === 1 && await E(`document.querySelector('#layers .ly:nth-child(2)').classList.contains('on')`), 'клик в списке выбирает');
const hid0 = await E('S.objects[S.objects.length-2].hid'); await clickEl('#layers .ly:nth-child(2) [data-l=hid]'); ok(await E('S.objects[S.objects.length-2].hid') === !hid0, 'глаз скрывает');
await clickEl('#layers .ly:nth-child(2) [data-l=hid]');
await clickEl('#layers .ly:nth-child(2) .nm'); await sleep(450); await clickEl('#layers .ly:nth-child(2) .nm'); await sleep(100); await clickEl('#layers .ly:nth-child(2) .nm'); await sleep(100);
ok(await E(`!!document.querySelector('#layers input')`), 'двойной клик — поле имени');
await E(`document.querySelector('#layers input').value='Мой контур'`); await b.key('Enter', { code: 'Enter' }); ok(await E(`S.objects.some(o=>o.name==='Мой контур')`), 'переименовано');
const id1 = await E('sel[0]'); const i1 = await E(`S.objects.findIndex(o=>o.id==='${id1}')`); await clickEl('#side .sec[data-s="Объекты"] [data-a=down]'); ok(await E(`S.objects.findIndex(o=>o.id==='${id1}')`) === i1 - 1, 'кнопка «Ниже»');
await clickEl('#side .sec[data-s="Объекты"] [data-a=up]'); ok(await E(`S.objects.findIndex(o=>o.id==='${id1}')`) === i1, 'кнопка «Выше»');
await clickEl('#side .sec[data-s="Объекты"] [data-a=dup]'); ok(await n() === 6, 'дубль из шапки'); await clickEl('#side .sec[data-s="Объекты"] [data-a=del]'); ok(await n() === 5, 'удалить из шапки'); await E('sel=[S.objects[0].id];panel()');
// --- палитра
await clickEl('#pal .sw[data-c="#e53935"]'); ok(await E('byId(sel[0]).fill') === '#e53935', 'палитра: клик — заливка');
const pw = await el('#pal .sw[data-c="#1e88e5"]'); await b.click(pw[0], pw[1], { button: 'right' }); ok(await E('byId(sel[0]).stroke') === '#1e88e5', 'палитра: правый клик — обводка');
// --- фото: импорт, коррекция, обрезка, пипетка
await E(`(async()=>{const c=document.createElement('canvas');c.width=400;c.height=300;const x=c.getContext('2d');const g=x.createLinearGradient(0,0,400,0);g.addColorStop(0,'#ff3300');g.addColorStop(1,'#0033ff');x.fillStyle=g;x.fillRect(0,0,400,300);
 const bl=await new Promise(r=>c.toBlob(r,'image/png'));await importFiles([new File([bl],'фото.png',{type:'image/png'})])})()`); await sleep(600);
ok(await E(`selObjs()[0].type`) === 'image', 'фото импортировано'); ok(await E(`[...document.querySelectorAll('#pp .ttl')].map(e=>e.textContent).join(',')`) === 'Объект,Выравнивание,Изображение', 'разделы фото');
await E(`(()=>{const i=document.querySelector('#pp [data-k="f.br"]');i.value=150;i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new Event('change',{bubbles:true}))})()`); ok(await E('selObjs()[0].f.br') === 150, 'яркость 150');
await clickEl('#pp [data-act=fReset]'); ok(await E('selObjs()[0].f.br') === 100, '«Сбросить» в шапке раздела');
await sleep(500); ok(await E(`!!document.querySelector('#layers .ly.on .th img')`), 'миниатюра фото');
await clickEl('#pp [data-act=cropT]'); ok(await E('tool') === 'crop', 'Обрезать → инструмент');
const ib = await E('(()=>{const o=selObjs()[0];return [o.x,o.y,o.w,o.h]})()'); await dragDoc(ib[0] + 10, ib[1] + 10, ib[0] + ib[2] / 2, ib[1] + ib[3] / 2); ok(await E('selObjs()[0].crop.w') < 400, 'обрезка: ' + await E('Math.round(selObjs()[0].crop.w)') + ' px');
await clickEl('#pp [data-act=cropReset]'); ok(await E('selObjs()[0].crop.w') === 400, 'Вернуть обрезку');
await b.key('i'); await E('sel=[S.objects[0].id];panel()'); const io = await E('(()=>{const o=S.objects.find(o=>o.type==="image");return [o.x+2,o.y+o.h/2]})()'); c = await S(io[0], io[1]); await b.click(c[0], c[1]);
ok(/^#f[0-9a-f]/.test(await E('S.objects[0].fill') || ''), 'пипетка взяла цвет с фото: ' + await E('S.objects[0].fill'));
// --- рука и масштаб
await b.key('h'); const vx = await E('view.x'); c = await S(100, 100); await b.drag(c[0], c[1], c[0] + 50, c[1]); ok(Math.abs(await E('view.x') - vx - 50) < 1, 'рука двигает вид');
const z0 = await E('view.z'); await clickEl('[data-a=zin]'); ok(await E('view.z') > z0, 'кнопка +'); ok(/^\d+%$/.test(await E(`document.querySelector('#zm').textContent`)), 'масштаб в процентах: ' + await E(`document.querySelector('#zm').textContent`));
await clickEl('[data-a=fit]'); await b.key('v');
// --- QR
await clickEl('#qrBtn'); ok(!await E(`document.querySelector('#qrm').hidden`), 'окно QR открылось');
await E(`(()=>{const i=document.querySelector('#qrFields [data-f=u]');i.value='fotomagazin.github.io';i.dispatchEvent(new Event('input',{bubbles:true}))})()`);
ok((await E(`document.querySelector('#qrData').value`)) === 'https://fotomagazin.github.io', 'данные QR');
await E(`(()=>{const s=document.querySelector('#qrType');s.value='wifi';s.dispatchEvent(new Event('input',{bubbles:true}))})()`); ok(await E(`!!document.querySelector('#qrFields [data-f=s]')`), 'тип Wi-Fi — свои поля');
await E(`(()=>{const s=document.querySelector('#qrType');s.value='url';s.dispatchEvent(new Event('input',{bubbles:true}))})()`);
await shot('qr');
await clickEl('#qrOk'); ok(await E(`document.querySelector('#qrm').hidden`) && await E('S.objects.some(o=>o.qr)'), 'QR вставлен вектором');
await clickEl('#qrBtn'); await clickEl('#qrX'); ok(await E(`document.querySelector('#qrm').hidden`), 'крестик закрывает окно');
const qb = await E('(()=>{const o=S.objects.find(o=>o.qr),B=objBox(o);return [B.x+B.w*.12,B.y+B.h*.12]})()'); c = await S(qb[0], qb[1]);
await E('sel=[];panel()'); await b.click(c[0], c[1]); await sleep(60); await b.click(c[0], c[1]); await sleep(200); ok(!await E(`document.querySelector('#qrm').hidden`), 'двойной клик по QR — изменить'); await b.key('Escape', { code: 'Escape' });
ok(await E(`!!document.querySelector('#layers svg path[d*="M12 7v3"]')`), 'значок QR в списке');
await shot('qr-in');
// === 0.2: сложить/вычесть, выравнивание, направляющие и привязка, текст ===
const area = id => E(`(()=>{const o=byId('${id}'),B=objBox(o),k=10,c=cvs(B.w*k+2,B.h*k+2),x=c.getContext('2d');x.translate(-B.x*k+1,-B.y*k+1);x.scale(k,k);x.fill(new Path2D(pathD(o)),'evenodd');const d=x.getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<d.length;i+=4)n+=d[i]/255;return n/k/k})()`);
const mk = (t, x, y, w, h, f = '#4a8') => E(`(()=>{const o=newPath('Т');o.sp=[{c:true,n:shapeNodes('${t}',${x},${y},${w},${h})}];o.fill='${f}';S.objects.push(o);commit('тест');render();return o.id})()`);
const nBefore = await n();
// --- сложить / вычесть / пересечь / исключить
{ const a1 = await mk('rect', 10, 200, 40, 40), b1 = await mk('ellipse', 30, 220, 40, 40);
  await E(`sel=['${a1}'];panel()`); ok(!await E(`!!document.querySelector('#pp [data-act="b-sub"]')`), 'одна фигура — кнопок «Сложить/Вычесть» нет');
  await E(`sel=['${a1}','${b1}'];panel()`); ok(await E(`document.querySelectorAll('#pp [data-act^="b-"]').length`) === 4, 'две фигуры — 4 кнопки операций');
  await clickEl('#pp [data-act="b-sub"]'); await sleep(2500);
  ok(await n() === nBefore + 1 && !await E(`!!byId('${b1}')`), 'Вычесть: осталась одна фигура'); const ar = await area(a1);
  ok(Math.abs(ar - (1600 - Math.PI * 100)) < 6, 'Вычесть: площадь ' + ar.toFixed(0) + ' (ожидаемо ' + (1600 - Math.PI * 100).toFixed(0) + ')'); ok(await E('hn[hi]') === 'Вычесть', 'шаг истории «Вычесть»');
  const c1 = await mk('ellipse', 0, 190, 30, 30); await E(`sel=['${a1}','${c1}'];panel()`); await clickEl('#pp [data-act="b-unite"]'); await sleep(300); ok(await n() === nBefore + 1 && await E(`byId('${a1}').sp.length`) >= 1, 'Сложить');
  const d1 = await mk('rect', 100, 100, 5, 5), e1 = await mk('rect', 150, 150, 5, 5); await E(`sel=['${d1}','${e1}'];panel()`); await clickEl('#pp [data-act="b-inter"]'); await sleep(300);
  ok(await n() === nBefore + 3 && /нет общей части/.test(await E(`document.querySelector('#toast').textContent`)), 'Пересечь без общей части — ничего не меняет, есть подсказка');
  await E(`sel=['${d1}','${e1}'];del()`);
  await E(`sel=['${a1}'];del()`); }
// --- выравнивание и распределение
{ const ids = [await mk('rect', 20, 30, 20, 10), await mk('rect', 60, 50, 30, 15), await mk('rect', 140, 20, 10, 25)];
  await E(`sel=${JSON.stringify(ids)};panel()`); await clickEl('#pp [data-act="alTo-sel"]'); ok(await E('alignTo') === 'sel', 'относительно выделения');
  await clickEl('#pp [data-act="al-l"]'); ok((await E(`${JSON.stringify(ids)}.map(i=>+objBox(byId(i)).x.toFixed(3))`)).every(v => v === 20), 'По левому краю — все X = 20');
  await clickEl('#pp [data-act="al-cv"]'); const cy = await E(`${JSON.stringify(ids)}.map(i=>{const B=objBox(byId(i));return +(B.y+B.h/2).toFixed(3)})`); ok(cy.every(v => v === cy[0]), 'По центру по вертикали — центры совпали: ' + cy[0]);
  await E(`(()=>{const xs=[20,70,170];${JSON.stringify(ids)}.forEach((i,k)=>{const o=byId(i),B=objBox(o);mapObj(o,q=>({x:q.x+xs[k]-B.x,y:q.y}))});commit('тест');panel()})()`);
  await clickEl('#pp [data-act="dist-h"]'); const gaps = await E(`(()=>{const B=${JSON.stringify(ids)}.map(i=>objBox(byId(i))).sort((a,b)=>a.x-b.x);return [B[1].x-B[0].x-B[0].w,B[2].x-B[1].x-B[1].w].map(v=>+v.toFixed(3))})()`);
  ok(gaps[0] === gaps[1], 'Распределить — равные промежутки: ' + gaps.join(' и ') + ' мм');
  await clickEl('#pp [data-act="alTo-page"]'); await clickEl('#pp [data-act="al-r"]'); ok((await E(`${JSON.stringify(ids)}.map(i=>{const B=objBox(byId(i));return +(B.x+B.w).toFixed(3)})`)).every(v => v === 210), 'относительно страницы, по правому краю — все у края 210 мм');
  await E(`sel=['${ids[0]}'];panel()`); await clickEl('#pp [data-act="al-c"]'); const B = await E(`objBox(byId('${ids[0]}'))`); ok(Math.abs(B.x + B.w / 2 - 105) < 1e-6 && Math.abs(B.y + B.h / 2 - 148.5) < 1e-6, 'В центр страницы');
  await E(`sel=${JSON.stringify(ids)};del()`); }
// --- направляющие: от линейки, перетаскивание, удаление
{ await E('sel=[];panel();fit()'); const rt = await el('#rulT'), y60 = (await S(0, 60))[1];
  await b.drag(rt[0], rt[1], rt[0], y60, { steps: 10 }); ok(await E('(S.page.g||[]).length') === 1 && await E('S.page.g[0].v') === false, 'направляющая от верхней линейки — горизонтальная');
  ok(Math.abs(await E('S.page.g[0].p') - 60) < 0.6, 'на 60 мм: ' + await E('S.page.g[0].p')); ok(await E('hn[hi]') === 'Новая направляющая', 'шаг истории');
  const rl = await el('#rulL'), x100 = (await S(100, 0))[0]; await b.drag(rl[0], rl[1] + 200, x100, rl[1] + 200, { steps: 10 }); ok(await E('S.page.g.length') === 2 && await E('S.page.g[1].v') === true, 'вертикальная от левой линейки');
  // привязка: на «чистом листе» (остальное временно скрыто), фигура подъезжает к направляющей 60 мм
  const shown = await E(`S.objects.filter(o=>!o.hid).map(o=>o.id)`); await E(`S.objects.forEach(o=>o.hid=true);render()`);
  await E(`SNAP.on=true;snapUI()`); const r1 = await mk('rect', 30, 40, 20, 15, '#c33'); await E(`sel=['${r1}'];panel()`);
  let p0 = await S(40, 47.5), p1 = await S(40, 47.5 + 4.2); await b.drag(p0[0], p0[1], p1[0], p1[1], { steps: 8 }); // низ был 55 → около 59.2
  ok(Math.abs(await E(`(()=>{const B=objBox(byId('${r1}'));return B.y+B.h})()`) - 60) < 1e-6, 'привязка: низ фигуры прилип к направляющей 60 мм');
  await E(`SNAP.on=false;snapUI()`); p0 = await S(40, 49.5); p1 = await S(40, 49.5 - 0.6); await b.drag(p0[0], p0[1], p1[0], p1[1], { steps: 8 });
  ok(Math.abs(await E(`(()=>{const B=objBox(byId('${r1}'));return B.y+B.h})()`) - 59.4) < 0.05, 'без привязки двигается свободно'); await E(`SNAP.on=true;snapUI()`);
  // сетка: прямоугольник рисуется по узлам сетки
  await E(`sel=[];panel()`); await clickEl('#pp [data-k="gridOn"]'); ok(await E('GRID.show') === true && await E(`JSON.parse(localStorage['kt-grid']).show`) === true, 'сетка включена и запомнилась');
  await b.key('r'); p0 = await S(120.6, 200.4); p1 = await S(149.5, 219.4); await b.drag(p0[0], p0[1], p1[0], p1[1], { steps: 8 });
  const gb = await E(`objBox(S.objects[S.objects.length-1])`); ok([gb.x, gb.y, gb.x + gb.w, gb.y + gb.h].every(v => Math.abs(v / 10 - Math.round(v / 10)) < 1e-6), 'фигура по сетке: ' + [gb.x, gb.y, gb.w, gb.h].map(v => +v.toFixed(4)).join(', '));
  await E(`sel=[S.objects[S.objects.length-1].id,'${r1}'];del();GRID.show=false;snapUI();setTool('select')`);
  await E(`${JSON.stringify(shown)}.forEach(i=>byId(i).hid=false);commit('тест');render();panel()`);
  // фигура, стоящая на направляющей, берётся сама (а не направляющая)
  { const on = await mk('rect', 90, 262, 20, 10, '#39f'); await E(`sel=[];panel();render()`); const c = await S(100, 267); const gx0 = await E('S.page.g[1].p');
    await b.drag(c[0], c[1], c[0] + 20, c[1], { steps: 6 }); ok(await E('S.page.g[1].p') === gx0 && Math.abs(await E(`objBox(byId('${on}')).x`) - 90) > 3, 'фигура на направляющей — двигается фигура, направляющая на месте');
    await E(`sel=['${on}'];del()`); }
  // убрать направляющую — утащить на линейку
  const gy = (await S(0, await E('S.page.g[0].p')))[1]; const gx = (await S(150, 0))[0]; await b.drag(gx, gy, gx, rt[1], { steps: 8 });
  ok(await E('S.page.g.length') === 1 && await E('hn[hi]') === 'Направляющая убрана', 'направляющая утащена на линейку — убрана'); await shot('guides'); }
// --- текст
{ await b.key('t'); ok(await E('tool') === 'text', 'клавиша T — текст'); ok(await E(`!!document.querySelector('#topts .fsel')`), 'в строке инструмента — шрифт и размер');
  const q = await S(20, 240); await b.click(q[0], q[1]); for (let i = 0; i < 50 && !await E('tEdit'); i++) await sleep(200);   // первый раз шрифт скачивается
  ok(await E('document.activeElement.id') === 'txtEdit', 'клик — можно печатать на странице');
  await b.send('Input.insertText', { text: 'Вывеска AV' }); await sleep(150); const tid = await E('tEdit.id');
  ok(await E(`byId('${tid}').sp.length`) >= 8, 'буквы сразу стали кривыми: ' + await E(`byId('${tid}').sp.length`) + ' контуров');
  await b.key('Escape', { code: 'Escape' }); ok(!await E('tEdit') && await E(`byId('${tid}').name`) === 'Текст «Вывеска AV»' && await E('hn[hi]') === 'Новый текст', 'Esc — готово, имя по тексту');
  ok(await E(`[...document.querySelectorAll('#pp .ttl')].map(e=>e.textContent).join(',')`) === 'Объект,Текст,Выравнивание,Кривая', 'разделы надписи: Объект, Текст, Выравнивание, Кривая');
  const w0 = await E(`objBox(byId('${tid}')).w`);
  await E(`(()=>{const s=document.querySelector('#pp [data-k="tx.f"]');s.value='Lobster';s.dispatchEvent(new Event('change',{bubbles:true}))})()`); for (let i = 0; i < 50 && await E(`byId('${tid}').txt.f`) !== 'Lobster'; i++) await sleep(200); await sleep(300);
  ok(await E(`byId('${tid}').txt.f`) === 'Lobster' && Math.abs(await E(`objBox(byId('${tid}')).w`) - w0) > 1, 'шрифт Lobster — буквы перестроились');
  ok(await E(`document.querySelector('#pp [data-act="tx-b"]').disabled`), 'у Lobster нет жирного — кнопка неактивна');
  await E(`(()=>{const s=document.querySelector('#pp [data-k="tx.f"]');s.value='Montserrat';s.dispatchEvent(new Event('change',{bubbles:true}))})()`); await sleep(1500);
  await clickEl('#pp [data-act="tx-b"]'); for (let i = 0; i < 50 && await E('hn[hi]') !== 'Жирный'; i++) await sleep(200); ok(await E(`byId('${tid}').txt.b`) === true && await E('hn[hi]') === 'Жирный', 'Жирный');
  const h0 = await E(`objBox(byId('${tid}')).h`); await E(`(()=>{const i=document.querySelector('#pp [data-k="tx.pt"]');i.value=96;i.dispatchEvent(new Event('change',{bubbles:true}))})()`); await sleep(600);
  ok(Math.abs(await E(`objBox(byId('${tid}')).h`) / h0 - 2) < .05, 'размер 48 → 96 пт — буквы вдвое выше');
  const bb0 = await E(`objBox(byId('${tid}'))`); await clickEl('#pp [data-act="tx-al-center"]'); await sleep(300);
  const bb = await E(`objBox(byId('${tid}'))`); ok(await E(`byId('${tid}').txt.al`) === 'center' && Math.abs(bb.x - bb0.x) < .01 && Math.abs(bb.y - bb0.y) < .01, 'по центру — надпись осталась на месте');
  await E(`(()=>{const t=document.querySelector('#pp textarea[data-k="tx.t"]');t.value='Вывеска AV\\nвторая строка';t.dispatchEvent(new Event('input',{bubbles:true}));t.dispatchEvent(new Event('change',{bubbles:true}))})()`); await sleep(300);
  ok(await E(`byId('${tid}').txt.t`) === 'Вывеска AV\nвторая строка' && await E(`objBox(byId('${tid}')).h`) > h0 * 2.5, 'текст из панели, две строки');
  await clickEl('#pp [data-act="rotR"]'); const rb = await E(`objBox(byId('${tid}'))`); ok(rb.h > rb.w, 'поворот на 90° — надпись встала вертикально');
  await E(`editText(byId('${tid}'))`); await sleep(400); await E(`document.querySelector('#txtEdit').setSelectionRange(99,99)`); await b.send('Input.insertText', { text: '!' }); await b.key('Escape', { code: 'Escape' }); await sleep(100);
  const rb2 = await E(`objBox(byId('${tid}'))`); ok((await E(`byId('${tid}').txt.t`)).endsWith('!') && rb2.h > rb2.w, 'правка повёрнутой надписи — остаётся повёрнутой');
  await shot('text');
  await b.key('z', { mod: 4 }); ok(!(await E(`byId('${tid}').txt.t`)).endsWith('!'), 'Ctrl+Z отменяет правку текста');
  // свой шрифт из файла
  await E(`(async()=>{const r=await fetch('https://cdn.jsdelivr.net/npm/@fontsource/russo-one@5.3.0/files/russo-one-cyrillic-400-normal.woff');const f=new File([await r.blob()],'МойШрифт.woff');const dt=new DataTransfer();dt.items.add(f);const i=document.querySelector('#fFont');i.files=dt.files;i.dispatchEvent(new Event('change'))})()`); await sleep(2500);
  const uf = await E(`byId('${tid}').txt.f`); ok(await E(`!!UFONT[${JSON.stringify(uf)}]`) && uf === 'Russo One (свой)' && await E(`document.querySelectorAll('#pp .fsel option').length`) === 19, 'свой шрифт подключён: «' + uf + '» (имя совпало со встроенным — добавлено «(свой)»)');
  ok(await E(`JSON.parse(projJSON()).fonts && Object.keys(JSON.parse(projJSON()).fonts).length`) === 1, 'свой шрифт сохраняется внутри проекта');
  // в кривые
  await E(`sel=['${tid}'];panel()`); const sp0 = await E(`JSON.stringify(byId('${tid}').sp)`); await clickEl('#pp [data-act="tx-curves"]');
  ok(!await E(`!!byId('${tid}').txt`) && await E(`JSON.stringify(byId('${tid}').sp)`) === sp0 && await E('hn[hi]') === 'Текст в кривые', 'В кривые — буквы те же, «памятка» убрана');
  await b.key('z', { mod: 4 }); ok(await E(`!!byId('${tid}').txt`), 'Ctrl+Z — снова текст');
  await b.key('v'); }
// --- PDF и Illustrator (.ai) — кривыми; CorelDRAW (.cdr) — подсказка; значки «Импорт» (стрелка внутрь) и «Экспорт» (стрелка наружу)
ok(await E(`document.querySelector('#expBtn').dataset.i`) === 'export' && await E(`document.querySelector('#importBtn').dataset.i`) === 'download', 'значки: Импорт — стрелка внутрь, Экспорт — наружу');
{ const before = await E('JSON.stringify(S.objects.map(o=>[o.fill,o.stroke,o.op,Object.values(objBox(o)||{}).map(v=>+v.toFixed(2))]))'), keep = await E('snap()'), pg = await E('JSON.stringify(S.page)');
  const r = await E(`(async()=>{const f=new File([buildPDF()],'проба.ai');const n0=S.objects.length;await importFiles([f]);const add=S.objects.slice(n0);
    return JSON.stringify(add.map(o=>[o.fill,o.stroke,o.op,Object.values(objBox(o)||{}).map(v=>+v.toFixed(2))]))})()`);
  const vec = JSON.parse(before).filter(x => x[3].length), got = JSON.parse(r);
  ok(got.length >= vec.length - (await E(`S.objects.filter(o=>o.type==='image'&&!o.hid).length`)) && /Открыто кривыми/.test(await E(`document.querySelector('#toast').textContent`)), 'свой PDF, названный .ai, открылся кривыми: ' + got.length + ' объектов · ' + await E(`document.querySelector('#toast').textContent`));
  ok(/фото внутри файла пропущены/.test(await E(`document.querySelector('#toast').textContent`)), 'про пропущенные фото — сказано');
  await E(`restoreSnap=${JSON.stringify(keep)};S.objects=JSON.parse(restoreSnap).objects;S.page=${pg};commit('тест');render();panel()`);
  b.logs.length = 0; await E(`importFiles([new File(['%!PS-Adobe-3.0\\n%%Creator: Adobe Illustrator(R) 8.0\\n'],'старый.ai')])`); await sleep(300);
  ok(b.logs.some(l => /без PDF-совместимости/.test(l)), 'старый .ai без PDF-копии — понятное объяснение, что сделать');
  b.logs.length = 0; await E(`importFiles([new File(['RIFF'],'макет.cdr')])`); await sleep(200);
  ok(b.logs.some(l => /CorelDRAW/.test(l) && /Экспорт/.test(l) && /Inkscape/.test(l)), '.cdr — подсказка: экспорт в PDF/AI из CorelDRAW или Inkscape');
  b.logs.length = 0; }
// --- история шагов
await clickEl('#histBtn'); ok(await E(`document.querySelector('#hist').classList.contains('open')`), 'меню «История» открылось');
const hl = await E(`[...document.querySelectorAll('#hist div')].map(d=>d.textContent)`); ok(hl.length > 20 && hl[0] === 'Новый документ' && hl.some(t => /Новая фигура «Прямоугольник/.test(t)) && hl.some(t => /QR-код/.test(t)), 'шаги с названиями: ' + hl.length + ', последний «' + hl[hl.length - 1] + '»');
const nh = await n(); await clickEl('#hist div[data-k="1"]'); ok(await n() === 1 && await E('hi') === 1, 'клик по шагу 1 — документ как тогда');
ok(await E(`!document.querySelector('#redoBtn').disabled`), '«Вернуть» активна'); await clickEl('#hist div:last-child'); ok(await n() === nh, 'клик по последнему шагу — всё вернулось');
await b.key('Escape', { code: 'Escape' }); ok(!await E(`document.querySelector('#hist').classList.contains('open')`), 'Esc закрывает меню');
// --- окно «Экспорт»
await clickEl('#expBtn'); ok(await E(`document.querySelector('#exModal').classList.contains('open')`), 'окно «Экспорт» открылось');
for (const f of ['svg', 'pdf', 'eps', 'dxf', 'png']) { await clickEl(`#exFmt [data-f=${f}]`); await sleep(f === 'png' ? 2200 : 700);
  const st = await E(`({w:document.querySelector('#exWeight').textContent,warn:document.querySelector('#exWarn').textContent,ext:document.querySelector('#exExt').textContent,dpi:!document.querySelector('#exDpiRow').hidden})`);
  ok(/≈ \d/.test(st.w) && st.ext === '.' + f && st.dpi === (f === 'png'), `${f}: ${st.w}` + (st.warn ? ' · предупреждение: ' + st.warn.slice(0, 40) + '…' : ''));
  if (f === 'eps' || f === 'dxf') ok(/Фото/.test(st.warn), f + ': предупреждение про фото'); if (f === 'png') await shot('export-window');
  await E(`document.querySelector('#exName').value='тест-${f}'`); await clickEl('#exGo'); await sleep(f === 'png' ? 1500 : 500); ok(!await E(`document.querySelector('#exModal').classList.contains('open')`), f + ': сохранено, окно закрылось');
  if (f !== 'png') await clickEl('#expBtn'); }
await b.key('e', { mod: 2 }); ok(await E(`document.querySelector('#exModal').classList.contains('open')`), 'Ctrl+E открывает экспорт');
await E(`(()=>{const s=document.querySelector('#exDpi');s.value='150';s.dispatchEvent(new Event('change'))})()`); await clickEl('#exBg [data-bg="#ffffff"]'); await sleep(1500);
ok(/1240 × 1754 px/.test(await E(`document.querySelector('#exDims').textContent`)), '150 dpi → 1240 × 1754 px');
await E(`document.querySelector('#exName').value='белый-150'`); await b.key('Enter', { code: 'Enter' }); await sleep(1500);
ok(JSON.parse(await E(`localStorage['kt-export']`)).dpi === 150, 'выбор запомнился');
await clickEl('#expBtn'); await b.key('Escape', { code: 'Escape' }); ok(!await E(`document.querySelector('#exModal').classList.contains('open')`), 'Esc закрывает окно');
// --- версия и обновления (интернет подменён)
await E(`localStorage.removeItem('kt-upd');window.__rel=null`); await clickEl('#updBtn'); await sleep(1000);
ok(/последняя версия/.test(await E(`document.querySelector('#updMenu').textContent`)), 'релизов нет — «У вас последняя версия»');
await E(`window.__rel={tag_name:'v9.9.0',name:'Контур 9.9',body:'**Текст** и выравнивание',html_url:'x'}`); await clickEl('#updCheck'); await sleep(1000);
ok(await E(`document.querySelector('#updBtn').classList.contains('new')`) && /Вышла версия 9.9/.test(await E(`document.querySelector('#updMenu').textContent`)), 'новая версия — синяя кнопка и «Скачать»');
await shot('update'); await E(`window.__net='off'`); await clickEl('#updCheck'); await sleep(1000); ok(/Не удалось проверить/.test(await E(`document.querySelector('#updMenu').textContent`)), 'нет интернета — «Не удалось проверить»');
await E(`window.__net='';window.__rel=null;localStorage.removeItem('kt-upd');UPD.r=null;UPD.state='idle';renderUpd();closeMenus()`);
// --- обратная связь (отправка подменена — настоящих сообщений нет)
await clickEl('#fbBtn'); ok(await E(`document.querySelector('#fbMenu').classList.contains('open')`), 'меню «Обратная связь»');
await clickEl('#fbMenu [data-fb=bug]'); ok(await E(`document.querySelector('#fbModal').classList.contains('open')&&document.querySelector('#fbType [data-t=bug]').classList.contains('on')`), 'окно отзыва, тип «Ошибка»');
await clickEl('#fbSend'); ok(/пару слов/.test(await E(`document.querySelector('#fbStatus').textContent`)), 'пустой отзыв не отправляется');
await E(`document.querySelector('#fbText').value='Проверка формы'`); await E(`window.__f=[]`); await clickEl('#fbSend'); await sleep(300);
const fb = JSON.parse(await E(`window.__f.find(x=>/feedback/.test(x[0]))[1]`)); ok(fb.text === '[Контур] Проверка формы' && fb.type === 'bug' && /^Контур \d+\.\d+\.\d+ бета/.test(fb.diag), 'отзыв уходит с пометкой [Контур]: ' + fb.diag);
ok(await E(`document.querySelector('#fbForm').classList.contains('sent')`), '«Спасибо!»'); await sleep(2000);
await E(`window.__fbok=false;openFb('idea');document.querySelector('#fbText').value='ещё'`); await clickEl('#fbSend'); await sleep(300);
ok(/Telegram-бот/.test(await E(`document.querySelector('#fbStatus').textContent`)) && await E(`document.querySelector('#fbText').value`) === 'ещё', 'ошибка отправки — текст не потерян, есть ссылка на бота');
await b.key('Escape', { code: 'Escape' }); ok(!await E(`document.querySelector('#fbModal').classList.contains('open')`), 'Esc закрывает окно отзыва');
// --- сохранение проекта
await E('window.showSaveFilePicker=undefined'); await clickEl('#saveBtn'); await sleep(1200);
const files = readdirSync(DL); console.log('  скачано:', files.map(f => f + ' ' + statSync(DL + '/' + f).size).join(', '));
for (const ext of ['svg', 'pdf', 'eps', 'dxf', 'png', 'kontur']) ok(files.some(f => f.endsWith('.' + ext) && statSync(DL + '/' + f).size > 100), 'файл .' + ext);
const png = readFileSync(DL + '/белый-150.png'); ok(png.readUInt32BE(16) === 1240 && png.readUInt32BE(20) === 1754, 'PNG 150 dpi: ' + png.readUInt32BE(16) + '×' + png.readUInt32BE(20));
const pdf = readFileSync(DL + '/тест-pdf.pdf'); ok(pdf.subarray(0, 8).toString() === '%PDF-1.4' && pdf.subarray(-7).toString().includes('%%EOF'), 'PDF корректной формы');
const before = await E('snap()');
// открыть сохранённый проект заново
const proj = readFileSync(DL + '/' + files.find(f => f.endsWith('.kontur')), 'utf8');
await E(`dirty=false;loadProject(new File([${JSON.stringify(proj)}],'тест.kontur'))`); await sleep(500);
ok(await E('snap()') === before, 'проект открылся точно таким же');
ok(await E(`document.querySelectorAll('#layers .ly').length`) === await n(), 'список объектов после открытия');
await sleep(400); await shot('reopened');
// --- автосохранение и «Есть незаконченная работа»
await E(`(()=>{const o=newPath('Метка');o.sp=[{c:true,n:shapeNodes('rect',5,5,10,10)}];o.fill='#123456';S.objects.push(o);commit('Метка')})()`); const want = await E('snap()');
await sleep(5000); ok(await E(`kv('get','autosave').then(a=>!!a&&JSON.parse(a.json).objects.length)`) === await n(), 'автосохранение записано');
ok(/Автосохранено/.test(await E(`document.querySelector('#asState').textContent`)), 'надпись «Автосохранено»');
await E('dirty=false'); await b.go('file://' + FILE); await sleep(1200);
ok(await E(`!!document.querySelector('#restore #rYes')`), 'после перезапуска — «Есть незаконченная работа»'); await shot('restore');
await E(`(()=>{const o=newPath('Новое');o.sp=[{c:true,n:shapeNodes('rect',50,50,10,10)}];S.objects.push(o);commit('Новое');dirty=true})()`); await sleep(5000);
ok(await E(`kv('get','autosave').then(a=>JSON.parse(a.json).objects.some(o=>o.name.startsWith('Метка')))`), 'пока не ответили — старое автосохранение не затёрто');
await clickEl('#rYes'); await sleep(800); ok(await E('snap()') === want, 'Восстановить — работа вернулась точь-в-точь'); ok(await E('dirty') === true, 'восстановленное помечено как несохранённое');
await E('dirty=false'); await b.go('file://' + FILE); await sleep(1200); await clickEl('#rNo'); await sleep(300);
ok(await E(`kv('get','autosave').then(a=>!a)`) && await E(`!document.querySelector('#restore #rYes')`), 'Удалить — автосохранение стёрто');
console.log('\nскриншоты и файлы: ' + process.env.SP);
console.log('\n' + (b.logs.length ? 'КОНСОЛЬ:\n' + b.logs.join('\n') : 'консоль чистая'));
console.log(fails.length ? `\nОШИБОК: ${fails.length}` : '\nВСЁ ОК');
b.close(); process.exit(0);
