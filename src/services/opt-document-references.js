// Documentary membership is read-only. It never supplies ledger piece identities.
export function createOptDocumentReferences(client,getToken,{catalog,timeoutMs=25000}={}) {
 let epoch=0,current=null;
 const invalidate=()=>{epoch++;current=null;};
 const ownsReference=(group,ref)=>!!current&&current.group===group&&current.token===getToken()&&catalog.ownsGroup(group)&&current.references.includes(ref);
 async function load(group){
  invalidate();const operation=epoch,token=getToken();
  if(!catalog?.ownsGroup(group))throw Error('OPT_DOCUMENTO_GRUPO_INVALIDO');
  if(!token)throw Error('OPT_SESION_REQUERIDA');
  let timer;
  const response=await Promise.race([Promise.resolve().then(()=>client.rpc('sgp_opt_referencias_documentales_v1',{p_token:token,p_scope:group.scope,p_reserva:group.reservation,p_sistema:group.system})),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('OPT_DOCUMENTO_TIMEOUT')),timeoutMs);})]).finally(()=>clearTimeout(timer));
  if(operation!==epoch||token!==getToken()||!catalog.ownsGroup(group))throw Error('OPT_DOCUMENTO_OBSOLETO');
  if(response?.error)throw Error('OPT_DOCUMENTO_NO_DISPONIBLE');
  const data=structuredClone(response?.data),invalid=()=>{throw Error('OPT_DOCUMENTO_CONTRATO_INVALIDO');};
  if(data?.contract!=='OPT-DOCUMENT-REFERENCES-1'||data.reservation!==group.reservation||data.system!==group.system||JSON.stringify(Object.keys(data.scope||{}).sort())!==JSON.stringify(Object.keys(group.scope).sort())||!Object.keys(group.scope).every(k=>data.scope[k]===group.scope[k])||!Array.isArray(data.references))invalid();
  const expected=new Map(group.references.map(r=>[r.id_documento,r.sha256])),seen=new Set(),documents=new Set();
  for(const ref of data.references){
   if(!ref||Object.keys(ref).sort().join()!=='id_documento,piezas_documento,referencia,sha256,sistema'||!expected.has(ref.id_documento)||expected.get(ref.id_documento)!==ref.sha256||typeof ref.referencia!=='string'||!ref.referencia.trim()||ref.sistema!==null&&(typeof ref.sistema!=='string'||!ref.sistema.trim())||!Number.isSafeInteger(ref.piezas_documento)||ref.piezas_documento<1)invalid();
   const key=JSON.stringify([ref.id_documento,ref.referencia]);if(seen.has(key))invalid();seen.add(key);documents.add(ref.id_documento);Object.freeze(ref);
  }
  if(documents.size!==expected.size||group.references.some(r=>!seen.has(JSON.stringify([r.id_documento,r.referencia]))))invalid();
  const references=Object.freeze(data.references);current={group,token,references};return references;
 }
 return {load,invalidate,ownsReference};
}
