import {sameOptImportIdentity} from './opt-import-observation.js';
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(v);
const sha=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
export function validateOptResolution(v,identity,requestHash,now=Date.now()){
 if(!v||v.contract!=='OPT-IMPORT-RESOLUTION-1'||v.status!=='ABSENT_FINAL'||v.proofKind!=='DURABLE_FENCE'||v.retryMode!=='MANUAL_EXACT_ONLY'||v.pdfArchived!==false||!sameOptImportIdentity(v.identity,identity)||v.requestHash!==requestHash||!sha(requestHash)||!sha(v.evidenceSha256)||!uuid(v.decisionId)||!uuid(v.retryGeneration)||!Number.isFinite(Date.parse(v.issuedAt))||!Number.isFinite(Date.parse(v.expiresAt))||Date.parse(v.issuedAt)>now||Date.parse(v.expiresAt)<=now||Date.parse(v.expiresAt)<=Date.parse(v.issuedAt)||identity?.source?.origin!=='RETAIL'||identity?.source?.mode!=='INDICE')throw Error('OPT_RESOLUTION_CONTRATO_INVALIDO');
 return structuredClone(v);
}
export function createOptImportResolution(client,getToken,{getContext}={}){
 let epoch=0;return {invalidate(){epoch++;},async resolve(identity,requestHash){
 const operation=epoch,token=getToken(),request=structuredClone(identity);
 const current=()=>operation===epoch&&token===getToken()&&(!getContext||sameOptImportIdentity(getContext(),request.scope));
 if(!token||!current())throw Error('OPT_RESOLUTION_SESION_INVALIDA');
 const result=await client.rpc('sgp_opt_import_resolucion_v1',{p_token:token,p_identity:request,p_request_hash:requestHash});
 if(!current())throw Error('OPT_RESOLUTION_OBSOLETA');
 if(result?.error)throw Error('OPT_RESOLUTION_UNAVAILABLE');
 return validateOptResolution(result?.data,request,requestHash);
 }};
}
