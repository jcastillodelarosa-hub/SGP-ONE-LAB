import test from 'node:test';
import assert from 'node:assert/strict';
import {mountNcGlassReview} from '../src/modules/lp01-nc-glass-review.js';

// Minimal control/lifetime DOM double. This does not claim layout or browser QA.
class Element {
 constructor(tag,doc){this.tagName=tag.toUpperCase();this.ownerDocument=doc;this.children=[];this.attributes={};this.dataset={};this.value='';this.checked=false;this.disabled=false;this.parentNode=null;this._text='';}
 get isConnected(){return Boolean(this.connected||this.parentNode?.isConnected);}
 setAttribute(key,value){this.attributes[key]=String(value);}
 getAttribute(key){return this.attributes[key]??null;}
 append(...nodes){for(const node of nodes){node.parentNode=this;this.children.push(node);}}
 replaceChildren(...nodes){for(const node of this.children)node.parentNode=null;this.children=[];this._text='';this.append(...nodes);}
 remove(){if(this.parentNode){this.parentNode.children=this.parentNode.children.filter(node=>node!==this);this.parentNode=null;}}
 set textContent(value){this.replaceChildren();this._text=String(value);}
 get textContent(){return this._text+this.children.map(node=>node.textContent).join(' ');}
 set innerHTML(html){
  this.replaceChildren();this.markup=html;
  // All controls use unique data attributes. Their nesting is irrelevant to
  // these tests; real parsing, CSS and native controls belong to the UI fixture.
  for(const match of html.matchAll(/<([a-z]+)\b[^>]*\b(data-nc-review-[a-z]+)(?:\s|>)[^>]*>/g)){
   const node=this.ownerDocument.createElement(match[1]);node.setAttribute(match[2],'');this.append(node);
  }
 }
 querySelector(selector){const name=selector.match(/^\[([^\]]+)\]$/)?.[1];for(const child of this.children){if(name&&Object.hasOwn(child.attributes,name))return child;const found=child.querySelector(selector);if(found)return found;}return null;}
}
const doc={createElement:tag=>new Element(tag,doc)};
const source={consecutivo:'NC-17',orden:'982383 - Producción completa',sistema:'ES-TEST',semana_maestro:45,estado_nc:'ABIERTA',activo:true,linea_responsable:'PANELES 2',cant_repo:90};
const fresh=()=>({status:'READY',count:1,candidates:[{reference:source.consecutivo,source:{...source},sources:[{...source}],sameResponsibleLine:true}]});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const tick=async()=>{for(let i=0;i<5;i++)await Promise.resolve();};
function fixture(options={}){
 const host=doc.createElement('div');host.connected=true;
 const row={key:'1314100|PANELES_2',produccion:source.orden,oficial:{sistema:source.sistema},linea:'PANELES_2'},scope={line:'PANELES_2',stage:'ENSAMBLE'};
 const calls=[],prepared=[];let current=true;
 const dispose=mountNcGlassReview(host,{row,scope,isCurrent:()=>current,
  readCandidates:async args=>{calls.push(args);return options.read?options.read(args):fresh();},
  onPrepare:async choice=>{prepared.push(choice);return options.prepare?.(choice);}
 });
 const get=name=>host.querySelector('[data-nc-review-'+name+']');
 const select=async(name,value)=>{get(name).value=value;await get(name).onchange?.();};
 const choose=async()=>{await select('reference','0');await select('stage','EMPAQUE');get('confirm').checked=true;await get('confirm').onchange();};
 return {host,row,scope,calls,prepared,get,select,choose,dispose,setCurrent:value=>current=value};
}

test('DOM controls never preselect a sole NC or the current scope stage',async()=>{
 const x=fixture();await tick();
 assert.equal(x.get('reference').value,'');assert.equal(x.get('stage').value,'');assert.equal(x.get('confirm').checked,false);assert.equal(x.get('prepare').disabled,true);
 assert.doesNotMatch(x.get('order').textContent,/1314100\|PANELES_2/);assert.match(x.get('order').textContent,/982383 - Producción completa/);
 assert.match(x.get('list').textContent,/1314100\|PANELES_2/);const disclosure=x.get('list').children[0].children.find(node=>node.tagName==='DETAILS');assert.ok(disclosure);assert.equal(disclosure.getAttribute('open'),null);
 assert.match(x.get('list').textContent,/Posible relación · Sin afectación registrada para esta NC/);
 assert.match(x.get('list').textContent,/ABIERTA/);assert.match(x.get('list').textContent,/PANELES 2/);
 await x.get('prepare').onclick();assert.equal(x.prepared.length,0);assert.equal(x.calls.length,1);
 await x.select('reference','0');assert.equal(x.get('prepare').disabled,true);
 await x.select('stage','EMPAQUE');assert.equal(x.get('prepare').disabled,true);
 x.dispose();
});

