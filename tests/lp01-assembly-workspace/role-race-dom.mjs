import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const {parseHTML}=await import(process.env.LP_DOM_PACKAGE||'linkedom');
const {window}=parseHTML('<html><body><button id="productionAssemblyTab" role="tab">Ensamble</button><button id="productionPackingTab" role="tab">Empaque</button><button id="productionOperationTab" role="tab">Operación</button><button id="productionReportsTab" role="tab">Reportes</button><section id="tracking"><header class="lp-followup-heading"><h3>Seguimiento</h3></header><div class="lp-followup-filters"><label>Línea<select data-line><option>PANELES_2</option></select></label>'+['week','day','shift','progress','sort'].map(n=>'<label><input data-'+n+'></label>').join('')+'<input data-search></div><p data-status></p><div data-list></div><div data-summary></div></section><section id="operation"><div data-operation-detail></div></section><section id="productionReportsPanel"></section><section id="productionDashboardPanel"></section></body></html>');
for(const name of ['document','MutationObserver','HTMLElement','HTMLInputElement','Event','CustomEvent'])globalThis[name]=window[name];globalThis.window=window;globalThis.CSS={escape:v=>String(v)};
for(const proto of [window.Element.prototype,window.Document.prototype])for(const name of ['querySelector','querySelectorAll']){const original=proto[name];proto[name]=function(selector){return original.call(this,selector.replaceAll(':modal','[open]'));};}
Object.defineProperty(window.HTMLSelectElement.prototype,'value',{get(){const option=this.querySelector('option[selected]')||this.querySelector('option');return option?.getAttribute('value')??option?.textContent??'';},set(value){for(const option of this.querySelectorAll('option'))option.selected=(option.getAttribute('value')??option.textContent)===value;},configurable:true});
Object.defineProperty(window.HTMLElement.prototype,'elements',{get(){return new Proxy([...this.querySelectorAll('input,select,textarea,button')],{get:(list,key)=>Reflect.get(list,key)??list.find(n=>n.getAttribute('name')===key)});}});
window.HTMLElement.prototype.focus=function(){};window.HTMLElement.prototype.setCustomValidity=function(){};window.HTMLElement.prototype.showModal=function(){this.open=true;};window.HTMLElement.prototype.close=function(){this.open=false;};
const intervals=new Set(),set=globalThis.setInterval,clear=globalThis.clearInterval;globalThis.setInterval=(...a)=>{const t=set(...a);intervals.add(t);return t;};globalThis.clearInterval=t=>{intervals.delete(t);clear(t);};
const {mountOperation}=await import('../../src/modules/lp01-operation.js');
const tracking=document.querySelector('#tracking'),operation=document.querySelector('#operation');let token='authenticated-admin',calls=0;
// Authentication completed before lazy module mounted: the old event has already gone.
document.dispatchEvent(new CustomEvent('sgp:lp-role',{detail:'ADMINISTRADOR'}));
const api=mountOperation({tracking,operation,bridge:{getToken:()=>token,getRole:()=>token==='authenticated-admin'?'ADMINISTRADOR':null,getClient:async()=>({rpc:async name=>{if(name==='sgp_lp_seguimiento_consultar'){calls++;return {error:{code:'QA_END',message:'Reached protected RPC'}};}return {error:{message:'Not used'}};}})}});
try{
 document.dispatchEvent(new CustomEvent('sgp:production-panel',{detail:'seguimiento'}));await new Promise(r=>setTimeout(r,15));
 assert.equal(calls,1,'late mount must recover already-validated presentation role');assert.match(tracking.querySelector('[data-op-status]').textContent,/Reached protected RPC/);
 document.dispatchEvent(new CustomEvent('sgp:lp-role',{detail:'CONSULTA'}));await api.load();assert.equal(calls,1,'role revocation must still stop protected request');assert.match(tracking.querySelector('[data-op-status]').textContent,/no autorizado/);
 console.log('PASS late mounted role hydration and subsequent role revocation; protected RPC unchanged');
}finally{for(const id of intervals)clear(id);}
