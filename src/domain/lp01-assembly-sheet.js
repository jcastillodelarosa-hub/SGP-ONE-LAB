import {exportBalance,exportQuantity} from './lp01-sources.js';
import {originalWeek} from './lp01-tracking.js';
import {currentClosureExportRealized} from './lp01-closure-export-v2.js';

export const ASSEMBLY_STATES=['ABIERTAS','PROGRAMADAS','OTRAS','POR_REVISAR','COMPLETADAS'];
const groupRank=state=>ASSEMBLY_STATES.indexOf(state==='POR_REVISAR'?'OTRAS':state);
const text=v=>typeof v==='string'?v.trim():'';
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+'T12:00:00Z'))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;
const shift=v=>[1,2].includes(v);
const cancelled=a=>['CANCELADA','CANCELADO','ANULADA','ANULADO'].includes(text(a.estado).toUpperCase());
const exactPeriod=(r,c)=>r.line===c.line&&r.stage===c.stage&&r.date===c.date&&r.shift===c.shift;
const period=r=>({line:r.line??r.linea,stage:r.stage??r.etapa,date:r.date??r.fecha,shift:r.shift??r.turno});
const identity=(key,official,line)=>typeof key==='string'&&key.endsWith('|'+line)&&official?.key_produccion===key&&official.id_linea===line;
const priority=a=>exportQuantity(a.prioridad)??Infinity;
const byPriority=(a,b)=>priority(a)-priority(b)||String(a.id??a.parte).localeCompare(String(b.id??b.parte),'es',{numeric:true});

/** Project the shared confirmed-close contract without independently interpreting
 * reports, summing versions/assignments, or falling back to manual ejecutado.
 * The full payload is required: an old report alone cannot prove a current close.
 */
export function assemblyClosure(data,key,context){
 return closureFor(currentClosureExportRealized(data,context),key,context);
}
function closureFor(confirmed,key,context){
 if(confirmed.status!=='CONFIRMED')return null;
 const row=confirmed.rows.find(r=>r.key===key);
 return row?{...row,reportId:row.closureId,date:context.date,shift:context.shift}:null;
}

function validateOperation(row,context){
 if(!row||!identity(row.key,row.oficial,context.line)||!exactPeriod(period(row),context)||!text(row.parte))throw Error('Identidad o ámbito operativo incompatible en Ensamble');
}
function validateProduction(p,context){
 if(!p||!identity(p.key,p.oficial,context.line)||(p.line!==undefined&&p.line!==context.line)||(p.stage!==undefined&&p.stage!==context.stage)||!Array.isArray(p.assignments))throw Error('Identidad de producción incompatible en la hoja de Ensamble');
 const seen=new Set();
 for(const a of p.assignments){
  if(!a||a.key_produccion!==p.key||!text(a.id)||seen.has(a.id)||(a.line!==undefined&&a.line!==context.line)||(a.id_linea!==undefined&&a.id_linea!==context.line))throw Error('Asignación ajena o duplicada en la hoja de Ensamble');
  seen.add(a.id);
 }
}
const officialSignature=o=>JSON.stringify([o.key_produccion,o.id_linea,o.cantidad,o.saldo_ensamble,o.saldos_inicializados,o.presente_ultimo_export,o.excluida_export,o.anio,o.semana_base,o.sistema,o.reserva_al]);

/** LP-OPERACION-1 + additive LP-HOJA-1. Exactly one row per authorized production.
 * Context: {line,stage:'ENSAMBLE',date:'YYYY-MM-DD',shift:1|2}.
 * Catalog assignments describe PROGRAMACION_LINEA, not writes/permissions.
 * Current operational targets are retained separately and never fabricated.
 * Missing catalog is explicitly partial: current operations only.
 */
