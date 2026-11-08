import {materialContext} from '../domain/lp01-sources.js';
import {assemblySheetRows} from '../domain/lp01-assembly-sheet.js';
import {renderAssemblySheet} from './lp01-assembly-sheet.js';
import {mountTrackingAffectations} from './lp01-tracking-affectations.js';
import {compactSummaryMarkup} from './lp01-affectation-summary.js';
import {affectationsTransport} from '../services/lp01-affectations.js';
import {sharedOrderTransport} from '../services/lp01-shared-order.js';
import {sharedOrderSummary} from '../domain/lp01-shared-order-summary.js';
import {orderDetailsTransport} from '../services/lp01-order-details.js';
import {withExportGlassSummary} from '../domain/lp01-export-glass-summary.js';
import {orderSaleTransport} from '../services/lp01-order-sale.js';
import {mountOrderSaleCell} from './lp01-order-sale-cell.js';

const esc=v=>String(v??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const amount=v=>v===null||v===undefined?'Pendiente':String(v);
const labels={ABIERTAS:'Abierta',PROGRAMADAS:'Programada',OTRAS:'Otras órdenes',POR_REVISAR:'Por revisar',COMPLETADAS:'Completada'};

/** B12/B13 share the existing order-scoped transports. No turn is opened and no
 * manual production quantity is written by viewing or refreshing this sheet. */
export function mountAssemblyWorkspace({host,bridge,isCurrent,onClose,onReports,onGlass,onCurrentPeriod=null,onIncorporate=null,canIncorporate=()=>false,noteRows=null,onAccessRevoked=null}){
 let data,context,rows=[],token,scope='',generation=0,selected=null,cause=null,detailDispose=null,saleDispose=null,provider=null,noteRowsProvider=null,flight=null;
 let state={},lastExternalSearch;const summaries=new Map(),summaryAt=new Map(),details=new Map();
 const visibleKeys=new Set(),observedSlots=new Map();
 const visibility=typeof IntersectionObserver==='undefined'?null:new IntersectionObserver(entries=>{for(const entry of entries){const key=observedSlots.get(entry.target);if(key){if(entry.isIntersecting)visibleKeys.add(key);else visibleKeys.delete(key);}}void refreshSummaries();},{rootMargin:'120px'});
 function observeSlots(){if(!visibility)return;for(const [slot,key] of observedSlots)if(!slot.isConnected){visibility.unobserve(slot);observedSlots.delete(slot);visibleKeys.delete(key);}for(const slot of host.querySelectorAll('[data-order-summary]'))if(!observedSlots.has(slot)){observedSlots.set(slot,slot.dataset.orderSummary);visibility.observe(slot);}}
 const alive=(version=generation)=>version===generation&&host.isConnected&&token===bridge.getToken()&&isCurrent();
 const noteProvider=key=>{const result=orderDetailsTransport({key,line:context.line,stage:context.stage,getToken:()=>alive()&&rows.some(r=>r.key===key)?token:null,client:{rpc:async(name,args)=>(await bridge.getClient()).rpc(name,args)}});result.onDetails=value=>{rememberDetails(key,value);paintNote(key);};return result;};
 const transport=key=>orderSaleTransport({key,stage:context.stage,getToken:()=>alive()&&rows.some(r=>r.key===key)?token:null,client:{rpc:async(name,args)=>(await bridge.getClient()).rpc(name,args)}});
 function disposeDetail(){detailDispose?.();saleDispose?.();detailDispose=null;saleDispose=null;}
 function canLeave(){
  const rowPending=[...host.querySelectorAll('[data-sale-retry],[data-incorporation-retry]')].some(button=>!button.hidden)||[...host.querySelectorAll('[data-order-note-save]')].some(button=>button.textContent.includes('Reintentar')||(button.disabled&&button.parentElement?.querySelector('[data-order-note-refresh]')?.disabled));
  const rowDirty=[...host.querySelectorAll('[data-order-note-discard]')].some(button=>!button.hidden);
  const pane=host.querySelector('section[data-assembly-detail]');
  if(!pane){if(!rowPending&&!rowDirty)return true;let notice=host.querySelector('[data-assembly-leave-status]');if(!notice){notice=document.createElement('p');notice.dataset.assemblyLeaveStatus='';notice.setAttribute('role','status');host.prepend(notice);}notice.textContent=rowPending?'Resuelve el guardado pendiente de Disponible u observación antes de salir de la hoja.':'Guarda o descarta el borrador de observación antes de salir de la hoja.';return false;}
  const noteSave=pane.querySelector('[data-order-note-save]'),noteDiscard=pane.querySelector('[data-order-note-discard]'),noteRefresh=pane.querySelector('[data-order-note-refresh]');
  const sharedForms=[...pane.querySelectorAll('[data-shared-form]')];
  const pendingNote=noteSave?.textContent.includes('Reintentar')||(noteSave?.disabled&&noteRefresh?.disabled);
  const pendingShared=sharedForms.some(form=>form.parentElement?.querySelector('[data-shared-discard]')?.disabled&&form.querySelector('input:disabled,textarea:disabled'));
  const dirtyNote=Boolean(noteDiscard&&!noteDiscard.hidden);
  const dirtyShared=sharedForms.some(form=>[...form.querySelectorAll('textarea,input[name=quantity],input[name=ncReference]')].some(el=>el.value?.trim()));
  const saleRetry=pane.querySelector('[data-sale-retry]'),pendingSale=Boolean(saleRetry&&!saleRetry.hidden);
  if(!rowPending&&!rowDirty&&!pendingNote&&!pendingShared&&!dirtyNote&&!dirtyShared&&!pendingSale)return true;
  let notice=pane.querySelector('[data-assembly-leave-status]');if(!notice){notice=document.createElement('p');notice.dataset.assemblyLeaveStatus='';notice.setAttribute('role','status');pane.prepend(notice);}
  notice.textContent=rowPending||pendingNote||pendingShared||pendingSale?'Resuelve el guardado pendiente en este detalle antes de cambiar de orden o salir.':'Guarda o descarta el borrador de este detalle antes de cambiar de orden o salir.';
  return false;
 }
 function clear(){++generation;lastExternalSearch=undefined;visibility?.disconnect();observedSlots.clear();visibleKeys.clear();disposeDetail();data=null;rows=[];scope='';selected=null;state={};summaries.clear();summaryAt.clear();details.clear();provider=null;host.classList.remove('lp-assembly-workspace','has-assembly-detail');host.replaceChildren();}
 function rememberDetails(key,value){const previous=details.get(key);if(previous?.note?.revision>value?.note?.revision)return previous;details.set(key,value);return value;}
 function paintNote(key){
  const body=host.querySelector('[data-assembly-body]'),value=details.get(key);if(!body)return;
  if(noteRows){noteRows.paintOrderNoteRows(body,key,value);return;}
  body.querySelectorAll('[data-note-order-key]').forEach(slot=>{if(slot.dataset.noteOrderKey!==key)return;slot.replaceChildren();const button=document.createElement('button');button.type='button';button.className='lp-assembly-link';button.textContent=value?.note?.observation||(value?'Sin observación':'Observación por consultar');button.onclick=()=>open(key);slot.append(button);});
 }
 function summaryFor(row){if(!row)return null;const value=summaries.get(row.key);return value&&value.balance!==row.balance?{...value,total:null,available:null}:value;}
 function update(next,ctx,{search=''}={}){
  const nextScope=JSON.stringify([bridge.getToken(),ctx.line,ctx.stage,ctx.date,ctx.shift]);
  if(scope!==nextScope){clear();scope=nextScope;token=bridge.getToken();context={...ctx};provider=key=>transport(key);noteRowsProvider=key=>noteProvider(key);}
  data=next;rows=assemblySheetRows(data,context,{includeCompleted:true});if(search!==lastExternalSearch){state.search=search;lastExternalSearch=search;}
  const periodState=host.querySelector('[data-assembly-period-state]');if(periodState&&periodState.textContent!==periodLabel())periodState.textContent=periodLabel();const currentButton=host.querySelector('[data-assembly-current]');if(currentButton)currentButton.hidden=!canConsultCurrent();
  if(selected&&!rows.some(r=>r.key===selected)){selected=null;disposeDetail();}
  // Keep the exact shared editor and its pending CAS command during quiet reads.
  if(selected&&host.querySelector('[data-assembly-detail]')){
   const fresh=rows.find(r=>r.key===selected);paintDetailNumbers(fresh);return;
  }
  render();
 }
 function canConsultCurrent(){const p=data?.schedule?.currentPeriod;return Boolean(onCurrentPeriod&&data?.schedule?.contract==='LP-HOJA-HORARIO-1'&&data.schedule.status==='AVAILABLE'&&p&&/^\d{4}-\d{2}-\d{2}$/.test(p.date)&&[1,2].includes(p.shift)&&(p.date!==context.date||p.shift!==context.shift));}
 function periodLabel(){
  const schedule=data.schedule,period=schedule?.currentPeriod;
  const current=schedule?.status==='AVAILABLE'&&period&&period.date===context.date&&period.shift===context.shift;
  return (data.turn?.estado??'Sin estado')+(period?' · Horario vigente '+period.date+' / T'+period.shift:' · Horario del servidor no disponible')+(current?' · Turno actual':'');
 }
 function header(){
  return (context.stage==='EMPAQUE'&&rows.some(r=>r.scheduleUnavailable)?'<p class="lp-source-note" data-packing-plan-pending>Programación específica de Empaque pendiente de conectar. Se muestran las órdenes ya incorporadas a Empaque; no se copia la programación de Ensamble.</p>':'')+'<header class="lp-assembly-heading"><div><span class="eyebrow">Hoja de '+(context.stage==='EMPAQUE'?'Empaque':'Ensamble')+'</span><h3>'+esc(context.line)+' · '+esc(context.date)+' / T'+context.shift+'</h3><p data-assembly-period-state>'+esc(periodLabel())+'</p></div><div class="lp-assembly-actions"><button type="button" data-assembly-current '+(!canConsultCurrent()?'hidden':'')+'>Consultar turno actual</button><button type="button" data-assembly-close>Revisar cierre del turno</button><button type="button" data-assembly-reports>Cierres e informes</button></div></header>';
 }
 function render(){
  disposeDetail();host.classList.add('lp-assembly-workspace');host.classList.toggle('has-assembly-detail',Boolean(selected));
  const existing=host.querySelector('[data-assembly-body]');
  if(!existing||selected||existing.classList.contains('lp-assembly-detail-layout'))host.innerHTML=header()+'<div data-assembly-body></div>';
  host.querySelector('[data-assembly-current]').onclick=()=>{if(canConsultCurrent()&&canLeave())onCurrentPeriod({...data.schedule.currentPeriod});};
  host.querySelector('[data-assembly-close]').onclick=()=>{if(canLeave())onClose();};host.querySelector('[data-assembly-reports]').onclick=()=>{if(canLeave())onReports();};
  const body=host.querySelector('[data-assembly-body]');
  if(selected){renderDetail(body,rows.find(r=>r.key===selected));return;}
  renderAssemblySheet({host:body,data,context,state,onDetail:row=>open(row.key),onGlass:context.stage==='ENSAMBLE'?onGlass:null,onAffectations:({row,cause:nextCause})=>open(row.key,nextCause),summaryFor,orderSaleProvider:provider,beforeRender:({host:table,rows:all})=>noteRows?noteRows.retainOrderNoteRows(table,noteRowsProvider,all.map(r=>({...r,orderDetails:details.get(r.key)}))):()=>all.forEach(r=>paintNote(r.key))});
  observeSlots();refreshSummaries();
 }
 function open(key,nextCause=null){if(!rows.some(r=>r.key===key)||!canLeave())return;selected=key;cause=nextCause;render();host.querySelector('[data-assembly-detail]')?.focus({preventScroll:true});}
 function paintDetailNumbers(row){
  if(!row)return;
  const number=host.querySelector('[data-assembly-balance]');if(number)number.textContent=amount(row.balance);
  const realized=host.querySelector('[data-assembly-realized]');if(realized)realized.textContent=amount(row.realized);
 }
 async function renderDetail(body,row){
  if(!row)return;
  const version=generation,key=row.key,current=()=>alive(version)&&selected===key&&body.isConnected;
  const incorporationEnabled=Boolean(context.stage==='ENSAMBLE'&&onIncorporate&&canIncorporate()&&row.oficial.activa==='SI');
  let material;try{if(data.materialContext?.status==='AVAILABLE')material=materialContext(data.materialContext,row);}catch{}
  const materials='<details class="lp-assembly-materials"><summary>Mecanizado y contexto de materiales</summary><p>Mecanizado: '+esc(material?.mechanized??'Sin fuente acreditada para esta producción')+'</p><p>'+esc(material?.note??'Sin observación de Mecanizado acreditada')+'</p><p>Aluminio: '+esc(material?.ambiguousByName?'Resumen omitido por producciones homónimas':material?.pending??'Consulta los pendientes por producción en las afectaciones')+'</p><p>Este contexto no libera ventanas ni modifica Disponible.</p></details>';
  body.className='lp-assembly-detail-layout';
  body.innerHTML='<aside class="lp-assembly-order-nav" aria-label="Órdenes de '+(context.stage==='EMPAQUE'?'Empaque':'Ensamble')+'"><button type="button" data-assembly-back>← Volver a la hoja</button>'+rows.filter(r=>r.state!=='COMPLETADAS'||r.key===key).map(r=>'<button type="button" data-assembly-select="'+esc(r.key)+'" aria-current="'+(r.key===key)+'" class="assembly-state-'+r.state.toLowerCase()+'"><b>'+esc(r.produccion)+'</b><small>'+esc(r.week?.label??'Semana pendiente')+' · '+esc(r.oficial.sistema)+'</small><small>'+esc(labels[r.state])+' · Saldo '+amount(r.balance)+'</small></button>').join('')+'</aside><section class="lp-assembly-detail-pane" data-assembly-detail tabindex="-1"><header><h3>'+esc(row.produccion)+'</h3><p>'+esc(row.oficial.sistema)+' · Reserva '+esc(row.oficial.reserva_al)+' · '+esc(row.week?.label??'Semana pendiente')+'</p></header><div class="lp-followup-summary"><div>Saldo '+(context.stage==='EMPAQUE'?'Empaque':'Ensamble')+' · Export<b data-assembly-balance>'+amount(row.balance)+'</b></div><div>Disponible<div data-assembly-available></div></div><div>Realizado · cierre / Export<b data-assembly-realized>'+amount(row.realized)+'</b></div></div><p class="lp-source-note">El realizado proviene de la fuente validada del turno. Las observaciones y afectaciones se comparten por producción; no se duplican al cambiar de turno.</p><div class="lp-assembly-actions">'+(context.stage==='ENSAMBLE'?'<button type="button" data-assembly-glass>Vidrio y ubicaciones</button>':'')+(context.stage==='ENSAMBLE'&&row.state==='OTRAS'?'<button type="button" data-assembly-incorporate '+(!incorporationEnabled?'disabled':'')+'>Incorporar al turno con motivo</button>':'')+'</div>'+(context.stage==='ENSAMBLE'&&row.state==='OTRAS'&&!incorporationEnabled?'<p class="lp-source-note">'+(row.oficial.activa!=='SI'?'La producción no está confirmada activa; no se puede incorporar.':'La incorporación por el líder todavía no está habilitada por el contrato del servidor.')+'</p>':'')+materials+'<section data-assembly-affectations>Consultando afectaciones y observación compartida…</section></section>';
  body.querySelector('[data-assembly-back]').onclick=()=>{if(!canLeave())return;selected=null;cause=null;render();};
  body.querySelectorAll('[data-assembly-select]').forEach(b=>b.onclick=()=>open(b.dataset.assemblySelect));
  if(context.stage==='ENSAMBLE')body.querySelector('[data-assembly-glass]').onclick=()=>{if(canLeave())onGlass(row);};
  body.querySelector('[data-assembly-incorporate]')?.addEventListener('click',()=>{if(incorporationEnabled&&canLeave())onIncorporate?.(row);});
  const saleHost=body.querySelector('[data-assembly-available]'),detailHost=body.querySelector('[data-assembly-affectations]');
  void mountOrderSaleCell(saleHost,transport(key)).then(dispose=>{if(current())saleDispose=dispose;else dispose?.();});
  try{
   const client=await bridge.getClient();if(!current())return;
   const dispose=await mountTrackingAffectations({host:detailHost,row,target:row.first,cause,scope:context,client,getToken:()=>current()?bridge.getToken():null,isCurrent:current,initialDetails:details.get(key),getLatestDetails:()=>details.get(key),onDetails:value=>{if(current())rememberDetails(key,value);},onSummary:value=>{if(current()){summaries.set(key,value);summaryAt.set(key,Date.now());}}});
   if(current())detailDispose=dispose;else dispose?.();
  }catch(error){if(current())detailHost.textContent='No se pudieron consultar afectaciones: '+error.message;}
 }
 async function refreshSummaries(){
  if(flight||selected||!alive())return;
  const version=generation,keys=[...new Set([...host.querySelectorAll('[data-order-summary]')].map(n=>n.dataset.orderSummary))].filter(key=>(!visibility||visibleKeys.has(key))&&Date.now()-(summaryAt.get(key)||0)>20000);
  if(!keys.length)return;let cursor=0;flight=version;
  try{
   const client=await bridge.getClient();
   await Promise.all(Array.from({length:Math.min(3,keys.length)},async()=>{while(cursor<keys.length&&alive(version)&&!selected){
    const key=keys[cursor++],getToken=()=>alive(version)&&rows.some(r=>r.key===key)?bridge.getToken():null;
    try{
     const outcomes=await Promise.allSettled([affectationsTransport({client,getToken,contractVersion:2,context:{key,line:context.line,stage:context.stage}}).read(),sharedOrderTransport({client,getToken,key,line:context.line,stage:context.stage}).read(),orderDetailsTransport({client,getToken,key,line:context.line,stage:context.stage}).read()]);
     if(!alive(version))return;if(!rows.some(r=>r.key===key))continue;
     if(outcomes.some(result=>result.status==='rejected'&&result.reason.message==='NO_AUTORIZADO'))throw Error('NO_AUTORIZADO');
     const [native,shared,note]=outcomes,detail=note.status==='fulfilled'?note.value:null;
     const base=native.status==='fulfilled'&&shared.status==='fulfilled'?sharedOrderSummary(native.value,shared.value):{status:'UNAVAILABLE'};
     const summary=withExportGlassSummary(base,detail,{key,line:context.line,stage:context.stage});summaries.set(key,summary);rememberDetails(key,detail);paintNote(key);
    }catch(error){if(!alive(version))return;if(error.message==='NO_AUTORIZADO'){clear();onAccessRevoked?.();host.textContent='Acceso revocado. Vuelve a consultar la hoja.';return;}summaries.set(key,{status:'UNAVAILABLE'});}
    summaryAt.set(key,Date.now());
    if(!selected)host.querySelectorAll('[data-order-summary]').forEach(slot=>{if(slot.dataset.orderSummary===key){slot.innerHTML=compactSummaryMarkup(summaryFor(rows.find(r=>r.key===key)));slot.querySelectorAll('[data-summary-cause]').forEach(button=>button.onclick=()=>open(key,button.dataset.summaryCause));}});
   }}));
  }finally{if(flight===version)flight=null;}
 }
 const observer=new MutationObserver(()=>{if(data&&!selected){observeSlots();void refreshSummaries();}});observer.observe(host,{childList:true,subtree:true});
 return {update,clear,open,canLeave,get editing(){return Boolean(selected);}};
}
