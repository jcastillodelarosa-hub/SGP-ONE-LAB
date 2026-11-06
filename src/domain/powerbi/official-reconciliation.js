import {OFFICIAL_POWERBI_VERSION} from './adapter.js';

const text=v=>typeof v==='string'?v.normalize('NFC').trim():'';
const identity=r=>JSON.stringify([text(r.production),text(r.project),text(r.system)]);
const whole=n=>Number.isSafeInteger(n)&&n>=0;
const minuteLabel=s=>{
 const m=/^(\d{2}):(\d{2}) (am|pm)$/.exec(s);
 if(!m||Number(m[1])<1||Number(m[1])>12||Number(m[2])>59)throw Error('Horario del archivo inválido');
 return String(Number(m[1])%12+(m[3]==='pm'?12:0)).padStart(2,'0')+':'+m[2];
};
/** A target read from the existing server schedule, never a client default. */
function configuredTimes(schedule,context){
 if(!schedule?.timezone||schedule.date!==context.date||schedule.shift!==context.shift||!schedule.start||!schedule.end)throw Error('HORARIO_CONFIGURADO_REQUERIDO');
 const start=Date.parse(schedule.start),end=Date.parse(schedule.end);
 if(!/(Z|[+-]\d{2}:\d{2})$/.test(schedule.start)||!/(Z|[+-]\d{2}:\d{2})$/.test(schedule.end)||!Number.isFinite(start)||!Number.isFinite(end)||end<=start)throw Error('HORARIO_CONFIGURADO_INVALIDO');
 const fmt=new Intl.DateTimeFormat('en-GB',{timeZone:schedule.timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 return [fmt.format(start),fmt.format(end)];
}
/** Reuses the XLSX parser. Catalog and schedule must be obtained by the authorized server.
 * A file supplies totals, not timbre IDs, employees, hours, or assignment allocations.
 */
export function reconcileOfficialPowerBI(parsed,{catalog,line,stage,date,shift,schedule}){
 if(parsed?.adapter!==OFFICIAL_POWERBI_VERSION||parsed.stage!==stage||!['ENSAMBLE','EMPAQUE'].includes(stage)||!['PANELES_2','FRAMES_2'].includes(line)||![1,2].includes(shift))throw Error('CONTRATO_CIERRE_OFICIAL_INVALIDO');
 const times=configuredTimes(schedule,{date,shift});
 if(!Array.isArray(catalog))throw Error('CATALOGO_REQUERIDO');
 const candidates=new Map(),keys=new Set();
 for(const p of catalog){
  if(!p||p.id_linea!==line||typeof p.key_produccion!=='string'||!p.key_produccion.endsWith('|'+line)||keys.has(p.key_produccion))throw Error('CATALOGO_IDENTIDAD_INVALIDA');
  keys.add(p.key_produccion);
  if(![p.produccion,p.proyecto,p.sistema].every(text))continue;
  const id=identity({production:p.produccion,project:p.proyecto,system:p.sistema}),list=candidates.get(id)||[];
  list.push(p.key_produccion);candidates.set(id,list);
 }
 const selected=parsed.records.filter(r=>r.line===line&&r.date===date&&r.shift===shift);
 if(!selected.length)throw Error('ARCHIVO_SIN_PERIODO');
 const rows=[],pending=[],seen=new Map();
 for(const r of selected){
  const label=/^[12]\.\s+(\d{2}:\d{2} (?:am|pm)) - (\d{2}:\d{2} (?:am|pm))$/.exec(r.shiftLabel);
  if(r.stage!==stage||!whole(r.quantity)||![r.production,r.project,r.system].every(text)||!Number.isSafeInteger(r.row)||r.row<2)throw Error('FILA_OFICIAL_INVALIDA');
  if(!label||JSON.stringify(label.slice(1).map(minuteLabel))!==JSON.stringify(times))throw Error('HORARIO_ARCHIVO_NO_COINCIDE');
  const matches=candidates.get(identity(r))||[];
  if(matches.length!==1){pending.push({...r,reason:matches.length?'IDENTIDAD_AMBIGUA':'IDENTIDAD_SIN_CORRESPONDENCIA',candidates:matches});continue;}
  const key=matches[0],prior=seen.get(key);
  const resolved={key,line,stage,date,shift,quantity:r.quantity,production:r.production,project:r.project,system:r.system,sourceRows:[r.row],year:r.year,week:r.week,unit:'VENTANAS'};
  // Different programming dimensions do not prove disjoint production totals.
  if(prior){
   if(prior.reason){prior.sourceRows.push(r.row);continue;}
   rows.splice(rows.indexOf(prior),1);
   const conflict={...resolved,sourceRows:[...prior.sourceRows,r.row],reason:'TOTAL_OFICIAL_REPETIDO',candidates:[key]};
   pending.push(conflict);seen.set(key,conflict);
  }else{rows.push(resolved);seen.set(key,resolved);}
 }
 return {contract:'LP-OFFICIAL-RECONCILIATION-1',context:{line,stage,date,shift},sha256:parsed.sha256,rows,pending,partial:true};
}
