import {parsePowerBI,selectedPowerBI} from '../domain/powerbi/adapter.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const qty=v=>Number.isSafeInteger(v)&&v>=0;
const same=(a,b)=>['stage','line','date','shift'].every(k=>a?.[k]===b?.[k]);
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/i.test(v);
/** A close receipt is authoritative even when the subsequent report read fails. */
export function acceptCloseReceipt(state,result,context,commandId){
 if(result?.ok!==true)throw Error('Cierre sin confirmación del servidor');
 state.confirmedClose={context:{...context},commandId,result};state.busy=false;state.uncertain=false;
 return state.confirmedClose;
}
export function closeReadbackPending(state,context){
 return Boolean(state?.confirmedClose&&same(state.confirmedClose.context,context)||state?.closeCheckRequired&&same(state.closeCheckRequired,context));
}
export function exportCloseEnabled(data,context){
 const cap=data?.exportClose;
 return data?.contract==='LP-OPERACION-1'&&data.writeContract==='LP-OPERACION-CAS-2'&&data.writes===true&&
  qty(data.turn?.revision)&&['ABIERTO','EN_REVISION'].includes(data.turn?.estado)&&['ENSAMBLE','EMPAQUE'].includes(context?.stage)&&
  ['LP-EXPORT-DUAL-1','LP-EXPORT-HISTORICAL-1'].includes(cap?.writerScope)&&cap.contract==='LP-EXPORT-CLOSE-4'&&cap.authority==='EXPORT_PRODUCTION_V2'&&cap.enabled===true&&cap.canImport===true&&cap.canClose===true&&same(cap,context);
}
export function confirmedImport(receipt,data,context){
 if(!exportCloseEnabled(data,context)||receipt?.ok!==true||receipt.writerScope!==data.exportClose.writerScope||receipt.contract!=='LP-EXPORT-IMPORT-3'||receipt.authority!=='EXPORT_PRODUCTION_V2'||
  receipt.turnRevision!==data.turn.revision||!same(receipt.universe,context)||!hash(receipt.sha256)||!hash(receipt.universeRevision)||
  typeof receipt.fileId!=='string'||!receipt.fileId||typeof receipt.importId!=='string'||!receipt.importId||!Array.isArray(receipt.rows)||!receipt.rows.length)return null;
 const seen=new Set();
 for(const r of receipt.rows){
  if(typeof r.key!=='string'||!r.key.endsWith('|'+context.line)||seen.has(r.key)||!['PRESENT','ABSENT'].includes(r.coverage)||!(r.quantity===null||qty(r.quantity))||
   (r.coverage==='PRESENT'&&(!qty(r.quantity)||r.valueStatus!=='CURRENT_FILE'))||
   (r.coverage==='ABSENT'&&!(r.valueStatus==='PRESERVED'&&qty(r.quantity)||r.valueStatus==='NEVER_REPORTED'&&r.quantity===null))||
   (r.pendingAgainstPlan!==undefined&&r.pendingAgainstPlan!==null&&!qty(r.pendingAgainstPlan)))return null;
  seen.add(r.key);
 }
 return receipt;
}
export function exportCloseCommand(receipt,data,context,reasons,observation){
 const valid=confirmedImport(receipt,data,context);if(!valid)throw Error('Importa el archivo nuevamente: el recibo ya no corresponde a la revisión del turno.');
 const clean={};for(const row of valid.rows){const reason=String(reasons[row.key]??'').trim();if((row.coverage==='ABSENT'||row.pendingAgainstPlan>0||row.reasonRequired===true)&&!reason)throw Error('Indica el motivo de las producciones ausentes o pendientes.');if(reason.length>2000)throw Error('El motivo excede 2000 caracteres.');if(reason)clean[row.key]=reason;}
 if(typeof observation!=='string'||observation.length>4000||!observation.trim())throw Error('Escribe la observación del cierre.');
 return {close_authority:'EXPORT_PRODUCTION_V2',close_contract:'LP-EXPORT-CLOSE-4',file_id:valid.fileId,import_id:valid.importId,reasons:clean,observation:observation.trim()};
}
/** State belongs to controller/session/scope, never localStorage. Server validates original and freezes plan. */
export function mountExportCloseEditor({host,data,context,state,onImport,onClose,onRetry,isCurrent}){
 if(closeReadbackPending(state,context)||!exportCloseEnabled(data,context)||!onImport||!onClose)return null;
 const section=document.createElement('section');section.className='lp-close';section.dataset.exportCloseEditor='';host.append(section);
 const receipt=confirmedImport(state.receipt,data,context);
 section.innerHTML='<h4>Archivo Export del turno</h4><p>La carga parcial reemplaza solo lo informado. Lo ausente conserva el último valor acreditado; nunca informado no equivale a cero.</p><label>Archivo de '+esc(context.stage)+'<input type="file" accept=".xlsx" data-export-file></label><div data-export-local role="status"></div><button type="button" data-export-import>Validar y guardar archivo</button>'+(receipt?'<p>Archivo confirmado · '+esc(receipt.sha256)+'</p>'+receipt.rows.map(r=>'<label><b>'+esc(r.key)+'</b> · '+(r.quantity===null?'Nunca informado':r.quantity+' ventanas')+' · '+esc(r.valueStatus)+'<input data-export-reason="'+esc(r.key)+'" placeholder="Motivo'+(r.coverage==='ABSENT'||r.pendingAgainstPlan>0?' obligatorio':' / observación')+'" value="'+esc(state.reasons?.[r.key])+'"></label>').join('')+'<label>Observación del cierre<textarea data-export-observation maxlength="4000">'+esc(state.observation)+'</textarea></label><button type="button" data-export-confirm>Confirmar cierre del turno</button>':'<p>Primero guarda el archivo para revisar el resultado acreditado por el servidor.</p>')+'<button type="button" data-export-retry>Reintentar la misma operación</button><p data-export-status role="status"></p>';
 const get=s=>section.querySelector(s),status=get('[data-export-status]');
 const alive=()=>section.isConnected&&isCurrent();
 const paint=()=>{section.querySelectorAll('input,textarea,button').forEach(el=>el.disabled=Boolean(state.busy||state.uncertain));get('[data-export-import]').disabled=Boolean(state.busy||state.uncertain||!state.file);get('[data-export-retry]').hidden=!state.uncertain;get('[data-export-retry]').disabled=Boolean(state.busy);};
 const run=async fn=>{if(!alive()||state.busy||closeReadbackPending(state,context))return;state.busy=true;paint();status.textContent='Procesando…';try{await fn();if(alive())status.textContent='Confirmado por el servidor.';}catch(e){state.uncertain=e.uncertain===true;if(alive())status.textContent=e.message;}finally{state.busy=false;if(alive())paint();}};
 get('[data-export-file]').onchange=async()=>{
  const file=get('[data-export-file]').files[0];state.file=null;state.busy=true;paint();
  try{if(!file||file.size>2097152||!/\.xlsx$/i.test(file.name))throw Error('Selecciona un XLSX de hasta 2 MiB.');
   const raw=new Uint8Array(await file.arrayBuffer()),parsed=await parsePowerBI(raw);if(parsed.stage!==context.stage)throw Error('El archivo corresponde a otra etapa.');
   const rows=selectedPowerBI(parsed,context);let binary='';for(let i=0;i<raw.length;i+=32768)binary+=String.fromCharCode(...raw.subarray(i,i+32768));
   if(!alive())return;state.file={filename:file.name,base64:btoa(binary)};get('[data-export-local]').textContent=file.name+' · '+rows.length+' producciones. Vista previa local; aún no guardado.';
  }catch(e){if(alive())status.textContent=e.message;}finally{state.busy=false;if(alive())paint();}
 };
 get('[data-export-import]').onclick=()=>run(()=>onImport({authority:'EXPORT_PRODUCTION_V2',...state.file}));
 section.querySelectorAll('[data-export-reason]').forEach(input=>input.oninput=()=>{state.reasons??={};state.reasons[input.dataset.exportReason]=input.value;});
 const observation=get('[data-export-observation]');if(observation)observation.oninput=()=>{state.observation=observation.value;};
 get('[data-export-confirm]')?.addEventListener('click',()=>run(()=>onClose(exportCloseCommand(state.receipt,data,context,state.reasons||{},state.observation||''))));
 get('[data-export-retry]').onclick=()=>run(onRetry);paint();
 return {canLeave:()=>!state.busy&&!state.uncertain,destroy:()=>section.remove()};
}
