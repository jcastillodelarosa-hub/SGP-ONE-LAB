// Prepared only: no UI wiring, journal mutation, bytes, import or retry capability.
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
export const sameOptImportIdentity=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
export function createOptImportObservation(client,getToken,{getContext}={}){
 let epoch=0;return {invalidate(){epoch++;},async observe(identity){
  const operation=epoch,token=getToken(),request=structuredClone(identity);
  const current=()=>operation===epoch&&token===getToken()&&(!getContext||sameOptImportIdentity(getContext(),request.scope));
  if(!token||!current())throw Error('OPT_OBSERVACION_SESION_INVALIDA');
  const result=await client.rpc('sgp_opt_import_observacion_v1',{p_token:token,p_identity:request});
  if(!current())throw Error('OPT_OBSERVACION_OBSOLETA');
  if(result?.error)throw Error('OPT_OBSERVACION_NO_DISPONIBLE');
  const data=result?.data;
  if(data?.contract!=='OPT-IMPORT-OBSERVATION-1'||!sameOptImportIdentity(data.identity,request)||!['COMMITTED_MATCH','NOT_OBSERVED','EVIDENCE_MISMATCH'].includes(data.status)||data.retryAuthorized!==false||data.pdfArchived!==false)throw Error('OPT_OBSERVACION_CONTRATO_INVALIDO');
  return structuredClone(data);
 }};
}
// Separate classifications for a future approved UI. All categories are factual;
// previous uncertainty takes precedence over this attempt's local/index outcome.
export function optImportOutcomeKind({previousPending=false,journalUnavailable=false,selectionReason,error,receiptValidated=false}={}){
 if(journalUnavailable)return 'JOURNAL_UNAVAILABLE';
 if(previousPending||error?.uncertain===true)return previousPending?'PREVIOUS_UNCERTAINTY':'UNCERTAIN';
 if(receiptValidated)return 'CONFIRMED';
 if(selectionReason==='OUTSIDE_PROGRAMMING')return 'PROGRAMMING_OMITTED';
 if(selectionReason==='EXACT_NAME_MISSING')return 'INDEX_EXCLUDED';
 if(selectionReason==='DUPLICATE_NAME')return 'DUPLICATE_BLOCKED';
 if(error?.definitive===true)return 'DEFINITIVE_REJECTION';
 if(error)return 'FAILED';
 return 'NOT_SENT';
}
