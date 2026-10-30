import {sourceKey,registrationPieces} from '../domain/pdt-registration.js';
import {registrationSources,saveRegistration} from '../services/pdt-registration.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
/** Shared embedded editor. No module-specific persistence, no legacy fallback.
 * onChange is called after every selection, not only after mounting. */
export async function mountPdtRegistration(host,{client,token,origin,context,onChange=()=>{}}){
 let sources=[],entries=[],loaded=false,busy=false;
 host.innerHTML='<div class="pdt-registration"><div role="status" data-status></div><p role="status" data-validation hidden></p><button type="button" data-retry>Actualizar piezas</button><div data-entries></div><button type="button" data-add>+ Agregar otra pieza</button></div>';
 const root=host.firstElementChild,status=root.querySelector('[data-status]'),list=root.querySelector('[data-entries]');
 function value(){return registrationPieces(origin,sources,entries);}
 function notify(){
  let valid=false,reason='';
  if(loaded&&!busy){try{value();valid=true;}catch(error){reason=error.message||'Completa los datos de la pieza.';}}
  const hint=root.querySelector('[data-validation]');
  if(hint){hint.textContent=reason&&!valid?'Para guardar: '+reason:'';hint.hidden=!reason||valid;}
  onChange(valid);
 }
 function draw(){
  list.innerHTML=entries.map((e,i)=>{
   const refs=[...new Set(sources.map(p=>p.codigo_sap))].sort();
   const options=sources.filter(p=>p.codigo_sap===e.ref);
   const picker=origin==='PICKING'?`<div class="table-wrap"><table class="nc-operational-table pdt-manual-table"><thead><tr><th>Elegir</th><th>Fabricación</th><th>Marca</th><th>Longitud</th><th>Acabado</th><th>Reserva</th><th>Referencia</th></tr></thead><tbody>${options.map(p=>`<tr><td><input type="radio" name="pdt-pick-${i}" data-source-radio="${esc(sourceKey(p))}" ${sourceKey(p)===e.source?'checked':''} aria-label="Seleccionar ${esc(p.fabricacion)} ${esc(p.longitud)}"></td><td>${esc(p.fabricacion)}</td><td>${esc(p.marca||'—')}</td><td>${esc(p.longitud)}</td><td>${esc(p.acabado)}</td><td>${esc(p.reserva)}</td><td>${esc(p.cantidad_referencia)}</td></tr>`).join('')}</tbody></table></div>`:`<label>Fabricación · longitud · acabado · reserva<select data-source><option value="">Selecciona la pieza real…</option>${options.map(p=>`<option value="${esc(sourceKey(p))}" ${sourceKey(p)===e.source?'selected':''}>${esc(p.fabricacion)} · ${esc(p.longitud)} in · ${esc(p.acabado)} · ${esc(p.reserva)} · Ref. ${esc(p.cantidad_referencia)}</option>`).join('')}</select></label>`;
   return `<fieldset data-entry="${i}"><legend>Pieza ${i+1}</legend><label>Referencia<select data-ref><option value="">Seleccionar…</option>${refs.map(r=>`<option ${r===e.ref?'selected':''}>${esc(r)}</option>`).join('')}</select></label>${picker}<div data-preview></div><div class="rec-grid"><label>Cantidad<input data-qty type="number" min="1" step="1" value="${esc(e.cantidad)}"></label><label>NC ${origin==='PICKING'?'(opcional)':'(obligatoria)'}<input data-nc maxlength="120" value="${esc(e.nc)}" ${origin!=='PICKING'?'required':''}></label></div>${origin==='PICKING'?`<div class="pdt-manual-ncs"><strong>NC adicionales (hasta 20)</strong>${(e.ncs||[]).slice(1).map((nc,n)=>`<div class="pdt-manual-nc-row"><label>NC ${n+2}<input data-extra-nc="${n+1}" maxlength="120" value="${esc(nc)}"></label><button type="button" data-remove-extra="${n+1}">Eliminar</button></div>`).join('')}<button type="button" data-add-extra>+ Agregar otra NC</button></div>`:''}<label>Observaciones<textarea data-obs rows="2">${esc(e.observacion)}</textarea></label><small>${origin==='PICKING'&&!e.nc.trim()?'NC PENDIENTE DE ASIGNAR':'La NC se conserva; su validación sigue el contrato existente.'}</small><button type="button" data-remove>Eliminar pieza</button></fieldset>`;
  }).join('');
  list.querySelectorAll('[data-entry]').forEach(card=>{
   const i=Number(card.dataset.entry),e=entries[i];
   card.querySelector('[data-ref]').onchange=event=>{e.ref=event.target.value;e.source='';draw();notify();};
   const preview=()=>{const p=sources.find(p=>sourceKey(p)===e.source);card.querySelector('[data-preview]').textContent=p?`${p.fabricacion} · ${p.longitud} in · ${p.acabado} · Reserva ${p.reserva} · Principal ${p.reserva_principal} · Referencia: ${p.cantidad_referencia} piezas`:'';};preview();
   if(origin==='PICKING')card.querySelectorAll('[data-source-radio]').forEach(input=>input.onchange=()=>{e.source=input.dataset.sourceRadio;preview();notify();});
   else card.querySelector('[data-source]').onchange=event=>{e.source=event.target.value;preview();notify();};
   for(const [selector,key] of [['[data-qty]','cantidad'],['[data-nc]','nc'],['[data-obs]','observacion']])card.querySelector(selector).oninput=event=>{e[key]=event.target.value;if(key==='nc'&&e.ncs)e.ncs[0]=e.nc;card.querySelector('small').textContent=origin==='PICKING'&&!e.nc.trim()?'NC PENDIENTE DE ASIGNAR':'La NC se conserva; su validación sigue el contrato existente.';notify();};
   if(origin==='PICKING'){
    card.querySelector('[data-add-extra]').onclick=()=>{e.ncs??=[e.nc];if(e.ncs.length>=20)return;e.ncs.push('');draw();notify();};
    card.querySelectorAll('[data-extra-nc]').forEach(input=>input.oninput=()=>{e.ncs[Number(input.dataset.extraNc)]=input.value;notify();});
    card.querySelectorAll('[data-remove-extra]').forEach(button=>button.onclick=()=>{e.ncs.splice(Number(button.dataset.removeExtra),1);draw();notify();});
   }
   card.querySelector('[data-remove]').onclick=()=>{entries.splice(i,1);draw();notify();};
  });
 }
 root.querySelector('[data-add]').onclick=()=>{entries.push({ref:'',source:'',cantidad:1,nc:'',observacion:''});draw();notify();};
 async function load(){
  busy=true;loaded=false;notify();status.textContent='Consultando piezas verificadas…';
  try{sources=await registrationSources(client,token,origin,context);loaded=true;status.textContent=sources.length?'Piezas PANEL verificadas · PANELES_2':'No hay piezas verificables para esta producción. No se puede guardar.';draw();}
  catch(e){status.textContent=e.message;}
  finally{busy=false;notify();}
 }
 root.querySelector('[data-retry]').onclick=load;
 entries.push({ref:'',source:'',cantidad:1,nc:'',observacion:''});await load();
 return {value,get sources(){return sources;},get entries(){return entries;},setDisabled(disabled){busy=disabled;root.querySelectorAll('input,select,textarea,button').forEach(x=>x.disabled=disabled);notify();}};
}
/** Stable opening API for parallel Ensamble/Empaque work. Picking uses the same
 * embedded editor inside its existing complete/incomplete delivery dialog. */
