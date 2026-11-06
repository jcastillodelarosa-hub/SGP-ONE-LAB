import {operationalRows,AFFECTATIONS,officialBalance} from './lp01-operation.js';
import {originalWeek} from './lp01-tracking.js';
const known=v=>['number','string'].includes(typeof v)&&String(v).trim()!==''&&Number.isSafeInteger(Number(v))&&Number(v)>=0;
const total=(rows,field)=>rows.every(r=>known(r[field]))?rows.reduce((sum,r)=>sum+Number(r[field]),0):null;
/** Only Export determines process state. Missing/incompatible values never mean zero. */
export function operationProcessState(row,{scheduled=true}={}){
 const balance=officialBalance(row,row.etapa),amount=row.oficial?.cantidad;
 if(balance===null||!known(amount)||Number(amount)<=0||balance>Number(amount))return 'POR_REVISAR';
 if(balance===0)return 'COMPLETADAS';
 if(balance<Number(amount))return 'ABIERTAS';
 return scheduled?'PROGRAMADAS':'OTRAS';
}
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
  const first=g.rows[0],hasAffectation=g.rows.some(r=>affected(r)||r.individualEvidence?.active);
  const states=g.rows.map(r=>operationProcessState(r,{scheduled:r.officialUnscheduled!==true}));
  const snapshots=new Set(g.rows.map(r=>JSON.stringify([officialBalance(r,r.etapa),r.oficial?.cantidad,originalWeek(r)?.key])));
  const state=new Set(states).size===1&&snapshots.size===1?states[0]:'POR_REVISAR';
  const origins=g.rows.flatMap(r=>r.individualEvidence?.opening?[r.individualEvidence.opening]:[]).filter(o=>o.eventId&&/^\d{4}-\d{2}-\d{2}$/.test(o.date)&&[1,2].includes(o.shift)).sort((a,b)=>a.date.localeCompare(b.date)||a.shift-b.shift);
  return {...g,first,state,officialAvailable:first.officialAvailable??null,officialRealized:first.officialRealized??null,week:originalWeek(first),sale:total(g.rows,'sale'),executed:total(g.rows,'ejecutado'),origin:origins[0]??null,hasAffectation};
 }).sort((a,b)=>['ABIERTAS','PROGRAMADAS','OTRAS','POR_REVISAR','COMPLETADAS'].indexOf(a.state)-['ABIERTAS','PROGRAMADAS','OTRAS','POR_REVISAR','COMPLETADAS'].indexOf(b.state)||(a.state==='ABIERTAS'?String(a.week?.key??'9999').localeCompare(String(b.week?.key??'9999')):0)||priority(a)-priority(b)||a.key.localeCompare(b.key));
}
export function validateTurnEntry(row,value,observation){
 if(!/^(0|[1-9]\d*)$/.test(String(value))||!Number.isSafeInteger(Number(value)))throw Error('Escribe una cantidad entera no negativa');
 if(!known(row.sale))throw Error('SALE por validar: el coordinador debe confirmar la disponibilidad');
 if(Number(value)<Number(row.sale)&&!String(observation??'').trim())throw Error('Explica por qué el total reportado queda por debajo de SALE');
 return Number(value);
}
