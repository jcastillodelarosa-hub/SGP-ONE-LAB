import {affectationSummary} from '../domain/lp01-affectation-summary.js';
import {pendingCompact} from './lp01-pending-compact.js';
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
  const summary=affectationSummary(snapshot);
  host.innerHTML='<h3>Afectaciones por orden</h3><p>'+esc(snapshot.key)+' · '+esc(snapshot.stage)+'</p><p>Ventanas distintas afectadas: <b>'+esc(summary.total??'Pendiente de validar')+'</b> · Disponibles: <b>'+esc(summary.available??'Pendiente de validar')+'</b></p><p>Las causas pueden coincidir. Solución en origen y recepción física se registran por separado.</p><div class="lp-affect-reports">'+snapshot.reports.map(r=>'<article><h4>'+esc(r.cause)+'</h4><p>'+r.quantity+' afectadas · '+r.solved+' solucionadas · '+r.confirmed+' confirmadas físicamente</p><small>'+esc(r.originStage)+' · '+esc(r.originDate)+' / T'+r.originShift+' · '+esc(r.createdBy)+'</small></article>').join('')+'</div><form><label>Acción<select name="action">'+Object.entries(actions).filter(([,v])=>snapshot.capabilities.includes(v[0])).map(([k,v])=>'<option value="'+k+'">'+v[1]+'</option>').join('')+'</select></label><label data-report>Reporte<select name="reportId">'+snapshot.reports.map(r=>'<option value="'+esc(r.id)+'">'+esc(r.cause)+' · '+esc(r.originDate)+' · '+esc(r.id)+'</option>').join('')+'</select></label><label data-cause>Causa<select name="cause"><option value="">Selecciona una causa</option><option>NC_AL</option><option>NC_V</option><option>TECNO</option><option>NOVEDAD</option></select></label><fieldset data-aluminum hidden disabled></fieldset><label>Cantidad de ventanas<input name="quantity" type="number" min="0" step="1" required></label><label>Observación<textarea name="observation" maxlength="2000" required></textarea></label><button type="submit">Guardar</button></form><p role="status" data-result></p><button type="button" data-reload>Actualizar datos</button><details data-affect-history><summary>Historial autorizado de la producción · contexto '+esc(snapshot.stage)+'</summary>'+snapshot.events.map(e=>'<article><b>'+esc(actions[e.action]?.[1]??e.action)+' · '+e.quantity+'</b><p>'+esc(e.date)+' / T'+e.shift+' · '+esc(e.user)+' · '+esc(e.stage)+'</p><p>'+esc(e.observation)+'</p></article>').join('')+'</details>';
  const form=host.querySelector('form'),status=host.querySelector('[data-result]');
  {const section=document.createElement('section');section.className='lp-aluminum-pending';const pending=snapshot.aluminumPending??snapshot.pickingPending;
   section.innerHTML='<h4>Pendientes de aluminio</h4>'+(!snapshot.aluminumPending?'<p>El lector aún no incluye todos los orígenes; se muestran los Picking disponibles.</p>':'')+(!pending||pending.status!=='AVAILABLE'?'<p>Consulta no disponible para esta sesión.</p>':pendingCompact(pending.rows));host.querySelector('form').before(section);
   const entries=[...section.querySelectorAll('[data-pdt-nc]')],cache=new Map();let cursor=0;
   void Promise.all(Array.from({length:Math.min(3,entries.length)},async()=>{while(cursor<entries.length&&alive()&&section.isConnected){const entry=entries[cursor++],ref=entry.dataset.pdtNc;
    if(!cache.has(ref))cache.set(ref,transport.lookupNc?transport.lookupNc(ref):Promise.resolve(null));
    try{const state=await cache.get(ref);if(alive()&&entry.isConnected)entry.textContent=state??'No disponible';}
    catch(error){if(denied(error))return;if(alive()&&entry.isConnected)entry.textContent='No disponible';}
   }}));
  }
  if(snapshot.capabilities.includes('RECONCILE')&&transport.legacy&&transport.reconcile){
   const section=document.createElement('section');section.innerHTML='<button type="button" data-legacy-load>Conciliar historial anterior</button><div data-legacy-content></div>';host.querySelector('[data-affect-history]').before(section);
   section.querySelector('button').onclick=async()=>{
    if(busy)return;busy=true;const box=section.querySelector('[data-legacy-content]');box.textContent='Consultando registros anteriores…';
    try{const legacy=await transport.legacy();if(!alive())return;
     box.innerHTML='<p>Relaciona cada registro anterior con las afectaciones existentes. No se copiarán ni sumarán registros.</p><form data-legacy-form>'+legacy.sources.map((source,i)=>'<fieldset><legend>'+esc(source.cause)+' · '+source.quantity+' ventanas</legend><small>'+esc(source.assignment)+' · '+esc(source.date)+' / T'+source.shift+'</small><label>Reportes relacionados<select multiple required data-legacy-reports="'+i+'">'+snapshot.reports.filter(r=>source.cause==='__UNION__'||r.cause===source.cause).map(r=>'<option value="'+esc(r.id)+'">'+esc(r.cause)+' · '+r.quantity+' ventanas · '+esc(r.id)+'</option>').join('')+'</select></label><label>Evidencia de la relación<textarea required maxlength="2000" data-legacy-evidence="'+i+'"></textarea></label></fieldset>').join('')+'<label>Observación del cotejo<textarea required maxlength="2000" name="observation"></textarea></label><button type="submit">Guardar conciliación</button><p role="status" data-legacy-result></p></form>';
     const form=box.querySelector('form');let last;
     form.onsubmit=async event=>{event.preventDefault();if(busy||!alive())return;const mappings=legacy.sources.map((source,i)=>({sourceId:source.id,reportIds:[...form.querySelector('[data-legacy-reports="'+i+'"]').selectedOptions].map(o=>o.value),evidence:form.querySelector('[data-legacy-evidence="'+i+'"]').value})),observation=form.elements.observation.value,signature=JSON.stringify([legacy,mappings,observation]);if(last?.signature!==signature)last={signature,id:crypto.randomUUID()};busy=true;const button=form.querySelector('button'),status=form.querySelector('[data-legacy-result]');button.disabled=true;
      try{await transport.reconcile({id:last.id,snapshot:legacy,mappings,observation});snapshot=await transport.read();show();}
      catch(error){if(!denied(error)&&alive())status.textContent=error.message;}
      finally{busy=false;if(button.isConnected)button.disabled=false;}
     };
    }catch(error){if(!denied(error)&&alive())box.textContent=error.message;}finally{busy=false;}
   };
  }
  if(snapshot.progress){const section=document.createElement('section');section.className='lp-affect-progress';section.innerHTML='<h4>Avances por proceso</h4>'+Object.entries(snapshot.progress).map(([stage,p])=>'<h5>'+esc(stage)+'</h5><p>Abierta desde: '+esc(p.opening?p.opening.date+' / T'+p.opening.shift:'No disponible')+'</p>'+p.events.map(e=>'<p>'+esc(e.date)+' / T'+e.shift+' · '+esc(e.assignment)+' · '+e.quantity+' unidades registradas · '+esc(e.observation)+'</p>').join('')).join('');host.querySelector('[data-affect-history]').before(section);}

  form.hidden=!snapshot.capabilities.some(c=>Object.values(actions).some(a=>a[0]===c));
  let aluminumMounted=false,editorMounted=false,aluminumEditor,aluminumValid=false;
  const update=()=>{const a=form.elements.action.value;host.querySelector('[data-report]').hidden=['CREATE','VALIDATE'].includes(a);host.querySelector('[data-cause]').hidden=a!=='CREATE';
   const aluminum=a==='CREATE'&&form.elements.cause.value==='NC_AL',box=host.querySelector('[data-aluminum]');box.hidden=!aluminum;box.disabled=!aluminum;
   if(aluminum&&!aluminumMounted){aluminumMounted=true;box.innerHTML='<p>'+ (snapshot.capabilities.includes('REPORT_ALUMINUM')?'Usa el pendiente original de Picking cuando corresponda. Indica por separado cuántas ventanas están afectadas.':'El registro de aluminio no está habilitado para esta sesión. No se guardará una afectación separada.')+'</p><label>Pendiente de aluminio<select name="aluminumSource"><option value="">Selecciona el origen</option>'+((snapshot.pickingPending?.rows)||[]).filter(p=>p.contract==='V2').map(p=>'<option value="'+esc(p.id)+'" '+(p.linked?'disabled':'')+'>'+esc(p.reference)+' · '+esc(p.fabrication)+' · '+esc(p.length)+' · Picking'+(p.linked?' · Ya asociado':'')+'</option>').join('')+'<option value="new">Registrar un nuevo pendiente</option></select></label><fieldset data-pdt-draft hidden disabled></fieldset>';form.elements.aluminumSource.onchange=update;}
   const source=form.elements.aluminumSource?.value||'',draft=box.querySelector('[data-pdt-draft]');
   if(draft){draft.hidden=source!=='new';draft.disabled=source!=='new';}
   if(aluminum&&source==='new'&&!editorMounted){editorMounted=true;transport.mountAluminumDraft?.(draft,valid=>{aluminumValid=valid;if(alive())update();}).then(editor=>{aluminumEditor=editor;});}
   form.querySelector('button[type="submit"]').disabled=(aluminum&&(!snapshot.capabilities.includes('REPORT_ALUMINUM')||!source||(source==='new'&&!aluminumValid)))||(a==='CREATE'&&!form.elements.cause.value);
  };
  form.elements.action.onchange=update;form.elements.cause.onchange=update;update();
  form.onsubmit=async e=>{
   e.preventDefault();if(busy||!alive()||form.querySelector('button[type="submit"]').disabled)return;
   const fields=Object.fromEntries(new FormData(form)),payload={action:fields.action,revision:snapshot.revision,quantity:Number(fields.quantity),observation:fields.observation};
   if(payload.action==='CREATE'){payload.cause=fields.cause;if(fields.cause==='NC_AL'){if(!snapshot.capabilities.includes('REPORT_ALUMINUM'))return;if(fields.aluminumSource==='new'){if(!aluminumEditor||!aluminumValid)return;payload.pieces=aluminumEditor.value();}else if(fields.aluminumSource){payload.sourcePicking=fields.aluminumSource;}else return;}}
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
