import {affectationSummary} from '../domain/lp01-affectation-summary.js';
import {compactSummaryMarkup as summaryMarkup} from './lp01-affectation-summary.js';
import {mountTrackingAffectations} from './lp01-tracking-affectations.js';
import {enrichOperationEvidence} from '../services/lp01-operation-evidence.js';
import {mountProposal} from './lp01-proposal.js';
import {operationOrders,validateTurnEntry} from '../domain/lp01-operation-orders.js';
import {operationOrderList} from './lp01-operation-orders.js';
import {affectationsTransport} from '../services/lp01-affectations.js';
import {mountAffectationsPanel} from './lp01-affectations-panel.js';
import {globalTrackingData,trackingIdentity} from '../domain/lp01-tracking-global.js';
import {renderTracking} from './lp01-tracking.js';
import {materialContext} from '../domain/lp01-sources.js';
import {parsePowerBI,reconcilePowerBI,bytesBase64,POWERBI_VERSION} from '../domain/powerbi/adapter.js';
import {importPowerBI} from './lp01-powerbi-client.js';
import {operationalRows,officialBalance,quantity,AFFECTATIONS,validateAffectations,reportCSV,salePendingReason} from '../domain/lp01-operation.js';
const esc=v=>String(v??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const progress=r=>r.total_etapa_parte>=r.programada?'Parte ejecutada':r.sale===null?'SALE por validar':r.ejecutado>=r.sale&&r.sale>0?'SALE cubierto':r.ejecutado>0?'En proceso':'Pendiente';
const n=v=>v===null||v===undefined?'Por validar':String(v);
/** Real RPC controller. Missing installation is explicit, never replaced with a write stub. */
export function mountOperation({tracking,operation,bridge,legacyLoad}){
 let data=null,context=null,selected=null,seq=0,pending=null,busy=false,bi=null,fileId=null,session=null,loading=false,missing=false,dirty=false,fileSequence=0;
 let viewPanel='planificador',trackingViewState={},globalData=null,globalContext=null,globalSession=null,trackingRole=null,globalRequest=null,globalQueued=false;
 let operationRequest=null,enrichment=null;
 const trackingStates=new Map();
 let summaryFlight=null,summaryScope=null;const summaries=new Map();
 document.addEventListener('sgp:lp-role',e=>{trackingRole=e.detail;if(globalSession!==bridge.getToken()||!['COORDINADOR','ADMINISTRADOR'].includes(trackingRole)){globalData=null;trackingStates.clear();if(viewPanel==='seguimiento'){++seq;loading=false;live.replaceChildren();message.textContent='Seguimiento no autorizado';}}});
 const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 tracking.querySelector('.lp-followup-filters').insertAdjacentHTML('afterend','<div class="lp-operational-context"><label>Etapa<select data-op-stage><option>ENSAMBLE</option><option>EMPAQUE</option></select></label><label>Fecha operativa<input type="date" data-op-date value="'+today()+'"></label><label>Turno<select data-op-shift><option value="1">Turno 1</option><option value="2">Turno 2</option></select></label><button type="button" data-op-load>Consultar turno</button><span data-op-status role="status"></span><button type="button" data-retry-pending hidden>Reintentar guardado sin respuesta</button></div><section data-live-orders></section>');
 const get=s=>tracking.querySelector(s),live=get('[data-live-orders]'),message=get('[data-op-status]');
 get('[data-live-orders]').insertAdjacentHTML('beforebegin','<nav data-tracking-stages hidden aria-label="Etapa de Seguimiento"><button type="button" data-tracking-stage="ENSAMBLE">Ensamble</button><button type="button" data-tracking-stage="EMPAQUE">Empaque</button></nav>');
 get('[data-tracking-stages]').querySelectorAll('button').forEach(b=>b.onclick=()=>{get('[data-op-stage]').value=b.dataset.trackingStage;load();});
 const capture=()=>({line:tracking.querySelector('[data-line]').value,stage:get('[data-op-stage]').value,date:get('[data-op-date]').value,shift:Number(get('[data-op-shift]').value)});
 const coordinator=()=>['COORDINADOR','ADMINISTRADOR'].includes(data?.role);
 const writeCompatible=()=>data?.writeContract==='LP-OPERACION-CAS-2';
 const writable=()=>writeCompatible()&&data?.writes&&(!data.operations||data.operations.includes('EJECUTAR'))&&data?.role!=='CONSULTA'&&data?.turn.estado!=='CERRADO'&&(data?.turn.estado!=='EN_REVISION'||coordinator());
 async function rpc(name,args,{signal}={}){const token=bridge.getToken();if(!token)throw Error('Inicia sesión para consultar');const client=await bridge.getClient();let query=client.rpc(name,{p_token:token,...args});if(signal&&typeof query.abortSignal==='function')query=query.abortSignal(signal);const r=await query;if(r.error)throw r.error;return r.data;}
 function globalControls(global){
  // The shared controls remain available in Ensamble/Empaque, outside Seguimiento.
  tracking.querySelector('.lp-followup-heading').hidden=global;
  tracking.querySelector('.lp-followup-filters').hidden=global;
  get('[data-op-load]').hidden=global;
  for(const sel of ['[data-op-date]','[data-op-shift]','[data-op-stage]'])get(sel).closest('label').hidden=global;
  get('[data-op-load]').textContent=global?'Actualizar Seguimiento':'Consultar turno';
  get('[data-tracking-stages]').hidden=!global;
 }
 async function loadGlobal({quiet=false}={}){
  const token=bridge.getToken(),ctx=capture(),scope=JSON.stringify([token,ctx.line,ctx.stage]);
  const sameScope=token===globalSession&&ctx.line===globalContext?.line&&ctx.stage===globalContext?.stage;
  if(!sameScope){globalData=null;live.replaceChildren();if(token!==globalSession)trackingStates.clear();}
  if(busy)return;
  if(globalRequest){if(globalRequest.scope!==scope||globalRequest.request!==seq){++seq;globalQueued=true;}return;}
  const request=++seq;globalRequest={scope,request};loading=true;globalControls(true);
  if(!quiet||!sameScope){live.replaceChildren();message.textContent='Consultando todas las semanas…';}
  try{
   if(!['COORDINADOR','ADMINISTRADOR'].includes(trackingRole))throw Error('Seguimiento no autorizado');
   const next=await rpc('sgp_lp_seguimiento_consultar',{p_etapa:ctx.stage,p_linea:ctx.line});
   if(request!==seq||viewPanel!=='seguimiento')return;
   if(token!==bridge.getToken())throw Error('La sesión cambió. Vuelve a consultar.');
   const normalized=globalTrackingData(next,ctx),changed=JSON.stringify(normalized)!==JSON.stringify(globalData);
   globalData=normalized;globalContext=ctx;globalSession=token;
   if(summaryScope!==scope){summaryScope=scope;summaries.clear();}
   const key=JSON.stringify([ctx.line,ctx.stage]);if(!trackingStates.has(key))trackingStates.set(key,{});trackingViewState=trackingStates.get(key);
   message.textContent='';const editing=quiet&&sameScope&&trackingViewState.open&&['Afectaciones','Materiales'].includes(trackingViewState.tab)&&globalData.orders.some(r=>trackingIdentity(r)===trackingViewState.selected);if(!editing&&(changed||!quiet||!sameScope))renderGlobal();
   refreshSummaries();
  }catch(e){if(request!==seq)return;globalData=null;live.replaceChildren();message.textContent='No se pudo consultar Seguimiento: '+e.message;}
  finally{if(globalRequest?.request===request)globalRequest=null;if(request===seq)loading=false;if(globalQueued){globalQueued=false;loading=false;if(viewPanel==='seguimiento')loadGlobal();}}
 }
 function summaryFor(row){const s=summaries.get(row.key);return s&&s.balance!==officialBalance(row,globalContext.stage)?{...s,total:null,available:null}:s;}
 function refreshSummaries(){
  if(summaryFlight||!globalData||viewPanel!=='seguimiento')return;
  const token=globalSession,scope=summaryScope,ctx={...globalContext},keys=globalData.orders.map(r=>r.key);let cursor=0;
  const alive=()=>token===bridge.getToken()&&scope===summaryScope&&viewPanel==='seguimiento'&&globalData;
  summaryFlight=(async()=>{const client=await bridge.getClient();
   await Promise.all(Array.from({length:Math.min(3,keys.length)},async()=>{while(cursor<keys.length&&alive()){
    const key=keys[cursor++];let summary;
    try{const transport=affectationsTransport({client,getToken:()=>alive()?bridge.getToken():null,contractVersion:2,context:{key,line:ctx.line,stage:ctx.stage}});summary=affectationSummary(await transport.read());}
    catch(error){if(!alive())return;if(error.message==='NO_AUTORIZADO'){++seq;loading=false;globalData=null;summaries.clear();live.replaceChildren();message.textContent='Acceso revocado. Vuelve a consultar.';return;}summary={status:'UNAVAILABLE'};}
    if(!alive())return;summaries.set(key,summary);
    live.querySelectorAll('[data-order-summary]').forEach(button=>{if(button.dataset.orderSummary===key){const row=globalData.orders.find(r=>r.key===key);const html=summaryMarkup(row?summaryFor(row):null);if(button.innerHTML!==html)button.innerHTML=html;}});
   }}));
  })().catch(()=>{}).finally(()=>{summaryFlight=null;if(scope!==summaryScope&&globalData)refreshSummaries();});
 }
 function renderGlobal(){
  if(!globalData||globalSession!==bridge.getToken())return;
  for(const sel of ['[data-week]','[data-day]','[data-shift]','[data-progress]','[data-sort]'])tracking.querySelector(sel).closest('label').hidden=true;
  for(const sel of ['[data-status]','[data-list]','[data-summary]'])tracking.querySelector(sel).hidden=true;
  get('[data-tracking-stages]').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.trackingStage===globalContext.stage)));
  renderTracking({host:live,data:{...globalData,orders:globalData.orders.map(r=>({...r,get affectationSummary(){return summaryFor(r);}}))},context:globalContext,state:trackingViewState,search:'',canReviewSale:true,
   onDetailClose:()=>renderGlobal(),
   onAffectations:async({host,row,target,cause})=>{
    const token=bridge.getToken(),scope=globalContext;host.textContent='Consultando afectaciones…';
    try{const client=await bridge.getClient();if(!host.isConnected||token!==bridge.getToken()||(scope.line!==globalContext?.line||scope.stage!==globalContext?.stage))return;
     await mountTrackingAffectations({host,row,target,cause,scope,client,getToken:()=>bridge.getToken(),isCurrent:()=>scope.line===globalContext?.line&&scope.stage===globalContext?.stage});
    }catch(error){if(host.isConnected)host.textContent='Afectaciones no disponibles: '+error.message;}
   },
   onOperate:async(id,focusSale,target)=>{
    if(!target||!globalData.orders.some(r=>trackingIdentity(r)===id&&r.operationTargets.some(t=>t.selectionId===target.selectionId)))return;
    get('[data-op-stage]').value=target.etapa;get('[data-op-date]').value=target.fecha;get('[data-op-shift]').value=String(target.turno);
    viewPanel='operacion';const token=bridge.getToken();selected=null;
    if(!await load()||token!==bridge.getToken()||viewPanel!=='operacion')return;
    const current=data.orders.find(r=>r.key===target.key&&r.parte===target.parte);if(!current){message.textContent='La asignación ya no está disponible en ese contexto.';return;}
    selected=current.parte;renderDetail();document.getElementById('productionOperationTab')?.click();if(focusSale)operation.querySelector('[data-sale]')?.focus();
   },onGlass:r=>glass(r)});
 }
 function stopEnrichment(){enrichment?.controller.abort();enrichment=null;}
 function startEnrichment(){
  if(!data||context.stage!=='ENSAMBLE'||enrichment)return;
  const token=bridge.getToken(),scope=JSON.stringify(context),controller=new AbortController(),job={controller};enrichment=job;
  enrichOperationEvidence(data,rpc,{signal:controller.signal}).then(enriched=>{
   if(enrichment!==job||!data||token!==bridge.getToken()||scope!==JSON.stringify(context))return;
   const byKey=new Map(enriched.orders.map(r=>[r.key,r.individualEvidence]));
   data={...data,orders:data.orders.map(r=>({...r,individualEvidence:byKey.get(r.key)||{status:'UNAVAILABLE',active:false}}))};
   render(); // Never replace an operation form or its draft after background reads.
  }).catch(error=>{if(enrichment===job&&!controller.signal.aborted&&token===bridge.getToken()&&scope===JSON.stringify(context)){++seq;loading=false;clear();message.textContent='No se pudo verificar el acceso: '+error.message;}}).finally(()=>{if(enrichment===job)enrichment=null;});
 }
 async function load({quiet=false}={}){
  if(viewPanel==='seguimiento'){stopEnrichment();return loadGlobal({quiet});}
  const scope=JSON.stringify([bridge.getToken(),capture()]);
  if(operationRequest){
   if(operationRequest.scope===scope)return operationRequest.promise;
   ++seq;clear();stopEnrichment();
   await operationRequest.promise;return load({quiet});
  }
  if(session!==bridge.getToken()||(context&&JSON.stringify(capture())!==JSON.stringify(context))){clear();stopEnrichment();}
  const promise=performLoad({quiet});operationRequest={scope,promise};
  try{return await promise;}finally{if(operationRequest?.promise===promise)operationRequest=null;}
 }
 async function performLoad({quiet=false}={}){
  globalControls(false);
  if(busy)return;loading=true;const request=++seq,ctx=capture(),token=bridge.getToken();if(!quiet){message.textContent='Consultando operación…';live.replaceChildren();}
  try{
   let next=await rpc('sgp_lp_operacion_consultar',{p_etapa:ctx.stage,p_linea:ctx.line,p_fecha:ctx.date,p_turno:ctx.shift});
   if(request!==seq)return;if(token!==bridge.getToken()){clear();message.textContent='La sesión cambió. Vuelve a consultar.';return;}
   operationalRows(next);const contextChanged=JSON.stringify(ctx)!==JSON.stringify(context)||session!==token;
   if(contextChanged){selected=null;bi=null;fileId=null;fileSequence++;stopEnrichment();}
   if(ctx.stage==='ENSAMBLE'){const prior=new Map(contextChanged?[]:(data?.orders||[]).map(r=>[r.key,r.individualEvidence]));next={...next,orders:next.orders.map(r=>({...r,individualEvidence:prior.get(r.key)||{status:'UNAVAILABLE',active:false}}))};}
   const previous=data?.orders.find(r=>r.parte===selected),current=next.orders.find(r=>r.parte===selected);const changed=previous&&current&&previous.revision!==current.revision;
   missing=false;data=next;context=ctx;session=token;message.textContent='Turno '+data.turn.estado+' · '+(data.writes?(writeCompatible()?'Contrato operativo disponible':'Contrato de escritura pendiente de actualización autorizada'):'Escrituras contenidas por configuración');
   render();if(!quiet||contextChanged||(changed&&!dirty))renderDetail();else if(changed){const notice=operation.querySelector('[data-live-notice]');if(notice)notice.textContent='Hay cambios en el servidor. SALE vigente: '+n(current.sale)+'. Se conserva tu formulario; vuelve a consultar antes de guardar.';const sale=operation.querySelector('[data-current-sale]');if(sale)sale.textContent=n(current.sale);}renderReports();startEnrichment();return true;
  }catch(e){if(request!==seq)return;clear();const absent=e.code==='PGRST202'||e.code==='42883';missing=absent;message.textContent=absent?'Persistencia por etapa pendiente de instalación autorizada. Consulta histórica disponible.':'No se pudo consultar operación: '+e.message;if(absent)legacyLoad?.();}finally{if(request===seq)loading=false;}
 }
 function clear(){stopEnrichment();trackingViewState={};for(const sel of ['[data-week]','[data-day]','[data-shift]','[data-progress]','[data-sort]'])tracking.querySelector(sel).closest('label').hidden=false;tracking.querySelector('[data-status]').hidden=false;data=null;selected=null;session=null;bi=null;fileId=null;live.replaceChildren();operation.querySelector('[data-operation-detail]').textContent='Consulta un turno. La operación requiere el contrato por etapa instalado y autorizado.';renderReports();}
 function render(){
  const expanded=new Set([...live.querySelectorAll('details[data-order-part][open]')].map(d=>d.dataset.orderPart));
  const rows=operationalRows(data,{line:tracking.querySelector('[data-line]')?.value||'',search:tracking.querySelector('[data-search]')?.value||''});
  for(const sel of ['[data-week]','[data-day]','[data-shift]','[data-progress]','[data-sort]'])tracking.querySelector(sel).closest('label').hidden=true;tracking.querySelector('[data-status]').hidden=true;
  tracking.querySelector('[data-list]').hidden=true;tracking.querySelector('[data-summary]').hidden=true;
  live.classList.remove('lp-tracking','has-detail');
  live.innerHTML='<div class="lp-turn-header"><b>'+esc(context.stage)+' · '+esc(context.line)+' · '+esc(context.date)+' / T'+context.shift+'</b><span>'+esc(data.turn.estado)+'</span>'+(coordinator()?'<button type="button" data-open '+(!writeCompatible()||!data.writes||!['ABIERTO','NO_ABIERTO','EN_REVISION'].includes(data.turn.estado)?'disabled':'')+'>Abrir / incorporar programación</button>':'')+((coordinator()&&context.stage==='EMPAQUE')?'<label>Capacidad autorizada de Empaque en este turno<input type="number" min="0" step="1" data-turn-capacity value="'+esc(data.turn.capacidad??'')+'" '+(!writeCompatible()||!data.writes?'disabled':'')+'></label>':'')+((data.turn.estado==='CERRADO'&&data.continuity?.ready)?'<button type="button" data-next-turn>Consultar siguiente turno · '+esc(data.continuity.next.date)+' / T'+data.continuity.next.shift+'</button>':'')+'</div><p class="lp-source-note">Saldo oficial: Export diario. Avance: último valor local del turno. Afectaciones en ventanas; las categorías pueden coincidir.</p>'+(data.notifications.length?'<details class="lp-notifications"><summary>'+data.notifications.length+' cambios de SALE · avisos al líder</summary>'+data.notifications.map(r=>'<p>'+esc(r.key)+' · '+esc(r.parte)+' · '+n(r.anterior)+' → '+r.nuevo+' · '+esc(r.motivo)+' · '+esc(r.usuario)+' / '+esc(r.creado_en)+'</p>').join('')+'</details>':'')+(context.stage==='ENSAMBLE'?operationOrderList(operationOrders(data,{line:context.line,search:tracking.querySelector('[data-search]')?.value||''}),context.stage):(rows.length?rows.map(r=>'<details data-order-part="'+esc(r.parte)+'" '+(expanded.has(r.parte)?'open':'')+' class="lp-followup-order '+(r.abierta?'lp-open-order':'')+'"><summary><span><b>'+esc(r.produccion)+'</b><small>'+esc(r.oficial.sistema)+' · '+esc(r.oficial.reserva_al)+' · Prioridad '+esc(r.prioridad)+'</small></span><span class="lp-followup-state">'+(r.abierta?'Abierta · origen '+esc(r.origen_fecha)+' T'+r.origen_turno:'Programada')+' · '+esc(progress(r))+'</span><span>Export <b>'+n(officialBalance(r,context.stage))+'</b><small>SALE '+n(r.sale)+' · Avance '+r.ejecutado+'</small></span></summary><div class="lp-followup-detail"><p>Producción '+esc(r.key)+' · Parte / asignación '+esc(r.parte)+'</p><p>Origen del arrastre '+esc(r.antiguedad_fecha??r.fecha)+' / T'+esc(r.antiguedad_turno??r.turno)+' · '+esc(salePendingReason(r))+'</p><div class="lp-affectation-chips">'+AFFECTATIONS.filter(k=>r.afectaciones[k]>0).map(k=>'<button type="button" data-affect="'+esc(r.parte)+'">'+esc(k.replace('_',' '))+' · '+r.afectaciones[k]+'</button>').join('')+'<span>Consolidado: '+n(r.consolidado)+' · '+(r.validado?'Validado':'Pendiente de validar')+'</span></div><p>'+esc(r.observacion||'Sin observaciones')+'</p>'+(context.stage==='ENSAMBLE'?'<p>Mecanizado y PDT: consulta el contexto existente en el detalle de Operación.</p>':'<p>Ensamble: '+(r.oficial.saldos_inicializados===true&&r.oficial.presente_ultimo_export===true?(officialBalance(r,'ENSAMBLE')===null?'sin confirmar':officialBalance(r,'ENSAMBLE')===0?'completo según Export':'pendiente según Export'):'sin confirmar')+'</p>')+'<div class="lp-followup-actions"><button type="button" data-live-operate="'+esc(r.parte)+'">'+(coordinator()?'Gestionar orden':'Registrar avance')+'</button><button type="button" data-glass="'+esc(r.parte)+'">Ver vidrio y ubicaciones</button></div></div></details>').join(''):'<p>No hay órdenes incorporadas. El coordinador puede abrir el turno e incorporar la programación existente.</p>'));
  if(coordinator()&&data.automaticOpening){
   const plan=data.automaticOpening;const labels={BLOCKED_WRITES_DISABLED:'Escrituras contenidas. No se puede abrir el turno ni ejecutar comandos LP.',MANUAL_BOOTSTRAP_REQUIRED:'Abre manualmente el primer turno.',BLOCKED_PREVIOUS_OPEN:'El turno anterior sigue abierto o en revisión. Debe cerrarse antes de abrir el siguiente.',BLOCKED_INVALID_CLOSE:'Falta una versión de cierre válida del turno anterior. Revisar con el responsable técnico.',WAITING_SCHEDULE:'Aún no llega el inicio configurado del siguiente turno.',READY_PENDING_TECHNICAL_APPROVAL:'El siguiente turno está pendiente de apertura. Puedes abrirlo manualmente con los controles existentes.',BLOCKED_SCHEDULE_INVALID:'No se pudo determinar el siguiente turno. Revisar horarios.'};
   live.insertAdjacentHTML('afterbegin','<aside class="lp-source-note" data-auto-opening role="status"><b>Próxima apertura · '+esc(plan.target?.date??'Inicio manual')+(plan.target?' / T'+esc(plan.target.shift):'')+'</b><p>'+esc(labels[plan.state]??'Revisar el estado del turno.')+'</p><p>Ejecutor automático pendiente de autorización técnica. Esta consulta no ejecuta ni registra una apertura automática.</p>'+(plan.late?'<p>El inicio configurado ya pasó; no se omitirán turnos.</p>':'')+'</aside>');
  }
  live.querySelector('[data-open]')?.addEventListener('click',()=>attempt(()=>send('ABRIR',context.stage==='EMPAQUE'&&live.querySelector('[data-turn-capacity]')?.value!==''?{capacity:quantity(live.querySelector('[data-turn-capacity]').value)}:{},null)));
  live.querySelector('[data-next-turn]')?.addEventListener('click',()=>{const next=data.continuity.next;get('[data-op-date]').value=next.date;get('[data-op-shift]').value=String(next.shift);load();});
  live.querySelectorAll('[data-live-operate],[data-affect]').forEach(b=>b.onclick=()=>{selected=b.dataset.liveOperate||b.dataset.affect;renderDetail();document.getElementById('productionOperationTab')?.click();});
  live.querySelectorAll('[data-glass]').forEach(b=>b.onclick=()=>glass(data.orders.find(r=>r.parte===b.dataset.glass)));
 }
 async function glass(r){
  const host=operation.querySelector('[data-operation-detail]');selected=r.parte;renderDetail();document.getElementById('productionOperationTab')?.click();
  const box=host.querySelector('[data-glass-summary]');box.textContent='Consultando vidrio…';const token=bridge.getToken(),part=r.parte;
  try{const g=await rpc('sgp_detalle_ubicacion_vidrio',{p_key_produccion:r.key});if(token!==bridge.getToken()||selected!==part||!box.isConnected)return;
   const sums=new Map((g.resumen||[]).map(x=>[x.categoria,x.unidades]));const split=g.categorias_version===2;box.innerHTML='<p>OVES y ubicaciones de '+esc(r.produccion)+' · '+esc(g.unidades??'Sin dato')+' vidrios · '+esc(g.burros??'Sin dato')+' burros. Estado de ubicación independiente de NC V.</p>'+['PREPARADO','NOVEDAD','TRASLADO','OTROS'].map(c=>'<button type="button" data-glass-category="'+c+'" '+(c==='TRASLADO'&&!split?'disabled title="La consulta vigente incluye traslado en Otros; desglose pendiente de instalación"':'')+'>'+c+(c==='OTROS'&&!split?' (incluye traslado)':'')+' · '+(c==='TRASLADO'&&!split?'Sin desglose':n(sums.get(c)??0))+'</button>').join('');box.querySelectorAll('button').forEach(b=>b.onclick=()=>bridge.openGlass?.(r.key,r.produccion,b.dataset.glassCategory));
  }catch(e){box.textContent='No se pudo consultar vidrio: '+e.message;}
 }
 function renderDetail(){
  dirty=false;const host=operation.querySelector('[data-operation-detail]'),r=data?.orders.find(r=>r.parte===selected);
  if(!data){host.textContent='Consulta un turno. La operación requiere el contrato por etapa instalado y autorizado.';return;}
  const enabled=writable(),coord=coordinator(),canValidate=data.role==='COORDINADOR'&&data.canValidate===true;
  host.innerHTML='<div class="lp-turn-header"><h4>'+esc(context.stage)+' · '+esc(context.line)+' · '+esc(context.date)+' / T'+context.shift+'</h4><button type="button" data-back>Volver a Seguimiento</button><button type="button" data-operation-pending-retry '+(!pending?'hidden':'')+'>Reintentar guardado sin respuesta</button></div>'+(r?'<h4>'+esc(r.produccion)+' · '+esc(r.oficial.sistema)+'</h4><p>Parte '+esc(r.parte)+' · '+esc(r.key)+'</p><p>'+esc(salePendingReason(r))+'</p>'+(r.origen_fecha?'<p>Origen del arrastre '+esc(r.antiguedad_fecha??r.origen_fecha)+' / T'+esc(r.antiguedad_turno??r.origen_turno)+' · Turno anterior: SALE '+n(r.contexto_origen?.sale)+' / ejecutado '+n(r.contexto_origen?.ejecutado)+'. El avance de este turno empieza en cero.</p>':'')+'<div class="lp-followup-summary"><div>Saldo Export<b>'+n(officialBalance(r,context.stage))+'</b></div><div>SALE validado<b data-current-sale>'+n(r.sale)+'</b></div><div>Último avance<b>'+r.ejecutado+'</b></div><div>Pendiente de SALE<b>'+n(r.sale===null?null:r.sale-r.ejecutado)+'</b></div></div><form data-order-form><label>Total '+(context.stage==='ENSAMBLE'?'ensamblado':'empacado')+' en este turno<input type="number" min="0" step="1" data-executed value="'+r.ejecutado+'" required></label><p>Guardar reemplaza el total anterior del turno y conserva su historial.</p><label>Observación / motivo<textarea data-operation-note rows="3" maxlength="2000">'+esc(r.observacion)+'</textarea></label><button type="submit" '+(!enabled?'disabled':'')+'>Guardar avance</button><button type="button" data-note-save '+(!enabled?'disabled':'')+'>Guardar observación</button>'+(coord?'<div class="lp-coordinator"><label>SALE de '+esc(context.stage)+'<input type="number" min="0" step="1" data-sale value="'+esc(r.sale??'')+'"></label><button type="button" data-sale-save '+(!enabled?'disabled':'')+'>Validar / modificar SALE</button></div>':'')+'<fieldset><legend>Ventanas afectadas · no sumar categorías</legend><div class="lp-affectation-inputs">'+AFFECTATIONS.map(k=>'<label>'+esc(k.replace('_',' '))+'<input type="number" min="0" step="1" data-affectation="'+k+'" value="'+(r.afectaciones[k]??0)+'"></label>').join('')+'</div><button type="button" data-affect-save '+(!enabled?'disabled':'')+'>Reportar afectaciones</button>'+(canValidate?'<label>Total de ventanas distintas, con solapamientos consolidados<input type="number" min="0" step="1" data-consolidated value="'+esc(r.consolidado??'')+'"></label><button type="button" data-validate-save '+(!enabled?'disabled':'')+'>Validar consolidación</button>':'')+'</fieldset><p data-save-status role="status"></p></form>'+'<details data-individual-affects><summary>Afectaciones individuales y pendientes de Picking</summary><div data-individual-affects-panel></div></details><section data-material-summary><button type="button" data-material-load>Consultar Mecanizado y PDT existentes</button></section>'+'<section data-glass-summary><button type="button" data-glass-load>Consultar vidrio / OVES</button></section><details><summary>Historial de esta orden</summary>'+data.history.filter(h=>h.key===r.key&&(context.stage==='ENSAMBLE'||h.parte===r.parte)).map(h=>'<p>'+esc(h.creado_en)+' · '+esc(h.usuario)+' · Asignación '+esc(h.parte??'Sin asignación')+(h.responsabilidad_servidor?' · '+esc(h.responsabilidad_servidor):'')+' · '+esc(h.operacion)+' · '+esc(h.payload.quantity??h.payload.consolidated??'')+' · '+esc(h.payload.observation)+'</p>').join('')+'</details>':'<p>Selecciona una orden en Seguimiento para registrar o corregir su avance.</p>')+'<section class="lp-close"><h4>Conciliación y cierre del turno</h4><p>Primero importa el archivo Power BI de esta etapa, fecha y turno. El archivo no modifica el Export diario.</p>'+((!data.biFormatApproved||data.biAdapter!==POWERBI_VERSION)?'<p class="lp-followup-blocked">Adaptador XLSX preparado. La importación requiere instalación, servicio servidor y habilitación autorizados.</p>':'')+'<label>Archivo Power BI <input type="file" data-bi-file accept=".xlsx" '+(!enabled||(!data.biFormatApproved||data.biAdapter!==POWERBI_VERSION)?'disabled':'')+'></label><div data-bi-preview></div><label>Observación general del turno<textarea data-close-note rows="2" maxlength="4000"></textarea></label><div class="lp-followup-actions"><button type="button" data-close '+(!enabled||!fileId?'disabled':'')+'>Confirmar cierre</button>'+(coord?'<button type="button" data-reopen '+(data.turn.estado!=='CERRADO'?'disabled':'')+'>Reabrir con motivo</button>':'')+'</div><p data-close-status role="status"></p></section>';
  if(r&&context.stage==='ENSAMBLE'){
   const groups=operationOrders(data,{line:context.line}),group=groups.find(g=>g.rows.some(x=>x.parte===r.parte));
   const pane=document.createElement('div');pane.className='lp-operation-form-pane';pane.append(...host.childNodes);host.append(pane);host.classList.add('lp-operation-detail-layout');
   const nav=document.createElement('aside');nav.className='lp-operation-order-nav';nav.setAttribute('aria-label','Órdenes del turno');nav.innerHTML=operationOrderList(groups,context.stage,{compact:true});host.prepend(nav);
   nav.querySelectorAll('[data-live-operate]').forEach(b=>b.onclick=()=>{selected=b.dataset.liveOperate;renderDetail();});
   const form=host.querySelector('[data-order-form]');
   if(context.stage==='ENSAMBLE'){const box=document.createElement('details');box.innerHTML='<summary>Propuesta de disponibilidad del siguiente turno</summary><div data-proposal-panel></div>';form.after(box);box.addEventListener('toggle',()=>{if(!box.open||box.dataset.loaded)return;box.dataset.loaded='true';const token=bridge.getToken(),scope={...context,key:r.key};mountProposal(box.querySelector('[data-proposal-panel]'),{rpc,scope,onDirty:()=>{dirty=true;},isCurrent:()=>token===bridge.getToken()&&selected===r.parte&&context.stage===scope.stage&&context.date===scope.date&&context.shift===scope.shift&&context.line===scope.line});});}
   form.insertAdjacentHTML('beforebegin','<p data-order-total>Semana '+esc(group.week?.label??'no disponible')+' · Total reportado de la orden en este turno: <b>'+n(group.executed)+'</b></p>'+(group.rows.length>1?'<label>Asignación que vas a actualizar<select data-assignment-select>'+group.rows.map((a,i)=>'<option value="'+esc(a.parte)+'" '+(a.parte===r.parte?'selected':'')+'>Asignación '+(i+1)+' · reportado '+n(a.ejecutado)+' · SALE '+n(a.sale)+'</option>').join('')+'</select></label><p>Esta orden tiene varias asignaciones. Actualiza cada cantidad identificada; no se reparte el total automáticamente.</p>':''));
   host.querySelector('[data-assignment-select]')?.addEventListener('change',e=>{selected=e.target.value;renderDetail();});
   if(group.rows.length>1)form.querySelector('[data-executed]').closest('label').firstChild.textContent='Total de esta asignación en el turno';
   const save=form.querySelector('button[type=submit]');if(r.sale===null||r.sale===undefined)save.disabled=true;
  }else host.classList.remove('lp-operation-detail-layout');
  host.querySelector('[data-operation-pending-retry]').onclick=()=>attempt(()=>transmit());
  const back=host.querySelector('[data-back]'),trackingTab=document.getElementById('productionTrackingTab');
  if(trackingTab?.hidden)back.textContent='Volver al turno';
  back.onclick=()=>document.getElementById(trackingTab?.hidden?(context.stage==='ENSAMBLE'?'productionAssemblyTab':'productionPackingTab'):'productionTrackingTab')?.click();
  host.insertAdjacentHTML('afterbegin','<p data-live-notice role="status"></p>');host.querySelectorAll('input,textarea').forEach(el=>el.addEventListener('input',()=>{dirty=true;}));
  if(r){
   const note=()=>host.querySelector('[data-operation-note]').value.trim();
   host.querySelector('[data-order-form]').onsubmit=e=>{e.preventDefault();attempt(()=>send('EJECUTAR',{quantity:context.stage==='ENSAMBLE'?validateTurnEntry(r,host.querySelector('[data-executed]').value,note()):quantity(host.querySelector('[data-executed]').value),observation:note()},r));};
   host.querySelector('[data-note-save]').onclick=()=>attempt(()=>send('NOTA',{observation:required(note())},r));
   host.querySelector('[data-sale-save]')?.addEventListener('click',()=>attempt(()=>send('SALE',{quantity:quantity(host.querySelector('[data-sale]').value),observation:required(note())},r)));
   const individual=host.querySelector('[data-individual-affects]');let individualLoaded=false;
   individual.ontoggle=async()=>{if(!individual.open||individualLoaded)return;individualLoaded=true;dirty=true;const box=host.querySelector('[data-individual-affects-panel]'),token=bridge.getToken(),ctx={...context};box.textContent='Consultando afectaciones…';
    try{const client=await bridge.getClient();if(!box.isConnected||token!==bridge.getToken())return;
     const transport=affectationsTransport({client,getToken:()=>bridge.getToken(),contractVersion:2,context:{key:r.key,line:ctx.line,stage:ctx.stage,date:ctx.date,shift:ctx.shift,production:r.produccion}}),read=transport.read;
     transport.read=async()=>{const value=await read();if(!box.isConnected)throw Error('NO_AUTORIZADO');if(data.turn.estado!=='ABIERTO')value.capabilities=['READ'];
      if(value.capabilities.includes('REPORT'))for(const el of host.querySelectorAll('[data-affect-save],[data-validate-save],[data-affectation],[data-consolidated]'))el.disabled=true;
      return value;};await mountAffectationsPanel(box,transport);
    }catch(error){if(box.isConnected)box.textContent='Afectaciones no disponibles: '+error.message;}
   };
   const affect=()=>Object.fromEntries([...host.querySelectorAll('[data-affectation]')].map(el=>[el.dataset.affectation,quantity(el.value)]));
   host.querySelector('[data-affect-save]').onclick=()=>attempt(()=>send('AFECTAR',{affectations:affect(),observation:required(note())},r));
   host.querySelector('[data-validate-save]')?.addEventListener('click',()=>attempt(()=>{const af=affect(),v=validateAffectations(af,host.querySelector('[data-consolidated]').value);return send('VALIDAR',{affectations:af,consolidated:v,observation:required(note())},r);}));
   host.querySelector('[data-glass-load]').onclick=()=>glass(r);
   host.querySelector('[data-material-load]')?.addEventListener('click',async()=>{
    const box=host.querySelector('[data-material-summary]'),token=bridge.getToken();box.textContent='Consultando fuentes existentes…';
    try{const fresh=await rpc('sgp_lp_operacion_consultar',{p_etapa:context.stage,p_linea:context.line,p_fecha:context.date,p_turno:context.shift});if(token!==bridge.getToken()||selected!==r.parte||!box.isConnected)return;
     const sheet=fresh?.materialContext;if(sheet?.status!=='AVAILABLE')throw Error('Contexto de materiales no disponible para esta sesión o pendiente de actualización autorizada');
     const p=materialContext(sheet,r);
     box.innerHTML='<p>Mecanizado: '+esc(p.mechanized??'Sin estado informado')+' · '+esc(p.note??'Sin observación informada')+'</p><p>PDT de la consulta histórica: '+esc(p.ambiguousByName?'Resumen omitido: existen producciones homónimas':p.pending??'La fuente no informó un resumen de pendientes')+'</p><p>El resumen histórico se agrupa por nombre y puede mezclar producciones. No acredita asociación a esta parte o etapa, ventanas liberadas ni modifica SALE.</p><button type="button" data-existing-pdt>Abrir pendientes existentes</button>';
     box.querySelector('[data-existing-pdt]').onclick=()=>{const nav=document.querySelector('.nav [data-view="pendientes-aluminio"]');if(!nav||nav.hidden){box.insertAdjacentHTML('beforeend','<p>El acceso a Pendientes no está disponible para esta sesión.</p>');return;}nav.click();};
    }catch(e){box.textContent='No se pudo consultar: '+e.message;}
   });
  }
  host.querySelector('[data-bi-file]').onchange=async e=>{
   const token=bridge.getToken(),ctx=JSON.stringify(context),request=++fileSequence;
   bi=null;fileId=null;host.querySelector('[data-close-status]').textContent='';host.querySelector('[data-bi-preview]').replaceChildren();host.querySelector('[data-close]').disabled=true;
   try{const file=e.target.files[0];if(!file)return;if(file.size>2097152)throw Error('Archivo mayor de 2 MiB');if(!/\.xlsx$/i.test(file.name))throw Error('Selecciona un archivo XLSX');
    const bytes=new Uint8Array(await file.arrayBuffer()),parsed=await parsePowerBI(bytes);
    if(token!==bridge.getToken()||JSON.stringify(context)!==ctx||request!==fileSequence)return;
    bi={filename:file.name,base64:bytesBase64(bytes),parsed,rows:reconcilePowerBI(parsed,{...context,orders:data.orders})};drawBI();
   }catch(e){if(request!==fileSequence)return;bi=null;fileId=null;host.querySelector('[data-close-status]').textContent=e.message;}
  };
  if(data.emptyCloseEligible===true&&data.turn.estado!=='NO_ABIERTO'){
   const box=host.querySelector('.lp-close');box.insertAdjacentHTML('afterbegin','<fieldset data-empty-close><legend>Cierre SIN ACTIVIDAD</legend><p>El servidor no detectó órdenes asignadas ni abiertas pendientes. Este cierre no necesita Power BI.</p><label><input type="checkbox" data-empty-confirm '+(!enabled?'disabled':'')+'>Confirmo que este turno no tiene órdenes asignadas ni abiertas pendientes.</label><p>Escribe el motivo en Observación general del turno y confirma el cierre.</p><button type="button" data-close-empty '+(!enabled?'disabled':'')+'>Cerrar SIN ACTIVIDAD</button></fieldset>');
   const fieldset=host.querySelector('[data-empty-close]');fieldset.insertBefore(host.querySelector('[data-close-note]').closest('label'),host.querySelector('[data-close-empty]'));
   box.querySelector('h4').hidden=true;box.querySelectorAll(':scope > p:not([data-close-status])').forEach(el=>el.hidden=true);
   host.querySelector('[data-bi-file]').closest('label').hidden=true;host.querySelector('[data-bi-preview]').hidden=true;host.querySelector('[data-close]').hidden=true;
   const reopen=host.querySelector('[data-reopen]');if(reopen)reopen.hidden=data.turn.estado!=='CERRADO';
   if(!reopen||reopen.hidden)box.querySelector('.lp-followup-actions').hidden=true;
   for(const input of [host.querySelector('[data-empty-confirm]'),host.querySelector('[data-close-note]')])input.addEventListener('input',()=>host.querySelector('[data-close-status]').textContent='');
   host.querySelector('[data-close-empty]').onclick=()=>attempt(()=>{if(!host.querySelector('[data-empty-confirm]').checked)throw Error('Confirma explícitamente el cierre SIN ACTIVIDAD');return send('CERRAR',{close_type:'SIN_ACTIVIDAD',confirmed:true,observation:required(host.querySelector('[data-close-note]').value)},null);});
  }
  host.querySelector('[data-close]').onclick=()=>attempt(()=>{const reasons=Object.fromEntries([...host.querySelectorAll('[data-close-reason]')].map(x=>[x.dataset.closeReason,x.value.trim()]));return send('CERRAR',{file_id:fileId,reasons,observation:required(host.querySelector('[data-close-note]').value)},null);});
  host.querySelector('[data-reopen]')?.addEventListener('click',()=>attempt(()=>send('REABRIR',{observation:required(host.querySelector('[data-close-note]').value)},null)));
  if(bi)drawBI();
 }
 const required=v=>{if(!v?.trim())throw Error('Escribe una justificación obligatoria');return v.trim();};
 function drawBI(){bi.rows=reconcilePowerBI(bi.parsed,{...context,orders:data.orders});const host=operation.querySelector('[data-operation-detail]');host.querySelector('[data-bi-preview]').innerHTML='<p>'+esc(POWERBI_VERSION)+' · '+esc(bi.filename)+' · Fecha operativa '+esc(context.date)+' / T'+context.shift+' · '+bi.rows.length+' producciones. El original conserva ambos turnos; solo se concilia el seleccionado.</p>'+bi.rows.map(r=>'<div class="lp-bi-row"><b>'+esc(r.production)+' · '+esc(r.key)+' · '+r.assignments.length+' asignaciones LP'+'</b><p>Líder '+r.executed+' · Power BI '+r.power_bi+' · Diferencia '+r.difference+'</p>'+((r.difference!==0||r.executed<r.sale)?'<label>Justificación obligatoria<input data-close-reason="'+esc(r.key)+'" required></label>':'')+'</div>').join('')+'<button type="button" data-import '+(!writable()?'disabled':'')+'>Validar y guardar archivo</button>';host.querySelector('[data-import]').onclick=()=>attempt(()=>send('IMPORTAR_XLSX',{filename:bi.filename,base64:bi.base64},null));}
 function attempt(fn){Promise.resolve().then(fn).catch(e=>{const host=operation.querySelector('[data-operation-detail]');(host.querySelector('[data-save-status]')||host.querySelector('[data-close-status]')||message).textContent=String(e.message).includes('SIN_ACTIVIDAD_EXISTEN_ORDENES')?'El turno tiene órdenes asignadas o abiertas. Actualiza la consulta y usa la conciliación normal.':String(e.message).includes('FUENTES_EN_ACTUALIZACION_RECONSULTAR')?'Programación o Export se están actualizando. Consulta de nuevo antes de cerrar SIN ACTIVIDAD.':e.message;});}
 async function send(op,extra,r){
  if(busy||loading)throw Error('Espera a que termine la consulta o guardado pendiente');if(session!==bridge.getToken())throw Error('La sesión cambió. Consulta de nuevo.');
  if(op==='CERRAR'&&data.individualClose===true&&!window.confirm('Confirmar cierre individual · '+context.line+' · '+context.stage+' · '+context.date+' / T'+context.shift+'. La intervención quedará auditada.'))throw Error('Cierre cancelado por el usuario');
  const payload={op,...context,revision:r?r.revision:data.turn.revision,turn_revision:data.turn.revision,...(r?{key:r.key,part:r.parte}:{}),...extra};
  const signature=JSON.stringify(payload);if(pending&&pending.signature!==signature)throw Error('Hay un guardado sin respuesta. Reintenta la misma operación antes de modificarla.');
  pending??={signature,token:session,cmd:{...payload,id:crypto.randomUUID()}};return transmit();
 }
 async function transmit(){
  if(busy||loading)throw Error('Espera a que termine la consulta o guardado pendiente');if(!pending||pending.token!==bridge.getToken())throw Error('Reinicia la sesión original para resolver el guardado pendiente');
  const op=pending.cmd.op;busy=true;message.textContent='Guardando…';
  try{const receipt=pending.uncertain?await rpc('sgp_lp_operacion_resultado',{p_id:pending.cmd.id}):null;const result=receipt?.committed?receipt.result:op==='IMPORTAR_XLSX'?await importPowerBI({token:pending.token,command:Object.fromEntries(['id','stage','line','date','shift','revision'].map(k=>[k,pending.cmd[k]])),filename:pending.cmd.filename,base64:pending.cmd.base64}):await rpc('sgp_lp_operacion_comando',{p_cmd:pending.cmd});if(pending.token!==bridge.getToken())throw Error('La sesión cambió; vuelve a consultar el estado');if(result?.ok!==true)throw Error('Respuesta de guardado incompatible');pending=null;if(op==='IMPORTAR_XLSX')fileId=result.fileId;if(op==='CERRAR'||op==='REABRIR'){bi=null;fileId=null;}busy=false;await load();message.textContent='Guardado confirmado por el servidor · '+op;}
  catch(e){busy=false;if(e.code&&e.code!=='FETCH_ERROR')pending=null;else if(pending)pending.uncertain=true;message.textContent='No se confirmó el guardado: '+e.message;throw e;}finally{get('[data-retry-pending]').hidden=!pending;const retry=operation.querySelector('[data-operation-pending-retry]');if(retry)retry.hidden=!pending;}
 }
 function renderReports(){
  const dashboard=document.getElementById('productionDashboardPanel'),reports=document.getElementById('productionReportsPanel');
  if(dashboard){dashboard.className='lp-followup';dashboard.innerHTML='<h3>Dashboard · turno consultado</h3>'+(data?'<p>'+esc(context.stage)+' · '+esc(context.line)+' · '+esc(context.date)+' / T'+context.shift+' · cantidades locales; no equivalen al avance oficial diario.</p><div class="lp-followup-summary">'+[['Órdenes / partes',data.orders.length],['SALE validado',data.orders.reduce((s,r)=>s+(r.sale??0),0)],['Últimos avances',data.orders.reduce((s,r)=>s+r.ejecutado,0)]].map(([l,v])=>'<div>'+l+'<b>'+v+'</b></div>').join('')+'</div><p>Indicadores oficiales semanales por sistema pendientes de fuente histórica contrastada. No se deducen del turno local.</p>':'<p>Consulta un turno en Seguimiento para ver indicadores de su fuente real.</p>');}
  if(reports){const expanded=new Set([...reports.querySelectorAll('details[data-report-id][open]')].map(d=>d.dataset.reportId));reports.className='lp-followup';reports.innerHTML='<h3>Reportes · cierres e historial</h3>'+(data?'<p>'+esc(context.stage)+' · '+esc(context.line)+' · '+esc(context.date)+' / T'+context.shift+'</p>'+data.reports.map(c=>'<details data-report-id="'+c.id+'" '+(expanded.has(c.id)?'open':'')+'><summary>'+(c.snapshot.type==='SIN_ACTIVIDAD'?'SIN ACTIVIDAD · ':'')+'Versión '+c.version+' · '+esc(c.usuario)+' · '+esc(c.creado_en)+'</summary><p>'+esc(c.snapshot.observation)+'</p><p>'+esc(c.snapshot.type==='SIN_ACTIVIDAD'?'Sin archivo Power BI · turno sin órdenes':'Archivo '+c.snapshot.file.name+' · SHA256 '+c.snapshot.file.sha256)+'</p><button type="button" data-report="'+c.id+'">Descargar CSV para Excel</button><button type="button" data-original="'+(c.snapshot.file?.id??'')+'" '+(c.snapshot.file?.adapter!==POWERBI_VERSION?'hidden':'')+'>Descargar XLSX original</button><pre>'+esc(JSON.stringify(c.snapshot.rows,null,2))+'</pre></details>').join('')+'<p>'+data.history.length+' movimientos trazados · '+data.reports.length+' versiones de cierre.</p>':'<p>Sin turno consultado. Los informes aparecen después de guardar un cierre real.</p>');reports.querySelectorAll('[data-original]').forEach(b=>b.onclick=async()=>{try{const f=await rpc('sgp_lp_operacion_archivo',{p_id:b.dataset.original});const raw=Uint8Array.from(atob(f.base64),ch=>ch.charCodeAt(0)),url=URL.createObjectURL(new Blob([raw],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})),a=document.createElement('a');a.href=url;a.download=f.filename;a.click();URL.revokeObjectURL(url);}catch(e){b.insertAdjacentElement('afterend',Object.assign(document.createElement('p'),{textContent:e.message}));}});reports.querySelectorAll('[data-report]').forEach(b=>b.onclick=()=>{const c=data.reports.find(c=>c.id===b.dataset.report),url=URL.createObjectURL(new Blob([reportCSV(c.snapshot)],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='LP-'+c.etapa+'-'+c.linea+'-'+c.fecha+'-T'+c.turno+'-V'+c.version+'.csv';a.click();URL.revokeObjectURL(url);});}
 }
 get('[data-retry-pending]').onclick=()=>attempt(()=>transmit());
 get('[data-op-load]').onclick=()=>load();for(const sel of ['[data-op-stage]','[data-op-date]','[data-op-shift]'])get(sel).onchange=()=>load();
 tracking.querySelector('[data-search]')?.addEventListener('input',()=>{if(viewPanel==='seguimiento')renderGlobal();else if(data)render();});tracking.querySelector('[data-line]')?.addEventListener('change',()=>load());
 document.addEventListener('sgp:production-panel',e=>{if(viewPanel!==e.detail){++seq;loading=false;}viewPanel=e.detail;});
 document.addEventListener('sgp:production-panel',e=>{if(e.detail==='seguimiento')tracking.querySelector('.lp-followup-heading h3').textContent='Seguimiento de órdenes';});
 document.addEventListener('sgp:production-stage',e=>{if(!['ENSAMBLE','EMPAQUE'].includes(e.detail))return;get('[data-op-stage]').value=e.detail;tracking.querySelector('.lp-followup-heading h3').textContent='Operación · '+(e.detail==='ENSAMBLE'?'Ensamble':'Empaque');});
 document.addEventListener('sgp:production-panel',e=>{if(['operacion','dashboard','reportes'].includes(e.detail)&&(missing||(data&&session===bridge.getToken()))){renderReports();return;}if(['seguimiento','operacion','dashboard','reportes','ensamble','empaque'].includes(e.detail))load();});
 document.addEventListener('sgp:line-plan-updated',()=>{if(!tracking.hidden||!operation.hidden)load();});
 const timer=setInterval(()=>{if((data||globalData)&&(!tracking.hidden||!operation.hidden)&&document.visibilityState==='visible')load({quiet:true});},20000);
 window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
 return {load};
}
