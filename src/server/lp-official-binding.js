import {officialCloseService} from './lp-official-close-service.js';
/** Exact RPC allowlist; disabled unless deployment explicitly opts in. */
export function officialCloseBinding({enabled,rpc,DOMParser}){
 if(enabled!==true)return null;
 const allowed=new Set(['sgp_lp_official_read_v1','sgp_lp_official_context_v1','sgp_lp_official_commit_v1']);
 return officialCloseService({DOMParser,rpc:(name,args)=>{
  if(!allowed.has(name))throw Error('OFFICIAL_RPC_NOT_ALLOWED');
  return rpc(name,args);
 }});
}
