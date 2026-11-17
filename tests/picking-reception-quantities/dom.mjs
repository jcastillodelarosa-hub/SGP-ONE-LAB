import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {pathToFileURL} from 'node:url';
const {JSDOM}=await import(pathToFileURL(process.env.SGP_JSDOM_MODULE).href);
const {initPickingReceptionReport}=await import('../../src/modules/picking-reception-report-controller.js');
const dom=new JSDOM(readFileSync('index.html','utf8'),{url:'http://localhost/'});globalThis.document=dom.window.document;globalThis.window=dom.window;globalThis.AbortController=dom.window.AbortController;globalThis.matchMedia=()=>({matches:false});
dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true};dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new dom.window.Event('close'))};dom.window.HTMLElement.prototype.checkVisibility=function(){return !this.hidden};
const $=id=>document.getElementById(id),tick=()=>new Promise(r=>setTimeout(r,0));let token='test',resolvePending=null,mode='ok';
const rows=[{id_recepcion:'r1',id_programacion:'p1',produccion:'DEMO-1',semana_programada:47,cantidad_programada:20,pendientes_al_recibir:[],fecha_recepcion:'2026-11-16',completa_al_recibir:true},{id_recepcion:'r2',id_programacion:'p2',produccion:'DEMO-2',semana_programada:9,cantidad_programada:10,pendientes_al_recibir:[{ventanas_afectadas:2,cantidad:3}],fecha_recepcion:'2026-11-16',completa_al_recibir:false}];
const payload={data:{ok:true,contract_version:1,total_rows:2,rows}};
initPickingReceptionReport({getAppToken:()=>token,getSupabaseClient:async()=>({rpc:async(name)=>{assert.equal(name,'sgp_picking_reporte_recepciones_v1');return mode==='defer'?new Promise(r=>resolvePending=r):payload}})});
$('pickReceptionReportRun').click();await tick();await tick();assert.match($('pickReceptionReportSummary').textContent,/Total programado30/);assert.match($('pickReceptionReportSummary').textContent,/Total efectivo28/);
const week=()=>document.querySelector('[data-report-column="semana_programada"]');week().click();document.querySelector('[data-column-none]').click();document.querySelector('[data-column-cancel]').click();assert.equal($('pickReceptionReportRows').querySelectorAll('tbody tr').length,2);assert.equal(document.activeElement,week());
week().click();document.querySelector('[data-column-order="asc"]').click();assert.equal($('pickReceptionReportRows').querySelector('tbody tr td').textContent,'9');
week().click();document.querySelector('[data-column-none]').click();const input=document.querySelector('[data-column-value="47"]');input.checked=true;input.dispatchEvent(new dom.window.Event('change'));document.querySelector('[data-column-apply]').click();assert.equal($('pickReceptionReportRows').querySelectorAll('tbody tr').length,1);assert.match($('pickReceptionReportSummary').textContent,/Total programado20/);
week().click();document.querySelector('[data-column-none]').click();document.querySelector('[data-column-apply]').click();assert.match($('pickReceptionReportRows').textContent,/No hay recepciones/);assert.equal($('pickReceptionReportExport').disabled,true);
// Reload resets column filters; stale responses remain discarded.
$('pickReceptionReportRun').click();await tick();await tick();assert.equal($('pickReceptionReportRows').querySelectorAll('tbody tr').length,2);
mode='defer';$('pickReceptionReportRun').click();await tick();token='changed';resolvePending(payload);await tick();assert.equal($('pickReceptionReportRows').textContent,'');
console.log('DOM PASS: totals, cancel/focus, numeric sort, select/filter, empty state, reload and stale session');
