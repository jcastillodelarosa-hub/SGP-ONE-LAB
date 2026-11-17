import {openPickingImpactComplement} from './picking-impact-complement.js';
import {reportColumns,applyReportColumns} from '../domain/picking-reception-columns.js';
import {createPickingReportColumns} from './picking-reception-columns.js';
import {isoWeekOf,isoWeekRange,normalizeReceptionFilters,filterReceptionRows,summarizeReceptions,receptionStatus,receptionCsv,receptionQuantities,historicalReceptionQuantities,receptionQuantityMissingLabel} from '../domain/picking-reception-report.js';
const safe=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const number=value=>Number(value).toLocaleString('es-CO');
const quantityHtml=(row,key)=>{const q=receptionQuantities(row),value=q[key]===null?safe(receptionQuantityMissingLabel(row,key)):number(q[key])+(key==='efectiva'&&q.estimada?'<small>Estimado</small>':'');if(!q.actualizada||key==='total')return value;const old=historicalReceptionQuantities(row);return value+'<small>Actualizado · complemento</small><details><summary>Ver original</summary>'+safe(old[key]??'No registrado')+'<small>'+safe(registered(row.impacto_complementario?.registrado_en))+' · '+safe(row.impacto_complementario?.nombre||'Responsable registrado')+'</small></details>';};
const labels={completa:'Completa',incompleta:'Incompleta',sin_evidencia:'Sin evidencia histórica'};
const date=value=>value&&/^\d{4}-\d{2}-\d{2}$/.test(value)?value.split('-').reverse().join('/'):'Sin dato';
const registered=value=>{const d=new Date(value);return value&&Number.isFinite(d.getTime())?d.toLocaleString('es-CO',{timeZone:'America/Bogota'})+' (Colombia)':'Sin dato';};
const table=(headers,rows)=>'<div class="table-wrap" tabindex="0" role="region" aria-label="'+safe(headers[0])+'"><table><thead><tr>'+headers.map(h=>'<th scope="col">'+safe(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table></div>';
function pendingHtml(row){
 const pieces=row.pendientes_al_recibir;
 if(!Array.isArray(pieces))return '<span class="pick-report-unknown">Sin evidencia histórica de pendientes</span>';
 if(!pieces.length)return 'Sin pendientes reportados';
 const quantity=pieces.every(p=>p.cantidad!=null&&Number.isFinite(Number(p.cantidad)))?number(pieces.reduce((sum,p)=>sum+Number(p.cantidad),0))+' piezas':pieces.length+' registros';
 return '<details class="pick-report-pending"><summary>'+safe(quantity)+' · Ver detalle</summary><ul>'+pieces.map(p=>'<li><strong>'+safe(p.perfil||p.referencia||'Referencia sin dato')+'</strong> · '+safe(p.cantidad??'Sin dato')+' piezas'+(p.fabricacion?' · '+safe(p.fabricacion):'')+(p.longitud?' · '+safe(p.longitud):'')+'<small>Paneles afectados: '+safe(p.ventanas_afectadas??'no registrados')+'</small>'+(p.observacion?'<br>'+safe(p.observacion):'')+'</li>').join('')+'</ul></details>';
}
export function receptionReviewsHtml(row){
 const areas=Array.isArray(row.revisiones_areas)?row.revisiones_areas:[];
 if(!areas.length)return safe(row.nombre_recibio||'Sin dato')+'<small>Sin revisión por sección registrada</small>';
 return areas.map(a=>'<div><strong>'+safe(a.id==='ZOCALERO'?'Zócalos':a.nombre||a.id)+'</strong> · '+safe(a.revision?.nombre|| (a.revision?'Nombre no disponible':'Pendiente'))+'<small>'+safe(a.revision?(a.revision.resultado==='SIN_FALTANTES'?'Sin faltantes':'Con faltantes')+' · '+date(a.revision.fecha):'Por auditar')+'</small></div>').join('');
}
export function receptionRowsHtml(rows){
 if(!rows.length)return '<div class="empty-state">No hay recepciones confirmadas para esta consulta.</div>';
 return table(reportColumns.map(c=>c[1]),rows.map(row=>'<tr><td>'+safe(row.semana_programada??'Sin dato')+'</td><td><strong>'+safe(row.produccion||'Sin dato')+'</strong><small>'+safe(row.reserva||'Sin reserva')+'</small></td><td>'+safe(row.sistema||'SIN SISTEMA')+'</td><td>'+quantityHtml(row,'total')+'</td><td>'+quantityHtml(row,'afectadas')+(row.impacto_paneles_version===1&&Array.isArray(row.pendientes_al_recibir)&&row.pendientes_al_recibir.some(p=>p.ventanas_afectadas==null)?'<button type="button" data-impact-complement="'+safe(row.id_entrega)+'">Revisar impacto</button>':'')+'</td><td>'+quantityHtml(row,'efectiva')+'</td><td><strong>'+safe(date(row.fecha_recepcion))+'</strong><small>Registro: '+safe(registered(row.registrado_en))+'</small></td><td>'+safe(row.turno_recepcion||'Sin dato')+'</td><td>'+safe(row.nombre_entrego||row.usuario_entrega||'Sin dato')+'</td><td>'+receptionReviewsHtml(row)+'</td><td><span class="pick-report-state '+(receptionStatus(row)==='completa'?'complete':receptionStatus(row)==='incompleta'?'partial':'unknown')+'">'+labels[receptionStatus(row)]+'</span></td><td>'+pendingHtml(row)+'</td></tr>'));
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
 const baseRows=()=>state&&state.token===getAppToken()?filterReceptionRows(state.rows,{search:el('Search').value,state:el('State').value}):[];
 const currentRows=()=>applyReportColumns(baseRows(),columns.state);
 const columns=createPickingReportColumns({root:el('Rows'),onChange:()=>show()});
 const clear=()=>{columns.reset();state=null;el('Export').disabled=true;for(const id of ['Summary','DateShifts','Rows','Systems'])el(id).replaceChildren();};
 const invalidate=()=>{request++;clear();el('Run').disabled=false;panel.removeAttribute('aria-busy');status.textContent='Filtros cambiados. Pulsa Consultar para actualizar los resultados.';};
 el('Week').addEventListener('change',()=>{try{if(el('Week').value){const range=isoWeekRange(el('Week').value);el('From').value=range.from;el('To').value=range.to;}invalidate();}catch(error){invalidate();status.textContent=error.message;}});
 for(const name of ['From','To','Shift','System'])el(name).addEventListener('input',()=>{if(['From','To'].includes(name))el('Week').value='';invalidate();});
 const show=()=>{
  if(!state)return;if(state.token!==getAppToken()){clear();status.textContent='La sesión cambió. Vuelve a consultar.';return;}const rows=currentRows(),summary=summarizeReceptions(rows);
  el('Summary').innerHTML='<div class="pick-report-metrics">'+[['Órdenes',summary.ordenes,'Sin duplicar recepciones','movements'],['Total programado',summary.sin_total?'Sin dato':number(summary.total),summary.sin_total?summary.sin_total+' órdenes sin cantidad':'Programación actual','movements'],[summary.actualizadas?'Paneles afectados · actualizado':'Paneles afectados',summary.sin_efectiva?'Sin dato':number(summary.total-summary.efectiva),summary.sin_efectiva?'Información incompleta':summary.actualizadas?summary.actualizadas+' órdenes con complemento':summary.estimadas?'Estimado · posible solapamiento':'Al momento de recibir','partial'],[summary.actualizadas?'Total efectivo · actualizado':'Total efectivo',summary.sin_efectiva?'Sin dato':number(summary.efectiva),summary.sin_efectiva?summary.sin_efectiva+' órdenes sin cálculo':summary.actualizadas?'Programación actual menos impacto acreditado':summary.estimadas?'Estimado · posibles paneles coincidentes':'Total menos afectados al recibir','complete']].map(([label,value,description,tone])=>'<div class="pick-report-kpi '+tone+'"><span class="pick-report-kpi-content"><span class="pick-report-kpi-label">'+safe(label)+'</span><strong>'+safe(value)+'</strong><small>'+safe(description)+'</small></span></div>').join('')+'</div>';
  el('DateShifts').innerHTML=summary.fechas_turnos.length?'<details class="pick-report-date-summary"><summary>Resumen por fecha y turno ('+summary.fechas_turnos.length+')</summary>'+table(['Fecha operativa','Turno','Recepciones','Completas','Incompletas','Sin estado histórico'],summary.fechas_turnos.map(group=>'<tr>'+[date(group.fecha),group.turno||'Sin dato',group.recepciones,group.completas,group.incompletas,group.sin_estado].map(v=>'<td>'+safe(v)+'</td>').join('')+'</tr>'))+'</details>':'';
  el('Rows').innerHTML=(columns.active()?'<button type="button" data-report-reset>Limpiar filtros de columnas</button>':'')+receptionRowsHtml(rows);
  el('Rows').querySelector('[data-report-reset]')?.addEventListener('click',()=>{columns.reset();show();});
  el('Rows').querySelectorAll('[data-impact-complement]').forEach(button=>button.addEventListener('click',async()=>{const token=state.token,db=await getSupabaseClient();if(token!==getAppToken())return;await openPickingImpactComplement({idEntrega:button.dataset.impactComplement,isCurrent:()=>token===getAppToken(),rpc:async(name,args)=>{if(token!==getAppToken())throw Error('La sesión cambió.');const {data,error}=await db.rpc(name,{p_token:token,...args});if(error)throw error;return data;},onSaved:()=>el('Run').click()});}));
  columns.update(baseRows());
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
   if(rows.some(row=>!Object.hasOwn(row,'semana_programada')||!Object.hasOwn(row,'cantidad_programada')))warnings.push('Falta habilitar semana, cantidades y revisores por sección en el servidor.');
   state={rows,summary,coverage,warnings,filters,token};show();
  }catch(error){if(!current())return;clear();const unavailable=error.code==='PGRST202'||/Could not find the function|does not exist|schema cache/i.test(error.message||'');status.textContent=unavailable?'Reporte de recepción no disponible: falta habilitar su consulta histórica en el servidor. No se muestran entregas como recepciones.':'No fue posible consultar: '+(error.message||String(error));}
  finally{if(id===request){el('Run').disabled=false;panel.removeAttribute('aria-busy');}}
 });
 el('Export').addEventListener('click',()=>{if(!state||!currentRows().length)return;const link=document.createElement('a'),url=URL.createObjectURL(new Blob([receptionCsv(currentRows())],{type:'text/csv;charset=utf-8'}));link.href=url;link.download='SGP_Picking_Recepcion_'+state.filters.from+'_'+state.filters.to+'.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
}
