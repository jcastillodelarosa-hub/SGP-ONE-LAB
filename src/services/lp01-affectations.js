import {progressEvidence} from '../domain/lp01-progress-evidence.js';
import {mountPdtRegistration} from '../modules/pdt-registration-form.js';
const integer=n=>Number.isSafeInteger(n)&&n>=0;
/** Scope-checked transport; not registered in live Operation until deployment controls pass. */
export function affectationsTransport({client,getToken,context,contractVersion=1}){
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
   const data=await rpc('sgp_lp_afectaciones_consultar_v'+contractVersion,{p_key:scope.key,p_stage:scope.stage});
   if(data?.contract!=='LP-AFFECTATIONS-'+contractVersion||data.key!==scope.key||data.line!==scope.line||data.stage!==scope.stage||!integer(data.revision)||!Array.isArray(data.reports)||!Array.isArray(data.events)||!Array.isArray(data.capabilities))throw Error('CONTRATO_AFECTACIONES_INVALIDO');
   for(const r of data.reports)if(!r.id||r.originStage!==scope.stage||![r.quantity,r.solved,r.confirmed].every(integer)||r.confirmed>r.solved||r.solved>r.quantity)throw Error('CONTRATO_AFECTACIONES_INVALIDO');
   if(data.pickingPending&&(!Array.isArray(data.pickingPending.rows)||data.pickingPending.rows.some(p=>p.key!==scope.key||p.origin!=='PICKING')))throw Error('PICKING_AMBITO_INVALIDO');
   if(data.aluminumPending&&(!['AVAILABLE','UNAUTHORIZED'].includes(data.aluminumPending.status)||!Array.isArray(data.aluminumPending.rows)||data.aluminumPending.rows.some(p=>p.key!==scope.key||!p.id||p.readOnly!==true)))throw Error('ALUMINIO_AMBITO_INVALIDO');
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
   const {pieces,sourcePicking,ncReference,...cmd}=command;
   if(pieces&&sourcePicking)throw Error('ORIGEN_ALUMINIO_AMBIGUO');
   const data=await rpc(ncReference!==undefined?'sgp_lp_glass_nc_report_v1':sourcePicking?'sgp_lp_afectaciones_desde_picking_v1':pieces?'sgp_lp_afectaciones_aluminio_v1':'sgp_lp_afectaciones_comando_v1',{p_key:scope.key,p_stage:scope.stage,p_date:scope.date,p_shift:scope.shift,p_cmd:cmd,...(ncReference!==undefined?{p_nc:ncReference}:{}),...(pieces?{p_pieces:pieces}:{}),...(sourcePicking?{p_source:sourcePicking}:{})});
   if(data?.contract!=='LP-AFFECTATIONS-COMMAND-1'||data.id!==command.id||!integer(data.revision))throw Error('RESPUESTA_NO_CONFIRMADA');
   return data;
  },
  async readGlassNc(){
   const d=await rpc('sgp_lp_glass_nc_read_v1',{p_key:scope.key,p_stage:scope.stage});
   if(d?.contract!=='LP-GLASS-NC-1'||d.key!==scope.key||d.stage!==scope.stage||!Array.isArray(d.references)||typeof d.canReport!=='boolean'||d.references.some(r=>!r.reportId||typeof r.reference!=='string'||r.verified!==false))throw Error('CONTRATO_NC_V_INVALIDO');
   return {...d,available:true};
  },
  async lookupNc(reference){
   let data;
   try{data=await rpc('sgp_pdt_manual_nc_consultar_v1',{p_referencia:reference});}
   catch(error){if(error.message!=='NO_AUTORIZADO')throw error;await this.read();return null;}
   const nc=data?.nc,normalize=v=>String(v??'').trim().toUpperCase();
   if(data?.ok!==true||!nc||![nc.numero,nc.consecutivo].some(v=>v!=null&&normalize(v)===normalize(reference)))return null;
   return typeof nc.estado==='string'&&nc.estado.trim()?nc.estado:null;
  },
  async legacy(){
   const data=await rpc('sgp_lp_afectaciones_legado_v1',{p_key:scope.key,p_stage:scope.stage});
   if(data?.contract!=='LP-AFFECTATIONS-LEGACY-1'||data.key!==scope.key||data.stage!==scope.stage||!Array.isArray(data.sources))throw Error('CONTRATO_LEGADO_INVALIDO');return data;
  },
  async reconcile({id,snapshot,mappings,observation}){
   const data=await rpc('sgp_lp_afectaciones_conciliar_v1',{p_key:scope.key,p_stage:scope.stage,p_id:id,p_fingerprint:snapshot.fingerprint,p_revision:snapshot.revision,p_mappings:mappings,p_observation:observation});
   if(data?.contract!=='LP-AFFECTATIONS-RECONCILIATION-1'||data.id!==id)throw Error('RESPUESTA_NO_CONFIRMADA');return data;
  },
  async mountAluminumDraft(host,onChange=()=>{}){
   // Reuses Picking's exact verified fabrication/length picker while preserving actual stage and NC rules.
   // Never call saveRegistration here: all writes use the joint server transaction.
   try{return await mountPdtRegistration(host,{client,token:getToken(),origin:scope.stage,context:{key_produccion:scope.key,produccion:scope.production,reserva:scope.reserve},selectionStyle:'table',onChange});}
   catch(error){host.textContent=error.message;}
  }
 };
}