test('DOM prepare force-refreshes before the callback, and duplicate clicks do not dispatch twice',async()=>{
 const wait=deferred();let reads=0;
 const x=fixture({read:()=>++reads===1?fresh():wait.promise});await tick();await x.choose();
 const first=x.get('prepare').onclick();await x.get('prepare').onclick();
 assert.deepEqual(x.calls,[{force:false},{force:true}]);assert.equal(x.prepared.length,0);assert.equal(x.get('prepare').disabled,true);
 wait.resolve(fresh());await first;
 assert.equal(x.prepared.length,1);assert.equal(x.prepared[0].reference,'NC-17');assert.equal(x.prepared[0].stage,'EMPAQUE');
 assert.deepEqual(Object.keys(x.prepared[0]),['reference','stage','source']);assert.equal(x.get('prepare').disabled,true);
 await x.get('prepare').onclick();assert.equal(x.prepared.length,1);
 x.dispose();
});

test('changing either explicit choice invalidates the checkbox',async()=>{
 const x=fixture();await tick();await x.choose();assert.equal(x.get('prepare').disabled,false);
 await x.select('stage','ENSAMBLE');assert.equal(x.get('confirm').checked,false);assert.equal(x.get('prepare').disabled,true);
 await x.choose();await x.select('reference','0');assert.equal(x.get('confirm').checked,false);assert.equal(x.get('prepare').disabled,true);
 x.dispose();
});

test('failed initial reads remain unavailable, while a successful empty read reports no candidates',async()=>{
 for(const read of [()=>({status:'UNAVAILABLE',count:null,candidates:[]}),()=>({status:'UNAUTHORIZED',count:null,candidates:[]}),()=>{throw Error('network');}]){
  const x=fixture({read});await tick();assert.doesNotMatch(x.get('status').textContent,/Sin candidatas|0 NC/);assert.equal(x.get('prepare').disabled,true);assert.equal(x.get('list').children.length,0);x.dispose();
 }
 const x=fixture({read:()=>({status:'READY',count:0,candidates:[]})});await tick();assert.match(x.get('status').textContent,/Sin candidatas/);assert.equal(x.get('prepare').disabled,true);x.dispose();
});

test('failed, missing, inactive or changed forced evidence never prepares from the previous result',async()=>{
 for(const change of [
  ()=>({status:'UNAVAILABLE',count:null,candidates:[]}),()=>({status:'UNAUTHORIZED',count:null,candidates:[]}),
  ()=>({status:'READY',count:0,candidates:[]}),()=>{throw Error('network');},
  ()=>{const r=fresh();r.candidates[0].source.activo=false;return r;},
  ()=>{const r=fresh();r.candidates[0].source.linea_responsable='FRAMES 2';r.candidates[0].sources=[r.candidates[0].source];return r;}
 ]){
  let reads=0;const x=fixture({read:()=>++reads===1?fresh():change()});await tick();await x.choose();await x.get('prepare').onclick();
  assert.equal(x.prepared.length,0);assert.equal(x.get('reference').value,'');assert.equal(x.get('confirm').checked,false);assert.equal(x.get('prepare').disabled,true);
  assert.equal(x.get('list').children.length,0);assert.doesNotMatch(x.get('status').textContent,/0 NC/);x.dispose();
 }
});

test('late responses after session, exact row, scope or attachment change never prepare',async()=>{
 for(const invalidate of [x=>x.setCurrent(false),x=>x.row.key='different',x=>x.row.oficial.sistema='different',x=>x.scope.stage='EMPAQUE',x=>x.host.connected=false]){
  const wait=deferred();let reads=0;const x=fixture({read:()=>++reads===1?fresh():wait.promise});await tick();await x.choose();
  const action=x.get('prepare').onclick();invalidate(x);wait.resolve(fresh());await action;assert.equal(x.prepared.length,0);x.dispose();
 }
});

test('disposing a pending read removes only its own UI and ignores late data',async()=>{
 const wait=deferred(),x=fixture({read:()=>wait.promise});x.dispose();
 const replacement=doc.createElement('p');replacement.textContent='New detail';x.host.append(replacement);
 wait.resolve(fresh());await tick();assert.equal(x.prepared.length,0);assert.equal(x.host.children.length,1);assert.equal(x.host.textContent,'New detail');x.dispose();
});

test('refresh clears every earlier choice and does not prepare or confirm automatically',async()=>{
 const x=fixture();await tick();await x.choose();x.get('refresh').onclick();await tick();
 assert.deepEqual(x.calls,[{force:false},{force:true}]);assert.equal(x.get('reference').value,'');assert.equal(x.get('stage').value,'');assert.equal(x.get('confirm').checked,false);assert.equal(x.prepared.length,0);x.dispose();
});

test('an async preparation failure preserves the exact plain-text error and requires confirmation again',async()=>{
 const message='Guarda o descarta el borrador antes de continuar. <img src=x>';
 const x=fixture({prepare:()=>{throw Error(message);}});await tick();await x.choose();await x.get('prepare').onclick();
 assert.equal(x.prepared.length,1);assert.equal(x.get('status').textContent,message);assert.equal(x.get('status').children.length,0);assert.equal(x.get('confirm').checked,false);assert.equal(x.get('prepare').disabled,true);x.dispose();
});
