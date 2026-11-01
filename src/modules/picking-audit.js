import {auditOperationalTime,auditDecisions} from '../domain/picking-audit.js';
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
  const snapshot=await rpc('sgp_picking_auditoria_contexto',{p_id_entrega:target.id_entrega});
  const sources=await rpc('sgp_pdt_registro_fuentes_v4',{p_origen:'PICKING',p_contexto:{id_programacion:target.id_programacion,produccion:target.produccion}});
  if(modal.hidden||modal.dataset.auditSession!==session)return;
  if(sources?.ok!==true||sources.contract_version!==4||!Array.isArray(sources.fuentes))throw Error('Contrato de fuentes PDT inválido');
  const pieces=sources.fuentes;
  const configuration=await rpc('sgp_configuracion_general_obtener',{});
  config=configuration.find(x=>x.clave==='HORARIOS_TURNOS')?.valor;
  const rows=snapshot.faltantes.map(f=>({...f,reserva:f.reserva_pendiente||f.pendiente.reserva,acabado:f.acabado_pendiente||f.pendiente.acabado_pendiente,accion:'',motivo:''}));
  const differences=[],request=crypto.randomUUID(),time=auditOperationalTime(new Date(),config);
  const body=card.querySelector('.pick-audit-body');
  body.innerHTML='<p><b>'+escape(target.produccion)+'</b> · Reserva '+escape(target.reserva)+' · '+escape(target.sistema)+'</p><div class="rec-grid"><label>Fecha de recepción<input data-date type="date" required value="'+time.fecha+'"></label><label>Turno de recepción<select data-shift required><option value="">Seleccionar…</option>'+['TURNO 1','TURNO 2'].map(t=>'<option '+(t===time.turno?'selected':'')+'>'+t+'</option>').join('')+'</select></label></div><p>La entrega del Patinador conserva su fecha y turno originales.</p><div data-rows></div><div data-new></div><label>Observación de auditoría<textarea data-observation rows="2"></textarea></label><p data-error role="alert" tabindex="-1"></p>';
  card.querySelector('.modal-actions').innerHTML='<button type="button" data-close>Cancelar</button><button type="button" data-add>+ Reportar diferencia</button><button type="button" data-save class="primary">Confirmar auditoría</button>';bindClose();
  const sourceOptions=(row)=>'<option value="">Seleccionar pieza PANEL…</option>'+pieces.map((p,i)=>'<option value="'+i+'" '+(p.id_pieza===row.id_pieza&&p.reserva===row.reserva?'selected':'')+'>'+escape([p.reserva,p.acabado,p.codigo_sap,p.marca,p.fabricacion,p.longitud].join(' · '))+'</option>').join('');
  const paint=()=>{
   for(const [list,selector,isNew] of [[rows,'[data-rows]',false],[differences,'[data-new]',true]]){
    const host=body.querySelector(selector);host.innerHTML=list.map((r,i)=>'<section class="pick-audit-decision" data-state="'+escape(r.accion||'NUEVO')+'"><h3>'+escape(isNew?'Diferencia nueva '+(i+1):r.perfil+' · '+(r.fabricacion||'—'))+'</h3><p>'+escape([r.reserva,r.acabado,r.marca,r.longitud,'Cantidad: '+r.cantidad].join(' · '))+'</p>'+(isNew?'': '<label>Decisión<select data-action="'+i+'"><option value="">Seleccionar…</option>'+[['ACEPTAR','Aceptar'],['MODIFICAR','Modificar'],['ELIMINAR','Eliminar (anular)']].map(([v,l])=>'<option value="'+v+'" '+(r.accion===v?'selected':'')+'>'+l+'</option>').join('')+'</select></label>')+((isNew||r.accion==='MODIFICAR')?'<label>Reserva · acabado · referencia · pieza<select data-piece="'+i+'">'+sourceOptions(r)+'</select></label><div class="rec-grid"><label>Cantidad faltante<input data-field="cantidad" data-i="'+i+'" type="number" min="1" step="1" value="'+escape(r.cantidad)+'"></label><label>Ventanas afectadas<input data-field="ventanas_afectadas" data-i="'+i+'" type="number" min="1" step="1" value="'+escape(r.ventanas_afectadas||1)+'"></label></div><label>Observaciones<textarea data-field="observacion" data-i="'+i+'">'+escape(r.observacion)+'</textarea></label>':'')+(!isNew&&['MODIFICAR','ELIMINAR'].includes(r.accion)?'<label>Motivo obligatorio<textarea data-field="motivo" data-i="'+i+'">'+escape(r.motivo)+'</textarea></label>':'')+(isNew?'<button type="button" data-remove="'+i+'">Quitar diferencia nueva</button>':'')+'</section>').join('');
    host.querySelectorAll('[data-action]').forEach(el=>el.onchange=()=>{list[el.dataset.action].accion=el.value;paint();});
    host.querySelectorAll('[data-piece]').forEach(el=>el.onchange=()=>{const p=pieces[el.value];if(p)Object.assign(list[el.dataset.piece],p,{perfil:p.codigo_sap,cantidad:list[el.dataset.piece].cantidad,ventanas_afectadas:list[el.dataset.piece].ventanas_afectadas});else list[el.dataset.piece].id_pieza='';paint();});
    host.querySelectorAll('[data-field]').forEach(el=>el.oninput=()=>list[el.dataset.i][el.dataset.field]=el.type==='number'?Number(el.value):el.value);
    host.querySelectorAll('[data-remove]').forEach(el=>el.onclick=()=>{list.splice(+el.dataset.remove,1);paint();});
   }
  };paint();
  card.querySelector('[data-add]').onclick=()=>{differences.push({cantidad:1,ventanas_afectadas:1,observacion:''});paint();const added=body.querySelector('[data-new]').lastElementChild;if(added)body.scrollTop+=added.getBoundingClientRect().top-body.getBoundingClientRect().top;};
  const error=body.querySelector('[data-error]');
  card.querySelector('[data-save]').onclick=async()=>{
   if(busy)return;
   try{
    const decisions=auditDecisions(rows);auditDecisions(differences.map(r=>({...r,accion:'MODIFICAR',motivo:'Diferencia adicional'})));
    if(!body.querySelector('[data-date]').value||!body.querySelector('[data-shift]').value)throw Error('Completa fecha y turno de recepción.');
    busy=true;card.querySelectorAll('button,input,select,textarea').forEach(el=>el.disabled=true);
    await rpc('sgp_picking_auditoria_guardar',{p_id_entrega:target.id_entrega,p_version:snapshot.version,p_solicitud:request,p_fecha:body.querySelector('[data-date]').value,p_turno:body.querySelector('[data-shift]').value,p_decisiones:decisions,p_diferencias:differences,p_observacion:body.querySelector('[data-observation]').value||null});
    busy=false;close();await onSaved();
   }catch(e){busy=false;card.querySelectorAll('button,input,select,textarea').forEach(el=>el.disabled=false);error.textContent=e.message;error.focus();}
  };
  card.querySelector('[data-close]').focus();
 }catch(e){if(modal.dataset.auditSession!==session)return;card.querySelector('.pick-audit-body').innerHTML='<p role="alert">Auditoría no disponible: '+escape(e.message)+'. Recarga o consulta la instalación del contrato aprobado.</p>';}
}
