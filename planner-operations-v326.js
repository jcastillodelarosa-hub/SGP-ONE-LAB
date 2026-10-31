/* LAB v326: Planificador persistente, operaciones explícitas autenticadas. */
(()=>{'use strict';
const $=id=>document.getElementById(id),root=$('productionPlannerPanel');if(!root)return;
const panel=document.createElement('section');panel.className='sgp-planner-operations';
panel.innerHTML='<h3>Programación por turno</h3><p>La cantidad y el saldo del Export no se modifican. Las acciones requieren sesión y permisos.</p><div class="sgp-planner-actions"><label>Fecha <input type="date" id="sgpPlanDate"></label><label>Turno <select id="sgpPlanShift"><option value="1">Turno 1</option><option value="2">Turno 2</option></select></label><label>Prioridad <input type="number" min="1" value="1" id="sgpPlanPriority"></label><button id="sgpPlanLoad" type="button">Consultar turnos</button></div><div class="sgp-planner-actions"><label>Producción <select id="sgpPlanProduction"></select></label><label>Cantidad <input id="sgpPlanQuantity" type="number" min="1" step="1"></label><button id="sgpPlanSave" type="button">Programar</button></div><p id="sgpPlanMessage" role="status"></p><div id="sgpPlanPartBatch" hidden><strong id="sgpPlanPartTitle"></strong><p id="sgpPlanPartPreview"></p><button id="sgpPlanPartSave" type="button">Programar todas las producciones de la parte</button><button id="sgpPlanPartCancel" type="button">Cancelar selección de parte</button></div><div id="sgpPlanAssignments"></div>';
root.append(panel);
const styles=document.createElement('style');styles.textContent='.sgp-planner-operations{margin:18px 0;padding:14px;border:1px solid #c9d9eb;border-radius:12px;background:#f8fbff}.sgp-planner-operations h3{color:#174f89}.sgp-planner-operations label{display:grid;gap:4px}.sgp-planner-operations select,.sgp-planner-operations input{padding:8px;border:1px solid #b7cee9;border-radius:7px;max-width:240px}.sgp-plan-row{padding:10px;border:1px solid #d5e1ef;border-radius:9px;margin:8px 0;background:white}.sgp-plan-row button{margin:4px;padding:8px;border-radius:7px;border:1px solid #bfd2e8;background:#eaf3ff;color:#124b8b}';document.head.append(styles);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=$('sgpPlanDate');date.value=new Date().toLocaleDateString('en-CA');let items=[];let pendingPart=null;
const toISO=value=>new Date(value).toISOString().slice(0,10);
const addDays=(iso,count)=>toISO(new Date(iso+'T12:00:00Z').getTime()+count*86400000);
const weekStart=iso=>{const day=new Date(iso+'T12:00:00Z').getUTCDay();return addDays(iso,-((day+6)%7))};
const todayISO=()=>new Date().toLocaleDateString('en-CA');
function isoWeekValue(monday){const thursday=addDays(monday,3);const year=Number(thursday.slice(0,4));const jan4=weekStart(year+'-01-04');const number=1+Math.round((new Date(monday+'T12:00:00Z')-new Date(jan4+'T12:00:00Z'))/604800000);return year+'-W'+String(number).padStart(2,'0')}
function mondayFromIsoWeek(value){const match=/^(\d{4})-W(\d{2})$/.exec(value||'');if(!match)return null;const number=Number(match[2]);if(number<1||number>53)return null;const monday=addDays(weekStart(match[1]+'-01-04'),(number-1)*7);return isoWeekValue(monday)===value?monday:null}
let weekAnchor=weekStart(date.value),loadSequence=0;
function rows(){return Array.isArray(window.SGPPlannerBridge?.getRows?.())?window.SGPPlannerBridge.getRows():[]}
function refreshProductions(){const old=$('sgpPlanProduction').value;const sel=$('sgpPlanProduction');sel.replaceChildren(...rows().map(r=>new Option([r.produccion,r.sistema,'Saldo '+r.saldo_ensamble].join(' · '),r.key_produccion)));if([...sel.options].some(o=>o.value===old))sel.value=old}
function notify(s){$('sgpPlanMessage').textContent=s}
function selectProduction(key){pendingPart=null;$('sgpPlanPartBatch').hidden=true;refreshProductions();const sel=$('sgpPlanProduction');const option=Array.from(sel.options).find(o=>o.value===String(key||''));if(!option)return {ok:false,message:'Producción no disponible en la hoja de Ensamble cargada. Actualiza la semana y la línea.'};sel.value=option.value;const row=rows().find(r=>String(r.key_produccion||'')===option.value);const qty=Number(row?.saldo_ensamble);$('sgpPlanQuantity').value=Number.isInteger(qty)&&qty>0?String(qty):'';notify('Producción seleccionada. Verifica las asignaciones existentes, fecha, turno y cantidad antes de guardar.');return {ok:true,message:'Producción cargada en el formulario de Línea. Verifica los datos antes de pulsar Programar.'}}
function selectPart(keys,meta={}){refreshProductions();const distinct=[...new Set(keys.map(String))];const selected=distinct.map(key=>rows().find(r=>String(r.key_produccion)===key));if(!distinct.length||selected.some(r=>!r))return {ok:false,message:'No se pudo preparar la parte: faltan producciones en la hoja cargada.'};if(selected.some(r=>!Number.isInteger(Number(r.saldo_ensamble))||Number(r.saldo_ensamble)<1))return {ok:false,message:'La parte contiene producciones sin saldo positivo; revisa los pendientes antes de programar.'};pendingPart=selected.map(r=>({key:r.key_produccion,name:r.produccion,quantity:Number(r.saldo_ensamble)}));$('sgpPlanPartBatch').hidden=false;$('sgpPlanPartTitle').textContent='Parte '+(meta.parte||'')+' · '+pendingPart.length+' producciones';$('sgpPlanPartPreview').textContent='Cantidades propuestas según saldo de ensamble: '+pendingPart.map(r=>r.name+' ('+r.quantity+')').join(' · ')+'. Verifica asignaciones previas; no equivale al saldo sin programar.';notify('Parte preparada. Revisa fecha, turno, prioridad y cantidades. El guardado masivo está bloqueado hasta contar con una operación transaccional.');return {ok:true,message:'Parte '+(meta.parte||'')+' preparada con '+pendingPart.length+' producciones. Revisa el resumen y confirma la programación.'};}
window.SGPLinePlanner=Object.freeze({selectProduction,selectPart,getAssignments:()=>items.slice(),reloadAssignments:()=>load(),programDirect,moveDirect,programGroup,groupBalances});

async function rpc(name,params){const token=window.SGPPlannerBridge?.getToken?.();if(!token)throw Error('No hay sesión accesible para el Planificador');const client=await window.SGPPlannerBridge.getClient();const {data,error}=await client.rpc(name,{p_token:token,...params});if(error)throw error;return data}
const inFlight=new Set();
async function groupBalances(keys){
 // The visible week is not the global balance. Do not infer a safe amount here.
 return keys.map(key=>({key_produccion:key,pendiente:null,asignado_global:null,inconsistente:false}));
}
async function programGroup({requestId,day,shift,items:productions}){
 if(!requestId||!/^\d{4}-\d{2}-\d{2}$/.test(day)||![1,2].includes(Number(shift))||!Array.isArray(productions)||!productions.length)throw Error('Solicitud grupal inválida');
 if(productions.length>100||new Set(productions.map(p=>p.key_produccion)).size!==productions.length||productions.some(p=>!rows().some(r=>String(r.key_produccion)===String(p.key_produccion))||!validTarget(day,shift,p.cantidad,p.prioridad)))throw Error('Cantidades, prioridades o producciones inválidas');
 const key='group|'+requestId;if(inFlight.has(key))throw Error('La programación ya está en curso');inFlight.add(key);
 const accepted=[],rejected=[];
 try{
  for(const item of productions){
   try{
    const result=await rpc('sgp_linea_plan_programar',{p_key_produccion:item.key_produccion,p_fecha:day,p_turno:Number(shift),p_cantidad:Number(item.cantidad),p_prioridad:Number(item.prioridad)});
    if(result?.ok===false)throw Error(result.mensaje||result.error||'Rechazada');
    accepted.push({key_produccion:item.key_produccion,cantidad:Number(item.cantidad),id_asignacion:result});
   }catch(error){rejected.push({key_produccion:item.key_produccion,cantidad:Number(item.cantidad),motivo:'No programada; revisar saldo, sesión o datos'});}
  }
  await load();
  return {ok:rejected.length===0,parcial:accepted.length>0&&rejected.length>0,aceptadas:accepted,rechazadas:rejected,ventanas_programadas:accepted.reduce((n,p)=>n+p.cantidad,0),ventanas_pendientes:rejected.reduce((n,p)=>n+p.cantidad,0)};
 }finally{inFlight.delete(key)}
}
function validTarget(day,shift,quantity,priority){return /^\d{4}-\d{2}-\d{2}$/.test(day)&&[1,2].includes(Number(shift))&&Number.isInteger(Number(quantity))&&Number(quantity)>0&&Number.isInteger(Number(priority))&&Number(priority)>0}
async function programDirect({key,day,shift,quantity,priority}){
 if(!rows().some(r=>String(r.key_produccion)===String(key))||!validTarget(day,shift,quantity,priority))throw Error('Producción o datos de programación inválidos');
 const request=String(key)+'|'+day+'|'+shift;if(inFlight.has(request))throw Error('Esta programación ya está en curso');
 inFlight.add(request);
 try{const result=await rpc('sgp_linea_plan_programar',{p_key_produccion:key,p_fecha:day,p_turno:Number(shift),p_cantidad:Number(quantity),p_prioridad:Number(priority)});if(result?.ok===false)throw Error(result.mensaje||result.error||'El servidor rechazó la programación');await load();notify('Programación confirmada por el servidor y calendario actualizado.');return result}finally{inFlight.delete(request)}
}
async function moveDirect({assignment,day,shift,quantity,priority}){
 const original=items.find(item=>String(item.id)===String(assignment));if(!original||!validTarget(day,shift,quantity,priority)||Number(quantity)>Number(original.cantidad))throw Error('Asignación o movimiento inválido');
 const request='move|'+assignment;if(inFlight.has(request))throw Error('Este movimiento ya está en curso');inFlight.add(request);
 try{const result=await rpc('sgp_linea_plan_mover',{p_asignacion:assignment,p_fecha:day,p_turno:Number(shift),p_cantidad:Number(quantity),p_prioridad:Number(priority)});if(result?.ok===false)throw Error(result.mensaje||result.error||'El servidor rechazó el movimiento');await load();notify('Movimiento confirmado por el servidor y calendario actualizado.');return result}finally{inFlight.delete(request)}
}
async function load(){const sequence=++loadSequence;const start=weekAnchor,end=addDays(start,6);notify('Consultando '+start+' a '+end+'…');try{const result=await rpc('sgp_linea_plan_consultar',{p_desde:start,p_hasta:end,p_linea:$('assemblyLine')?.value||null});if(sequence!==loadSequence)return;if(!Array.isArray(result))throw Error('La consulta no devolvió asignaciones válidas');items=result;if(selectedDay<start||selectedDay>end)selectedDay=start;render();renderViews();document.dispatchEvent(new CustomEvent('sgp:line-plan-updated'));notify(items.length+' asignaciones consultadas · '+start+' a '+end)}catch(e){if(sequence!==loadSequence)return;items=[];render();renderViews();notify('No fue posible consultar '+start+' a '+end+': '+e.message)}}
function reviewAssignment(key,day,shift,quantity,priority,moving){
 const row=rows().find(r=>String(r.key_produccion||'')===String(key));
 const context=window.SGPLP01ReadContext?.forKey?.(key);
 const current=items.filter(a=>String(a.fecha||'').slice(0,10)===day&&Number(a.turno)===shift).reduce((total,a)=>total+(Number(a.cantidad)||0),0);
 const capacity=Number($('lp01Capacity')?.value)||90;
 const warnings=[];
 if(context?.reception?.received===false)warnings.push('Recepción pendiente');
 if(context?.reception?.received===null)warnings.push('Recepción sin consultar');
 if(context&&!['PROCESADO','PICKING'].includes(context.mechanized))warnings.push('Mecanizado: '+context.mechanized);
 if(!context)warnings.push('Condiciones operativas sin consultar');
 if(current+quantity>capacity)warnings.push('Sobrecupo orientativo: '+(current+quantity)+'/'+capacity);
 const existing=items.filter(a=>String(a.key_produccion||'')===String(key));
 if(existing.length)warnings.push(existing.length+' asignaciones de esta producción en el rango consultado; verifica cantidades y reservas compartidas');
 const detail=(moving?'Mover/dividir':'Programar')+' · '+(row?.produccion||key)+' · '+day+' · turno '+shift+' · '+quantity+' unidades · prioridad '+priority;
 return window.confirm(detail+'\n'+(warnings.length?'Advertencias no bloqueantes:\n• '+warnings.join('\n• '):'Sin advertencias detectadas en las fuentes consultadas.')+'\n¿Confirmar la operación? El servidor volverá a validar permisos, saldo y concurrencia.');
}
async function openMove(a){const qty=Number(prompt('Cantidad a mover (máximo '+a.cantidad+')',a.cantidad));if(!Number.isInteger(qty)||qty<1||qty>Number(a.cantidad))return;const shift=Number($('sgpPlanShift').value),priority=Number($('sgpPlanPriority').value);if(!reviewAssignment(a.key_produccion||a.produccion,date.value,shift,qty,priority,true))return;try{await rpc('sgp_linea_plan_mover',{p_asignacion:a.id,p_fecha:date.value,p_turno:shift,p_cantidad:qty,p_prioridad:priority});await load();notify('Movimiento confirmado y asignaciones actualizadas.')}catch(e){notify('Movimiento rechazado: '+e.message)}}
function render(){const el=$('sgpPlanAssignments');el.replaceChildren();if(!items.length){el.textContent='Sin asignaciones para el rango seleccionado.';return}items.forEach(a=>{const node=document.createElement('div');node.className='sgp-plan-row';node.innerHTML='<strong>'+escape(a.produccion)+'</strong> · '+escape(a.sistema)+' · '+escape(a.fecha)+' T'+escape(a.turno)+' · Prioridad '+escape(a.prioridad)+'<p>Programado: '+escape(a.cantidad)+' · Ensamblado registrado: '+escape(a.ejecutado)+' · Estado: '+escape(a.estado)+'</p><button data-act="move">Mover/dividir</button><button data-act="exec">Registrar ensamble</button>';node.querySelector('[data-act="move"]').onclick=()=>openMove(a);node.querySelector('[data-act="exec"]').onclick=async()=>{const qty=Number(prompt('Unidades ensambladas',Math.max(1,a.cantidad-Number(a.ejecutado))));if(!Number.isInteger(qty)||qty<1)return;const obs=prompt('Observación (obligatoria si queda pendiente)','');if(obs===null)return;try{await rpc('sgp_linea_plan_registrar',{p_asignacion:a.id,p_cantidad:qty,p_observacion:obs});await load()}catch(e){notify('Registro rechazado: '+e.message)}};el.append(node)})}

/* LAB v339: tres vistas enlazadas a la misma consulta de asignaciones. */
const viewShell=document.createElement('section');
viewShell.className='sgp-line-views';
viewShell.innerHTML='<nav class="sgp-line-view-tabs" aria-label="Vistas de planificación"><button type="button" data-view="calendar" aria-pressed="true">Calendario</button><button type="button" data-view="table" aria-pressed="false">Tabla</button><button type="button" data-view="kanban" aria-pressed="false">Kanban</button><button type="button" data-view="pending" aria-pressed="false">Por programar</button><button type="button" data-view="tracking" aria-pressed="false">Ejecución</button></nav><div class="sgp-line-view-content" aria-live="polite"></div>';
panel.prepend(viewShell);
const viewContent=viewShell.querySelector('.sgp-line-view-content');
let activeView='calendar',selectedDay='';
date.addEventListener('change',()=>{selectedDay=date.value});
const sum=(arr,k)=>arr.reduce((n,a)=>n+(Number(a[k])||0),0);
const dayKey=a=>String(a.fecha||'').slice(0,10);
function renderViews(){
 const data=Array.isArray(items)?items:[],all=rows();
 viewShell.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===activeView)));
 if(activeView==='pending'){
  viewContent.innerHTML='<div class="sgp-line-view-head"><h4>Pendientes de Ensamble</h4><input type="search" id="sgpLinePendingSearch" placeholder="Buscar producción, reserva o sistema" aria-label="Buscar pendientes"></div><div id="sgpLinePendingRows"></div>';
  const list=viewContent.querySelector('#sgpLinePendingRows');
  const draw=()=>{const q=viewContent.querySelector('#sgpLinePendingSearch').value.toLocaleLowerCase().trim();
   const filtered=all.filter(a=>Number(a.saldo_ensamble)>0&&[a.produccion,a.id,a.sistema,a.reserva_al,a.reserva].some(v=>String(v??'').toLocaleLowerCase().includes(q)));
   list.replaceChildren();
   if(!filtered.length){list.textContent='No hay producciones con saldo positivo para el filtro actual.';return}
   filtered.forEach(a=>{const line=document.createElement('div');line.className='sgp-line-pending-row';
    line.innerHTML='<div><strong>'+escape(a.produccion||a.id||'Producción')+'</strong><small>'+escape(a.sistema||'—')+' · Reserva '+escape(a.reserva_al||a.reserva||'—')+' · Saldo Export '+escape(a.saldo_ensamble)+'</small></div><button type="button">Programar</button>';
    line.querySelector('button').onclick=()=>{const result=selectProduction(a.key_produccion);notify(result.message);if(result.ok)panel.querySelector('#sgpPlanProduction')?.scrollIntoView({behavior:'smooth',block:'center'});};
    list.append(line);
   });
  };viewContent.querySelector('#sgpLinePendingSearch').addEventListener('input',draw);draw();return;
 }
 if(activeView==='calendar'){
  const days=Array.from({length:7},(_,index)=>addDays(weekAnchor,index));
  viewContent.innerHTML='<div class="lp-week-toolbar"><div><h4>Programación semanal</h4><small>Asignaciones consultadas · lunes a domingo · dos turnos</small></div><div class="lp-week-controls"><button type="button" data-week-action="prev">← Semana anterior</button><label>Semana <input id="sgpPlanWeek" type="week" aria-label="Seleccionar semana"></label><button type="button" data-week-action="today">Hoy</button><button type="button" data-week-action="next">Semana siguiente →</button></div></div><div class="lp-week-scroll"><div class="lp-week-grid" role="grid" aria-label="Calendario de programación semanal"></div></div><p class="lp-week-legend">Arrastra una producción del explorador a cualquier celda. Soltar abre un formulario; no guarda una asignación.</p>';
  const grid=viewContent.querySelector('.lp-week-grid');
  const corner=document.createElement('div');corner.className='lp-week-corner';corner.textContent='Turno / día';grid.append(corner);
  days.forEach(d=>{const h=document.createElement('div');h.className='lp-week-day';h.textContent=new Intl.DateTimeFormat('es-CO',{weekday:'short',day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(d+'T12:00:00Z'));h.title=d;grid.append(h)});
  for(const shift of [1,2]){
   const label=document.createElement('div');label.className='lp-week-shift';label.textContent='Turno '+shift;grid.append(label);
   days.forEach(d=>{const subset=data.filter(a=>dayKey(a)===d&&Number(a.turno)===shift),load=sum(subset,'cantidad');const cell=document.createElement('section');cell.className='lp-week-cell';cell.dataset.lpDate=d;cell.dataset.lpShift=String(shift);cell.setAttribute('role','gridcell');cell.setAttribute('aria-label',d+' turno '+shift+'; '+load+' unidades programadas');
    const head=document.createElement('div');head.className='lp-week-cell-head';head.innerHTML='<strong>'+load+' programadas</strong><small>'+subset.length+' asignaciones</small>';cell.append(head);
    const systems=new Map();subset.forEach(a=>systems.set(String(a.sistema||'Sin sistema'),(systems.get(String(a.sistema||'Sin sistema'))||0)+(Number(a.cantidad)||0)));
    if(systems.size){const breakdown=document.createElement('small');breakdown.className='lp-week-systems';breakdown.textContent=[...systems].map(([name,qty])=>name+': '+qty).join(' · ');cell.append(breakdown)}
    if(!subset.length){const empty=document.createElement('small');empty.className='lp-week-empty';empty.textContent='Suelta aquí una producción';cell.append(empty)}
    subset.sort((a,b)=>Number(a.prioridad)-Number(b.prioridad)).forEach(a=>{const card=document.createElement('article');card.className='lp-week-assignment';card.draggable=Boolean(a.id);if(a.id)card.dataset.lpAssignment=String(a.id);card.title='Arrastra para mover esta asignación';card.innerHTML='<strong>'+escape(a.produccion||'Producción')+'</strong><small>'+escape(a.sistema||'—')+' · '+escape(a.cantidad)+' und. · Prioridad '+escape(a.prioridad)+'</small>';cell.append(card)});
    grid.append(cell)})
  }
  const weekInput=viewContent.querySelector('#sgpPlanWeek');weekInput.value=isoWeekValue(weekAnchor);
  weekInput.onchange=()=>{const chosen=mondayFromIsoWeek(weekInput.value);if(!chosen){notify('Semana inválida');return}weekAnchor=chosen;selectedDay=chosen;load()};
  viewContent.querySelectorAll('[data-week-action]').forEach(button=>button.onclick=()=>{const action=button.dataset.weekAction;weekAnchor=action==='today'?weekStart(todayISO()):addDays(weekAnchor,action==='prev'?-7:7);selectedDay=weekAnchor;load()});return;
 }
 if(activeView==='table'){
  viewContent.innerHTML='<div class="sgp-line-view-head"><h4>Programación · tabla</h4><small>Orden visual por fecha, turno y prioridad; no modifica prioridades guardadas.</small></div><div class="sgp-line-table-wrap"><table><thead><tr><th>Fecha</th><th>Turno</th><th>Prioridad</th><th>Producción</th><th>Sistema</th><th>Programadas</th><th>Ejecutadas</th><th>Estado</th><th>Acción</th></tr></thead><tbody></tbody></table></div>';
  const body=viewContent.querySelector('tbody');const ordered=[...data].sort((a,b)=>dayKey(a).localeCompare(dayKey(b))||Number(a.turno)-Number(b.turno)||Number(a.prioridad)-Number(b.prioridad));
  if(!ordered.length){body.innerHTML='<tr><td colspan="9">Sin asignaciones para el rango consultado.</td></tr>';return}
  ordered.forEach(a=>{const tr=document.createElement('tr');[dayKey(a),a.turno,a.prioridad,a.produccion,a.sistema,a.cantidad,a.ejecutado,a.estado].forEach(value=>{const td=document.createElement('td');td.textContent=String(value??'—');tr.append(td)});const cell=document.createElement('td');const button=document.createElement('button');button.type='button';button.textContent='Mover/dividir';button.onclick=()=>openMove(a);cell.append(button);tr.append(cell);body.append(tr)});return;
 }
 if(activeView==='kanban'){
  const day=selectedDay||date.value;const entries=data.filter(a=>dayKey(a)===day);
  viewContent.innerHTML='<div class="sgp-line-view-head"><h4>Programación · Kanban</h4><label>Día <input type="date" id="sgpKanbanDay"></label></div><p>Las columnas muestran asignaciones, no estados físicos. Selecciona Mover/dividir para confirmar un cambio.</p><div class="sgp-line-kanban"></div>';
  const picker=viewContent.querySelector('#sgpKanbanDay');picker.value=day;picker.onchange=()=>{selectedDay=picker.value;renderViews()};
  const board=viewContent.querySelector('.sgp-line-kanban');
  [0,1,2].forEach(shift=>{const column=document.createElement('section');column.className='sgp-line-kanban-column';const subset=shift?entries.filter(a=>Number(a.turno)===shift):[];const heading=document.createElement('h5');heading.textContent=shift?'Turno '+shift+' · '+sum(subset,'cantidad')+' programadas':'Por asignar';column.append(heading);
   if(!shift){const hint=document.createElement('p');hint.textContent='Consulta la pestaña Por programar para seleccionar una producción con saldo Export. El saldo no equivale a cantidad sin asignar.';column.append(hint);const link=document.createElement('button');link.type='button';link.textContent='Ver pendientes';link.onclick=()=>{activeView='pending';renderViews()};column.append(link)}
   else if(!subset.length){const empty=document.createElement('p');empty.textContent='Sin asignaciones para este turno.';column.append(empty)}
   subset.forEach(a=>{const card=document.createElement('article');card.className='sgp-line-kanban-card';const title=document.createElement('strong');title.textContent=a.produccion||'Producción';const info=document.createElement('p');info.textContent=[a.sistema,a.cantidad+' programadas','Prioridad '+a.prioridad].filter(Boolean).join(' · ');const button=document.createElement('button');button.type='button';button.textContent='Mover/dividir';button.onclick=()=>openMove(a);card.append(title,info,button);column.append(card)});board.append(column)});return;
 }
 viewContent.innerHTML='<div class="sgp-line-view-head"><h4>Seguimiento de Ensamble</h4><small>Datos de asignaciones y ejecución consultadas</small></div><div class="sgp-line-table-wrap"><table><thead><tr><th>Fecha</th><th>Turno</th><th>Prioridad</th><th>Producción</th><th>Programado</th><th>Ensamblado</th><th>Pendiente</th><th>Estado</th></tr></thead><tbody></tbody></table></div>';
 const tbody=viewContent.querySelector('tbody');if(!data.length){tbody.innerHTML='<tr><td colspan="8">Sin asignaciones consultadas</td></tr>';return}
 data.forEach(a=>{const tr=document.createElement('tr');const cells=[dayKey(a),a.turno,a.prioridad,a.produccion,a.cantidad,a.ejecutado,Math.max(0,(Number(a.cantidad)||0)-(Number(a.ejecutado)||0)),a.estado];cells.forEach(v=>{const td=document.createElement('td');td.textContent=String(v??'—');tr.append(td)});tbody.append(tr)});
}
viewShell.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{activeView=b.dataset.view;renderViews()});
const viewCss=document.createElement('style');
viewCss.textContent='.sgp-line-views{margin-bottom:14px}.sgp-line-view-tabs{display:flex;gap:6px;overflow-x:auto;padding:3px 0 12px}.sgp-line-view-tabs button{flex:1;min-width:95px;min-height:44px;border:1px solid #cbdcf0;background:#fff;color:#103b73;border-radius:10px;font-weight:650}.sgp-line-view-tabs button[aria-pressed="true"]{background:#1264c8;color:#fff}.sgp-line-view-head{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;margin:5px 0 12px}.sgp-line-view-head h4{margin:0;color:#103b73}.sgp-line-view-head input{padding:10px;border:1px solid #cbdcf0;border-radius:9px;max-width:100%;flex:1}.sgp-line-days{display:grid;grid-template-columns:repeat(auto-fit,minmax(125px,1fr));gap:8px}.sgp-line-day{display:grid;gap:4px;text-align:left;border:1px solid #cbdcf0;border-radius:12px;padding:10px;background:#fff;color:#0b2442}.sgp-line-day[aria-pressed="true"]{border:2px solid #1264c8;background:#eaf2fb}.sgp-line-day span,.sgp-line-detail small,.sgp-line-pending-row small{display:block;color:#526781;font-size:12px}.sgp-line-pending-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid #dce5f2}.sgp-line-pending-row strong{font-size:14px}.sgp-line-pending-row button{border:0;background:#1264c8;color:white;border-radius:9px;min-height:40px;padding:0 14px}.sgp-line-detail{padding:8px;border-bottom:1px solid #e5ecf5}.sgp-line-table-wrap{overflow:auto;max-height:65vh}.sgp-line-table-wrap table{width:100%;border-collapse:collapse;min-width:680px}.sgp-line-table-wrap th,.sgp-line-table-wrap td{padding:10px;border-bottom:1px solid #dce5f2;text-align:left}.sgp-line-table-wrap th{position:sticky;top:0;background:#eaf2fb;color:#103b73}.sgp-line-view-content details{margin:10px 0;padding:10px;border:1px solid #dce5f2;border-radius:10px}@media(max-width:650px){.sgp-line-views{margin:-4px -5px 12px}.sgp-line-days{grid-template-columns:repeat(2,minmax(0,1fr))}.sgp-line-pending-row{padding:8px 0}.sgp-line-pending-row strong{font-size:13px}.sgp-line-pending-row button{flex:none}.sgp-planner-operations .sgp-plan-row{font-size:13px}}@media(prefers-reduced-motion:reduce){.sgp-line-views *{scroll-behavior:auto!important}}';
viewCss.textContent+='.sgp-line-kanban{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.sgp-line-kanban-column{min-width:0;min-height:180px;padding:12px;border:1px solid #cbdcf0;border-radius:12px;background:#eef5fd}.sgp-line-kanban-column h5{margin:0 0 10px;color:#103b73}.sgp-line-kanban-card{margin:8px 0;padding:12px;border-left:4px solid #1264c8;border-radius:9px;background:#fff;box-shadow:0 1px 3px #163b6816}.sgp-line-kanban-card p{margin:6px 0;color:#526781}.sgp-line-kanban button,.sgp-line-table-wrap button{min-height:40px;padding:7px 11px;border:1px solid #1264c8;border-radius:8px;background:#fff;color:#103b73;font-weight:650}.sgp-line-view-head input[type=date]{min-height:40px;padding:5px;border:1px solid #cbdcf0;border-radius:8px}@media(max-width:700px){.sgp-line-kanban{display:flex;overflow-x:auto;scroll-snap-type:x mandatory}.sgp-line-kanban-column{flex:0 0 min(82vw,320px);scroll-snap-align:start}.sgp-line-view-tabs button{flex:none}}';
document.head.append(viewCss);
renderViews();

