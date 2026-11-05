/** Input must be a scoped server audit projection, never a client assertion of history coverage. */
export function progressEvidence({key,line,stage,events=[],coverage='UNKNOWN'}){
 if(!['ENSAMBLE','EMPAQUE'].includes(stage))throw Error('ETAPA_INVALIDA');
 const seen=new Set();
 const rows=events.map(e=>{
  if(e.key!==key||e.line!==line||e.stage!==stage||!e.id||seen.has(e.id)||!e.assignment||!/^\d{4}-\d{2}-\d{2}$/.test(e.date)||!Number.isFinite(Date.parse(e.date+'T00:00:00Z'))||new Date(e.date+'T00:00:00Z').toISOString().slice(0,10)!==e.date||![1,2].includes(e.shift)||!Number.isSafeInteger(e.quantity)||e.quantity<0||!Number.isSafeInteger(e.before)||e.before<0||!Number.isFinite(Date.parse(e.at)))throw Error('EVIDENCIA_AVANCE_INVALIDA');
  seen.add(e.id);return {...e};
 }).sort((a,b)=>a.date.localeCompare(b.date)||a.shift-b.shift||a.at.localeCompare(b.at)||a.id.localeCompare(b.id));
 const positive=rows.find(e=>e.quantity>0);
 // Existing progress before the first captured event contradicts complete origin coverage.
 const firstByAssignment=new Map();for(const e of rows)if(!firstByAssignment.has(e.assignment))firstByAssignment.set(e.assignment,e);
 const complete=coverage==='FROM_ORIGIN'&&![...firstByAssignment.values()].some(e=>e.before>0);
 const opening=complete&&positive?{date:positive.date,shift:positive.shift,eventId:positive.id,at:positive.at}:null;
 return {events:rows,opening,openingReason:opening?null:!complete?'Sin evidencia completa del primer avance':'Sin avance positivo acreditado'};
}
