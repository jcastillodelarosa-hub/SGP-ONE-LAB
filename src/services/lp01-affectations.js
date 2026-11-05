import {progressEvidence} from '../domain/lp01-progress-evidence.js';
import {mountPdtRegistration} from '../modules/pdt-registration-form.js';
const integer=n=>Number.isSafeInteger(n)&&n>=0;
/** Scope-checked transport; not registered in live Operation until deployment controls pass. */
export function affectationsTransport({client,getToken,context}){
 const scope=Object.freeze({...context});
 async function rpc(name,args){
  const token=getToken();if(!token)throw Error('NO_AUTORIZADO');
  const {data,error}=await client.rpc(name,{p_token:token,...args});
  if(getToken()!==token)throw Error('NO_AUTORIZADO');
  if(error){if(/SESION|AMBITO|LP_ROL_ETAPA|NO_AUTORIZADO/.test(error.message||''))throw Error('NO_AUTORIZADO');throw Error(error.message||'CONTRATO_NO_DISPONIBLE');}
  return data;
 }
 return {
  async read(){
   const data=await rpc('sgp_lp_afectaciones_consultar_v1',{p_key:scope.key,p_stage:scope.stage});
   if(data?.contract!=='LP-AFFECTATIONS-1'||data.key!==scope.key||data.line!==scope.line||data.stage!==scope.stage||!integer(data.revision)||!Array.isArray(data.reports)||!Array.isArray(data.events)||!Array.isArray(data.capabilities))throw Error('CONTRATO_AFECTACIONES_INVALIDO');
   for(const r of data.reports)if(!r.id||r.originStage!==scope.stage||![r.quantity,r.solved,r.confirmed].every(integer)||r.confirmed>r.solved||r.solved>r.quantity)throw Error('CONTRATO_AFECTACIONES_INVALIDO');
   if(data.available!==null&&!integer(data.available))throw Error('CONTRATO_AFECTACIONES_INVALIDO');
   for(const [stage,p] of Object.entries(data.progress||{})){
    const evidence=progressEvidence({key:scope.key,line:scope.line,stage,events:p.events,coverage:p.coverage});
    if(JSON.stringify(evidence.opening)!==JSON.stringify(p.opening)){
     // PostgreSQL JSON field order/timestamp serialization need not match JS object order.
     if(evidence.opening?.eventId!==p.opening?.eventId||evidence.opening?.date!==p.opening?.date||evidence.opening?.shift!==p.opening?.shift)throw Error('APERTURA_NO_ACREDITADA');
    }
   }
   return data;
  },
  async command(command){
   const data=await rpc('sgp_lp_afectaciones_comando_v1',{p_key:scope.key,p_stage:scope.stage,p_date:scope.date,p_shift:scope.shift,p_cmd:command});
   if(data?.contract!=='LP-AFFECTATIONS-COMMAND-1'||data.id!==command.id||!integer(data.revision))throw Error('RESPUESTA_NO_CONFIRMADA');
   return data;
  },
  async mountAluminumDraft(host){
   // Reuses Picking's exact verified fabrication/length picker while preserving actual stage and NC rules.
   // No saveRegistration call: joint PDT/LP atomic writer is not yet certified.
   try{return await mountPdtRegistration(host,{client,token:getToken(),origin:scope.stage,context:{key_produccion:scope.key,produccion:scope.production,reserva:scope.reserve},selectionStyle:'table'});}
   catch(error){host.textContent=error.message;}
  }
 };
}
