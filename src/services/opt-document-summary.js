import {validOptDocumentSummary} from '../domain/opt-document-summary.js';
// Read-only documentary API. Catalogue ownership + fresh session/scope on both sides.
export function createOptDocumentSummary(client,getToken,{catalog,timeoutMs=25000}={}) {
 let epoch=0;
 const invalidate=()=>{epoch++;};
 async function load(group){
  if(!catalog?.ownsGroup(group))throw Error('OPT_RESUMEN_GRUPO_INVALIDO');
  const token=getToken(),operation=++epoch;
  if(!token)throw Error('OPT_SESION_REQUERIDA');
  let timer;
  const response=await Promise.race([client.rpc('sgp_opt_resumen_documental_v1',{p_token:token,p_scope:group.scope,p_reserva:group.reservation,p_sistema:group.system}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('OPT_RESUMEN_TIMEOUT')),timeoutMs);})]).finally(()=>clearTimeout(timer));
  if(epoch!==operation||getToken()!==token||!catalog.ownsGroup(group))throw Error('OPT_RESUMEN_OBSOLETO');
  if(response?.error)throw Error('OPT_RESUMEN_NO_DISPONIBLE');
  const data=structuredClone(response?.data),invalid=()=>{throw Error('OPT_RESUMEN_CONTRATO_INVALIDO');};
  if(data?.contract!=='OPT-DOCUMENT-SUMMARIES-1'||data.reservation!==group.reservation||data.system!==group.system||!['linea','anio','semana','modo'].every(k=>data.scope?.[k]===group.scope[k])||!Array.isArray(data.documents))invalid();
  const expected=new Map(group.references.map(r=>[r.id_documento,r])),seen=new Set();
  const documents=data.documents.map(d=>{
   const ref=expected.get(d.id_documento);
   if(!ref||seen.has(d.id_documento)||d.sha256!==ref.sha256||!ref.fuentes.some(s=>s.consecutivo===d.opt)||d.scope!=='DOCUMENTO'||!['AVAILABLE','PARTIAL','NOT_PERSISTED'].includes(d.status))invalid();
   seen.add(d.id_documento);
   if(d.summary&&d.status!==(d.summary.cutRows?.length&&d.summary.materialRows?.length?'AVAILABLE':'PARTIAL'))invalid();
   if(d.status!=='NOT_PERSISTED'?!validOptDocumentSummary(d.summary):d.summary!==null)invalid();
   return {id_documento:d.id_documento,sha256:d.sha256,opt:d.opt,scope:'DOCUMENTO',status:d.status,
    projectData:d.summary?.projectData||null,cutRows:d.summary?.cutRows||[],materialRows:d.summary?.materialRows||[],notices:[d.status!=='NOT_PERSISTED'?'Totales impresos del documento completo; no son totales exclusivos de esta reserva.':'Este documento no tiene resumen persistido. No se han inferido valores de las piezas.']};
  });
  if(seen.size!==expected.size)invalid();
  return {documents};
 }
 return {load,invalidate};
}
