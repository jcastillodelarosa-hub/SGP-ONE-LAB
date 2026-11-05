const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const integer=v=>Number.isSafeInteger(v)&&v>=0;
/** Optional B12 contract; missing installation is visible, never saved locally as a proposal. */
export async function mountProposal(host,{rpc,scope,isCurrent,onDirty=()=>{}}){
 let data,pending,busy=false;
 const valid=r=>r?.contract==='LP-PROPOSAL-1'&&r.key===scope.key&&r.line===scope.line&&r.date===scope.date&&r.shift===scope.shift&&integer(r.revision);
 const call=cmd=>rpc('sgp_lp_propuesta_v1',{p_key:scope.key,p_linea:scope.line,p_fecha:scope.date,p_turno:scope.shift,p_cmd:cmd});
 const current=()=>host.isConnected&&isCurrent();
 host.textContent='Consultando propuesta…';
 try{
  data=await call(null);if(!current())return;
  if(!valid(data)||!Array.isArray(data.history)||!data.target?.date||![1,2].includes(data.target.shift))throw Error('CONTRATO_PROPUESTA_INVALIDO');
  const enabled=data.canWrite===true&&integer(data.available),last=data.history[0];
  host.innerHTML='<p>Propuesta para '+esc(data.target.date)+' / T'+data.target.shift+'. No modifica SALE ni el saldo Export; requiere validación del coordinador.</p><p>Disponibilidad acreditada: '+(integer(data.available)?data.available:'Por validar; no se suman causas ni se convierten piezas en ventanas')+'</p><label>Ventanas propuestas<input data-proposal-quantity type="number" min="0" step="1" value="'+esc(last?.quantity??'')+'" '+(!enabled?'disabled':'')+'></label><label>Observación<textarea data-proposal-note maxlength="2000" '+(!enabled?'disabled':'')+'>'+esc(last?.observation??'')+'</textarea></label><button type="button" data-proposal-save '+(!enabled?'disabled':'')+'>Guardar propuesta</button><p data-proposal-status role="status">'+(!data.canWrite?'Registro pendiente de habilitación autorizada.':'')+'</p><details><summary>Historial de propuestas</summary>'+data.history.map(h=>'<p>'+esc(h.at)+' · '+esc(h.user)+' · '+esc(h.quantity)+' ventanas · '+esc(h.observation)+'</p>').join('')+'</details>';
  host.querySelectorAll('input,textarea').forEach(el=>el.addEventListener('input',onDirty));
  const status=host.querySelector('[data-proposal-status]'),save=host.querySelector('[data-proposal-save]');
  save.onclick=async()=>{
   if(busy||!current())return;
   try{
    if(!pending){
     const raw=host.querySelector('[data-proposal-quantity]').value,n=Number(raw),observation=host.querySelector('[data-proposal-note]').value.trim();
     if(!/^(0|[1-9]\d*)$/.test(raw)||!integer(n)||n>data.available||!observation)throw Error('Indica una cantidad dentro de la disponibilidad acreditada y una observación');
     pending={id:crypto.randomUUID(),revision:data.revision,quantity:n,observation};
    }
    busy=true;save.disabled=true;host.querySelectorAll('input,textarea').forEach(e=>e.disabled=true);
    const result=await call(pending);if(!current())return;
    if(!valid(result)||result.id!==pending.id)throw Error('RESPUESTA_NO_CONFIRMADA');
    pending=null;await mountProposal(host,{rpc,scope,isCurrent,onDirty});
    if(current())host.querySelector('[data-proposal-status]').textContent='Propuesta guardada; SALE no ha cambiado.';
   }catch(error){if(current()){if(error.code==='P0001'){pending=null;await mountProposal(host,{rpc,scope,isCurrent,onDirty});if(current())host.querySelector('[data-proposal-status]')?.append(document.createTextNode(error.message));return;}status.textContent=error.message;save.textContent=pending?'Reintentar la misma propuesta':'Guardar propuesta';save.disabled=false;}}
   finally{busy=false;}
  };
 }catch(error){if(current())host.textContent='Propuesta del siguiente turno no disponible: '+error.message+'. No se ha registrado ninguna propuesta.';}
}
