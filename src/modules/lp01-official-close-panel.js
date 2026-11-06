import {readOfficialClose,submitOfficialClose} from './lp01-powerbi-client.js';
import {bytesBase64} from '../domain/powerbi/adapter.js';
import {availableFromOfficial} from '../domain/lp01-official-close.js';
const esc=v=>String(v??'No disponible').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/** One controller survives detail remounts, retaining uncertain requests unchanged. */
export function officialCloseController({getToken,read=readOfficialClose,submit=submitOfficialClose}){
 const pending=new Map();
 const key=context=>JSON.stringify([getToken(),context.stage,context.line,context.date,context.shift]);
 return {
  pending:context=>pending.has(key(context)),
  read:context=>read({token:getToken(),context}),
  async save(context,revision,input){
   const id=key(context);let request=pending.get(id);
   if(!request){const {action,key,quantity,priority,...payload}=input;request={token:getToken(),command:{...context,revision,id:crypto.randomUUID(),action,...(key===undefined?{}:{key,quantity,...(priority===undefined?{}:{priority})})},...payload};pending.set(id,request);}
   try{const result=await submit(request);pending.delete(id);return result;}
   catch(error){if(error.code!=='OFFICIAL_COMMIT_UNCERTAIN'&&error.code!=='FETCH_ERROR')pending.delete(id);throw error;}
  }
 };
}
export async function mountOfficialClosePanel({host,context,controller,isCurrent,onSaved=()=>{},definition=null}){
 const alive=()=>host.isConnected&&isCurrent();let view=null,busy=false;
 host.innerHTML='<h4>Cierre oficial · PDA / Export</h4><p>Realizado procede del Export. Las recargas reemplazan el total del mismo período y conservan las órdenes ausentes.</p><p data-status role="status">Consultando cierre persistente…</p><div data-controls></div><div data-history></div>';
 const status=host.querySelector('[data-status]'),controls=host.querySelector('[data-controls]'),history=host.querySelector('[data-history]');
 function draw(){
  const same=r=>['stage','line','date','shift'].every(k=>r[k]===context[k]);
  const entries=view.state.entries.filter(same),pending=view.state.pending.filter(same),closures=view.state.closures.filter(c=>same(c.context));
  let available={status:'UNDEFINED',quantity:null};if(definition)available=availableFromOfficial(view.state,definition);
  history.innerHTML=(definition?'<p>Disponible: '+esc(available.quantity)+' · '+esc(available.status)+'</p>':(view.availability||[]).length?'':'<p>Disponible: definición y base acreditada pendientes</p>')+'<table><thead><tr><th>Orden</th><th>Realizado oficial</th></tr></thead><tbody>'+entries.map(r=>'<tr><td>'+esc(r.key)+'</td><td>'+r.quantity+'</td></tr>').join('')+'</tbody></table><p>'+pending.length+' registros pendientes de conciliación</p>'+pending.map(r=>'<p>'+esc(r.production)+' · '+esc(r.reason)+'</p>').join('')+closures.map(c=>'<details><summary>Cierre '+c.version+' · '+esc(c.recordedAt)+'</summary><p>'+esc(c.observation)+'</p><table><tr><th>Orden</th><th>Plan al cierre</th><th>Realizado</th><th>Diferencia</th></tr>'+c.rows.map(r=>'<tr><td>'+esc(r.key)+'</td><td>'+esc(r.planned)+'</td><td>'+esc(r.realized)+'</td><td>'+esc(r.difference)+'</td></tr>').join('')+'</table></details>').join('');
  controls.innerHTML='<label>Export de '+esc(context.stage)+'<input type="file" accept=".xlsx" data-file></label><button data-import>Guardar Export</button><label>Observación del cierre<textarea data-note maxlength="4000"></textarea></label><button data-close '+(!entries.length||pending.length?'disabled':'')+'>Guardar cierre oficial</button><button data-retry '+(!controller.pending(context)?'hidden':'')+'>Reintentar la misma solicitud</button><button data-refresh>Recargar historial</button>';
  const projections=view.availability||[];
  history.insertAdjacentHTML('afterbegin','<h5>Disponible por orden</h5>'+projections.map(a=>'<p>'+esc(a.key)+' · '+esc(a.quantity)+' · '+esc(a.status)+' · definición '+esc(a.definitionId)+'</p>').join(''));
  const catalog=view.catalog||[],planned=new Set((view.plan?.rows||[]).map(r=>r.key));
  const other=catalog.filter(r=>!planned.has(r.key_produccion)&&r.saldos_inicializados===true&&r.presente_ultimo_export===true&&Number(r[context.stage==='ENSAMBLE'?'saldo_ensamble':'saldo_empaque'])>0);
  const options=rows=>rows.map(r=>'<option value="'+esc(r.key_produccion)+'">'+esc(r.produccion)+' · '+esc(r.sistema)+'</option>').join('');
  controls.insertAdjacentHTML('beforeend','<details><summary>Otras órdenes · '+other.length+'</summary><label>Orden<select data-other>'+options(other)+'</select></label><label>Cantidad<input data-other-quantity type="number" min="1" step="1"></label><label>Prioridad<input data-other-priority type="number" min="1" step="1"></label><label>Motivo<textarea data-other-reason></textarea></label><button data-incorporate '+(!other.length?'disabled':'')+'>Incorporar al turno</button></details>');
  if(['COORDINADOR','ADMINISTRADOR'].includes(view.role))controls.insertAdjacentHTML('beforeend','<details><summary>Definir Disponible</summary><label>Orden<select data-available-key>'+options(catalog)+'</select></label><label>Ventanas disponibles<input data-available-quantity type="number" min="0" step="1"></label><label>Motivo<textarea data-available-reason></textarea></label><button data-define>Guardar definición</button></details>');
  history.insertAdjacentHTML('beforeend','<details><summary>Incorporaciones e historial de Disponible</summary>'+[...(view.state.inclusions||[]),...(view.state.definitions||[])].map(r=>'<p>'+esc(r.recordedAt)+' · '+esc(r.actor)+' · '+esc(r.key)+' · '+r.quantity+' · '+esc(r.observation)+'</p>').join('')+'</details>');
  if(controller.pending(context))controls.querySelectorAll('input,textarea,select,[data-import],[data-close],[data-incorporate],[data-define]').forEach(e=>e.disabled=true);
  const save=async input=>{if(busy||!alive())return;busy=true;controls.querySelectorAll('button').forEach(b=>b.disabled=true);try{await controller.save(context,view.revision,input);if(!alive())return;status.textContent='Guardado confirmado. Actualizando historial…';await reload();await onSaved();}catch(error){if(alive()){status.textContent=error.message;draw();}}finally{busy=false;}};
  const workflow=(action,prefix)=>{const key=controls.querySelector('[data-'+prefix+(prefix==='other'?'':'-key')+']').value,raw=controls.querySelector('[data-'+prefix+'-quantity]').value,quantity=Number(raw),observation=controls.querySelector('[data-'+prefix+'-reason]').value.trim(),priority=prefix==='other'?Number(controls.querySelector('[data-other-priority]').value):undefined;if(!raw||!Number.isSafeInteger(quantity)||quantity<0||!observation){status.textContent='Completa cantidad y motivo';return;}save({action,key,quantity,priority,observation});};
  controls.querySelector('[data-incorporate]').onclick=()=>workflow('INCORPORATE','other');
  controls.querySelector('[data-define]')?.addEventListener('click',()=>workflow('DEFINE_AVAILABLE','available'));
  controls.querySelector('[data-import]').onclick=async()=>{const file=controls.querySelector('[data-file]').files[0];if(!file||file.size>2097152){status.textContent='Selecciona un XLSX de hasta 2 MB';return;}const bytes=new Uint8Array(await file.arrayBuffer());if(alive())await save({action:'IMPORT',filename:file.name,base64:bytesBase64(bytes)});};
  controls.querySelector('[data-close]').onclick=()=>{const observation=controls.querySelector('[data-note]').value.trim();if(!observation){status.textContent='Escribe la observación del cierre';return;}save({action:'CLOSE',observation});};
  controls.querySelector('[data-retry]').onclick=()=>save({});
  controls.querySelector('[data-refresh]').onclick=()=>reload();
 }
 async function reload(){try{const next=await controller.read(context);if(!alive())return;view=next;draw();status.textContent='Historial oficial consultado · '+context.date+' / T'+context.shift;}catch(error){if(alive())status.textContent='Cierre oficial no disponible: '+error.message;}}
 await reload();
}
