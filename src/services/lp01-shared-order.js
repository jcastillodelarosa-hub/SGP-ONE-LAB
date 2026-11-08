import {packingSharedEvidence} from '../domain/lp01-packing-affectation-scope.js';
const valid=n=>Number.isSafeInteger(n)&&n>=0;
/** Same canonical identity in both leader sheets and Seguimiento. No shift arguments. */
export function sharedOrderTransport({client,getToken,key,line,stage}){
 const initialToken=getToken();
 const current=()=>Boolean(initialToken)&&getToken()===initialToken;
 async function rpc(name,args={}){
  if(!current())throw Error('NO_AUTORIZADO');
  const {data,error}=await client.rpc(name,{p_token:initialToken,p_key:key,p_stage:stage,...args});
  if(!current())throw Error('NO_AUTORIZADO');
  if(error){const e=Error(/SESION|AMBITO|NO_AUTORIZADO/.test(error.message||'')?'NO_AUTORIZADO':['PGRST202','42883','42501'].includes(error.code)?'SHARED_ORDER_UNAVAILABLE':error.message||'SHARED_ORDER_REQUEST_FAILED');e.confirmedRejected=/^[A-Z0-9]{5}$/.test(error.code||'')&&!/^08/.test(error.code);throw e;}
  return data;
 }
 const identity=d=>d?.key===key&&d.line===line&&d.stage===stage&&key.endsWith('|'+line);
 return {isCurrent:current,
  async read(){
   const d=await rpc('sgp_lp_shared_order_read_v1');
   if(!identity(d)||d.contract!=='LP-SHARED-ORDER-1'||!valid(d.revision)||typeof d.canReport!=='boolean'||!Array.isArray(d.reports)||!Array.isArray(d.history)||!Array.isArray(d.legacyReports)||!Array.isArray(d.accessories))throw Error('SHARED_ORDER_CONTRACT_INVALID');
   const ids=new Set();for(const r of d.reports){if(!r.id||ids.has(r.id)||r.key!==key||!['ENSAMBLE','EMPAQUE'].includes(r.origin_stage)||!['NC_AL','NC_V','NOVEDAD','ACCESORIOS'].includes(r.cause)||![r.quantity,r.solved,r.confirmed].every(valid)||r.confirmed>r.solved||r.solved>r.quantity||(r.nc_link&&r.nc_link.source?.reference!==r.nc_reference)||(r.sourceNow&&r.sourceNow.reference!==r.nc_reference))throw Error('SHARED_ORDER_REPORT_INVALID');ids.add(r.id);}
   if(d.history.length!==d.revision||d.history.some((e,i)=>e.revision!==i+1||!ids.has(e.reportId)))throw Error('SHARED_ORDER_HISTORY_INVALID');
   return packingSharedEvidence(d);
  },
  async command(cmd){
   const d=await rpc('sgp_lp_shared_order_command_v1',{p_cmd:cmd});
   if(d?.contract!=='LP-SHARED-COMMAND-1'||d.key!==key||d.id!==cmd.id||d.revision!==cmd.revision+1||!d.reportId||typeof d.duplicate!=='boolean')throw Error('SHARED_ORDER_RESPONSE_UNCERTAIN');
   return d;
  },
  async lookupNc(reference){
   const d=await rpc('sgp_lp_shared_nc_lookup_v1',{p_reference:reference});
   if(!identity(d)||d.contract!=='LP-SHARED-NC-1'||d.reference!==reference.trim()||(d.source&&(d.source.reference!==d.reference||typeof d.source.active!=='boolean'||!/^[a-f0-9]{32}$/.test(d.fingerprint))))throw Error('SHARED_NC_CONTRACT_INVALID');
   return d;
  }
 };
}