$('sgpPlanPartCancel').onclick=()=>{pendingPart=null;$('sgpPlanPartBatch').hidden=true;notify('Selección de parte cancelada; no se guardaron cambios.');};
$('sgpPlanPartSave').disabled=true;$('sgpPlanPartSave').textContent='Programación masiva pendiente de validación';$('sgpPlanPartSave').title='Se requiere una operación transaccional autorizada en Supabase para evitar programación parcial o duplicada.';
$('sgpPlanSave').onclick=async()=>{const key=$('sgpPlanProduction').value;const qty=Number($('sgpPlanQuantity').value),shift=Number($('sgpPlanShift').value),priority=Number($('sgpPlanPriority').value);if(!key||!Number.isInteger(qty)||qty<1||!Number.isInteger(priority)||priority<1||![1,2].includes(shift)||!/^\d{4}-\d{2}-\d{2}$/.test(date.value)){notify('Selecciona producción, fecha, turno, prioridad y cantidad entera positiva');return}if(!reviewAssignment(key,date.value,shift,qty,priority,false))return;try{await rpc('sgp_linea_plan_programar',{p_key_produccion:key,p_fecha:date.value,p_turno:shift,p_cantidad:qty,p_prioridad:priority});await load();notify('Programación confirmada y asignaciones actualizadas.')}catch(e){notify('Programación rechazada: '+e.message)}};
$('sgpPlanLoad').onclick=load;$('productionPlannerTab')?.addEventListener('click',async()=>{if(!rows().length)await window.SGPPlannerBridge?.loadAssembly?.();refreshProductions();load()});$('loadAssembly')?.addEventListener('click',()=>setTimeout(refreshProductions,1000));refreshProductions();
})();
