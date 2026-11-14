// Presentation contract: local extraction and server receipts remain independent.
// Controller must supply serverOutcome solely from the existing validated import
// service/journal, never from a filename, local extraction or elapsed time.
const localStates=new Set(['not_started','processing','processed','error']);
const serverStates=new Set(['not_sent','processing','confirmed','rejected','failed','uncertain']);
const safeText=value=>typeof value==='string'&&value.length>0&&!/[\u0000-\u001f\u007f]/.test(value);
export function optFileSelectionState({file,available=false,localOutcome='not_started',serverOutcome='not_sent'}={}){
 if(!localStates.has(localOutcome)||!serverStates.has(serverOutcome))throw Error('OPT_FILE_STATE_INVALID');
 const name=safeText(file?.name)&&!/[\\/]/.test(file.name)?file.name:null;
 const relative=file?.webkitRelativePath;
 // Accept only the browser's relative path with matching filename. Never use
 // input.value, URL, drive letter, absolute path, or inferred parent folder.
 const parts=typeof relative==='string'?relative.split('/'):[];
 const relativePath=name&&safeText(relative)&&!/[\\:]/.test(relative)&&parts.length>1&&parts.every(p=>p&&p!=='.'&&p!=='..')&&parts.at(-1)===name?relative:null;
 return Object.freeze({name,relativePath,location:relativePath||name,available:!!name&&available===true,
  localOutcome,serverOutcome,processedLocally:localOutcome==='processed',
  savedDataConfirmed:serverOutcome==='confirmed',serverPdfArchived:false,
  requiresReconciliation:serverOutcome==='uncertain',
  labels:Object.freeze({selection:name?(available?'Archivo disponible localmente':'Archivo no disponible en esta selección'):'Sin archivo seleccionado',
   local:{not_started:'Sin procesar localmente',processing:'Procesando localmente',processed:'Procesado localmente',error:'Error de lectura local'}[localOutcome],
   server:{not_sent:'No enviado a SGP',processing:'Envío en curso; guardado sin confirmar',confirmed:'Datos de OPT guardados en SGP; PDF original no archivado',failed:'Fallo del intento; guardado sin confirmar',rejected:'Intento rechazado; no acredita ni descarta cargas anteriores',uncertain:'Resultado incierto; verificar antes de reintentar'}[serverOutcome]})});
}