export function assemblySheetRows(data,context,filters={}){
 if(!context||!['PANELES_2','FRAMES_2'].includes(context.line)||context.stage!=='ENSAMBLE'||!date(context.date)||!shift(context.shift))throw Error('Ámbito de hoja de Ensamble incompatible');
 if(data?.contract!=='LP-OPERACION-1'||!Array.isArray(data.orders)||(data.reports!==undefined&&!Array.isArray(data.reports)))throw Error('Contrato de hoja de Ensamble incompatible');
 const operations=new Map(),operationIds=new Set();
 for(const r of data.orders){
  validateOperation(r,context);
  const id=JSON.stringify([r.key,r.parte]);
  if(operationIds.has(id))throw Error('Contexto operativo duplicado en Ensamble');
  operationIds.add(id);
  if(!operations.has(r.key))operations.set(r.key,[]);
  operations.get(r.key).push(r);
 }
 const catalog=data.catalog;let productions;
 if(catalog!==undefined&&catalog!==null){
  if(catalog.contract!=='LP-HOJA-1'||!exactPeriod(period(catalog),context)||!Array.isArray(catalog.productions))throw Error('Catálogo de Ensamble incompatible o de otro ámbito');
  productions=catalog.productions;
 }else productions=[...operations].map(([key,rows])=>({key,oficial:rows[0].oficial,assignments:[],partial:true,conflictingOfficial:rows.some(r=>officialSignature(r.oficial)!==officialSignature(rows[0].oficial))}));
 const confirmedClosure=currentClosureExportRealized(data,context);
 const seen=new Set(),all=productions.map(p=>{
  validateProduction(p,context);
  if(seen.has(p.key))throw Error('Producción duplicada en la hoja de Ensamble');
  seen.add(p.key);
  const cancelledIds=new Set(p.assignments.filter(cancelled).map(a=>a.id));
  const targets=(operations.get(p.key)||[]).filter(r=>!cancelledIds.has(r.parte)).slice().sort(byPriority);
  const assignments=p.assignments.filter(a=>!cancelled(a)).map(a=>({...a}));
  const currentAssignments=assignments.filter(a=>a.source==='PROGRAMACION_LINEA'&&date(a.fecha)&&shift(a.turno)&&a.fecha===context.date&&a.turno===context.shift).sort(byPriority);
  const scheduleInvalid=assignments.some(a=>a.source!=='PROGRAMACION_LINEA'||!date(a.fecha)||!shift(a.turno)||exportQuantity(a.cantidad)===null||exportQuantity(a.prioridad)===null);
  const quantity=exportQuantity(p.oficial.cantidad),rawBalance=exportBalance(p.oficial,context.stage);
  const valid=quantity!==null&&quantity>0&&rawBalance!==null&&rawBalance<=quantity&&!p.conflictingOfficial;
  const balance=valid?rawBalance:null;
  const scheduled=currentAssignments.length>0;
  const state=!valid?'POR_REVISAR':balance===0?'COMPLETADAS':balance<quantity?'ABIERTAS':scheduleInvalid?'POR_REVISAR':scheduled?'PROGRAMADAS':'OTRAS';
  const closing=closureFor(confirmedClosure,p.key,context);
  const observations=[...new Set([p.observacion,...currentAssignments.map(a=>a.observacion),...targets.map(r=>r.observacion)].map(text).filter(Boolean))];
  const week=originalWeek({oficial:p.oficial});
  const originDates=[...assignments.map(a=>a.fecha),...targets.flatMap(r=>[r.antiguedad_fecha,r.origen_fecha])].filter(date).sort();
  return {key:p.key,id:JSON.stringify([context.line,context.stage,p.key]),linea:context.line,etapa:context.stage,produccion:text(p.oficial.produccion)||text(targets[0]?.produccion)||p.key,oficial:{...p.oficial},
   assignments,currentAssignments,operationTargets:targets,first:targets[0]??null,state,week,balance,quantity,available:null,realized:closing?.quantity??null,realizedSource:closing,
   excludedExport:p.oficial.excluida_export===true,scheduled,priority:Math.min(...currentAssignments.map(priority)),originDate:originDates[0]??null,observations,observation:observations.join(' · '),partial:Boolean(p.partial),reviewReason:!valid?'Cantidad o saldo Export pendiente de validar':scheduleInvalid?'Programación pendiente de validar':null};
 });
 if(catalog&&[...operations.keys()].some(key=>!seen.has(key)))throw Error('El catálogo no contiene una producción del ámbito operativo');
 all.sort((a,b)=>groupRank(a.state)-groupRank(b.state)||compareReservation(a,b)||compareAge(a,b)||a.key.localeCompare(b.key,'es',{numeric:true}));
 // Only the explicit, coordinator-approved backend flag excludes an active row.
 // An absent daily-file row alone is not approval. Historical reports stay intact.
 return filterAssemblySheetRows(all.filter(r=>!r.excludedExport),filters);
}
function compareReservation(a,b){
 // Reservation parts (e.g. 1.4) are not the planner assignment ranking.
 for(const field of ['reserva_al','prioridad_reserva']){
  const left=String(a.oficial[field]??'').trim(),right=String(b.oficial[field]??'').trim();
  const compared=Number(!left)-Number(!right)||left.localeCompare(right,'es',{numeric:true});
  if(compared)return compared;
 }
 return 0;
}
function compareAge(a,b){
 const wa=a.week,wb=b.week;
 return (wa&&wb?wa.year-wb.year||wa.week-wb.week:Number(!wa)-Number(!wb))||String(a.originDate??'9999').localeCompare(String(b.originDate??'9999'));
}
export function filterAssemblySheetRows(rows,{search='',status='',includeCompleted=false}={}){
 const query=text(search).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es');
 return rows.filter(r=>(includeCompleted||status==='COMPLETADAS'||r.state!=='COMPLETADAS')&&(!status||r.state===status)&&(!query||[r.produccion,r.key,r.oficial.sistema,r.oficial.reserva_al,r.oficial.prioridad_reserva,r.week?.label,r.observation,...r.assignments.map(a=>a.id)].some(v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').includes(query))));
}
