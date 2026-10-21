// Снимки возможностей «текст, выравнивание, привязка, операции с фигурами»: node tools/shots02.mjs "$PWD/kontur.html" папка-для-снимков
import { open, sleep } from './cdp.mjs';
import { mkdirSync } from 'node:fs';
const [, , FILE, OUT] = process.argv; mkdirSync(OUT, { recursive: true });
const b = await open({ w: 1440, h: 900 }); const E = x => b.ev(x), SH = n => b.shot(`${OUT}/${n}.png`);
const S = async (x, y) => E(`(()=>{const r=svg.getBoundingClientRect(),p=toScr({x:${x},y:${y}});return [r.left+p.x,r.top+p.y]})()`);
await b.go('file://' + FILE); await sleep(600); await E('fit()');
// 1. вывеска: текст + фигуры
await E(`(async()=>{const T=async(s,f,pt,b,al,x,y,fill)=>{const t={...textOpt,t:s,f,pt,b,al,m:[1,0,0,1,x,y]};await useFont(t);const o=newPath('Текст');o.fill=fill;o.stroke=null;o.txt=t;o.name=textName(t);S.objects.push(o);regenText(o);return o};
 const mk=(k,x,y,w,h,f)=>{const q=newPath('Фигура');q.sp=[{c:true,n:shapeNodes(k,x,y,w,h)}];q.fill=f;S.objects.push(q);return q};
 const bg=mk('rect',20,30,170,110,'#1d2b3a');bg.name='Фон вывески';
 const cup=mk('ellipse',80,48,50,40,'#d9a35b'),cut=mk('rect',70,40,70,22,'#000');sel=[cup.id,cut.id];await boolOp('sub');S.objects.find(o=>o.id===cup.id).name='Чашка';
 const h=mk('ellipse',123,66,16,14,'#d9a35b'),hh=mk('ellipse',127,70,8,6,'#000');sel=[h.id,hh.id];await boolOp('sub');
 await T('КОФЕЙНЯ','Unbounded',44,true,'center',105,92,'#f4e7d3');await T('«Зёрна» · с 8:00 до 22:00','Montserrat',18,false,'center',105,118,'#d9a35b');
 S.page.g=[{v:true,p:105},{v:false,p:30},{v:false,p:140}];sel=[];commit('демо');render();panel();fit()})()`);
await sleep(800); await SH('1-вывеска');
// 2. правка текста на странице, строка инструмента со шрифтами
await E(`setTool('text');editText(S.objects.find(o=>o.txt&&o.txt.f==='Unbounded'))`); await sleep(800); await SH('2-текст-правка');
await E(`endTextEdit();setTool('select');sel=[S.objects.find(o=>o.txt&&o.txt.f==='Montserrat').id];panel()`); await sleep(400);
await E(`document.querySelector('#pp .sec[data-s="Текст"]').scrollIntoView()`); await SH('3-текст-панель');
// 3. операции с фигурами: два объекта выбраны
await E(`(()=>{const mk=(k,x,y,w,h,f)=>{const q=newPath('Фигура');q.sp=[{c:true,n:shapeNodes(k,x,y,w,h)}];q.fill=f;S.objects.push(q);return q};const a=mk('rect',40,180,60,60,'#3d8bfd'),c=mk('star',75,195,60,60,'#ff6b6b');sel=[a.id,c.id];render();panel();
 document.querySelector('#pp [data-act="b-unite"]').scrollIntoView({block:'center'})})()`); await sleep(400); await SH('4-операции-до');
await E(`boolOp('sub')`); await sleep(700); await E(`document.querySelector('#side').scrollTop=0`); await SH('5-операции-вычесть');
// 4. выравнивание
await E(`(()=>{const mk=(k,x,y,w,h,f)=>{const q=newPath('Фигура');q.sp=[{c:true,n:shapeNodes(k,x,y,w,h)}];q.fill=f;S.objects.push(q);return q};const ids=[mk('ellipse',130,185,20,20,'#19d3a2'),mk('rect',150,215,30,14,'#a35bff'),mk('star',170,250,22,22,'#fdd835')].map(o=>o.id);sel=ids;alignTo='sel';render();panel();
 document.querySelector('#pp .sec[data-s="Выравнивание"]').scrollIntoView()})()`); await sleep(300); await SH('6-выравнивание-до');
await E(`align('ch');distribute('v')`); await sleep(300); await E(`document.querySelector('#pp .sec[data-s="Выравнивание"]').scrollIntoView()`); await SH('7-выравнивание-после');
// 5. сетка, направляющие, привязка во время перетаскивания
await E(`GRID.show=true;snapUI();sel=[S.objects.find(o=>o.name==='Чашка').id];render();panel()`);
const c = await E(`(()=>{const B=objBox(S.objects.find(o=>o.name==='Чашка')),r=svg.getBoundingClientRect(),q=toScr({x:B.x+B.w/2,y:B.y+B.h/2});return[r.left+q.x,r.top+q.y]})()`);
await b.mouse('mouseMoved', c[0], c[1]); await b.mouse('mousePressed', c[0], c[1]); for (let i = 1; i <= 8; i++) await b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c[0] - i * 2.6, y: c[1] + i * 1.2, button: 'left', buttons: 1 });
await sleep(150); await SH('8-сетка-направляющие-привязка'); await b.mouse('mouseReleased', c[0] - 21, c[1] + 10);
console.log(b.logs.join('\n') || 'консоль чистая'); b.close(); process.exit(0);
