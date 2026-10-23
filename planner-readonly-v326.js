/* LAB v326: Planificador de línea, primera etapa de consulta sin escrituras. */
(()=>{
'use strict';
const root=document.querySelector('#productionPlannerPanel');
if(!root||document.querySelector('#sgpPlanner'))return;
const section=document.createElement('section');
section.id='sgpPlanner';
section.setAttribute('aria-label','Planificador de ensamble');
section.innerHTML='<div class="sgp-planner-heading"><h3>Planificador de Ensamble <small>Programación · LAB v330</small></h3><p>Calendario, tabla y Kanban. Las asignaciones y cantidades parciales se gestionan en el panel de programación inferior.</p></div><div class="sgp-planner-actions"><label>Vista <select id="sgpPlannerView"><option value="calendar">Calendario</option><option value="table">Tabla dinámica</option><option value="kanban">Kanban</option></select></label><input id="sgpPlannerSearch" type="search" placeholder="Buscar producción, reserva o sistema" aria-label="Buscar en planificador"><button type="button" id="sgpPlannerRefresh">Actualizar vista</button><button type="button" id="sgpPlannerLocations">Reporte de ubicaciones</button></div><div id="sgpPlannerStats" class="sgp-planner-stats"></div><div id="sgpPlannerContent" class="sgp-planner-content" aria-live="polite"></div><p class="sgp-planner-note">Los saldos y estados provienen de la consulta vigente. No se modifican datos. La programación por turno se gestiona abajo y requiere permisos de sesión.</p>';
root.insertBefore(section,root.firstChild);
// LAB v327: exploración jerárquica en solo lectura, sin inferir partes ni escribir programación.
const explorer=document.createElement('section');explorer.id='sgpPlannerExplorer';
explorer.innerHTML='<h3>Reservas para planificar <small>LAB v327</small></h3><p>Selecciona la semana y el sistema; abre una reserva para consultar sus órdenes. Las partes solo se agrupan cuando el dato de origen está identificado.</p><div class="sgp-explorer-filters"><label>Semana <select id="sgpExplorerWeek"></select></label><label>Sistema <select id="sgpExplorerSystem"><option value="">Todos los sistemas</option></select></label><input id="sgpExplorerSearch" type="search" placeholder="Buscar reserva, producción u orden"><label>Recepción física <select id="sgpExplorerReceptionFilter"><option value="">Todas</option><option value="RECIBIDA">Recibidas (incluye sin legalizar)</option><option value="PENDIENTE">Pendientes de recibir</option></select></label><label>Legalización <select id="sgpExplorerLegalFilter"><option value="">Todas</option><option value="OK">Legalizadas / OK Export</option><option value="SIN_OK">Sin OK Export</option></select></label><label>Estado mecanizado <select id="sgpExplorerStateFilter"><option value="">Todos los estados</option><option>CORTE</option><option>MECANIZADO</option><option>PROCESADO</option><option>PICKING</option><option value="SIN DATO">Sin dato</option></select></label><label>Ordenar <select id="sgpExplorerSort"><option value="reserva">Reserva</option><option value="estado_asc">Estado A–Z</option><option value="estado_desc">Estado Z–A</option><option value="ventanas_desc">Mayor cantidad de ventanas</option><option value="ventanas_asc">Menor cantidad de ventanas</option></select></label><button id="sgpExplorerLoad" type="button">Consultar semana</button></div><p id="sgpExplorerStatus" role="status"></p><div id="sgpExplorerResults"></div>';
section.parentNode.insertBefore(explorer,section);
// Mantener las vistas originales visibles antes de las tarjetas de reservas.
const viewActions=section.querySelector('.sgp-planner-actions');
if(viewActions){viewActions.classList.add('sgp-explorer-view-actions');explorer.insertBefore(viewActions,explorer.querySelector('.sgp-explorer-filters'));}
// LAB v342: retire the redundant legacy weekly-card block; keep its nodes mounted for existing read-only listeners.
section.hidden=true;
section.setAttribute('aria-hidden','true');

const explorerStyle=document.createElement('style');explorerStyle.textContent='#sgpPlannerExplorer{margin-bottom:18px;padding:16px;border:1px solid #c9d9eb;border-radius:12px;background:#f8fbff}#sgpPlannerExplorer h3{color:#124a89;margin:0}#sgpPlannerExplorer h3 small{font-size:12px;color:#64748b}#sgpPlannerExplorer p{font-size:13px;color:#60748b}#sgpPlannerExplorer .sgp-explorer-filters{display:flex;gap:10px;flex-wrap:wrap;align-items:end}#sgpPlannerExplorer .sgp-explorer-filters label{display:grid;gap:4px}#sgpPlannerExplorer input,#sgpPlannerExplorer select,#sgpPlannerExplorer button{padding:9px;border:1px solid #bfd1e6;border-radius:8px;background:#fff;color:#164675}#sgpExplorerSearch{flex:1;min-width:170px}.sgp-explorer-reservation{border:1px solid #cbdcf0;border-radius:12px;margin:10px 0;background:white;overflow:hidden}.sgp-explorer-reservation>summary{padding:14px;cursor:pointer;list-style:none}.sgp-explorer-reservation>summary::-webkit-details-marker{display:none}.sgp-explorer-reservation>summary:after{content:"Ver partes y órdenes ▾";font-size:12px;color:#1759a1;display:block;margin-top:8px}.sgp-explorer-metrics{display:flex;gap:8px;flex-wrap:wrap;margin-top:9px}.sgp-explorer-metrics span{padding:6px 9px;border-radius:7px;background:#eaf2ff;font-size:12px}.sgp-explorer-part{margin:10px;padding:10px;background:#f3f7fd;border-radius:9px}.sgp-explorer-order{padding:9px;margin:7px 0;background:#fff;border:1px solid #d9e5f3;border-radius:8px;font-size:13px}.sgp-explorer-order button{margin-top:6px}@media(max-width:600px){#sgpPlannerExplorer .sgp-explorer-filters>*{width:100%}} .sgp-explorer-view-actions{margin:12px 0;padding:10px;background:#eaf2ff;border-radius:10px;display:flex;align-items:center;flex-wrap:wrap;gap:10px}.sgp-explorer-view-actions label{font-weight:700;color:#164675}.sgp-explorer-view-actions select{min-width:170px} #sgpExplorerResults{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-items:start}.sgp-explorer-reservation{min-width:0;margin:0}.sgp-explorer-reservation>summary{min-width:0}.sgp-explorer-order{overflow-wrap:anywhere}@media(max-width:780px){#sgpExplorerResults{grid-template-columns:1fr}}.sgp-explorer-glass{display:inline-flex;gap:5px;vertical-align:middle}.sgp-explorer-glass span{display:inline-flex;flex-direction:column;align-items:center;justify-content:center;width:49px;height:49px;border-radius:50%;font-size:11px;font-weight:700}.sgp-explorer-glass b{font-size:16px}.sgp-glass-prep{background:#ddf6e8;color:#376f55}.sgp-glass-nov{background:#fff0dc;color:#8b6336}.sgp-glass-trans{background:#e7efff;color:#4c6388}.sgp-explorer-state{display:inline-block;border-radius:999px;padding:4px 9px;font-weight:700;font-size:11px;background:#e7eef8;color:#526b87;border:1px solid transparent}.sgp-explorer-state[data-state="CORTE"]{background:#0758a9;color:#fff}.sgp-explorer-state[data-state="MECANIZADO"]{background:#258319;color:#fff}.sgp-explorer-state[data-state="PROCESADO"]{background:#df4ce7;color:#161027}.sgp-explorer-state[data-state="PICKING"]{background:#f8ef00;color:#222;border-color:#d7ca00}.sgp-explorer-state[data-state="PROGRAMADA"]{background:#fff5b8;color:#745e00}.sgp-explorer-state[data-state="REPROGRAMADO"]{background:#e6e8ed;color:#606975}';document.head.append(explorerStyle);
explorerStyle.textContent+='.sgp-part-header{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:7px 0}.sgp-part-header button{background:#1264c8!important;color:white!important;font-weight:700;cursor:pointer}.sgp-explorer-metrics .sgp-explorer-status-summary{display:inline-flex;align-items:center;gap:6px;background:transparent;border:0;padding:0;color:#173e6d;font-weight:700}.sgp-explorer-metrics .sgp-explorer-status-summary .sgp-explorer-state{padding:7px 12px;font-size:12px;letter-spacing:.02em;border-radius:9px;box-shadow:0 2px 5px rgba(10,35,75,.1)}.sgp-explorer-metrics .sgp-explorer-status-summary .sgp-explorer-state[data-state="CORTE"]{background:#0758a9;color:white}.sgp-explorer-metrics .sgp-explorer-status-summary .sgp-explorer-state[data-state="MECANIZADO"]{background:#258319;color:white}.sgp-explorer-metrics .sgp-explorer-status-summary .sgp-explorer-state[data-state="PROCESADO"]{background:#df4ce7;color:#161027}.sgp-explorer-metrics .sgp-explorer-status-summary .sgp-explorer-state[data-state="PICKING"]{background:#f8ef00;color:#222;border-color:#d7ca00}';explorerStyle.textContent+='#sgpExplorerSelection{margin-top:12px;padding:12px;border:1px solid #bdd3ef;border-radius:10px;background:#fff;color:#164675}#sgpExplorerSelection p{margin:6px 0}';explorerStyle.textContent+='#sgpPlannerExplorer{background:linear-gradient(155deg,#f2f7ff,#fff 62%);border-color:#b7cdee;box-shadow:0 12px 30px rgba(22,65,117,.08)}.sgp-explorer-reservation{border:1px solid #cadbf0;box-shadow:0 4px 12px rgba(17,64,117,.06);transition:box-shadow .18s ease,transform .18s ease}.sgp-explorer-reservation:hover{box-shadow:0 9px 22px rgba(17,64,117,.13);transform:translateY(-1px)}.sgp-explorer-reservation[open]{border-color:#7da9e5;box-shadow:0 12px 25px rgba(17,64,117,.13)}.sgp-explorer-reservation>summary{border-left:4px solid #2269bc;padding:17px}.sgp-explorer-reservation>summary strong{font-size:15px}.sgp-explorer-metrics span{background:#eaf2ff;border:1px solid #d9e8ff;font-weight:600}.sgp-explorer-metrics .sgp-explorer-state{border-radius:999px;padding:5px 11px;font-weight:800}#sgpExplorerStateFilter,#sgpExplorerSort{min-width:140px}@media(max-width:780px){.sgp-explorer-reservation>summary{padding:13px}.sgp-explorer-reservation:hover{transform:none}}';explorerStyle.textContent+='.sgp-reception-indicator[data-received="yes"]{background:#dcfce7!important;color:#166534!important;border:1px solid #86efac!important;font-weight:800!important}.sgp-reception-indicator[data-received="no"]{background:#f1f5f9!important;color:#475569!important}.sgp-reception-indicator[data-received="unknown"]{background:#fff7ed!important;color:#9a3412!important}';explorerStyle.textContent+='.sgp-explorer-multi{display:inline-block;padding:3px 7px;border-radius:999px;background:#e7f0ff;color:#124a89;border:1px solid #bcd4f7;font-size:11px;font-weight:700;margin:2px 4px}';
const explorerEsc=v=>String(v??'').replace(/[&<>\"']/g,c=>'&#'+c.charCodeAt(0)+';');
const explorerSelection=document.createElement('div');explorerSelection.id='sgpExplorerSelection';explorerSelection.setAttribute('role','status');explorerSelection.innerHTML='<strong>Producción seleccionada</strong><p>Selecciona una producción para consultar su contexto antes de programarla.</p><p>La asignación por día y turno estará disponible después de validar el mecanismo operativo de guardado.</p>';explorer.querySelector('#sgpExplorerResults').after(explorerSelection);
const explorerReceptionFilter=explorer.querySelector('#sgpExplorerReceptionFilter'),explorerLegalFilter=explorer.querySelector('#sgpExplorerLegalFilter');
const explorerWeek=explorer.querySelector('#sgpExplorerWeek'),explorerSystem=explorer.querySelector('#sgpExplorerSystem'),explorerSearch=explorer.querySelector('#sgpExplorerSearch'),explorerStateFilter=explorer.querySelector('#sgpExplorerStateFilter'),explorerSort=explorer.querySelector('#sgpExplorerSort');
function explorerSyncWeeks(){
 const src=document.querySelector('#assemblyWeek');if(!src)return;
 const options=Array.from(src.options).filter(o=>o.value&&Number.isInteger(Number(o.value))&&Number(o.value)>=1&&Number(o.value)<=53);
 const old=explorerWeek.value;
 explorerWeek.replaceChildren(...options.map(o=>new Option(o.text,o.value)));
 if(options.length){explorerWeek.value=options.some(o=>o.value===old)?old:(options.some(o=>o.value===src.value)?src.value:options[0].value)}
 else explorerWeek.replaceChildren(new Option('Cargando semanas…',''));
}
async function explorerRefreshWeeks(){
 const token=window.SGPPlannerBridge?.getToken?.();if(!token)return;
 try{
  const client=await window.SGPPlannerBridge.getClient();
  const {data,error}=await client.rpc('sgp_picking_semanas',{p_token:token});
  if(error)throw error;
  const weeks=[...new Set((Array.isArray(data)?data:[]).map(Number).filter(n=>Number.isInteger(n)&&n>=1&&n<=53))].sort((a,b)=>b-a);
  const prev=explorerWeek.value;
  explorerWeek.replaceChildren(...weeks.map(w=>new Option('Semana '+w,String(w))));
  if(weeks.length)explorerWeek.value=weeks.some(w=>String(w)===prev)?prev:String(weeks[0]);
  else explorerWeek.replaceChildren(new Option('Sin semanas disponibles',''));
 }catch(e){explorerSyncWeeks();explorer.querySelector('#sgpExplorerStatus').textContent='No fue posible consultar semanas: '+e.message}
}
function explorerNum(v){const n=Number(v);return Number.isFinite(n)?n:0}
let explorerDetail=new Map(),explorerDetailSeq=0;
async function explorerLoadDetail(){
 const token=window.SGPPlannerBridge?.getToken?.(),week=Number(document.querySelector('#assemblyWeek')?.value),line=document.querySelector('#assemblyLine')?.value;
 const seq=++explorerDetailSeq;explorerDetail=new Map();
 if(!token||!Number.isInteger(week)||week<1||week>53||!line){explorerRender();return}
 try{
  const client=await window.SGPPlannerBridge.getClient();
  const {data,error}=await client.rpc('sgp_linea_plan_explorador_v327',{p_token:token,p_semana:week,p_linea:line});
  if(error)throw error;
  if(seq!==explorerDetailSeq)return;
  explorerDetail=new Map((Array.isArray(data)?data:[]).map(r=>[r.key_produccion,r]));
  explorerRender();
 }catch(e){if(seq===explorerDetailSeq){explorerRender();explorer.querySelector('#sgpExplorerStatus').textContent+=' · Detalle de vidrio no disponible: '+e.message}}
}
function explorerState(value){const v=String(value||'Sin dato').trim().toUpperCase();return '<span class="sgp-explorer-state" data-state="'+explorerEsc(v)+'">'+explorerEsc(v)+'</span>'}
function explorerGlass(r){
 const v=explorerDetail.get(r.key_produccion);
 const fields=[['Prep.','vidrio_preparado','sgp-glass-prep'],['Nov.','vidrio_novedad','sgp-glass-nov'],['Trasl.','vidrio_traslado','sgp-glass-trans']];
 return '<span class="sgp-explorer-glass">'+fields.map(([label,key,cls])=>'<span class="'+cls+'">'+label+'<b>'+(v?.[key]===null||v?.[key]===undefined?'—':explorerEsc(v[key]))+'</b></span>').join('')+'</span>';
}
function explorerMultiReserva(raw){return String(raw||'').split(',').map(v=>v.trim()).filter(Boolean).length>1;}
function explorerReserveLabel(raw){const all=String(raw||'').split(',').map(v=>v.trim()).filter(Boolean);return all.length>1?'<span class="sgp-explorer-multi" title="Producción multi-reserva; no implica reserva compartida">MULTI-RESERVA · principal '+explorerEsc(all[0])+'</span>':'';}
// Datos operativos independientes de la hoja Export. No inferir ausencia cuando la RPC falle.
let explorerOps={mechanized:new Map(),picking:new Map(),reception:new Map(),mechanizedOk:false,pickingOk:false,receptionOk:false},explorerOpsSeq=0;
function explorerPrimaryReserva(r){return String(r.reserva_al||r.reserva||'').split(',')[0].trim()}
function explorerMechanized(r){const operational=explorerOps.mechanized.get(String(r.key_produccion||''));return operational||(!explorerOps.mechanizedOk?'SIN CONSULTAR':String(r.estado_mecanizado||'SIN DATO').trim().toUpperCase())}
function explorerPicking(r){return explorerOps.picking.get(String(r.key_produccion||''))||{entrega:'SIN ENTREGAR',completitud:'—',validacion:'—'}}
function explorerReception(reserve){const k=String(reserve||'').split(',')[0].trim();const item=explorerOps.reception.get(k);if(!explorerOps.receptionOk)return {received:null,ok:null,label:'RECEPCIÓN SIN CONSULTAR'};if(!item)return {received:false,ok:false,label:'PENDIENTE DE RECIBIR'};const ok=item.ok_export===true;const received=String(item.estado||'').toUpperCase()==='RECIBIDA'&&Boolean(item.fecha_recepcion||item.fecha_recepcion_operativa)||ok;return {received,ok,label:received?'RECIBIDA · '+(ok?'LEGALIZADA / OK':'SIN LEGALIZAR')+(item.completa===false?' · CON FALTANTES':''):'PENDIENTE DE RECIBIR'};}
async function explorerLoadOperations(){
 const token=window.SGPPlannerBridge?.getToken?.(),seq=++explorerOpsSeq;
 explorerOps={mechanized:new Map(),picking:new Map(),reception:new Map(),mechanizedOk:false,pickingOk:false,receptionOk:false};
 if(!token){explorerRender();return}
 try{
 const client=await window.SGPPlannerBridge.getClient();
 const queries=[['sgp_picking_cola',{p_token:token}],['sgp_recepcion_listar',{p_token:token,p_semana:null}]];
 const results=await Promise.allSettled(queries.map(([name,args])=>client.rpc(name,args)));
 if(seq!==explorerOpsSeq)return;
 const picking=results[0];
 if(picking.status==='fulfilled'&&!picking.value.error&&Array.isArray(picking.value.data)){
  explorerOps.mechanizedOk=true;explorerOps.pickingOk=true;
  for(const p of picking.value.data)for(const order of (Array.isArray(p.ordenes)?p.ordenes:[])){
   const key=String(order.key_produccion||'');if(!key)continue;
   const mech=String(order.estado_mecanizado||p.estado||'').toUpperCase();
   if(mech)explorerOps.mechanized.set(key,mech);
   const raw=String(order.entrega_estado||'').toUpperCase();
   const hasDelivery=Boolean(raw);
   if(hasDelivery)explorerOps.picking.set(key,{entrega:'ENTREGADA',completitud:order.entrega_completa===true?'COMPLETA':order.entrega_completa===false?'CON FALTANTES':'SIN DATO',validacion:raw==='PENDIENTE_VALIDACION'?'PENDIENTE DE VALIDACIÓN':raw==='VALIDADA'?'VALIDADA':raw==='AUDITADA_DIFERENCIA'?'VALIDADA CON DIFERENCIAS':raw});
  }
 }
 // Fuente canónica del calendario: ejecución por id_programacion; no confundir PROGRAMADA con PROCESADO.
 // Las lecturas directas respetan los permisos actuales del usuario, sin credenciales privilegiadas.
 try{
  const visible=getRows(),reservations=[...new Set(visible.map(explorerPrimaryReserva).filter(Boolean))];
  if(reservations.length&&reservations.length<=300){
   const {data:plans,error:planError}=await client.from('sgp_mecanizado_programacion')
    .select('id_programacion,reserva,fecha_programacion,estado').in('reserva',reservations).neq('estado','CANCELADA');
   if(planError)throw planError;
   if(seq!==explorerOpsSeq)return;
   const ids=[...new Set((plans||[]).map(p=>p.id_programacion).filter(Boolean))];
   if(ids.length&&ids.length<=500){
    const [execution,details]=await Promise.all([
     client.from('sgp_mecanizado_ejecucion').select('id_programacion,estado').in('id_programacion',ids),
     client.from('sgp_mecanizado_programacion_detalle').select('id_programacion,key_produccion').in('id_programacion',ids)
    ]);
    if(execution.error)throw execution.error;
    if(seq!==explorerOpsSeq)return;
    const statusById=new Map((execution.data||[]).map(e=>[String(e.id_programacion),String(e.estado||'').toUpperCase()]));
    const plansByReserve=new Map();
    for(const p of plans||[]){const k=String(p.reserva||'').trim();if(!plansByReserve.has(k))plansByReserve.set(k,[]);plansByReserve.get(k).push(p)}
    const keysByReserve=new Map();
    for(const row of visible){const k=explorerPrimaryReserva(row);if(!keysByReserve.has(k))keysByReserve.set(k,new Set());keysByReserve.get(k).add(String(row.key_produccion||''))}
    const statusByKey=new Map();
    if(!details.error)for(const d of details.data||[]){const st=statusById.get(String(d.id_programacion));if(st&&d.key_produccion){const k=String(d.key_produccion);if(!statusByKey.has(k))statusByKey.set(k,new Set());statusByKey.get(k).add(st)}}
    for(const [key,states] of statusByKey)if(states.size===1)explorerOps.mechanized.set(key,[...states][0]);
    for(const [reserve,items] of plansByReserve){
     const keys=keysByReserve.get(reserve);
     if(!keys||keys.size!==1)continue; // No propagar estado de reserva a múltiples producciones.
     const statuses=new Set(items.map(p=>statusById.get(String(p.id_programacion))).filter(Boolean));
     if(statuses.size===1){const key=[...keys][0];if(!statusByKey.has(key))explorerOps.mechanized.set(key,[...statuses][0])}
    }
    explorerOps.mechanizedOk=true;
   }
  }
 }catch(e){console.warn('Estados de ejecución del explorador no disponibles:',e)}
 if(seq!==explorerOpsSeq)return;
 const reception=results[1];
 if(reception.status==='fulfilled'&&!reception.value.error&&Array.isArray(reception.value.data)){
  explorerOps.receptionOk=true;
  for(const item of reception.value.data)if(item.reserva)explorerOps.reception.set(String(item.reserva).trim(),item);
 }
 explorerRender();
 if(!explorerOps.mechanizedOk||!explorerOps.receptionOk)explorer.querySelector('#sgpExplorerStatus').textContent+=' · Consultas operativas no disponibles para este rol: '+(!explorerOps.mechanizedOk?'mecanizado/Picking ':'')+(!explorerOps.receptionOk?'recepción':'');
 }catch(e){if(seq===explorerOpsSeq){explorerRender();explorer.querySelector('#sgpExplorerStatus').textContent+=' · No se pudieron consultar estados operativos: '+e.message}}
}
function explorerRender(){
 const all=getRows(),q=explorerSearch.value.trim().toLowerCase();
 const systems=[...new Set(all.map(r=>String(r.sistema||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));const prev=explorerSystem.value;
 explorerSystem.innerHTML='<option value="">Todos los sistemas</option>'+systems.map(v=>'<option value="'+explorerEsc(v)+'">'+explorerEsc(v)+'</option>').join('');explorerSystem.value=systems.includes(prev)?prev:'';
 const rows=all.filter(r=>(!explorerSystem.value||String(r.sistema||'')===explorerSystem.value)&&(!explorerStateFilter.value||explorerMechanized(r)===explorerStateFilter.value)&&(!explorerReceptionFilter.value||(explorerOps.receptionOk&&((explorerReception(explorerPrimaryReserva(r)).received===true?'RECIBIDA':'PENDIENTE')===explorerReceptionFilter.value)))&&(!explorerLegalFilter.value||(explorerOps.receptionOk&&((explorerReception(explorerPrimaryReserva(r)).ok?'OK':'SIN_OK')===explorerLegalFilter.value)))&&(!q||[r.reserva_al,r.reserva,r.produccion,r.id,r.sistema,r.proyecto].some(v=>String(v??'').toLowerCase().includes(q))));
 const groups=new Map();for(const r of rows){const reserve=String(r.reserva_al||r.reserva||'Sin reserva');const key=JSON.stringify([reserve,String(r.sistema||'')]);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r)}
 explorer.querySelector('#sgpExplorerStatus').textContent=groups.size+' grupos reserva/sistema · '+rows.length+' producciones · saldo Export '+rows.reduce((n,r)=>n+explorerNum(r.saldo_ensamble),0)+' · semana '+(explorerWeek.selectedOptions[0]?.text||'sin seleccionar');
 const out=explorer.querySelector('#sgpExplorerResults');if(!rows.length){out.textContent='Sin datos para los filtros seleccionados. Consulta una semana disponible.';return}
 const sortedGroups=[...groups.values()].sort((a,b)=>{const mode=explorerSort.value;const state=x=>explorerMechanized(x[0]);const count=x=>x.reduce((n,r)=>n+explorerNum(r.cantidad),0);if(mode==='estado_asc')return state(a).localeCompare(state(b));if(mode==='estado_desc')return state(b).localeCompare(state(a));if(mode==='ventanas_desc')return count(b)-count(a);if(mode==='ventanas_asc')return count(a)-count(b);return String(a[0]?.reserva_al||a[0]?.reserva||'').localeCompare(String(b[0]?.reserva_al||b[0]?.reserva||''),undefined,{numeric:true});});out.innerHTML=sortedGroups.map(rs=>{const first=rs[0],reserve=first.reserva_al||first.reserva||'Sin reserva',glass=rs.map(r=>r.porc_vidrio).filter(v=>v!==null&&v!==undefined&&v!=='').map(Number).filter(Number.isFinite),average=glass.length?(glass.reduce((a,b)=>a+b,0)/glass.length).toFixed(1)+'%':'Sin dato';
 const partKey=r=>String(explorerDetail.get(r.key_produccion)?.parte??'').trim();const parts=new Map();for(const r of rs){const p=partKey(r)||'Parte no disponible en programación';if(!parts.has(p))parts.set(p,[]);parts.get(p).push(r)}
 return '<details class="sgp-explorer-reservation"><summary><strong>Reserva '+explorerEsc(reserve)+'</strong> · '+explorerEsc(first.sistema||'—')+' · '+explorerEsc(first.acabado||'—')+' · '+explorerEsc(first.tipo||'—')+'<div class="sgp-explorer-metrics"><span>Órdenes/producciones: '+rs.length+'</span><span>Ventanas: '+rs.reduce((n,r)=>n+explorerNum(r.cantidad),0)+'</span><span>Vidrio promedio: '+average+'</span><span class="sgp-explorer-status-summary">Estado: '+([...new Set(rs.map(r=>explorerMechanized(r)).filter(Boolean))].map(explorerState).join(' ')||explorerState('SIN DATO'))+'</span><span>Recepción: '+explorerEsc(explorerReception(reserve).label)+'</span><span>Picking: '+explorerEsc(!explorerOps.pickingOk?'SIN CONSULTAR':rs.every(r=>explorerPicking(r).entrega==='ENTREGADA')?'ENTREGADA':rs.some(r=>explorerPicking(r).entrega==='ENTREGADA')?'ENTREGA PARCIAL DE ÓRDENES':'SIN ENTREGAR')+'</span></div></summary>'+[...parts].map(([part,orders])=>'<div class="sgp-explorer-part"><div class="sgp-part-header"><strong>'+explorerEsc(part)+'</strong> · '+orders.length+' producciones · '+orders.reduce((n,r)=>n+explorerNum(r.cantidad),0)+' ventanas · '+[['Prep.','vidrio_preparado'],['Nov.','vidrio_novedad'],['Trasl.','vidrio_traslado']].map(([label,key])=>label+' '+(orders.every(r=>explorerDetail.has(r.key_produccion)&&explorerDetail.get(r.key_produccion)?.[key]!=null)?orders.reduce((n,r)=>n+explorerNum(explorerDetail.get(r.key_produccion)[key]),0):'—')).join(' · ')+' <button type="button" data-plan-part="'+explorerEsc(JSON.stringify([reserve,first.sistema,part]))+'">Programar parte completa</button></div>'+orders.map(r=>'<div class="sgp-explorer-order"><strong>'+explorerEsc(r.produccion||r.id||'Producción')+'</strong> '+explorerReserveLabel(r.reserva_al||r.reserva)+' · '+explorerEsc(r.sistema||'')+' · '+explorerEsc(r.cantidad??'—')+' ventanas<br>Estado: '+explorerState(explorerMechanized(r))+' · Entrega: '+explorerEsc(explorerOps.pickingOk?[explorerPicking(r).entrega,explorerPicking(r).completitud,'Validación: '+explorerPicking(r).validacion].join(' · '):'SIN CONSULTAR')+' · Vidrio: '+explorerGlass(r)+'<br><button type="button" data-plan-key="'+explorerEsc(r.key_produccion||'')+'">Seleccionar para programar</button></div>').join('')+'</div>').join('')+'</details>'}).join('');
 const rsForPart=(reserve,system,part)=>getRows().filter(r=>String(r.reserva_al||r.reserva||'Sin reserva')===reserve&&String(r.sistema||'')===system&&String(explorerDetail.get(r.key_produccion)?.parte??'').trim()===part);
 out.querySelectorAll('[data-plan-part]').forEach(b=>{b.onclick=()=>{const [reserve,system,part]=JSON.parse(b.dataset.planPart);const candidates=rsForPart(reserve,system,part);const keys=candidates.map(r=>r.key_produccion).filter(Boolean);if(keys.length!==candidates.length||!keys.length){explorerSelection.textContent='No se puede preparar esta parte: faltan identificadores de producción.';return;}const result=window.SGPLinePlanner?.selectPart?.(keys,{reserva:reserve,sistema:system,parte:part});explorerSelection.textContent=result?.message||'El formulario de programación por parte no está disponible.';if(result?.ok)document.querySelector('.sgp-planner-operations')?.scrollIntoView({behavior:'smooth',block:'start'});};});
 out.querySelectorAll('[data-plan-key]').forEach(b=>{b.disabled=!b.dataset.planKey;b.onclick=()=>{const selected=getRows().find(r=>String(r.key_produccion||'')===b.dataset.planKey);if(selected){explorerSelection.innerHTML='<strong>Producción seleccionada</strong><p>'+explorerEsc(selected.produccion||selected.id||selected.key_produccion)+' · '+explorerEsc(selected.sistema||'')+' · Reserva principal '+explorerEsc(String(selected.reserva_al||selected.reserva||'').split(',')[0].trim())+'</p><p>Consulta operativa preparada. No se han guardado cambios de programación.</p>';}const select=window.SGPLinePlanner?.selectProduction;if(typeof select!=='function'){explorerSelection.innerHTML+='<p>El formulario operativo de Línea todavía no está disponible. No se realizaron cambios.</p>';return;}const result=select(b.dataset.planKey);explorerSelection.innerHTML+='<p>'+explorerEsc(result?.message||'No se pudo seleccionar la producción')+'</p>';if(result?.ok)document.querySelector('.sgp-planner-operations')?.scrollIntoView({behavior:'smooth',block:'start'});}});
}
explorer.querySelector('#sgpExplorerLoad').addEventListener('click',()=>{const w=document.querySelector('#assemblyWeek');if(w&&explorerWeek.value){if(!Array.from(w.options).some(o=>o.value===explorerWeek.value))w.add(new Option('Semana '+explorerWeek.value,explorerWeek.value));w.value=explorerWeek.value;window.SGPPlannerBridge?.loadAssembly?.()}});explorerSystem.addEventListener('change',explorerRender);explorerSearch.addEventListener('input',explorerRender);explorerStateFilter.addEventListener('change',explorerRender);explorerSort.addEventListener('change',explorerRender);explorerReceptionFilter.addEventListener('change',explorerRender);explorerLegalFilter.addEventListener('change',explorerRender);
explorerSyncWeeks();explorerRefreshWeeks();document.querySelector('#assemblyWeek')?.addEventListener('change',()=>{if(document.querySelector('#assemblyWeek')?.value)explorerSyncWeeks()});
document.querySelector('#assemblyStatus')&&new MutationObserver(()=>{explorerRender();explorerLoadDetail();explorerLoadOperations()}).observe(document.querySelector('#assemblyStatus'),{childList:true,characterData:true,subtree:true});
document.querySelector('#productionPlannerTab')?.addEventListener('click',()=>{explorerRefreshWeeks();explorerRender();explorerLoadOperations()});setTimeout(()=>{explorerRender();explorerLoadDetail();explorerLoadOperations()},0);

const style=document.createElement('style');
style.textContent='.sgp-planner-heading h3{margin:0;color:#124a89}.sgp-planner-heading small{font-size:12px;color:#62788e}.sgp-planner-heading p,.sgp-planner-note{color:#60748b;font-size:13px}.sgp-planner-actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:12px 0}.sgp-planner-actions label{display:flex;gap:8px;align-items:center}.sgp-planner-actions input{flex:1;min-width:170px}.sgp-planner-actions select,.sgp-planner-actions input,.sgp-planner-actions button{padding:9px;border:1px solid #bfd1e6;border-radius:8px;background:white;color:#164675}.sgp-planner-stats{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.sgp-planner-stat{background:#eaf3ff;padding:10px 14px;border-radius:9px;color:#124a89}.sgp-planner-stat strong{display:block;font-size:21px}.sgp-planner-content{overflow-x:auto}.sgp-planner-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px}.sgp-planner-card{padding:12px;border:1px solid #cdddf0;border-radius:10px;background:#fff;color:#1c4169}.sgp-planner-card strong{display:block}.sgp-planner-card small{display:block;margin-top:5px}.sgp-planner-board{display:grid;grid-template-columns:repeat(3,minmax(190px,1fr));gap:10px;min-width:580px}.sgp-planner-lane{background:#eef5ff;border-radius:10px;padding:10px}.sgp-planner-table{width:100%;border-collapse:collapse;min-width:700px}.sgp-planner-table th,.sgp-planner-table td{padding:9px;border-bottom:1px solid #dce6f3;text-align:left}.sgp-planner-table th{background:#dceaff;color:#124a89}@media(max-width:600px){.sgp-planner-actions>*{width:100%}.sgp-planner-board{min-width:580px}}';
document.head.appendChild(style);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>Number(v)||0;
function getRows(){return Array.isArray(window.SGPPlannerBridge?.getRows?.())?window.SGPPlannerBridge.getRows():[]}
function card(r){return '<article class="sgp-planner-card"><strong>'+esc(r.produccion||r.id||'Producción')+'</strong><small>'+esc(r.sistema)+' · Reserva '+esc(r.reserva_al||r.reserva||'—')+'</small><small>Saldo Export: '+esc(r.saldo_ensamble??'—')+' · Estado: '+esc(r.estado_produccion||'—')+'</small><small>Vidrio: '+esc(r.porc_vidrio??'—')+' · '+esc(r.ubicacion_vidrio||'Consultar reporte')+'</small></article>'}
function render(){
const q=document.querySelector('#sgpPlannerSearch').value.toLowerCase().trim();
const rows=getRows().filter(r=>!q||[r.produccion,r.id,r.sistema,r.reserva_al,r.reserva].some(v=>String(v??'').toLowerCase().includes(q)));
const stats=document.querySelector('#sgpPlannerStats'),content=document.querySelector('#sgpPlannerContent');
stats.innerHTML='<div class="sgp-planner-stat">Producciones<strong>'+rows.length+'</strong></div><div class="sgp-planner-stat">Saldo Export<strong>'+rows.reduce((n,r)=>n+num(r.saldo_ensamble),0)+'</strong></div><div class="sgp-planner-stat">Abiertas<strong>'+rows.filter(r=>r.estado_produccion==='ABIERTA').length+'</strong></div>';
if(!rows.length){content.textContent='No hay producciones cargadas. Selecciona semana y línea en Hoja de Ensamble y pulsa Actualizar.';return}
const view=document.querySelector('#sgpPlannerView').value;
if(view==='table'){content.innerHTML='<table class="sgp-planner-table"><thead><tr><th>Producción</th><th>Sistema</th><th>Reserva</th><th>Saldo Export</th><th>Estado ensamble</th><th>Mecanizado</th><th>Entrega</th><th>Vidrio</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+esc(r.produccion||r.id)+'</td><td>'+esc(r.sistema)+'</td><td>'+esc(r.reserva_al||r.reserva)+'</td><td>'+esc(r.saldo_ensamble)+'</td><td>'+esc(r.estado_produccion)+'</td><td>'+esc(r.ubicacion_vidrio||'Ver reporte')+'</td></tr>').join('')+'</tbody></table>';return}
if(view==='kanban'){const lanes=[['ABIERTA','Abiertas'],['ENSAMBLADA','Ensambladas'],['OTROS','Otros estados']];content.innerHTML='<div class="sgp-planner-board">'+lanes.map(([code,label])=>'<div class="sgp-planner-lane"><strong>'+label+'</strong>'+rows.filter(r=>code==='OTROS'?!['ABIERTA','ENSAMBLADA'].includes(r.estado_produccion):r.estado_produccion===code).map(card).join('')+'</div>').join('')+'</div>';return}
content.innerHTML='<p class="sgp-planner-note">Vista de carga semanal. Fechas y turnos pendientes de la nueva programación persistente; no se inventan asignaciones.</p><div class="sgp-planner-grid">'+rows.map(card).join('')+'</div>';
}
explorer.querySelector('#sgpPlannerView').addEventListener('change',render);
explorer.querySelector('#sgpPlannerSearch').addEventListener('input',render);
explorer.querySelector('#sgpPlannerRefresh').addEventListener('click',render);
explorer.querySelector('#sgpPlannerLocations').addEventListener('click',()=>document.querySelector('#productionLocationsTab')?.click());
document.querySelector('#loadAssembly')?.addEventListener('click',()=>setTimeout(render,800));
document.querySelector('#productionPlannerTab')?.addEventListener('click',()=>{if(!getRows().length)document.querySelector('#loadAssembly')?.click();else render()});
const assemblyStatus=document.querySelector('#assemblyStatus');if(assemblyStatus)new MutationObserver(render).observe(assemblyStatus,{childList:true,characterData:true,subtree:true});
render();

/* Pending assembly queue: read-only, preserves original assignment workflow. */
const pending=document.createElement('section');pending.id='sgpPendingAssemblyQueue';pending.innerHTML='<h3>Órdenes pendientes · Programación directa</h3><p>Saldo de ensamble positivo de la hoja cargada. Selecciona una orden y confirma fecha, turno, prioridad y cantidad antes de guardar. El saldo Export no equivale necesariamente al saldo sin programar.</p><p id="sgpPendingCount" role="status"></p><input type="search" id="sgpPendingSearch" placeholder="Filtrar producción, sistema o reserva" aria-label="Filtrar pendientes"><div id="sgpPendingRows"></div>';
root.append(pending);
const queueStyle=document.createElement('style');queueStyle.textContent='#sgpPendingAssemblyQueue{margin:16px 0;padding:16px;border:1px solid #c9d9eb;border-radius:14px;background:#f7f9fc}#sgpPendingAssemblyQueue h3{color:#103b73;margin:0}#sgpPendingAssemblyQueue p{font-size:13px;color:#526781}#sgpPendingSearch{box-sizing:border-box;width:100%;padding:11px;border:1px solid #b7cee9;border-radius:8px}.sgp-pending-item{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:8px 0;padding:12px;border:1px solid #dce5f2;border-radius:12px;background:white}.sgp-pending-item small{display:block;color:#526781}.sgp-pending-item button{min-height:44px;padding:8px 14px;border:0;border-radius:8px;background:#1264c8;color:white;font-weight:800;cursor:pointer}.sgp-pending-item button:focus-visible{outline:3px solid #103b73;outline-offset:2px}@media(max-width:640px){.sgp-pending-item{flex-direction:column;align-items:stretch}}';document.head.append(queueStyle);
function renderPending(){
 const q=document.querySelector('#sgpPendingSearch').value.trim().toLowerCase();
 const records=getRows().filter(r=>Number(r.saldo_ensamble)>0).filter(r=>!q||[r.produccion,r.sistema,r.reserva_al,r.reserva].some(v=>String(v??'').toLowerCase().includes(q)));
 const host=document.querySelector('#sgpPendingRows');host.replaceChildren();
 document.querySelector('#sgpPendingCount').textContent=records.length+' órdenes con saldo de ensamble positivo · Semana '+(document.querySelector('#assemblyWeek')?.value||'—');if(!records.length){host.textContent='Sin pendientes en la hoja cargada para este filtro.';return;}
 records.forEach(r=>{
  const item=document.createElement('article');item.className='sgp-pending-item';
  const label=document.createElement('div'),name=document.createElement('strong'),detail=document.createElement('small'),button=document.createElement('button');
  name.textContent=r.produccion||'Producción';detail.textContent=[r.sistema||'Sin sistema','Reserva '+(r.reserva_al||r.reserva||'—'),'Saldo '+r.saldo_ensamble].join(' · ');const state=document.createElement('small');state.textContent='Estado: ';const stateBadge=document.createElement('span');stateBadge.className='sgp-explorer-state';stateBadge.dataset.state=String(r.estado_mecanizado||'Sin dato').trim().toUpperCase();stateBadge.textContent=stateBadge.dataset.state;state.append(stateBadge);const obs=document.createElement('small');obs.textContent=r.observacion_mecanizado?'Observación mecanizado: '+r.observacion_mecanizado:'';label.append(name,detail,state);if(obs.textContent)label.append(obs);
  button.type='button';button.textContent='Programar';button.setAttribute('aria-label','Programar '+(r.produccion||'producción'));button.onclick=()=>{
   const result=window.SGPLinePlanner?.selectProduction?.(r.key_produccion);
   if(!result?.ok){const msg=document.querySelector('#sgpPlanMessage');if(msg)msg.textContent=result?.message||'Actualiza la hoja de Ensamble.';return;}
   document.querySelector('#sgpPlanProduction')?.focus();
   document.querySelector('.sgp-planner-operations')?.scrollIntoView({behavior:'auto',block:'start'});
  };item.append(label,button);host.append(item);
 });
}
document.querySelector('#sgpPendingSearch').addEventListener('input',renderPending);document.addEventListener('sgp:line-plan-updated',renderPending);
document.querySelector('#productionPlannerTab')?.addEventListener('click',()=>setTimeout(renderPending,0));
document.querySelector('#loadAssembly')?.addEventListener('click',()=>setTimeout(renderPending,850));
if(assemblyStatus)new MutationObserver(renderPending).observe(assemblyStatus,{childList:true,subtree:true});
renderPending();
})();