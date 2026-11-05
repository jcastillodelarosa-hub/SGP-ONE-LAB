import {operationalRows,AFFECTATIONS} from './lp01-operation.js';
import {originalWeek} from './lp01-tracking.js';
const known=v=>v!==null&&v!==undefined&&v!==''&&Number.isSafeInteger(Number(v))&&Number(v)>=0;
const total=(rows,field)=>rows.every(r=>known(r[field]))?rows.reduce((sum,r)=>sum+Number(r[field]),0):null;
const complete=r=>known(r.programada)&&known(r.total_etapa_parte)&&Number(r.total_etapa_parte)>=Number(r.programada);
const affected=r=>AFFECTATIONS.some(k=>Number(r.afectaciones?.[k])>0);
const priority=g=>Math.min(...g.rows.map(r=>known(r.prioridad)?Number(r.prioridad):Infinity));
/** One visible production per exact process/turn. Assignments retain their own writes. */
export function operationOrders(data,filters={}){
 const grouped=new Map();
 for(const row of operationalRows(data,{line:filters.line})){
  const id=JSON.stringify([row.linea,row.etapa,row.fecha,row.turno,row.key]);
  if(!grouped.has(id))grouped.set(id,{id,key:row.key,rows:[]});grouped.get(id).rows.push(row);
 }
 const q=String(filters.search??'').trim().toLocaleLowerCase('es');
 return [...grouped.values()].filter(g=>!q||g.rows.some(r=>[r.produccion,r.key,r.parte,r.observacion,r.oficial?.sistema,r.oficial?.reserva_al].some(v=>String(v??'').toLocaleLowerCase('es').includes(q)))).map(g=>{
  g.rows.sort((a,b)=>(Number(a.prioridad)||0)-(Number(b.prioridad)||0)||a.parte.localeCompare(b.parte));
  const first=g.rows[0],hasAffectation=g.rows.some(r=>affected(r)||r.individualEvidence?.active),finished=g.rows.every(complete)&&!hasAffectation;
  const started=g.rows.some(r=>Number(r.ejecutado)>0||Number(r.total_etapa_parte)>0);
  const uncertain=g.rows.some(r=>r.individualEvidence?.status==='UNAVAILABLE');
  const state=hasAffectation?'ABIERTAS':finished?(uncertain?'POR_REVISAR':'COMPLETADAS'):g.rows.some(r=>r.abierta)||started?'ABIERTAS':uncertain?'POR_REVISAR':'PROGRAMADAS';
  const origins=g.rows.flatMap(r=>r.individualEvidence?.opening?[r.individualEvidence.opening]:[]).filter(o=>o.eventId&&/^\d{4}-\d{2}-\d{2}$/.test(o.date)&&[1,2].includes(o.shift)).sort((a,b)=>a.date.localeCompare(b.date)||a.shift-b.shift);
  return {...g,first,state,week:originalWeek(first),sale:total(g.rows,'sale'),executed:total(g.rows,'ejecutado'),origin:origins[0]??null,hasAffectation};
 }).sort((a,b)=>['ABIERTAS','PROGRAMADAS','POR_REVISAR','COMPLETADAS'].indexOf(a.state)-['ABIERTAS','PROGRAMADAS','POR_REVISAR','COMPLETADAS'].indexOf(b.state)||(a.state==='ABIERTAS'?String(a.origin?.date??'9999').localeCompare(String(b.origin?.date??'9999'))||(a.origin?.shift??3)-(b.origin?.shift??3):0)||priority(a)-priority(b)||a.key.localeCompare(b.key));
}
export function validateTurnEntry(row,value,observation){
 if(!/^(0|[1-9]\d*)$/.test(String(value))||!Number.isSafeInteger(Number(value)))throw Error('Escribe una cantidad entera no negativa');
 if(!known(row.sale))throw Error('SALE por validar: el coordinador debe confirmar la disponibilidad');
 if(Number(value)<Number(row.sale)&&!String(observation??'').trim())throw Error('Explica por qué el total reportado queda por debajo de SALE');
 return Number(value);
}
