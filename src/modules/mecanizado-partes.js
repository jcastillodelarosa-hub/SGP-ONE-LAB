import {positiveInteger,proposeParts,validateParts} from '../domain/mecanizado-partes.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const empty=()=>({cantidad:'',fecha:'',turno:'',prioridad:1,observacion:''});

/** The existing SGP dialog is the design reference: blue header, labelled fields, scoped scroll. */
export async function openPartialProgramming({client,token,key,reserva,canManage=false,onSaved=async()=>{}}){
 const previous=document.activeElement;
 const dialog=document.createElement('dialog');dialog.className='mec-part-dialog';
 dialog.setAttribute('aria-labelledby','mecPartTitle');
 dialog.innerHTML='<header><div><small>MECANIZADO · PROGRAMACIÓN PARCIAL</small><h2 id="mecPartTitle">Programar producción</h2><span data-production></span></div><button type="button" data-close aria-label="Cerrar programación">✕</button></header><div class="mec-part-content"><p data-message role="status" aria-live="polite">Consultando cantidades…</p><div data-summary class="mec-part-summary"></div><div class="mec-part-toolbar"><label>Capacidad por turno<input data-capacity type="number" min="1" step="1" inputmode="numeric"></label><button type="button" data-split>Dividir por capacidad</button><button type="button" data-refresh>Actualizar saldo</button></div><p>Selecciona fecha y turno en cada fila. Solo se guardarán las cantidades indicadas.</p><div data-proposal></div><h3>Partes existentes</h3><div data-existing></div><div data-history></div></div><footer><button type="button" data-close>Volver</button><button type="button" class="primary" data-save>Guardar partes</button></footer>';
 document.body.append(dialog);dialog.showModal();
 let model=null,rows=[empty()],busy=false,request=null,signature=null,closed=false;
 const el=s=>dialog.querySelector(s),message=(text,error=false)=>{el('[data-message]').textContent=text;el('[data-message]').setAttribute('role',error?'alert':'status');};
 const rpc=async(name,args)=>{const {data,error}=await client.rpc(name,{p_token:token,...args});if(error)throw ['PGRST202','42883'].includes(error.code)?new Error('La programación parcial aún no está habilitada. No se guardaron cambios.'):error;return data;};
 const close=()=>{if(busy)return;closed=true;dialog.close();dialog.remove();previous?.focus();};
 dialog.querySelectorAll('[data-close]').forEach(b=>b.onclick=close);
 dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 function renderProposal(){
  el('[data-proposal]').innerHTML=rows.map((p,i)=>'<fieldset class="mec-part-row" data-row="'+i+'"><legend>Parte propuesta '+(i+1)+'</legend><label>Ventanas<input data-field="cantidad" type="number" min="1" step="1" inputmode="numeric" value="'+esc(p.cantidad)+'"></label><label>Fecha<input data-field="fecha" type="date" value="'+esc(p.fecha)+'"></label><label>Turno<select data-field="turno"><option value="">Seleccionar…</option>'+['TURNO 1','TURNO 2'].map(t=>'<option '+(p.turno===t?'selected':'')+'>'+t+'</option>').join('')+'</select></label><label>Prioridad<input data-field="prioridad" type="number" min="1" step="1" inputmode="numeric" value="'+esc(p.prioridad)+'"></label><label class="mec-part-obs">Observaciones<textarea data-field="observacion" rows="2">'+esc(p.observacion)+'</textarea></label>'+(rows.length>1?'<button type="button" data-remove="'+i+'">Quitar parte '+(i+1)+'</button>':'')+'</fieldset>').join('');
  dialog.querySelectorAll('[data-field]').forEach(input=>input.oninput=()=>{rows[Number(input.closest('[data-row]').dataset.row)][input.dataset.field]=input.value;});
  dialog.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{rows.splice(Number(b.dataset.remove),1);renderProposal();});
 }
 function existing(){
  el('[data-existing]').innerHTML=model.partes.length?model.partes.map(p=>'<article class="mec-part-existing"><div><b>'+esc(p.identificador)+'</b><span class="prod-state">'+esc(p.estado)+'</span></div><p>'+p.cantidad+' ventanas · Procesadas '+p.procesada+' · Entregadas registradas '+p.entregada+'</p><small>'+esc(p.fecha_programacion)+' · '+esc(p.turno)+' · Prioridad '+esc(p.prioridad)+'</small><p>'+esc(p.observacion||'Sin observaciones')+'</p><small>'+esc(p.usuario)+' · '+esc(p.fecha_actualizacion)+'</small><div><button type="button" data-history-id="'+p.id_programacion+'">Historial</button>'+(p.estado==='SIN INICIAR'&&!Number(p.entregada)?'<button type="button" data-move-id="'+p.id_programacion+'">Reprogramar</button><button type="button" data-cancel-id="'+p.id_programacion+'">Cancelar parte</button>':'')+'</div></article>').join(''):'<p>Esta producción aún no tiene partes agregadas.</p>';
  dialog.querySelectorAll('[data-history-id]').forEach(b=>b.onclick=()=>act(async()=>{const history=await rpc('sgp_mecanizado_parte_historial',{p_id:b.dataset.historyId});el('[data-history]').innerHTML='<h3>Historial</h3>'+history.map(m=>'<p><b>'+esc(m.tipo)+'</b> · '+esc(m.usuario)+' · '+esc(m.fecha)+'<br>'+esc(JSON.stringify(m.nuevo))+'</p>').join('');}));
  if(!canManage)dialog.querySelectorAll('[data-cancel-id],[data-move-id]').forEach(b=>b.remove());
  dialog.querySelectorAll('[data-cancel-id]').forEach(b=>b.onclick=()=>{
   const reason=prompt('Motivo de cancelación (mínimo 5 caracteres). Se liberará únicamente esta parte sin avance.');
   if(reason==null)return;
   act(async()=>{await rpc('sgp_mecanizado_parte_mover',{p_id:b.dataset.cancelId,p_fecha:null,p_turno:null,p_prioridad:null,p_motivo:reason,p_cancelar:true});await refresh();await onSaved();message('Parte cancelada. Su cantidad vuelve a estar disponible.');});
  });
  dialog.querySelectorAll('[data-move-id]').forEach(b=>b.onclick=()=>{
   const p=model.partes.find(x=>x.id_programacion===b.dataset.moveId);
   const host=el('[data-history]');host.innerHTML='<fieldset class="mec-part-row"><legend>Reprogramar '+esc(p.identificador)+'</legend><label>Fecha<input data-move-date type="date" value="'+esc(p.fecha_programacion)+'"></label><label>Turno<select data-move-shift>'+['TURNO 1','TURNO 2'].map(t=>'<option '+(t===p.turno?'selected':'')+'>'+t+'</option>').join('')+'</select></label><label>Prioridad<input data-move-priority type="number" min="1" value="'+esc(p.prioridad)+'"></label><label>Motivo<textarea data-move-reason></textarea></label><button type="button" data-confirm-move>Guardar reprogramación</button></fieldset>';
   el('[data-confirm-move]').onclick=()=>act(async()=>{await rpc('sgp_mecanizado_parte_mover',{p_id:p.id_programacion,p_fecha:el('[data-move-date]').value,p_turno:el('[data-move-shift]').value,p_prioridad:positiveInteger(el('[data-move-priority]').value,'Prioridad'),p_motivo:el('[data-move-reason]').value,p_cancelar:false});host.innerHTML='';await refresh();await onSaved();message('Parte reprogramada con el mismo identificador.');});
  });
 }
 async function refresh(){
  const data=await rpc('sgp_mecanizado_partes_consultar',{p_key:key});if(closed)return;
  if(!data||!Array.isArray(data.partes)||!Number.isSafeInteger(Number(data.disponible)))throw new Error('Respuesta de cantidades incompleta.');
  model=data;el('[data-production]').textContent=data.produccion+' · Reserva '+reserva;
  el('[data-summary]').innerHTML=[['Original',data.original],['Programadas',data.programada],['Disponibles',data.disponible]].map(([label,n])=>'<div><small>'+label+'</small><strong>'+esc(n)+'</strong></div>').join('');
  el('[data-capacity]').value=data.capacidad??'';el('[data-split]').disabled=!data.capacidad||!data.disponible;
  existing();
 }
 async function act(fn){
  if(busy||closed)return;busy=true;
  dialog.querySelectorAll('button,input,select,textarea').forEach(x=>x.disabled=true);
  try{await fn();}catch(error){message(error.message||String(error),true);}
  finally{busy=false;if(!closed){dialog.querySelectorAll('button,input,select,textarea').forEach(x=>x.disabled=false);if(!canManage)dialog.querySelectorAll('[data-proposal] input,[data-proposal] select,[data-proposal] textarea,[data-remove],[data-capacity]').forEach(x=>x.disabled=true);el('[data-save]').disabled=!canManage||!model||!model.disponible;el('[data-split]').disabled=!canManage||!model?.disponible;}}
 }
 el('[data-refresh]').onclick=()=>act(async()=>{await refresh();message('Saldo actualizado.');});
 el('[data-split]').onclick=()=>{try{
  if(!model)throw new Error('Primero actualiza las cantidades.');
  rows=proposeParts(model.disponible,el('[data-capacity]').value).map(cantidad=>({...empty(),cantidad}));renderProposal();message('Propuesta editable: selecciona fecha, turno y prioridad para cada parte.');
 }catch(error){message(error.message,true);}};
 el('[data-save]').onclick=()=>act(async()=>{
  if(!model)throw new Error('No se pudo consultar el saldo.');
  const parts=validateParts(rows,model.disponible),next=JSON.stringify(parts);
  if(!request||signature!==next){request=crypto.randomUUID();signature=next;}
  const result=await rpc('sgp_mecanizado_partes_programar',{p_key:key,p_reserva:reserva,p_partes:parts,p_clave:request});
  if(result?.ok!==true)throw new Error('No se confirmó la programación. Reintenta la misma propuesta.');
  rows=[empty()];request=null;signature=null;renderProposal();await refresh();
  try{await onSaved();}catch{message('Partes guardadas. Actualiza el listado para ver los cambios.',true);return;}
  message('Partes guardadas. Saldo disponible: '+result.disponible+' ventanas.');
 });
 renderProposal();await act(async()=>{await refresh();message(canManage?'Introduce la cantidad que deseas programar.':'Consulta de partes. Tu rol no permite programar.');});
 return {dialog,close};
}
