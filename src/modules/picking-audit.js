import {auditOperationalTime,auditDecisions,auditAreaDecisions,auditAreaLabel} from '../domain/picking-audit.js';
import {sourceKey} from '../domain/pdt-registration.js';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function openAudit({target,rpc,config,onSaved}){
 const modal=document.querySelector('#pickAuditModal'),card=modal.querySelector('.pick-audit-card');
 const previous=document.activeElement,session=crypto.randomUUID();modal.dataset.auditSession=session;
 modal.hidden=false;card.setAttribute('role','dialog');card.setAttribute('aria-modal','true');card.setAttribute('aria-labelledby','pickAuditTitle');
 card.innerHTML='<div class="modal-header"><div><strong id="pickAuditTitle">Auditoría de Picking</strong><small>Entrega original: '+escape(target.fecha_entrega)+' · '+escape(target.turno_entrega)+'</small></div><button type="button" data-close class="modal-close" aria-label="Cerrar auditoría">×</button></div><div class="pick-audit-body"><div role="status">Cargando contrato de auditoría…</div></div><div class="modal-actions"><button type="button" data-close>Cancelar</button></div>';
 let busy=false;
 const close=()=>{if(busy)return;modal.hidden=true;modal.onkeydown=null;previous?.focus();};
 const bindClose=()=>card.querySelectorAll('[data-close]').forEach(b=>b.onclick=close);bindClose();
 modal.onkeydown=e=>{if(e.key==='Escape')close();if(e.key==='Tab'){const els=[...card.querySelectorAll('button,input,select,textarea')].filter(x=>!x.disabled&&x.getClientRects().length);const first=els[0],last=els.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};
 try{
  let snapshot,legacy=false;
  try{snapshot=await rpc('sgp_picking_auditoria_areas_contexto',{p_id_entrega:target.id_entrega});}
  catch(e){
   if(e.code!=='PGRST202'||!String(e.message||'').includes('sgp_picking_auditoria_areas_contexto'))throw e;
   snapshot=await rpc('sgp_picking_auditoria_contexto',{p_id_entrega:target.id_entrega});legacy=true;
   snapshot={...snapshot,areas:[{id:'GENERAL',nombre:'Recepción (contrato vigente)'}],revisados_ids:[]};
  }
  if(modal.hidden||modal.dataset.auditSession!==session)return;
  if(!Array.isArray(snapshot.fuentes))throw Error('Contrato de fuentes de auditoría inválido');
  const pieces=snapshot.fuentes;
  if(!Array.isArray(snapshot.areas)||!snapshot.areas.length)throw Error('Configuración de áreas de auditoría no disponible');
  let area='';
  const configuration=await rpc('sgp_configuracion_general_obtener',{});
  if(modal.hidden||modal.dataset.auditSession!==session)return;
  config=configuration.find(x=>x.clave==='HORARIOS_TURNOS')?.valor;
  const rows=snapshot.faltantes.filter(f=>!(snapshot.revisados_ids||[]).includes(f.id_faltante)).map(f=>({...f,nc_historica:f.nc||f.pendiente?.nc||'',nc:'',reserva:f.reserva_pendiente||f.pendiente.reserva,acabado:f.acabado_pendiente||f.pendiente.acabado_pendiente,accion:legacy?'':'NO_CORRESPONDE',motivo:''}));
  const differences=[],request=crypto.randomUUID(),time=auditOperationalTime(new Date(),config);
  const body=card.querySelector('.pick-audit-body');
  body.innerHTML=(legacy?'<p role="status">La revisión por áreas aún no está activada. Esta recepción usa el contrato vigente; después de la activación, vuelve a abrir la auditoría.</p>':'')+'<label>Sección<select data-area required><option value="">Seleccionar…</option>'+snapshot.areas.map(a=>'<option data-area-state="'+(a.revision?'audited':'pending')+'" value="'+escape(a.id)+'" '+(a.revision?'disabled':'')+'>'+escape(auditAreaLabel(snapshot.linea,a))+(a.revision?' · Auditado por '+escape(a.revision.usuario):' · Pendiente')+'</option>').join('')+'</select></label><div data-area-progress>'+snapshot.areas.map(a=>'<p class="pick-audit-area-status" data-area-state="'+(a.revision?'audited':'pending')+'"><strong>'+escape(auditAreaLabel(snapshot.linea,a))+'</strong>: '+(a.revision?'Auditado · '+(a.revision.resultado==='SIN_FALTANTES'?'Completo / sin faltantes':'Con faltantes')+' · '+escape(a.revision.usuario)+' · '+escape(a.revision.fecha)+' · '+escape(a.revision.turno||''):'Pendiente de revisión')+'</p>').join('')+'</div><label>Resultado de tu revisión<select data-result required><option value="">Seleccionar…</option><option value="SIN_FALTANTES">Completo / sin faltantes</option><option value="CON_FALTANTES">Con faltantes</option></select></label><p>Selecciona únicamente los faltantes que revisaste en tu área. La orden se cierra cuando todas las áreas confirmen.</p><p><b>'+escape(target.produccion)+'</b> · Reserva '+escape(target.reserva)+' · '+escape(target.sistema)+'</p><div class="rec-grid"><label>Fecha de recepción<input data-date type="date" required value="'+time.fecha+'"></label><label>Turno de recepción<select data-shift required><option value="">Seleccionar…</option>'+['TURNO 1','TURNO 2'].map(t=>'<option '+(t===time.turno?'selected':'')+'>'+t+'</option>').join('')+'</select></label></div><p>La entrega del Patinador conserva su fecha y turno originales.</p><div data-rows></div><div data-new></div><label>Observación de auditoría<textarea data-observation rows="2"></textarea></label><p data-error role="alert" tabindex="-1"></p>';
  card.querySelector('.modal-actions').innerHTML='<button type="button" data-close>Cancelar</button><button type="button" data-add>+ Reportar diferencia</button><button type="button" data-save class="primary">Confirmar auditoría</button>';bindClose();
  const selectedSource=row=>pieces.find(p=>p.id_pieza===row.id_pieza&&p.reserva===row.reserva&&(!row.key_produccion||p.key_produccion===row.key_produccion));
  const picker=(row,i,isNew)=>{
   const selected=selectedSource(row),ref=row.auditReference??selected?.codigo_sap??'';
   const refs=[...new Set(pieces.map(p=>p.codigo_sap))].sort();
   const options=pieces.filter(p=>p.codigo_sap===ref);
   return '<label>Referencia<select data-reference="'+i+'"><option value="">Seleccionar…</option>'+refs.map(r=>'<option value="'+escape(r)+'" '+(r===ref?'selected':'')+'>'+escape(r)+'</option>').join('')+'</select></label>'+
    (ref?'<div class="table-wrap"><table class="nc-operational-table pdt-manual-table"><thead><tr><th>Elegir</th><th>Fabricación</th><th>Marca</th><th>Longitud</th><th>Acabado</th><th>Reserva</th><th>Cantidad de referencia</th></tr></thead><tbody>'+options.map(p=>'<tr><td><input type="radio" name="audit-piece-'+(isNew?'new':'existing')+'-'+i+'" data-piece="'+i+'" value="'+escape(sourceKey(p))+'" '+(selected&&sourceKey(selected)===sourceKey(p)?'checked':'')+' aria-label="Seleccionar '+escape([p.fabricacion,p.longitud,p.acabado,p.reserva].join(' · '))+'"></td><td>'+escape(p.fabricacion)+'</td><td>'+escape(p.marca||'—')+'</td><td>'+escape(p.longitud)+'</td><td>'+escape(p.acabado)+'</td><td>'+escape(p.reserva)+'</td><td>'+escape(p.cantidad_referencia??p.cantidad??'—')+'</td></tr>').join('')+'</tbody></table></div>':'<p>Selecciona una referencia para ver sus fabricaciones.</p>');
  };
  const paint=()=>{
   for(const [list,selector,isNew] of [[rows,'[data-rows]',false],[differences,'[data-new]',true]]){
    const host=body.querySelector(selector);host.innerHTML=list.map((r,i)=>'<section class="pick-audit-decision" data-state="'+escape(r.accion||'NUEVO')+'"><h3>'+escape(isNew?'Diferencia nueva '+(i+1):r.perfil+' · '+(r.fabricacion||'—'))+'</h3><p>'+escape([r.reserva,r.acabado,r.marca,r.longitud,'Cantidad: '+r.cantidad].join(' · '))+'</p>'+(isNew?'': '<label>Decisión<select data-action="'+i+'"><option value="">Seleccionar…</option>'+[...(!legacy?[['NO_CORRESPONDE','No corresponde a mi área']]:[]),['ACEPTAR','Aceptar'],['MODIFICAR','Modificar'],['ELIMINAR','Eliminar (anular)']].map(([v,l])=>'<option value="'+v+'" '+(r.accion===v?'selected':'')+'>'+l+'</option>').join('')+'</select></label>')+((isNew||r.accion==='MODIFICAR')?picker(r,i,isNew)+'<div class="rec-grid"><label>Cantidad faltante<input data-field="cantidad" data-i="'+i+'" type="number" min="1" step="1" value="'+escape(r.cantidad)+'"></label><label>Ventanas afectadas<input data-field="ventanas_afectadas" data-i="'+i+'" type="number" min="1" step="1" value="'+escape(r.ventanas_afectadas||1)+'"></label></div><label>Observaciones<textarea data-field="observacion" data-i="'+i+'">'+escape(r.observacion)+'</textarea></label>':'')+(!isNew&&['MODIFICAR','ELIMINAR'].includes(r.accion)?'<label>Motivo obligatorio<textarea data-field="motivo" data-i="'+i+'">'+escape(r.motivo)+'</textarea></label>':'')+((!legacy&&(isNew||['ACEPTAR','MODIFICAR'].includes(r.accion)))?(r.nc_historica?'<p>NC registrada: '+escape(r.nc_historica)+' (se conserva)</p>':'')+'<label>NC '+(isNew?'':'adicional ')+'(opcional)<input data-field="nc" data-i="'+i+'" maxlength="120" value="'+escape(r.nc||'')+'" placeholder="Número de NC existente"></label><small data-nc-info="'+i+'" role="status">Sin NC puedes registrar el faltante y asignarla después.</small><small>Verifica que la NC corresponda a esta orden. La consulta confirma su existencia, no su relación con la orden.</small>':'')+(isNew?'<button type="button" data-remove="'+i+'">Quitar diferencia nueva</button>':'')+'</section>').join('');
    host.querySelectorAll('[data-action]').forEach(el=>el.onchange=()=>{list[el.dataset.action].accion=el.value;if(['ELIMINAR','NO_CORRESPONDE'].includes(el.value))list[el.dataset.action].nc='';paint();});
    host.querySelectorAll('[data-reference]').forEach(el=>el.onchange=()=>{
     const row=list[el.dataset.reference];row.auditReference=el.value;
     for(const key of ['id_pieza','key_produccion','reserva','acabado','codigo_sap','perfil','fabricacion','longitud','marca'])row[key]='';
     paint();
    });
    host.querySelectorAll('[data-piece]').forEach(el=>el.onchange=()=>{
     const matches=pieces.filter(p=>sourceKey(p)===el.value),row=list[el.dataset.piece];
     if(matches.length!==1)return;
     const p=matches[0];Object.assign(row,p,{perfil:p.codigo_sap,cantidad:row.cantidad,ventanas_afectadas:row.ventanas_afectadas});paint();
    });
    host.querySelectorAll('[data-field]').forEach(el=>el.oninput=()=>list[el.dataset.i][el.dataset.field]=el.type==='number'?Number(el.value):el.value);
    host.querySelectorAll('[data-field="nc"]').forEach(el=>el.onblur=async()=>{
     const reference=el.value.trim(),info=host.querySelector('[data-nc-info="'+el.dataset.i+'"]');
     if(!reference){info.textContent='NC pendiente de asignar';return;}
     info.textContent='Consultando NC…';
     try{const result=await rpc('sgp_picking_auditoria_nc_consultar',{p_referencia:reference});if(el.value.trim()!==reference)return;if(result?.ok!==true||!result.nc)throw Error('NC no encontrada; corrige antes de guardar.');info.textContent='NC '+(result.nc.numero||result.nc.consecutivo||reference)+' · '+(result.nc.estado||'Sin estado');}catch(e){info.textContent=e.message;}
    });
    host.querySelectorAll('[data-remove]').forEach(el=>el.onclick=()=>{list.splice(+el.dataset.remove,1);paint();});
   }
  };paint();
  body.querySelector('[data-area]').onchange=()=>{rows.forEach(r=>{r.accion=legacy?'':'NO_CORRESPONDE';r.motivo='';r.nc='';});differences.splice(0);body.querySelector('[data-result]').value='';body.querySelector('[data-observation]').value='';paint();};
  card.querySelector('[data-add]').onclick=()=>{differences.push({cantidad:1,ventanas_afectadas:1,observacion:''});paint();const added=body.querySelector('[data-new]').lastElementChild;if(added)body.scrollTop+=added.getBoundingClientRect().top-body.getBoundingClientRect().top;};
  const error=body.querySelector('[data-error]');
  card.querySelector('[data-save]').onclick=async()=>{
   if(busy)return;
   try{
    area=body.querySelector('[data-area]').value;
    const resultado=body.querySelector('[data-result]').value;
    const decisions=auditAreaDecisions({area,resultado,rows,differences});auditDecisions(differences.map(r=>({...r,accion:'MODIFICAR',motivo:'Diferencia adicional'})));
    if(!body.querySelector('[data-date]').value||!body.querySelector('[data-shift]').value)throw Error('Completa fecha y turno de recepción.');
    busy=true;card.querySelectorAll('button,input,select,textarea').forEach(el=>el.disabled=true);
    for(const reference of [...new Set([...decisions.filter(d=>d.accion!=='ELIMINAR'),...differences].map(d=>String(d.nc||'').trim()).filter(Boolean))]){
     if(reference.length>120||/[\x00-\x1f\x7f]/.test(reference))throw Error('NC inválida.');
     const check=await rpc('sgp_picking_auditoria_nc_consultar',{p_referencia:reference});
     if(check?.ok!==true||!check.nc)throw Error('NC '+reference+' no encontrada; corrige antes de guardar.');
    }
    const result=await rpc(legacy?'sgp_picking_auditoria_guardar':'sgp_picking_auditoria_area_guardar',{...(!legacy?{p_area:area,p_resultado:resultado}:{}),p_id_entrega:target.id_entrega,p_version:snapshot.version,p_solicitud:request,p_fecha:body.querySelector('[data-date]').value,p_turno:body.querySelector('[data-shift]').value,p_decisiones:decisions,p_diferencias:differences,p_observacion:body.querySelector('[data-observation]').value||null});
    if(modal.hidden||modal.dataset.auditSession!==session)return;
    if(result?.ok!==true)throw Error('El servidor no confirmó la auditoría. Recarga antes de continuar.');
    busy=false;
    try{await onSaved();close();}catch(refreshError){
     error.textContent='Auditoría guardada. No fue posible actualizar los listados: '+refreshError.message+'. Cierra y actualiza la vista; no vuelvas a guardar.';
     card.querySelectorAll('[data-close]').forEach(el=>el.disabled=false);error.focus();
    }
   }catch(e){busy=false;card.querySelectorAll('button,input,select,textarea').forEach(el=>el.disabled=false);error.textContent=String(e.message).includes('AUDITORIA_POR_AREAS_REQUERIDA')?'La auditoría por áreas ya está activa. Cierra y vuelve a abrir esta orden para registrar tu área; no se guardó esta revisión.':e.message;error.focus();}
  };
  card.querySelector('[data-close]').focus();
 }catch(e){if(modal.dataset.auditSession!==session)return;card.querySelector('.pick-audit-body').innerHTML='<p role="alert">Auditoría no disponible: '+escape(e.message)+'. Recarga o consulta la instalación del contrato aprobado.</p>';}
}
