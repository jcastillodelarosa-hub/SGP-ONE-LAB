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
   const ids=new Set();for(const r of d.reports){if(!r.id||ids.has(r.id)||r.key!==key||!['ENSAMBLE','EMPAQUE'].includes(r.origin_stage)||!['NC_AL','NC_V','NOVEDAD','ACCESORIOS'].includes(r.cause)||![r.quantity,r.solved,r.confirmed].every(valid)||r.confirmed>r.solved||r.solved>r.quantity||(r.nc_link&&r.nc_link.source?.reference!==r.nc_reference)||(r.sourceNow&&r.sourceNow.reference!==r.nc_reference))throw Error('SHARED_ORDER_REPORT_INVALID');if(r.numero_novedad!=null&&(r.cause!=='NOVEDAD'||typeof r.numero_novedad!=='string'||r.numero_novedad.length>80||!r.numero_novedad.trim()||/[\u0000-\u001f\u007f]/.test(r.numero_novedad)))throw Error('SHARED_ORDER_REPORT_INVALID');ids.add(r.id);}
   if(d.history.length!==d.revision||d.history.some((e,i)=>e.revision!==i+1||!ids.has(e.reportId)))throw Error('SHARED_ORDER_HISTORY_INVALID');
   let visible=packingSharedEvidence(d);
   const references=new Set([...visible.reports.filter(r=>r.cause==='NC_V').map(r=>r.nc_reference),...visible.legacyReports.filter(r=>r.causa==='NC_V').map(r=>r.ncReference)].filter(Boolean).map(r=>String(r).trim()));
   if(references.size){
    try{
     const states=await rpc('sgp_lp_shared_nc_states_v1');
     if(!identity(states)||states.contract!=='NCV-ORDER-STATE-1'||!Array.isArray(states.rows))throw Error('NCV_STATE_CONTRACT_INVALID');
     const groups=new Map();
     for(const item of states.rows){
      if(!item||typeof item.reference!=='string'||!references.has(item.reference))throw Error('NCV_STATE_CONTRACT_INVALID');
      const group=groups.get(item.reference)||[];group.push(item);groups.set(item.reference,group);
     }
     const finalized=new Map([...groups].filter(([,items])=>items.length===1&&items[0].active===true&&['CERRADA','FINALIZADA'].includes(String(items[0].state??'').trim().toUpperCase())).map(([ref,items])=>[ref,items[0]]));
     visible={...visible,reports:visible.reports.map(r=>({...r,sourceNotice:r.cause==='NC_V'?finalized.get(String(r.nc_reference??'').trim())||null:null})),legacyReports:visible.legacyReports.map(r=>({...r,sourceNotice:r.causa==='NC_V'?finalized.get(String(r.ncReference??'').trim())||null:null}))};
    }catch(error){if(error.message==='NO_AUTORIZADO')throw error;/* A missing reader never invents closure or removes saved affectations. */}
   }
   return visible;
  },
  async command(cmd){
   if(stage==='EMPAQUE'&&cmd?.cause==='TECNO')throw Error('TECNO_SOLO_ENSAMBLE');
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
