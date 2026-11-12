import {validReportScope,reportSelection,validateCutReport} from '../domain/opt-cut-report.js';
// Separate authenticated read adapter. No local files or manufacturing fallback.
export function createOptCutReport(client,getToken,{timeoutMs=25000}={}){
 if(!Number.isFinite(timeoutMs)||timeoutMs<=0)throw Error('OPT_ESPERA_INVALIDA');
 let generation=0,current=null;const owners=new WeakMap();
 const invalidate=()=>{generation++;current=null;};
 const isCurrent=result=>!!result&&result===current&&owners.get(result)===getToken();
 async function load(scope,selection=null){
  invalidate();const operation=generation;
  if(!validReportScope(scope))throw Error('OPT_SCOPE_INVALIDO');
  const requested={...scope},selected=reportSelection(selection),token=getToken();
  if(!token)throw Error('OPT_SESION_REQUERIDA');
  let timer;
  const response=await Promise.race([
   Promise.resolve().then(()=>client.rpc('sgp_opt_cortes_reporte_v2',{p_token:token,p_scope:requested,p_reservas:selected})),
   new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('OPT_REPORTE_TIMEOUT')),timeoutMs);})
  ]).finally(()=>clearTimeout(timer));
  if(operation!==generation||token!==getToken())throw Error('OPT_REPORTE_OBSOLETO');
  if(response?.error)throw Error(response.error.message||'OPT_REPORTE_NO_DISPONIBLE');
  const result=validateCutReport(response?.data,requested,selected);owners.set(result,token);current=result;return result;
 }
 return {load,invalidate,isCurrent};
}
