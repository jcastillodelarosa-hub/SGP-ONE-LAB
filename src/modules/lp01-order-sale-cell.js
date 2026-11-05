const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const owners=new WeakMap();
/** Display the saved order definition; it is not Export balance or turn SALE. */
export async function mountOrderSaleCell(host,transport){
 owners.get(host)?.dispose();
 const owner={};owners.set(host,owner);
 let disposed=false,state=null,pending=null,busy=false,message='';
 const alive=()=>!disposed&&owners.get(host)===owner&&host.isConnected&&transport.isCurrent();
 const dispose=()=>{disposed=true;clearInterval(watch);if(owners.get(host)===owner){owners.delete(host);host.replaceChildren();}};owner.dispose=dispose;
 const watch=setInterval(()=>{if(!alive())dispose();},250);
 const denied=e=>{if(e.message==='NO_AUTORIZADO'||!alive()){dispose();return true;}return false;};
 const value=()=>state.quantity===null?'Por definir':String(state.quantity);
 function show(){
  if(!alive())return;
  const canDefine=state.capabilities.includes('DEFINE');
  host.innerHTML='<span class="lp-sale-compact">'+(canDefine?'<button type="button" class="lp-sale-value" data-sale-edit aria-label="Disponible: '+esc(value())+'. Editar definición por orden">'+esc(value())+' <span aria-hidden="true">✎</span></button>':'<span class="lp-sale-value" aria-label="Disponible: '+esc(value())+'">'+esc(value())+'</span>')+'</span>'+(message?'<span class="lp-sale-message" role="status">'+esc(message)+'</span>':'')+(canDefine?'<dialog class="lp-sale-dialog" aria-label="Definir disponible por orden"><form class="lp-sale-definition"><label>Disponible<input name="quantity" type="number" min="0" step="1" inputmode="numeric" value="'+esc(state.quantity??'')+'" placeholder="Por definir" required></label><label>Motivo<textarea name="observation" maxlength="2000" required></textarea></label><p class="lp-sale-hint">Definición por orden. No modifica Export ni SALE de turnos.</p><p role="status" data-sale-status></p><div class="lp-sale-actions"><button type="submit" data-sale-save>Guardar</button><button type="button" data-sale-cancel>Cancelar</button><button type="button" data-sale-retry hidden>Reintentar mismo guardado</button><button type="button" data-sale-refresh>Actualizar</button></div></form><details><summary>Historial · '+state.history.length+'</summary>'+state.history.map(e=>'<p>'+esc(e.at)+' · '+esc(e.user)+' · '+esc(e.before?.cantidad??'Sin definición')+' → '+e.quantity+'<br>'+esc(e.observation)+'</p>').join('')+'</details></dialog>':'');
  if(!canDefine)return;
  const dialog=host.querySelector('dialog'),form=dialog.querySelector('form'),status=dialog.querySelector('[data-sale-status]');
  const setBusy=on=>{busy=on;form.querySelectorAll('input,textarea,button').forEach(n=>n.disabled=on);};
  const open=()=>{dialog.showModal();status.textContent=message;if(pending){form.elements.quantity.value=String(pending.quantity);form.elements.observation.value=pending.observation;form.elements.quantity.disabled=true;form.elements.observation.disabled=true;dialog.querySelector('[data-sale-save]').hidden=true;dialog.querySelector('[data-sale-retry]').hidden=false;}else form.elements.quantity.focus();};
  const close=()=>{if(busy)return;dialog.close();if(pending&&!host.querySelector('.lp-sale-message'))host.querySelector('.lp-sale-compact').insertAdjacentHTML('afterend','<span class="lp-sale-message" role="status">'+esc(message)+'</span>');if(!pending){form.reset();status.textContent='';}};
  host.querySelector('[data-sale-edit]').onclick=open;
  dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
  dialog.querySelector('[data-sale-cancel]').onclick=close;
  async function send(){
   setBusy(true);
   try{
    await transport.save(pending);if(!alive())return;pending=null;message='';dialog.close();
    try{state=await transport.read();if(alive()){show();host.querySelector('[data-sale-edit]')?.focus({preventScroll:true});}}
    catch(e){if(!denied(e)){host.innerHTML='<button type="button" class="lp-sale-value" data-sale-load>Guardado confirmado · Actualizar</button>';host.querySelector('[data-sale-load]').onclick=()=>void refresh();}}
   }catch(e){if(!denied(e)){
    if(e.confirmedRejected){pending=null;dialog.querySelector('[data-sale-retry]').hidden=true;dialog.querySelector('[data-sale-save]').hidden=false;}
    message=pending?'Resultado sin confirmar; reintenta el mismo guardado.':e.message;
    status.textContent=message;
    if(pending){dialog.querySelector('[data-sale-save]').hidden=true;dialog.querySelector('[data-sale-retry]').hidden=false;form.elements.quantity.disabled=true;form.elements.observation.disabled=true;}
    else setBusy(false);
   }}finally{busy=false;if(alive()&&pending){dialog.querySelector('[data-sale-retry]').disabled=false;dialog.querySelector('[data-sale-cancel]').disabled=false;}}
  }
  form.onsubmit=e=>{
   e.preventDefault();if(busy||pending||!alive())return;
   const raw=form.elements.quantity.value,quantity=Number(raw),observation=form.elements.observation.value.trim();
   if(raw===''||!Number.isSafeInteger(quantity)||quantity<0||!observation){status.textContent='Indica una cantidad entera y un motivo.';return;}
   if(state.source.available===null){status.textContent='Disponibilidad pendiente de validar.';return;}
   if(quantity>state.source.available){status.textContent='La cantidad supera la disponibilidad validada.';return;}
   pending={id:crypto.randomUUID(),quantity,revision:state.revision,sourceFingerprint:state.source.fingerprint,observation};void send();
  };
  dialog.querySelector('[data-sale-retry]').onclick=()=>{if(!busy&&pending&&alive())void send();};
  dialog.querySelector('[data-sale-refresh]').onclick=()=>{if(!busy&&!pending){dialog.close();void refresh();}};
 }
 async function refresh(){
  if(busy||pending||!alive())return;busy=true;
  try{const next=await transport.read();if(alive()){state=next;message='';show();}}
  catch(e){if(!denied(e)&&alive()){host.innerHTML='<button type="button" class="lp-sale-value" data-sale-load>Disponible no disponible · Actualizar</button>';host.querySelector('[data-sale-load]').onclick=()=>void refresh();}}
  finally{busy=false;}
 }
 host.textContent='Consultando disponible…';await refresh();return dispose;
}
