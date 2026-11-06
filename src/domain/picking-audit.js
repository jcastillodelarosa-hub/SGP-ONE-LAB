/** Operational day is the start day of the configured shift, in Colombia. */
export function auditOperationalTime(now,config){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));
 const day=`${parts.year}-${parts.month}-${parts.day}`,minute=Number(parts.hour)*60+Number(parts.minute);
 const minutes=s=>{if(!/^\d{2}:\d{2}$/.test(s||''))throw Error('Configuración de turnos incompleta');const [h,m]=s.split(':').map(Number);if(h>23||m>59)throw Error('Horario inválido');return h*60+m;};
 for(const offset of [-1,0]){
  const date=new Date(day+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+offset);
  const dateText=date.toISOString().slice(0,10),schedule=date.getUTCDay()===0?config?.domingo:config?.lunes_sabado;
  for(const [key,turno] of [['turno1','TURNO 1'],['turno2','TURNO 2']]){
   const start=minutes(schedule?.[key]?.inicio)+offset*1440,end0=minutes(schedule?.[key]?.fin)+offset*1440,end=end0<=start?end0+1440:end0;
   if(minute>=start&&minute<end)return {fecha:dateText,turno};
  }
 }
 return {fecha:day,turno:''}; // Configured gaps require an explicit operational correction.
}
export function auditDecisions(rows){
 return rows.map(row=>{
  if(!['ACEPTAR','MODIFICAR','ELIMINAR'].includes(row.accion))throw Error('Decide cada pendiente antes de guardar.');
  if(row.accion!=='ACEPTAR'&&!row.motivo?.trim())throw Error('Indica el motivo de modificación o anulación.');
  if(row.accion==='MODIFICAR'&&(!row.id_pieza||!row.reserva||!row.acabado||!Number.isInteger(Number(row.cantidad))||Number(row.cantidad)<1||!Number.isInteger(Number(row.ventanas_afectadas))||Number(row.ventanas_afectadas)<1))throw Error('Selecciona una pieza y cantidades válidas.');
  return {...row};
 });
}
