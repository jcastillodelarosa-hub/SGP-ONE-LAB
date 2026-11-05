const integer=n=>Number.isSafeInteger(n)&&n>=0;
export function orderSaleTransport({client,getToken,key,stage}){
 const token=getToken();const isCurrent=()=>Boolean(token)&&getToken()===token;
 async function rpc(name,args){
  if(!isCurrent())throw Error('NO_AUTORIZADO');
  const {data,error}=await client.rpc(name,{p_token:token,p_key:key,p_stage:stage,...args});
  if(!isCurrent())throw Error('NO_AUTORIZADO');
  if(error){const e=Error(/SESION|AMBITO|LP_ROL|NO_AUTORIZADO/.test(error.message||'')?'NO_AUTORIZADO':error.message||'SALE_ORDER_REJECTED');e.confirmedRejected=/^[0-9A-Z]{5}$/.test(error.code||'')&&!/^08/.test(error.code);throw e;}
  return data;
 }
 return {isCurrent,
  async read(){
   const d=await rpc('sgp_lp_sale_orden_consultar_v1',{});
   if(d?.contract!=='LP-ORDER-SALE-1'||d.key!==key||d.stage!==stage||!integer(d.revision)||(d.quantity!==null&&!integer(d.quantity))||d.operational!==false||d.temporalPolicy!=='UNRESOLVED'||!Array.isArray(d.history)||!Array.isArray(d.capabilities)||d.capabilities.some(c=>!['READ','DEFINE'].includes(c))||d.capabilities.includes('DEFINE')&&!['COORDINADOR','ADMINISTRADOR'].includes(d.role)||!d.source||typeof d.source.fingerprint!=='string'||!d.source.fingerprint||[d.source.exportBalance,d.source.available].some(n=>n!==null&&!integer(n)))throw Error('SALE_ORDER_CONTRACT_INVALID');
   if((d.revision===0)!==(d.quantity===null)||!d.capabilities.includes('READ')||d.revision>0&&d.history.at(-1)?.quantity!==d.quantity)throw Error('SALE_ORDER_CONTRACT_INVALID');
   if(d.history.some((h,i)=>!h.id||h.revision!==i+1||!integer(h.quantity))||d.history.length!==d.revision)throw Error('SALE_ORDER_HISTORY_INVALID');
   return d;
  },
  async save(cmd){
   if(!cmd||Object.keys(cmd).some(k=>!['id','quantity','revision','sourceFingerprint','observation'].includes(k))||!cmd.id||!integer(cmd.quantity)||!integer(cmd.revision)||!cmd.sourceFingerprint||typeof cmd.observation!=='string'||!cmd.observation.trim())throw Error('SALE_ORDER_COMMAND_INVALID');
   const d=await rpc('sgp_lp_sale_orden_definir_v1',{p_cmd:cmd});
   if(d?.contract!=='LP-ORDER-SALE-SAVED-1'||d.id!==cmd.id||d.key!==key||d.stage!==stage||d.quantity!==cmd.quantity||d.revision!==cmd.revision+1||d.operational!==false||d.temporalPolicy!=='UNRESOLVED')throw Error('SALE_ORDER_RESPONSE_UNCERTAIN');
   return d;
  }
 };
}
