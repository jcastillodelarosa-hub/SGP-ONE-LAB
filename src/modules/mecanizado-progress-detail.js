const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const states=['SIN INICIAR','CORTE','MECANIZADO','PROCESADO'];
const stateClass=value=>'state-'+String(value).toLowerCase().replace(/\s+/g,'-');
const number=value=>value===null?'Por conciliar':Number(value).toLocaleString('es-CO');
export function progressDetailMarkup(details,system,{canManage=false,filter='pending'}={}){
 const all=details.filter(row=>row.system===system),shown=all.filter(row=>filter==='all'||row.pending===null||row.pending>0);
 const rows=shown.map(row=>{
  const header='<tr class="sgp-progress-order"><th colspan="6" scope="rowgroup">'+escape(row.production||'Orden sin nombre')+' · Reserva '+escape(row.reserve)+' <small>Base '+number(row.programmed)+' · Procesadas '+number(row.processed)+' · Pendientes '+number(row.pending)+'</small></th></tr>';
  const assignments=row.assignments.map(a=>'<tr><td data-label="Reserva / parte">'+escape(a.reserva)+'<small>Parte '+escape(a.part||'—')+'</small></td><td data-label="Cantidad">'+number(a.quantity)+'</td><td data-label="Por procesar">'+number(row.editable?Math.max(0,a.quantity-a.processed):null)+'</td><td data-label="Día / turno">'+escape(a.date||'Sin fecha')+'<small>'+escape(a.shift||'Sin turno')+'</small></td><td data-label="Estado"><span class="prod-state '+stateClass(a.state)+'">'+escape(a.state)+'</span></td><td data-label="Cambiar estado">'+(canManage&&row.editable&&a.editable?'<div data-progress-edit data-id="'+escape(a.id_programacion)+'" data-production="'+escape(a.produccion)+'"><select aria-label="Nuevo estado de '+escape(a.produccion)+'" class="prod-order-state '+stateClass(a.state)+'" data-progress-state>'+states.map(s=>'<option value="'+s+'" '+(s===a.state?'selected':'')+'>'+s+'</option>').join('')+'</select><button type="button" data-progress-save disabled>Guardar</button><span role="status" data-progress-message></span></div>':'<small>'+(!canManage?'Solo consulta':!row.editable?'Resolver conciliación':'Cierre de reserva: gestionar en Producción')+'</small>')+'</td></tr>').join('');
  const unassigned=row.unassigned?'<tr><td>Sin asignar a mecanizado</td><td>'+number(row.unassigned)+'</td><td>'+number(row.unassigned)+'</td><td>Sin programar</td><td><span class="prod-state state-sin-iniciar">SIN INICIAR</span></td><td><small>Programar desde Reservas</small></td></tr>':'';
  const warnings=row.warnings.length?'<tr><td colspan="6" role="status">'+row.warnings.map(escape).join(' · ')+'</td></tr>':'';
  return header+assignments+unassigned+warnings;
 }).join('');
 return '<section class="sgp-progress-detail" aria-label="Detalle de '+escape(system)+'"><header><h4>'+escape(system)+' · Reservas y órdenes</h4><button type="button" data-progress-close>Contraer ↑</button></header><div class="sgp-progress-filters"><button type="button" data-progress-filter="pending" aria-pressed="'+(filter==='pending')+'">Pendientes</button><button type="button" data-progress-filter="all" aria-pressed="'+(filter==='all')+'">Todas</button><span>'+shown.length+' órdenes</span></div><div class="sgp-progress-scroll"><table><thead><tr><th>Reserva / parte</th><th>Cantidad</th><th>Por procesar</th><th>Día / turno</th><th>Estado</th><th>Cambiar estado</th></tr></thead><tbody>'+ (rows||'<tr><td colspan="6">No hay órdenes para este filtro.</td></tr>')+'</tbody></table></div><p class="sgp-progress-help">Por procesar = ventanas pendientes de mecanizado, no perfiles faltantes.</p></section>';
}
export function bindProgressDetail(root,{save,onSaved,onFilter,onClose}){
 root.querySelector('[data-progress-close]')?.addEventListener('click',onClose);
 root.querySelectorAll('[data-progress-filter]').forEach(b=>b.addEventListener('click',()=>onFilter(b.dataset.progressFilter)));
 root.querySelectorAll('[data-progress-edit]').forEach(row=>{
  const select=row.querySelector('[data-progress-state]'),button=row.querySelector('[data-progress-save]'),message=row.querySelector('[data-progress-message]');let previous=select.value,busy=false;
  select.addEventListener('change',()=>{select.className='prod-order-state '+stateClass(select.value);button.disabled=busy||select.value===previous;message.textContent='';});
  button.addEventListener('click',async()=>{if(busy||select.value===previous)return;busy=true;button.disabled=true;select.disabled=true;message.textContent='Guardando…';try{await save({id:row.dataset.id,production:row.dataset.production,state:select.value,expected:previous});previous=select.value;message.textContent='Guardado';await onSaved();}catch(error){message.textContent=error?.message||'No fue posible guardar';}finally{busy=false;select.disabled=false;button.disabled=select.value===previous;}});
 });
}
