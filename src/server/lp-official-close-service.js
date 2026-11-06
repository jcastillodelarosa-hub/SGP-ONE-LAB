import {parsePowerBI,bytesBase64} from '../domain/powerbi/adapter.js';
import {reconcileOfficialPowerBI} from '../domain/powerbi/official-reconciliation.js';
import {applyOfficialImport,closeOfficialPeriod} from '../domain/lp01-official-close.js';

/** Server-only transition over the existing parser. No browser-supplied catalog,
 * actor, plan, schedule or state. RPC credentials stay in the caller's server.
 * Unbound by default: deployment of this service needs the reviewed SQL contract.
 */
export function officialCloseService({rpc,DOMParser}){
 async function call(name,args){const {data,error}=await rpc(name,args);if(error)throw Object.assign(Error(error.message),{code:error.code});return data;}
 async function run({token,command,filename,bytes,observation}){
  if(!command||!['IMPORT','CLOSE'].includes(command.action)||!/^[a-f0-9-]{36}$/i.test(command.id??'')||!['ENSAMBLE','EMPAQUE'].includes(command.stage)||!['PANELES_2','FRAMES_2'].includes(command.line)||!/^\d{4}-\d{2}-\d{2}$/.test(command.date??'')||![1,2].includes(command.shift)||!Number.isSafeInteger(command.revision)||command.revision<0||Object.keys(command).some(k=>!['id','action','stage','line','date','shift','revision'].includes(k)))throw Error('OFFICIAL_COMMAND_INVALID');
  if(command.action==='IMPORT'&&(!(bytes instanceof Uint8Array)||bytes.length>2097152||!/^.+\.xlsx$/i.test(filename??'')||filename.length>255))throw Error('OFFICIAL_FILE_INVALID');
  if(command.action==='CLOSE'&&(typeof observation!=='string'||!observation.trim()||observation.length>4000))throw Error('OFFICIAL_REASON_REQUIRED');
  const context=Object.fromEntries(['stage','line','date','shift'].map(k=>[k,command[k]]));
  const parsed=command.action==='IMPORT'?await parsePowerBI(bytes,{DOMParser,stage:context.stage}):null;
  const payload={...command,...(parsed?{filename,sha256:parsed.sha256}:{observation})};
  const requestHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(payload)))),b=>b.toString(16).padStart(2,'0')).join('');
  const current=await call('sgp_lp_official_context_v1',{p_token:token,p_context:context,p_id:command.id,p_request_hash:requestHash});
  if(current?.contract!=='LP-OFFICIAL-CONTEXT-1')throw Error('OFFICIAL_CONTEXT_INVALID');
  if(current.receipt){if(current.receipt.contract!=='LP-OFFICIAL-COMMITTED-1'||current.receipt.id!==command.id||current.receipt.revision!==command.revision+1)throw Error('OFFICIAL_RECEIPT_INVALID');return current.receipt;}
  if(current.state?.revision!==command.revision)throw Error('CONFLICTO_REVISION');
  const args={id:command.id,expectedRevision:command.revision,actor:current.actor,recordedAt:current.observedAt,plan:current.plan};
  const transition=parsed?applyOfficialImport(current.state,{...args,schedule:current.schedule,reconciliation:reconcileOfficialPowerBI(parsed,{...context,catalog:current.catalog,schedule:current.schedule})}):closeOfficialPeriod(current.state,{...args,observation});
  let result;try{result=await call('sgp_lp_official_commit_v1',{p_token:token,p_context:context,p_id:command.id,p_request_hash:requestHash,p_source_fingerprint:current.fingerprint,p_expected_revision:command.revision,p_state:transition.state,p_result:transition.receipt,p_file:parsed?{name:filename,sha256:parsed.sha256,base64:bytesBase64(bytes)}:null});}catch(error){if(!/^[0-9A-Z]{5}$/.test(error.code??'')||/^08/.test(error.code))error.code='OFFICIAL_COMMIT_UNCERTAIN';throw error;}
  if(result?.contract!=='LP-OFFICIAL-COMMITTED-1'||result.id!==command.id||result.revision!==transition.state.revision)throw Object.assign(Error('OFFICIAL_COMMIT_UNCERTAIN'),{code:'OFFICIAL_COMMIT_UNCERTAIN'});
  return result;
 }
 return {run};
}
