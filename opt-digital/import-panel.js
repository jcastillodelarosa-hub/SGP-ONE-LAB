import {mountOptImportRecovery} from './import-recovery-panel.js';
import {optFileSelectionState} from '../src/domain/opt-file-selection-state.js';
import {optImportOutcomeKind} from '../src/services/opt-import-observation.js';
import {selectProgrammedFiles} from './import-selection.js';
import {fileIdentity} from './library.js';
export function importRoundingWarning(result){
 return Array.isArray(result?.validationWarnings)&&result.validationWarnings.some(w=>w?.code==='OPT_PRINTED_ROUNDING_COMPATIBLE')
  ?'Advertencia: totales compatibles con redondeo de 1/32 de pulgada. Se conservan las medidas impresas; no se acredita la precisión original del programa. No confirma cortes realizados.':'';
}
export function importFailureMessage(error){
 const messages={OPT_RETAIL_TIEMPO_AGOTADO:'La operación Retail superó el tiempo permitido. Espera a que termine la actividad de programación y vuelve a iniciar la carga manualmente.',OPT_CONTEXTO_OCUPADO:'La programación está siendo actualizada. Espera a que termine esa operación antes de iniciar la carga manualmente.'};
 // A previous uncertain attempt cannot be cleared by a later confirmed rejection.
 if(error.uncertain&&messages[error.message])return 'Este intento fue rechazado, pero una carga anterior sigue sin confirmar. Verifica su estado antes de volver a enviar los archivos.';
 return messages[error.message]||error.message;
}
// Originals are retained in memory/the existing PDF library, never inferred from extraction.
export function mountOptImportPanel(container,{api,getScope,getProgrammingSnapshot=()=>null,getOrigin,getEntries,getRecords,onImported=()=>{}}){
 const make=(tag,text)=>{const element=container.ownerDocument.createElement(tag);if(text)element.textContent=text;return element;};
 const panel=make('section');panel.id='optImportPanel';panel.className='panel';
 const button=make('button','Procesar y guardar OPT en SGP');button.id='optImportProcess';button.type='button';
 const status=make('p');status.id='optImportStatus';status.setAttribute('role','status');
 const pendingNotice=make('p');pendingNotice.id='optImportPending';
 const results=make('div');results.id='optImportResults';results.setAttribute('aria-live','polite');
 panel.append(make('h2','Crear OPT compartidas'),make('p','Al pulsar Procesar y guardar OPT en SGP, se envían el PDF original y su índice a Supabase para validarlos contra la programación y crear las OPT compartidas. Retail y Proyecto incluyen solo las OPT con alguna reserva y sistema en la programación consultada de PANELES_2. Un PDF mixto se envía completo, junto con el índice original sin recortar. Esta selección no autoriza la importación. Los individuales se validan con su PDF y SGP. No se envían revisiones, planes ni asociaciones locales. Esto no registra cortes realizados. Perfil acotado: PDF de hasta 1 MiB y 100 páginas; índice de hasta 3 MiB. Los documentos que excedan estos límites se rechazan completos, sin dividirlos ni importar unidades parciales.'),button,status,pendingNotice,results);container.append(panel);
 const selection=make('section');selection.id='optSelectedOrigin';selection.append(make('h3','Origen seleccionado'));
 const selectionNote=make('p','Sin archivos seleccionados. Seleccionar o leer un archivo no significa guardarlo en SGP.'),selectionTable=make('table'),selectionBody=make('tbody'),selectionHead=make('thead'),selectionRow=make('tr');selectionTable.className='opt-file-table';for(const label of ['Nombre / ruta relativa','Estado','Resultado'])selectionRow.append(make('th',label));selectionHead.append(selectionRow);selectionTable.append(selectionHead,selectionBody);selection.append(selectionNote,selectionTable);panel.prepend(selection);
 const verify=make('button','Comprobar cargas anteriores sin reenviar');verify.id='optImportReconcile';verify.type='button';const verification=make('div');verification.id='optImportReconciliation';verification.setAttribute('role','status');pendingNotice.after(verify,verification);
 const recovery=mountOptImportRecovery(panel,{api,getScope,onImported});
 const selectedFiles=new Map(),fileStates=new Map(),indexSelections=new Map();
 const reasonLabels={CONTEXT_REQUIRED:'Falta índice o programación',PENDING_OUTCOME:'Bloqueado por resultado anterior incierto',EXACT_NAME_MISSING:'Excluido: sin nombre exacto en el índice',OUTSIDE_PROGRAMMING:'Omitido: fuera de programación',DUPLICATE_NAME:'Bloqueado: nombre duplicado',CANDIDATE:'Candidato exacto; no guardado'};
 function renderSelection(){
  const chosen=selectedFiles.get(getOrigin())||[];selectionBody.replaceChildren();selectionNote.textContent=`${getOrigin()||'Selecciona origen'} · ${chosen.length} PDF seleccionados en este navegador. Seleccionado ≠ guardado. El PDF original no se archiva en SGP.`;
  const idx=indexSelections.get(getOrigin());if(idx){const state=optFileSelectionState({file:idx.file,available:true,localOutcome:idx.localOutcome});selectionNote.textContent+=` Índice: ${state.location} · ${state.labels.local}; no acredita guardado en SGP.${idx.error?' '+idx.error:''}`;}
  for(const item of chosen){const progress=fileStates.get(item.file)||{},state=optFileSelectionState({file:item.file,available:true,...progress}),row=make('tr');
   [state.location,state.labels.selection+' · '+state.labels.local,progress.serverOutcome&&progress.serverOutcome!=='not_sent'?state.labels.server:[state.labels.server,reasonLabels[item.reason]].filter(Boolean).join(' · ')].forEach((text,i)=>{const cell=make('td',text);cell.dataset.label=['Nombre / ruta relativa','Estado','Resultado'][i];row.append(cell);});selectionBody.append(row);}
  selectionTable.hidden=!chosen.length;
 }
 function setFileOutcome(file,serverOutcome){if(file){fileStates.set(file,{...(fileStates.get(file)||{}),serverOutcome});renderSelection();}}
 const originals=new Map(),indexes=new Map();let closed=false,busy=false,epoch=0,capturing=0,lastScope='';
 const scopeKey=()=>{const s=getScope();return s?JSON.stringify([s.linea,s.anio,s.semana,s.modo]):'';};
 function programming(){const current=getScope(),snapshot=getProgrammingSnapshot();return current?.linea==='PANELES_2'&&snapshot?.status==='READY'&&Array.isArray(snapshot.relations)&&['linea','anio','semana','modo'].every(key=>snapshot.scope?.[key]===current[key])?snapshot:null;}
 function availability(){renderSelection();const pending=api?.pending?.();verify.hidden=!pending?.length;verify.disabled=closed||busy||capturing>0||!api?.reconcilePending;pendingNotice.textContent=pending===null?'No se pudo leer el registro de cargas anteriores. No se enviarán archivos hasta que esté disponible.':pending?.length?'Cargas anteriores sin confirmar. Verifica su estado antes de reintentar; conserva los originales y ámbito: '+pending.map(p=>`${p.pdf?.name} · ${p.source?.origin} · ${p.scope?.semana}/${p.scope?.anio} · índice ${p.index?.name||'no corresponde'}`).join('; ')+'. Pueden haberse guardado en SGP.':'';button.disabled=closed||busy||capturing>0||!api||getScope()?.linea!=='PANELES_2'||!['RETAIL','PROYECTO','INDIVIDUAL'].includes(getOrigin())||getOrigin()!=='INDIVIDUAL'&&!programming();if(!busy&&!status.textContent)status.textContent=!api?'La carga compartida no está disponible. Puedes conservar y revisar los archivos localmente.':'Consulta PANELES_2 y selecciona Retail, Proyecto o individual. Los originales no se envían hasta pulsar el botón.';}
 function invalidate(message='Selección cambiada. Revisa el origen y los archivos antes de procesar.'){
  epoch++;api?.invalidate();recovery.invalidate();results.replaceChildren();verification.replaceChildren();status.textContent=busy?'Cambió el contexto durante la carga. Una petición ya enviada puede haberse guardado. Consulta su estado antes de reintentar y conserva exactamente el mismo PDF, índice, origen y ámbito.':message;availability();
 }
 async function captureFiles(files,origin){
  if(!selectedFiles.has(origin))selectedFiles.set(origin,files.map(file=>({file})));renderSelection();
  capturing++;availability();
  try{for(const file of files){if(!/\.pdf$/i.test(file.name)||typeof file.arrayBuffer!=='function')continue;try{const hash=await fileIdentity(file);if(closed)return;originals.set(JSON.stringify([origin,file.name,hash]),{file,origin,name:file.name,hash});}catch(error){if(!closed)status.textContent=file.name+': no se conservó el original para enviar: '+error.message;}}}
  finally{capturing--;availability();}
 }
 function availableFiles(origin){
  const found=new Map([...originals].filter(([,item])=>item.origin===origin));
  for(const record of getRecords()){
   if(record.format!=='pdf'||!record.file||typeof record.file.arrayBuffer!=='function')continue;
   for(const source of record.sources?.length?record.sources:[{origin:'UNKNOWN',mode:'INDIVIDUAL',name:record.name}]){
    const own=source.mode==='INDIVIDUAL'?'INDIVIDUAL':source.origin;if(own!==origin)continue;
    const name=source.name||record.name,key=JSON.stringify([origin,name,record.key]);
    if(!found.has(key))found.set(key,{origin,name,hash:record.key,file:{name,size:record.file.size,arrayBuffer:()=>record.file.arrayBuffer()}});
   }
  }
  return [...found.values()];
 }
 function jobsFor(origin){
  const files=availableFiles(origin);
  if(origin==='INDIVIDUAL')return {jobs:files.map(item=>({...item,opt:item.name.replace(/\.pdf$/i,'')})),omitted:0};
  // A confirmed read selects documents only. It never binds units or grants a write.
  const snapshot=programming();if(!snapshot)return {jobs:[],omitted:0,unavailable:true};
  const pair=(reservation,system)=>JSON.stringify([String(reservation??'').trim(),String(system??'').trim()]);
  const pairs=new Set(snapshot.relations.filter(r=>r.reservation&&r.system).map(r=>pair(r.reservation,r.system)));
  const index=indexes.get(origin),entries=getEntries().filter(e=>e.origin===origin),allOpts=[...new Set(entries.map(e=>e.opt))];
  const opts=[...new Set(entries.filter(e=>e.reservation&&e.system&&pairs.has(pair(e.reservation,e.system))).map(e=>e.opt))],jobs=[];
  const omitted=allOpts.filter(opt=>!opts.includes(opt)).length;
  if(!index){return {jobs:files.length?files.map(item=>({...item,error:'Falta el índice original de '+origin+'. Cárgalo antes de enviar este archivo.'})):[{name:origin,error:'Faltan el índice original y los PDF de este origen.'}],omitted:0};}
  for(const opt of opts){const matches=files.filter(item=>item.name===opt+'.pdf'||item.name.replace(/\.pdf$/i,'')===opt);if(matches.length===1)jobs.push({...matches[0],opt,index});else jobs.push({name:opt+'.pdf',error:matches.length?'Hay varios PDF con ese nombre exacto y contenido distinto. No se elige uno automáticamente.':'Falta PDF con nombre exacto. No se asigna por semejanza.'});}
  // An index-only foreign OPT (with or without a PDF) is omitted, not a failed import.
  for(const item of files)if(!allOpts.includes(item.name.replace(/\.pdf$/i,'')))jobs.push({...item,error:'Este PDF no tiene consecutivo exacto en el índice de '+origin+'.'});
  return {jobs,omitted};
 }
 button.onclick=async()=>{
  if(button.disabled||busy)return;const scope=getScope(),origin=getOrigin(),batch=jobsFor(origin),{jobs,omitted}=batch,operation=++epoch;busy=true;results.replaceChildren();availability();
  let succeeded=0,rejected=0,uncertain=0,prior=0,indexExcluded=0,blocked=0,failed=0,withWarning=0;const confirmed=[];const omittedText=origin==='INDIVIDUAL'?'':` ${omitted} OPT del índice omitidas por no corresponder a la programación confirmada de PANELES_2, semana ${scope?.semana}/${scope?.anio}.`;
  try{
   if(batch.unavailable){status.textContent='Consulta la programación vigente de PANELES_2 antes de seleccionar el lote. No se enviaron archivos.';return;}
   if(!jobs.length){status.textContent=origin==='INDIVIDUAL'?'No hay PDF originales para este origen. Selecciona su carpeta o los archivos individuales.':'No hay OPT candidatas para la programación consultada. No se enviaron archivos.'+omittedText;return;}
   for(let i=0;i<jobs.length;i++){
    if(closed||operation!==epoch)return;const job=jobs[i],row=make('p');row.dataset.file=job.name;row.className='opt-file-result';results.append(row);
    const pending=api?.pending?.();
    if(pending===null||pending?.some(p=>p.pdf?.name===job.name||p.source?.opt===job.opt)){row.textContent=job.name+' · Bloqueado: resultado anterior incierto; verifica su estado antes de reintentar.';row.dataset.outcome=optImportOutcomeKind({previousPending:pending!==null,journalUnavailable:pending===null});prior++;continue;}
    if(job.error){const excluded=job.error.startsWith('Este PDF no tiene consecutivo exacto');row.dataset.outcome=optImportOutcomeKind({selectionReason:excluded?'EXACT_NAME_MISSING':undefined,error:excluded?undefined:Error(job.error)});row.textContent=job.name+' · '+(excluded?'Excluido por índice: ':'Bloqueado: ')+job.error;excluded?indexExcluded++:blocked++;continue;}
    setFileOutcome(job.file,'processing');row.textContent=job.name+' · Enviando original '+(i+1)+' de '+jobs.length+'…';status.textContent='Procesando secuencialmente. Cada archivo tiene su propio resultado.';
    try{
     const result=await api.process({scope:{...scope},source:{origin:origin==='INDIVIDUAL'?'DESCONOCIDO':origin,opt:job.opt,mode:origin==='INDIVIDUAL'?'INDIVIDUAL':'INDICE'},pdf:job.file,...(job.index?{index:job.index}:{})});
     if(closed||operation!==epoch){if(!closed)setFileOutcome(job.file,'uncertain');return;}
     setFileOutcome(job.file,'confirmed');row.dataset.outcome=optImportOutcomeKind({receiptValidated:true});succeeded++;confirmed.push(result);row.textContent=job.name+' · '+(result.data.duplicado?'Duplicado confirmado, sin crear otra OPT':'Guardado en SGP')+` · ${result.data.cantidad_piezas} piezas documentales; ${result.scopeTotals.assigned} asignadas a PANELES_2 según su semana de origen; ${result.scopeTotals.outsideScope} sin asignación a PANELES_2 y no disponibles para cortar. Documento ${result.data.id_documento}. No acredita cortes realizados.`;
     const warning=importRoundingWarning(result);if(warning){withWarning++;const notice=make('span',warning);notice.className='opt-rounding-warning';notice.dataset.warning='OPT_PRINTED_ROUNDING_COMPATIBLE';row.append(notice);}
    }catch(error){
     if(closed||operation!==epoch){if(!closed)setFileOutcome(job.file,'uncertain');return;}
     const unknown=error.uncertain===true;unknown?uncertain++:error.definitive===true?rejected++:failed++;setFileOutcome(job.file,unknown?'uncertain':error.definitive===true?'rejected':'failed');row.dataset.outcome=optImportOutcomeKind({error});
     const blockers=Array.isArray(error.blockers)?error.blockers.slice(0,12).map(value=>typeof value==='string'?value:JSON.stringify(value)).join(' · '):'';
     const resourceLimit=error.message==='OPT_IMPORTACION_LIMITE_RECURSOS';
     row.textContent=job.name+' · '+(resourceLimit?'Resultado incierto. El servidor interrumpió el procesamiento por límite de recursos. Conserva los originales y verifica el estado antes de reintentar. ':unknown?'Resultado incierto. Puede haberse guardado; verifica su estado y conserva exactamente el mismo PDF, índice, origen y ámbito. ':'No guardado en este intento: ')+importFailureMessage(error)+(blockers?' · '+blockers:'');
    }
   }
   if(!closed&&operation===epoch){status.textContent=`${succeeded} confirmados · ${rejected} rechazos definitivos · ${uncertain} inciertos de este intento · ${prior} bloqueos por estado anterior · ${indexExcluded} excluidos por índice · ${blocked} bloqueos locales · ${failed} fallos.${withWarning?` ${withWarning} confirmados con advertencia de redondeo.`:''} Los fallos no acreditan otros archivos.`+omittedText;if(confirmed.length)onImported(confirmed);}
  }finally{busy=false;availability();}
 };
 verify.onclick=async()=>{
  if(verify.disabled)return;const operation=++epoch,identities=api.pending();if(!Array.isArray(identities))return;busy=true;verification.replaceChildren();availability();
  try{for(const identity of identities){if(closed||operation!==epoch)return;const row=make('p',`${identity.pdf?.name||'Archivo'} · comprobando recibo…`);verification.append(row);
   try{const result=await api.reconcilePending(identity);if(closed||operation!==epoch)return;row.textContent=`${identity.pdf?.name} · `+(result.status==='COMMITTED_MATCH'?'Guardado confirmado por identidad, hash y ámbito. No se reenvió el PDF.':result.status==='NOT_OBSERVED'?'No observado en este ámbito. Sigue pendiente; esta lectura no autoriza reintentar.':'Evidencia diferente. Sigue pendiente; requiere revisión.');}
   catch(error){if(closed||operation!==epoch)return;row.textContent=`${identity.pdf?.name} · No se pudo comprobar. El pendiente se conserva. ${error.message}`;}
  }}finally{busy=false;if(!closed)availability();}
 };
 availability();
 return {setLocalOutcome({file,localOutcome}){if(closed)return;fileStates.set(file,{...(fileStates.get(file)||{}),localOutcome});renderSelection();},setSelection(files,origin,decisions=[]){selectedFiles.set(origin,files.map((file,i)=>({file,reason:decisions[i]?.reason})));renderSelection();},selectFiles(files,origin){return selectProgrammedFiles({files,origin,scope:getScope(),snapshot:programming(),entries:getEntries(),indexReady:indexes.has(origin),pending:api?.pending?.()??null});},captureFiles,setIndexReading(origin,file){indexSelections.set(origin,{file,localOutcome:'processing'});renderSelection();},setIndexError(origin,file,error){indexSelections.set(origin,{file,localOutcome:'error',error});renderSelection();},dropIndex(origin){indexes.delete(origin);indexSelections.delete(origin);invalidate('Leyendo índice nuevo. El índice anterior ya no se usa para enviar.');},setIndex(origin,index){indexes.set(origin,index);indexSelections.set(origin,{file:index.file,localOutcome:'processed'});invalidate('Índice original conservado para el envío explícito. La revisión local no crea OPT en SGP.');},invalidate,update(){const next=scopeKey();if(next!==lastScope){lastScope=next;invalidate();}availability();},destroy(){recovery.destroy();closed=true;epoch++;api?.invalidate();originals.clear();indexes.clear();selectedFiles.clear();fileStates.clear();indexSelections.clear();panel.remove();}};
}
