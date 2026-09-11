const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

// Synthetic fixtures only; no captured client data.
let snapshot = { timestamp: 1789110000, warning: '', devices: [
  {hostname:'Phone-Aster',ip:'192.168.50.42',mac:'02:7a:91:3c:58:e4',iface:'demo1',ssid:'Demo-5G',band:'5 ГГц',signal:-64,duration:2220,rx:6,tx:780},
  {hostname:'Tablet-Birch',ip:'192.168.50.87',mac:'06:2d:b8:61:af:30',iface:'demo0',ssid:'Demo-2G',band:'2,4 ГГц',signal:-56,duration:2460,rx:26,tx:1},
  {hostname:'',ip:'',mac:'0a:94:5e:27:c1:68',iface:'demo1',ssid:'Demo-5G',band:'5 ГГц',signal:null,duration:null,rx:null,tx:null}
]};
class Element {
  constructor(tag, attrs, children) { this.tag=tag; this.attrs=attrs || {}; this.children=Array.isArray(children) ? children : children==null ? [] : [children]; }
  replaceChildren(...children) { this.children=children; }
}
function E(tag, attrs, children) { return new Element(tag,attrs,children); }
function all(root, predicate) { return root instanceof Element ? (predicate(root) ? [root] : []).concat(root.children.flatMap(c=>all(c,predicate))) : []; }
function text(root) { return root instanceof Element ? root.children.map(text).join(' ') : String(root); }
let calls=0, failure=false, polling;
const doc={hidden:false};
const page=new Function('view','rpc','poll','E','document',fs.readFileSync(path.join(__dirname,'../files/wifi-monitor.js'),'utf8'))(
  {extend:x=>x}, {declare:()=>async()=>{calls++; if(failure) throw new Error('Test failure'); return snapshot;}}, {add:fn=>{polling=fn;}}, E, doc);
const tick=()=>new Promise(r=>setImmediate(r));
(async()=>{
  const root=page.render();
  await tick();
  assert.match(text(root), /Всего: 3/);
  assert.match(text(root), /2,4 ГГц: 1/);
  assert.match(text(root), /5 ГГц: 2/);
  const search=all(root,e=>e.attrs.type==='search')[0];
  search.attrs.input({target:{value:'02:7A:91:3C:58:E4'}});
  assert.match(text(root), /Подключённые устройства · 1/);
  search.attrs.input({target:{value:'no-such-device'}});
  assert.match(text(root), /Нет устройств по выбранным условиям/);
  search.attrs.input({target:{value:''}});
  const band=all(root,e=>e.attrs['aria-label']==='Диапазон')[0];
  band.attrs.change({target:{value:'2,4 ГГц'}});
  assert.match(text(root), /Подключённые устройства · 1/);
  assert.match(text(root), /Всего: 3/);
  band.attrs.change({target:{value:''}});
  all(root,e=>e.tag==='button' && text(e).startsWith('Сигнал'))[0].attrs.click();
  assert.match(text(root), /Сигнал ↑/);
  const firstTable=all(root,e=>e.tag==='table')[0];
  assert.match(text(firstTable.children[1]), /Phone-Aster/);
  assert.match(text(firstTable.children[3]), /0a:94:5e:27:c1:68/);
  const button=all(root,e=>e.attrs.class==='cbi-button cbi-button-apply')[0];
  await Promise.all([button.attrs.click(),button.attrs.click()]);
  assert.equal(calls,2,'Concurrent refreshes must share one request');
  failure=true;
  await button.attrs.click();
  assert.equal(button.disabled,false);
  assert.match(all(root,e=>e.attrs.role==='status')[0].textContent,/предыдущие данные/);
  failure=false;
  snapshot={timestamp:1789110030,warning:' demo1',devices:[]};
  await button.attrs.click();
  assert.match(text(root),/Всего: 0/);
  assert.match(all(root,e=>e.attrs.role==='status')[0].textContent,/demo1/);
  const before=calls;
  await polling();
  assert.equal(calls,before,'Auto refresh is disabled by default');
  console.log('PASS: rendering, unknown fields, search, band filter, sorting, concurrent refresh, error recovery, empty data, warnings, default polling');
})().catch(error=>{console.error(error);process.exitCode=1;});
