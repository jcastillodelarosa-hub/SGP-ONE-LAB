import {isoWeekOf,isoWeekRange,normalizeReceptionFilters,filterReceptionRows,summarizeReceptions,receptionStatus,receptionCsv} from '../domain/picking-reception-report.js';
const safe=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const number=value=>Number(value).toLocaleString('es-CO');
const labels={completa:'Completa',incompleta:'Incompleta',sin_evidencia:'Sin evidencia histórica'};
const date=value=>value&&/^\d{4}-\d{2}-\d{2}$/.test(value)?value.split('-').reverse().join('/'):'Sin dato';
const registered=value=>{const d=new Date(value);return value&&Number.isFinite(d.getTime())?d.toLocaleString('es-CO',{timeZone:'America/Bogota'})+' (Colombia)':'Sin dato';};
const table=(headers,rows)=>'<div class="table-wrap" tabindex="0" role="region" aria-label="'+safe(headers[0])+'"><table><thead><tr>'+headers.map(h=>'<th scope="col">'+safe(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table></div>';
function pendingHtml(row){
 const pieces=row.pendientes_al_recibir;
 if(!Array.isArray(pieces))return '<span class="pick-report-unknown">Sin evidencia histórica de pendientes</span>';
 if(!pieces.length)return 'Sin pendientes reportados';
 const quantity=pieces.every(p=>p.cantidad!=null&&Number.isFinite(Number(p.cantidad)))?number(pieces.reduce((sum,p)=>sum+Number(p.cantidad),0))+' piezas':pieces.length+' registros';
 return '<details class="pick-report-pending"><summary>'+safe(quantity)+' · Ver detalle</summary><ul>'+pieces.map(p=>'<li><strong>'+safe(p.perfil||p.referencia||'Referencia sin dato')+'</strong> · '+safe(p.cantidad??'Sin dato')+' piezas'+(p.fabricacion?' · '+safe(p.fabricacion):'')+(p.longitud?' · '+safe(p.longitud):'')+(p.observacion?'<br>'+safe(p.observacion):'')+'</li>').join('')+'</ul></details>';
}
export function receptionRowsHtml(rows){
 if(!rows.length)return '<div class="empty-state">No hay recepciones confirmadas para esta consulta.</div>';
 return table(['Orden / reserva','Sistema','Fecha de recepción / registro','Turno','Entregó','Recibió','Estado al recibir','Pendientes reportados'],rows.map(row=>'<tr><td><strong>'+safe(row.produccion||'Sin dato')+'</strong><small>'+safe(row.reserva||'Sin reserva')+'</small></td><td>'+safe(row.sistema||'SIN SISTEMA')+'</td><td><strong>'+safe(date(row.fecha_recepcion))+'</strong><small>Registro: '+safe(registered(row.registrado_en))+'</small></td><td>'+safe(row.turno_recepcion||'Sin dato')+'</td><td>'+safe(row.nombre_entrego||row.usuario_entrega||'Sin dato')+'</td><td>'+safe(row.nombre_recibio||row.usuario_recepcion||'Sin dato')+'</td><td><span class="pick-report-state '+(receptionStatus(row)==='completa'?'complete':receptionStatus(row)==='incompleta'?'partial':'unknown')+'">'+labels[receptionStatus(row)]+'</span></td><td>'+pendingHtml(row)+'</td></tr>'));
}
export function initPickingReceptionReport({getSupabaseClient,getAppToken}){
 const $=id=>document.getElementById(id),panel=$('pickReportReceptionPanel');if(!panel)return;
 const el=suffix=>$('pickReceptionReport'+suffix),status=el('Status');let state=null,request=0;
 const selectTab=name=>{for(const current of ['Delivery','Reception']){const tab=$('pickReport'+current+'Tab'),selected=current===name;tab.classList.toggle('active',selected);tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;$('pickReport'+current+'Panel').hidden=!selected;}};
 for(const name of ['Delivery','Reception']){
  const tab=$('pickReport'+name+'Tab');tab.addEventListener('click',()=>selectTab(name));
  tab.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?'Delivery':event.key==='End'?'Reception':name==='Delivery'?'Reception':'Delivery';selectTab(next);$('pickReport'+next+'Tab').focus();});
 }
 $('pickDirectReport')?.addEventListener('click',()=>selectTab('Delivery'));
 const today=new Date().toLocaleDateString('en-CA',{timeZone:'America/Bogota'});el('Week').value=isoWeekOf(today);const initial=isoWeekRange(el('Week').value);el('From').value=initial.from;el('To').value=initial.to;
 const currentRows=()=>state&&state.token===getAppToken()?filterReceptionRows(state.rows,{search:el('Search').value,state:el('State').value}):[];
 const clear=()=>{state=null;el('Export').disabled=true;for(const id of ['Summary','DateShifts','Rows','Systems'])el(id).replaceChildren();};
 const invalidate=()=>{request++;clear();el('Run').disabled=false;panel.removeAttribute('aria-busy');status.textContent='Filtros cambiados. Pulsa Consultar para actualizar los resultados.';};
 el('Week').addEventListener('change',()=>{try{if(el('Week').value){const range=isoWeekRange(el('Week').value);el('From').value=range.from;el('To').value=range.to;}invalidate();}catch(error){invalidate();status.textContent=error.message;}});
 for(const name of ['From','To','Shift','System'])el(name).addEventListener('input',()=>{if(['From','To'].includes(name))el('Week').value='';invalidate();});
 const show=()=>{
  if(!state)return;if(state.token!==getAppToken()){clear();status.textContent='La sesión cambió. Vuelve a consultar.';return;}const rows=currentRows(),summary=summarizeReceptions(rows);
  el('Summary').innerHTML='<div class="pick-report-metrics">'+[['Órdenes recibidas',summary.ordenes,summary.recepciones+' recepciones','movements'],['Completas al recibir',summary.completas,'Sin pendientes reportados','complete'],['Incompletas al recibir',summary.incompletas,'Con pendientes reportados','partial'],['Piezas pendientes reportadas',summary.recepciones_sin_pendientes?'Sin dato':summary.piezas_pendientes,summary.recepciones_sin_pendientes?summary.recepciones_sin_pendientes+' recepciones sin detalle histórico':'Al momento de recibir','partial']].map(([label,value,description,tone])=>'<div class="pick-report-kpi '+tone+'"><span class="pick-report-kpi-content"><span class="pick-report-kpi-label">'+safe(label)+'</span><strong>'+safe(value)+'</strong><small>'+safe(description)+'</small></span></div>').join('')+'</div>';
  el('DateShifts').innerHTML=summary.fechas_turnos.length?'<details class="pick-report-date-summary"><summary>Resumen por fecha y turno ('+summary.fechas_turnos.length+')</summary>'+table(['Fecha operativa','Turno','Recepciones','Completas','Incompletas','Sin estado histórico'],summary.fechas_turnos.map(group=>'<tr>'+[date(group.fecha),group.turno||'Sin dato',group.recepciones,group.completas,group.incompletas,group.sin_estado].map(v=>'<td>'+safe(v)+'</td>').join('')+'</tr>'))+'</details>':'';
  el('Rows').innerHTML=receptionRowsHtml(rows);
  el('Systems').innerHTML=summary.sistemas.length?'<div class="pick-report-system-grid">'+summary.sistemas.map(system=>'<section class="pick-report-system-card"><h4>'+safe(system.sistema)+'</h4><div><span>'+number(system.ordenes)+' órdenes recibidas</span><strong>'+ (system.sin_cantidad?'Ventanas: Sin dato':number(system.ventanas)+' ventanas recibidas')+'</strong></div>'+(system.sin_cantidad?'<small>'+system.sin_cantidad+' recepciones sin cantidad acreditada'+(system.ventanas?' · '+number(system.ventanas)+' ventanas con evidencia, total incompleto':'')+'</small>':'')+'</section>').join('')+'</div>':'<div class="empty-state">Sin sistemas para resumir.</div>';
  const excluded=Number(state.coverage?.recepciones_sin_fecha_operativa)||0;
  status.textContent=rows.length+' de '+state.rows.length+' recepciones · '+date(state.filters.from)+' a '+date(state.filters.to)+' · '+(state.filters.shift||'Todos los turnos')+'. Fecha operativa y momento de registro se muestran por separado.'+(summary.sin_estado?' '+summary.sin_estado+' recepciones sin estado histórico acreditado.':'')+(excluded?' Hay '+excluded+' auditorías antiguas en todo el histórico, fuera de los filtros actuales, sin fecha operativa demostrada; se excluyen de este reporte por fecha.':'')+(state.warnings.length?' '+state.warnings.join(' '):'');
  el('Export').disabled=!rows.length;
 };
 for(const name of ['Search','State'])el(name).addEventListener(name==='Search'?'input':'change',show);
 el('Run').addEventListener('click',async()=>{
  const id=++request,token=getAppToken();clear();status.textContent='Consultando recepciones confirmadas…';el('Run').disabled=true;panel.setAttribute('aria-busy','true');
  const current=()=>id===request&&token===getAppToken();
  try{
   const filters=normalizeReceptionFilters({from:el('From').value,to:el('To').value,shift:el('Shift').value,system:el('System').value});
   if(!token)throw Error('Inicia sesión para consultar.');
   const db=await getSupabaseClient();if(!current())return;let total=0,summary={},coverage={},warnings=[];const rows=[],seen=new Set();
   for(let offset=0;offset<=20000;offset+=500){
    const {data,error}=await db.rpc('sgp_picking_reporte_recepciones_v1',{p_token:token,p_fecha_inicio:filters.from,p_fecha_fin:filters.to,p_turno:filters.shift||null,p_sistema:filters.system||null,p_limit:500,p_offset:offset});
    if(!current())return;if(error)throw error;
    if(data?.ok!==true||data.contract_version!==1||!Array.isArray(data.rows)||!Number.isInteger(data.total_rows)||data.total_rows<0)throw Error('El servidor no confirmó el contrato del reporte de recepción.');
    if(!offset){total=data.total_rows;summary=data.summary||{};coverage=data.coverage||{};const warningLabels={VENTANAS_RECIBIDAS_NO_CONSTAN:'Las cantidades de ventanas recibidas no constan en esta fuente.',IDENTIDAD_Y_NOMBRES_CATALOGO_ACTUAL:'Los nombres y datos de la orden corresponden al catálogo actual.'};warnings=Array.isArray(data.warnings)?data.warnings.map(code=>warningLabels[code]).filter(Boolean):[];if(total>20000)throw Error('El reporte supera 20.000 recepciones. Reduce el rango.');}
    if(data.total_rows!==total)throw Error('La consulta cambió mientras se cargaba. Vuelve a consultar.');
    for(const row of data.rows){const key=row.id_recepcion;if(!key||seen.has(key))throw Error('La consulta contiene recepciones duplicadas o sin identidad. Vuelve a consultar.');seen.add(key);rows.push(row);}
    if(rows.length>=total)break;if(!data.rows.length)throw Error('Paginación incompleta. Vuelve a consultar.');
   }
   if(rows.length!==total)throw Error('La consulta no recuperó todos los registros.');
   state={rows,summary,coverage,warnings,filters,token};show();
  }catch(error){if(!current())return;clear();const unavailable=error.code==='PGRST202'||/Could not find the function|does not exist|schema cache/i.test(error.message||'');status.textContent=unavailable?'Reporte de recepción no disponible: falta habilitar su consulta histórica en el servidor. No se muestran entregas como recepciones.':'No fue posible consultar: '+(error.message||String(error));}
  finally{if(id===request){el('Run').disabled=false;panel.removeAttribute('aria-busy');}}
 });
 el('Export').addEventListener('click',()=>{if(!state||!currentRows().length)return;const link=document.createElement('a'),url=URL.createObjectURL(new Blob([receptionCsv(currentRows())],{type:'text/csv;charset=utf-8'}));link.href=url;link.download='SGP_Picking_Recepcion_'+state.filters.from+'_'+state.filters.to+'.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
}
