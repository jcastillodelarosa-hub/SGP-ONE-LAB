const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const same=(a,b)=>['stage','line','date','shift'].every(k=>a?.[k]===b?.[k]);
export function turnReferenceOptions(payload,context){
 if(payload?.contract!=='LP-TURN-REFERENCE-OPTIONS-1'||!same(payload.context,context)||context.stage!=='ENSAMBLE'||!Array.isArray(payload.references))throw Error('No se pudieron acreditar las referencias de este turno.');
 const ids=new Set();return payload.references.map(r=>{
  if(!uuid(r?.loadId)||ids.has(r.loadId)||typeof r.file!=='string'||!r.file.trim()||!Number.isFinite(Date.parse(r.at))||!Number.isFinite(Date.parse(r.loadedAt))||!Number.isSafeInteger(r.rowCount)||r.rowCount<0||r.status!=='ESTIMATED_REFERENCE')throw Error('Referencia de saldos incompleta.');
  ids.add(r.loadId);return {...r};
 });
}
export function withTurnReference(command,state,context){
 if(!state.referenceLoadId)return command;
 if(context.stage!=='ENSAMBLE'||!same(state.referenceContext,context)||!state.referenceOptions?.some(r=>r.loadId===state.referenceLoadId))throw Error('Vuelve a consultar la referencia de saldos antes de cerrar.');
 return {...command,report_reference_load_id:state.referenceLoadId};
}
export const referenceLabel=r=>new Intl.DateTimeFormat('es-CO',{timeZone:'America/Bogota',dateStyle:'short',timeStyle:'short'}).format(new Date(r.at))+' · '+(r.atKind==='IMPORT_TIMESTAMP'?'Importación':'Hora del archivo')+' · '+r.file;