export async function openPdtRegistration({client,token,origin,context,onSaved=()=>{}}){
 if(origin==='PICKING')throw new Error('Picking debe usar el diálogo de entrega para guardar toda la operación de forma atómica.');
 const previous=document.activeElement,m=document.createElement('div');m.className='piece-modal';
 m.innerHTML=`<div class="piece-modal-card repo-work-card" role="dialog" aria-modal="true" aria-labelledby="pdtRegistrationTitle"><div class="piece-modal-head"><div><span class="eyebrow">${esc(origin)} · PDT</span><h2 id="pdtRegistrationTitle">Registrar PDT</h2></div><button data-close aria-label="Cerrar">×</button></div><div class="piece-modal-meta">${esc(context.produccion)} · Reserva ${esc(context.reserva||'según pieza')} · ${esc(context.sistema||'')}</div><div class="repo-work-body" data-editor></div><p role="status" data-result></p><div class="repo-work-footer"><button data-save class="primary" disabled>Guardar PDT</button></div></div>`;
 document.body.appendChild(m);const save=m.querySelector('[data-save]'),result=m.querySelector('[data-result]');let saving=false,key=crypto.randomUUID(),frozen=null,done=false;
 const close=()=>{if(!saving){m.remove();previous?.focus();}};m.querySelector('[data-close]').onclick=close;
 m.onkeydown=e=>{if(e.key==='Escape')close();if(e.key==='Tab'){const nodes=[...m.querySelectorAll('button,input,select,textarea')].filter(x=>!x.disabled),first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};
 const editor=await mountPdtRegistration(m.querySelector('[data-editor]'),{client,token,origin,context,onChange:valid=>{if(!saving&&!done)save.disabled=!valid;}});
 save.onclick=async()=>{if(saving||done)return;saving=true;save.disabled=true;editor.setDisabled(true);
  try{const payload={origin,context,sources:editor.sources,entries:editor.entries,idempotencyKey:key};const signature=JSON.stringify([context,editor.value()]);if(frozen&&frozen!==signature){key=crypto.randomUUID();payload.idempotencyKey=key;}frozen=signature;const data=await saveRegistration(client,token,payload);done=true;result.textContent='PDT registrado. Puedes cerrar esta ventana.';await onSaved(data);}
  catch(e){result.textContent=e.message;}
  finally{saving=false;editor.setDisabled(done);if(done)save.disabled=true;}
 };m.querySelector('[data-close]').focus();return m;
}
