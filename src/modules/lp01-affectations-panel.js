/** Isolated panel contract. transport must provide scoped read/command; no production RPC fallback. */
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mounts=new WeakMap();
const actions={CREATE:['REPORT','Registrar afectación'],CORRECT:['REPORT','Corregir cantidad total'],SOLVE:['SOLVE','Registrar solución parcial'],CONFIRM:['CONFIRM','Confirmar recepción física'],VALIDATE:['VALIDATE','Validar consolidado']};
export async function mountAffectationsPanel(host,transport){
 let disposed=false,busy=false,snapshot,retry;
 const token={};mounts.set(host,token);const alive=()=>!disposed&&mounts.get(host)===token;
 const denied=error=>{if(error.message==='NO_AUTORIZADO'&&alive()){disposed=true;host.textContent='Acceso revocado. Vuelve a ingresar con una sesión autorizada.';return true;}return false;};
 host.innerHTML='<p role="status">Cargando afectaciones…</p>';
 const show=()=>{
  if(!alive())return;
  host.innerHTML='<h3>Afectaciones por orden</h3><p>'+esc(snapshot.key)+' · '+esc(snapshot.stage)+'</p><p>Ventanas distintas afectadas: <b>'+esc(snapshot.consolidated?.quantity??'Pendiente de validar')+'</b> · Disponibles: <b>'+esc(snapshot.available??'No disponible')+'</b></p><p>Las causas pueden coincidir. Solución en origen y recepción física se registran por separado.</p><div class="lp-affect-reports">'+snapshot.reports.map(r=>'<article><h4>'+esc(r.cause)+'</h4><p>'+r.quantity+' afectadas · '+r.solved+' solucionadas · '+r.confirmed+' confirmadas físicamente</p><small>'+esc(r.originStage)+' · '+esc(r.originDate)+' / T'+r.originShift+' · '+esc(r.createdBy)+'</small></article>').join('')+'</div><form><label>Acción<select name="action">'+Object.entries(actions).filter(([,v])=>snapshot.capabilities.includes(v[0])).map(([k,v])=>'<option value="'+k+'">'+v[1]+'</option>').join('')+'</select></label><label data-report>Reporte<select name="reportId">'+snapshot.reports.map(r=>'<option value="'+esc(r.id)+'">'+esc(r.cause)+' · '+esc(r.originDate)+' · '+esc(r.id)+'</option>').join('')+'</select></label><label data-cause>Causa<select name="cause"><option value="">Selecciona una causa</option><option>NC_AL</option><option>NC_V</option><option>TECNO</option><option>NOVEDAD</option></select></label><fieldset data-aluminum hidden disabled></fieldset><label>Cantidad de ventanas<input name="quantity" type="number" min="0" step="1" required></label><label>Observación<textarea name="observation" maxlength="2000" required></textarea></label><button type="submit">Guardar</button></form><p role="status" data-result></p><button type="button" data-reload>Actualizar datos</button><details><summary>Historial autorizado de la producción · contexto '+esc(snapshot.stage)+'</summary>'+snapshot.events.map(e=>'<article><b>'+esc(actions[e.action]?.[1]??e.action)+' · '+e.quantity+'</b><p>'+esc(e.date)+' / T'+e.shift+' · '+esc(e.user)+' · '+esc(e.stage)+'</p><p>'+esc(e.observation)+'</p></article>').join('')+'</details>';
  const form=host.querySelector('form'),status=host.querySelector('[data-result]');
  if(snapshot.progress){const section=document.createElement('section');section.className='lp-affect-progress';section.innerHTML='<h4>Avances por proceso</h4>'+Object.entries(snapshot.progress).map(([stage,p])=>'<h5>'+esc(stage)+'</h5><p>Abierta desde: '+esc(p.opening?p.opening.date+' / T'+p.opening.shift:'No disponible')+'</p>'+p.events.map(e=>'<p>'+esc(e.date)+' / T'+e.shift+' · '+esc(e.assignment)+' · '+e.quantity+' unidades registradas · '+esc(e.observation)+'</p>').join('')).join('');host.querySelector('details').before(section);}

  form.hidden=!snapshot.capabilities.some(c=>Object.values(actions).some(a=>a[0]===c));
  let aluminumMounted=false;
  const update=()=>{const a=form.elements.action.value;host.querySelector('[data-report]').hidden=['CREATE','VALIDATE'].includes(a);host.querySelector('[data-cause]').hidden=a!=='CREATE';
   const aluminum=a==='CREATE'&&form.elements.cause.value==='NC_AL',box=host.querySelector('[data-aluminum]');box.hidden=!aluminum;box.disabled=!aluminum;
   form.querySelector('button[type="submit"]').disabled=aluminum||(a==='CREATE'&&!form.elements.cause.value);
   if(aluminum&&!aluminumMounted){aluminumMounted=true;box.innerHTML='<p>NC aluminio requiere su registro en Pendientes de Aluminio. El vínculo seguro aún no está habilitado; no se puede guardar una afectación separada.</p><div data-pdt-draft></div>';transport.mountAluminumDraft?.(box.querySelector('[data-pdt-draft]'));}
  };
  form.elements.action.onchange=update;form.elements.cause.onchange=update;update();
  form.onsubmit=async e=>{
   e.preventDefault();if(busy||!alive()||form.querySelector('button[type="submit"]').disabled)return;
   const fields=Object.fromEntries(new FormData(form)),payload={action:fields.action,revision:snapshot.revision,quantity:Number(fields.quantity),observation:fields.observation};
   if(payload.action==='CREATE')payload.cause=fields.cause;
   else if(payload.action!=='VALIDATE')payload.reportId=fields.reportId;
   const signature=JSON.stringify(payload);if(retry?.signature!==signature)retry={signature,id:crypto.randomUUID()};
   busy=true;form.querySelector('button[type="submit"]').disabled=true;status.textContent='Guardando…';
   try{await transport.command({...payload,id:retry.id});if(!alive())return;snapshot=await transport.read();if(!alive())return;retry=null;show();host.querySelector('[data-result]').textContent='Guardado';}
   catch(error){if(!denied(error)&&alive())status.textContent=error.message==='REVISION_DESACTUALIZADA'?'La orden cambió. Conserva tu observación y actualiza los datos antes de corregir.':error.message;}
   finally{busy=false;if(alive()&&form.isConnected)update();}
  };
  host.querySelector('[data-reload]').onclick=async()=>{if(busy)return;busy=true;try{snapshot=await transport.read();retry=null;show();}catch(error){if(!denied(error)&&alive())status.textContent=error.message;}finally{busy=false;}};
 };
 try{snapshot=await transport.read();show();}catch(error){if(!denied(error)&&alive())host.textContent='Afectaciones no disponibles: '+error.message;}
 return ()=>{if(alive())host.replaceChildren();disposed=true;};
}
