import {officialBalance} from './lp01-operation.js';
export const trackingIdentity=row=>row.trackingId??row.parte;
/** Global read contract: identity is a production, never a fabricated assignment. */
export function globalTrackingData(payload,{line,stage}){
 if(payload?.contract!=='LP-SEGUIMIENTO-1'||payload.line!==line||payload.stage!==stage||!['COORDINADOR','ADMINISTRADOR'].includes(payload.role)||!Array.isArray(payload.productions))throw Error('Contrato de Seguimiento global incompatible o no autorizado');
 const seen=new Set(),history=[];
 const orders=payload.productions.map(p=>{
  if(typeof p.key!=='string'||!p.key.endsWith('|'+line)||p.line!==line||p.stage!==stage||p.oficial?.key_produccion!==p.key||p.oficial?.id_linea!==line||seen.has(p.key)||!Array.isArray(p.assignments)||!Array.isArray(p.operations))throw Error('Identidad global ajena o duplicada');
  seen.add(p.key);
  if(p.assignments.some(a=>a.key_produccion!==p.key)||p.operations.some(o=>o.key!==p.key||o.linea!==line||o.etapa!==stage||!p.assignments.some(a=>a.id===o.parte)))throw Error('Asignación o contexto operativo ajeno');
  const balance=officialBalance({oficial:p.oficial},stage),classification=balance===null||balance===0?'PENDIENTE_CONCILIACION':'ABIERTA';
  if(p.classification!==classification)throw Error('Clasificación incompatible con Export');
  // Keep each exact operational context; never sum snapshots or choose a period silently.
  const targets=p.operations.map(o=>({...o,selectionId:JSON.stringify([o.key,o.parte,o.etapa,o.linea,o.fecha,o.turno])}));
  if(new Set(targets.map(t=>t.selectionId)).size!==targets.length)throw Error('Contexto operativo duplicado');
  for(const h of p.history||[]){if(h.key!==p.key||h.etapa!==stage||h.linea!==line)throw Error('Historial ajeno');history.push(h);}
  return {key:p.key,trackingId:JSON.stringify([p.key,stage]),parte:null,linea:line,etapa:stage,produccion:p.oficial.produccion,oficial:p.oficial,
   global:true,classification,abierta:balance>0,sale:null,ejecutado:null,afectaciones:{},consolidado:null,validado:false,
   assignments:p.assignments,operationTargets:targets,assignmentLabel:p.assignments.length?p.assignments.length+' asignaciones':'Sin asignación',
   observacion:'Selecciona un contexto operativo para consultar sus avances y afectaciones; no se suman turnos.'};
 });
 return {contract:'LP-SEGUIMIENTO-1',role:payload.role,orders,history};
}
