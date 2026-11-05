const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const owners=new WeakMap();
/** Mount only with an explicitly supplied, authorized order contract. No fallback to turn SALE. */
export async function mountOrderSaleCell(host,transport,{compact=false}={}){
 owners.get(host)?.dispose();
 const owner={};owners.set(host,owner);
 let disposed=false,state,pending=null,busy=false,expanded=true;
 const alive=()=>!disposed&&owners.get(host)===owner&&host.isConnected&&transport.isCurrent();
 const dispose=()=>{disposed=true;clearInterval(watch);if(owners.get(host)===owner){owners.delete(host);host.replaceChildren();}};owner.dispose=dispose;
 const watch=setInterval(()=>{if(!alive())dispose();},250);
 const denied=e=>{if(e.message==='NO_AUTORIZADO'||!alive()){dispose();return true;}return false;};
 function show(message=''){
  if(!alive())return;
  const canDefine=state.capabilities.includes('DEFINE');
  const markup='<form class="lp-sale-definition"><label>Última definición de SALE<input name="quantity" type="number" min="0" step="1" inputmode="numeric" value="'+esc(state.quantity)+'" placeholder="Por definir" '+(!canDefine?'readonly':'')+'></label><label '+(!canDefine?'hidden':'')+'>Motivo<textarea name="observation" maxlength="2000" required></textarea></label><button '+(!canDefine?'hidden':'')+'>Guardar definición</button></form><p role="status" data-sale-message>'+esc(message)+'</p><small>Definición por orden guardada por separado. Uso entre turnos pendiente; no modifica Export.</small><button type="button" data-sale-refresh>Actualizar</button><button type="button" data-sale-retry hidden>Reintentar mismo guardado</button><details><summary>Historial · '+state.history.length+'</summary>'+state.history.map(e=>'<p>'+esc(e.at)+' · '+esc(e.user)+' · '+esc(e.before?.cantidad??'Sin definición')+' → '+e.quantity+'<br>'+esc(e.observation)+'</p>').join('')+'</details>';
  host.innerHTML=compact?'<details class="lp-sale-editor" '+(expanded?'open':'')+'><summary>'+esc(state.quantity??'Por definir')+' · '+(canDefine?'Editar':'Consultar')+'</summary><div class="lp-sale-editor-body">'+markup+'</div></details>':markup;
  if(compact)host.querySelector('.lp-sale-editor').ontoggle=e=>{expanded=e.currentTarget.open;};
  const form=host.querySelector('form'),status=host.querySelector('[data-sale-message]');
  const saving=on=>{busy=on;form.querySelectorAll('input,textarea,button').forEach(n=>n.disabled=on);host.querySelector('[data-sale-refresh]').disabled=on;};
  async function send(){
   saving(true);
   try{
    await transport.save(pending);if(!alive())return;pending=null;
    status.textContent='Definición guardada. No aplicada a turnos.';
    try{state=await transport.read();if(alive())show('Definición guardada. No aplicada a turnos.');}
    catch(e){if(!denied(e)){status.textContent='Definición guardada; no se pudo actualizar la lectura. Pulsa Actualizar.';form.querySelectorAll('input,textarea,button').forEach(n=>n.disabled=true);host.querySelector('[data-sale-refresh]').disabled=false;}}
   }catch(e){if(!denied(e)){if(e.confirmedRejected)pending=null;status.textContent=pending?'Resultado sin confirmar. Reintenta el mismo guardado.':e.message;host.querySelector('[data-sale-retry]').hidden=!pending;if(!pending)saving(false);}}
   finally{busy=false;}
  }
  form.onsubmit=event=>{
   event.preventDefault();if(busy||pending||!alive()||!canDefine)return;
   const quantity=Number(form.elements.quantity.value),observation=form.elements.observation.value.trim();
   if(form.elements.quantity.value===''||!Number.isSafeInteger(quantity)||quantity<0||!observation){status.textContent='Indica una cantidad entera y un motivo.';return;}
   if(state.source.available===null){status.textContent='Disponibilidad pendiente de validar.';return;}
   if(quantity>state.source.available){status.textContent='La cantidad supera la disponibilidad validada.';return;}
   pending={id:crypto.randomUUID(),quantity,revision:state.revision,sourceFingerprint:state.source.fingerprint,observation};void send();
  };
  host.querySelector('[data-sale-retry]').onclick=()=>{if(!busy&&pending&&alive())void send();};
  host.querySelector('[data-sale-refresh]').onclick=()=>{if(!busy&&!pending)void refresh();};
 }
 async function refresh(){
  if(busy||pending||!alive())return;busy=true;
  host.querySelectorAll('input,textarea,button').forEach(n=>n.disabled=true);
  try{state=await transport.read();if(alive())show();}
  catch(e){if(!denied(e)&&alive()){host.textContent='SALE por orden no disponible: '+e.message;const retry=document.createElement('button');retry.type='button';retry.textContent='Actualizar';retry.onclick=()=>void refresh();host.append(retry);}}
  finally{busy=false;}
 }
 host.textContent='Consultando definición de SALE…';await refresh();return dispose;
}
