const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/** A role label alone never enables the new persistent capability. */
export function canIncorporateAssembly(data,context){
 const cap=data?.incorporation;
 return context?.stage==='ENSAMBLE'&&context?.line==='PANELES_2'&&data?.contract==='LP-OPERACION-1'&&data.writeContract==='LP-OPERACION-CAS-2'&&data.writes===true&&data.turn?.estado==='ABIERTO'&&Number.isSafeInteger(data.turn.revision)&&data.turn.revision>=0&&cap?.contract==='LP-INCORPORAR-1'&&cap.enabled===true&&cap.canIncorporate===true&&cap.stage===context.stage&&cap.line===context.line;
}
export function incorporationInput(row,quantity,observation){
 const value=String(quantity??''),reason=String(observation??'').trim();
 if(typeof row?.key!=='string'||!row.key.endsWith('|PANELES_2')||row.key==='|PANELES_2'||row?.state!=='OTRAS'||row.oficial?.activa!=='SI'||!Number.isSafeInteger(row.balance)||row.balance<=0)throw Error('La orden no está disponible para incorporación. Actualiza la hoja.');
 if(!/^[1-9]\d*$/.test(value)||!Number.isSafeInteger(Number(value))||Number(value)>2147483647||Number(value)>row.balance)throw Error('Indica una cantidad entera positiva hasta el saldo de Ensamble.');
 if(!reason||Array.from(reason).length>2000)throw Error('Escribe un motivo de hasta 2000 caracteres.');
 return {key:row.key,quantity:Number(value),observation:reason};
}
/** Persistence is delegated to the existing CAS/idempotent command controller. */
export function showAssemblyIncorporation({host,row,data,context,isCurrent,onSave,onRetry,onSaved=()=>{}}){
 if(!canIncorporateAssembly(data,context))throw Error('La incorporación por el líder no está habilitada por el servidor.');
 const dialog=document.createElement('dialog');dialog.className='lp-sale-dialog';dialog.setAttribute('aria-label','Incorporar producción al turno');
 dialog.innerHTML='<form><h3>Incorporar '+esc(row.produccion)+'</h3><p>'+esc(context.line)+' · '+esc(context.date)+' / T'+context.shift+' · Ensamble</p><label>Ventanas para programar<input name="quantity" type="number" min="1" max="'+row.balance+'" step="1" required></label><label>Motivo del cambio<textarea name="observation" maxlength="2000" required></textarea></label><p>No abre el turno ni registra producción realizada. Se conserva el historial de la incorporación.</p><p data-incorporation-status role="status"></p><div class="lp-followup-actions"><button type="submit">Incorporar</button><button type="button" data-incorporation-retry hidden>Reintentar mismo guardado</button><button type="button" data-incorporation-cancel>Cancelar</button></div></form>';
 host.append(dialog);dialog.showModal();const form=dialog.querySelector('form'),status=dialog.querySelector('[data-incorporation-status]');let busy=false,uncertain=false;
 const close=()=>{if(busy||uncertain)return;dialog.close();dialog.remove();};
 const sync=()=>{form.querySelectorAll('input,textarea').forEach(input=>input.disabled=busy||uncertain);form.querySelector('[type=submit]').disabled=busy||uncertain;dialog.querySelector('[data-incorporation-retry]').hidden=!uncertain;dialog.querySelector('[data-incorporation-retry]').disabled=busy;dialog.querySelector('[data-incorporation-cancel]').disabled=busy||uncertain;};
 async function save(retry=false){
  if(busy||(!retry&&uncertain)||!isCurrent())return;
  let input;try{if(!retry)input=incorporationInput(row,form.elements.quantity.value,form.elements.observation.value);}catch(error){status.textContent=error.message;return;}
  busy=true;sync();status.textContent='Guardando incorporación…';
  try{await (retry?onRetry():onSave(input));uncertain=false;busy=false;close();onSaved();}
  catch(error){uncertain=error.uncertain===true;status.textContent=uncertain?'Resultado sin confirmar. Reintenta el mismo guardado antes de salir.':error.message;}
  finally{busy=false;if(dialog.isConnected)sync();}
 }
 form.onsubmit=event=>{event.preventDefault();void save();};dialog.querySelector('[data-incorporation-retry]').onclick=()=>void save(true);dialog.querySelector('[data-incorporation-cancel]').onclick=close;dialog.addEventListener('cancel',event=>{event.preventDefault();close();});form.elements.quantity.focus();
 return ()=>{if(!busy&&!uncertain)close();};
}
