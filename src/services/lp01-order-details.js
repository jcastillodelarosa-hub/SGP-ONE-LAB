import {exportGlassEstimate} from '../domain/lp01-export-glass.js';
const integer=n=>Number.isSafeInteger(n)&&n>=0;
const note=s=>typeof s==='string'&&Array.from(s).length<=2000;
/** New contract only; no fallback to assignment notes or SALE events. */
export function orderDetailsTransport({client,getToken,key,line,stage}) {
 const token=getToken(),isCurrent=()=>Boolean(token)&&getToken()===token;
 async function rpc(name,args={}) {
  if(!isCurrent())throw Error('NO_AUTORIZADO');
  const {data,error}=await client.rpc(name,{p_token:token,p_key:key,p_stage:stage,...args});
  if(!isCurrent())throw Error('NO_AUTORIZADO');
  if(error){
   const unavailable=['PGRST202','42883','42501'].includes(error.code);
   const denied=/SESION|SESSION|AMBITO|LP_ROL|NO_AUTORIZADO|PERMISSION_DENIED/.test(error.message||'');
   const e=Error(unavailable?'ORDER_DETAILS_UNAVAILABLE':denied?'NO_AUTORIZADO':error.message||'ORDER_DETAILS_REQUEST_FAILED');
   e.confirmedRejected=/^[0-9A-Z]{5}$/.test(error.code||'')&&!/^08/.test(error.code);throw e;
  }
  return data;
 }
 return {isCurrent,
  async read(){
   const d=await rpc('sgp_lp_order_details_read_v1');
   if(d?.contract!=='LP-ORDER-DETAILS-1'||d.key!==key||d.line!==line||d.stage!==stage||!key.endsWith('|'+line)
    ||!integer(d.note?.revision)||!note(d.note?.observation)||!Array.isArray(d.history)||d.history.length!==d.note.revision
    ||!Array.isArray(d.capabilities)||!d.capabilities.includes('READ')||d.capabilities.some(c=>!['READ','NOTE'].includes(c))
    ||!d.export||['quantity','percentage'].some(k=>d.export[k]!==null&&typeof d.export[k]!=='string')
    ||![true,false,null].includes(d.export.present))throw Error('ORDER_DETAILS_CONTRACT_INVALID');
   if(d.history.some((h,i)=>!h.id||h.revision!==i+1||!note(h.observation)||!['ENSAMBLE','EMPAQUE'].includes(h.stage))
    ||(d.note.revision>0&&d.history.at(-1).observation!==d.note.observation))throw Error('ORDER_DETAILS_HISTORY_INVALID');
   return {...d,glass:exportGlassEstimate(d.export)};
  },
  async save(cmd){
   if(!cmd||Object.keys(cmd).some(k=>!['id','revision','observation'].includes(k))||!cmd.id||!integer(cmd.revision)||!note(cmd.observation))throw Error('ORDER_NOTE_COMMAND_INVALID');
   const d=await rpc('sgp_lp_order_note_save_v1',{p_cmd:cmd});
   if(d?.contract!=='LP-ORDER-NOTE-SAVED-1'||d.key!==key||d.id!==cmd.id||d.revision!==cmd.revision+1||d.observation!==cmd.observation||typeof d.duplicate!=='boolean')throw Error('ORDER_NOTE_RESPONSE_UNCERTAIN');
   return d;
  }
 };
}
