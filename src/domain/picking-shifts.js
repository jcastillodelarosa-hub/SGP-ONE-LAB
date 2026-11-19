export function sgpPickingCurrentShift(at=new Date()){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23',weekday:'short'}).formatToParts(at).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
 const date=parts.year+'-'+parts.month+'-'+parts.day,h=Number(parts.hour)+Number(parts.minute)/60;
 const weekday=parts.weekday;
 // Sunday has configured special hours 07-18 and 18-05; other days 07-19 and 19-07.
 if(h>=7)return {fecha:date,turno:h<(weekday==='Sun'?18:19)?'TURNO 1':'TURNO 2'};
 const previous=new Date(Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day)-1,12));
 const prevParts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit',weekday:'short'}).formatToParts(previous).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
 if(prevParts.weekday==='Sun'&&h>=5)return null; // Unconfigured Monday 05:00-07:00: fail closed.
 return {fecha:prevParts.year+'-'+prevParts.month+'-'+prevParts.day,turno:'TURNO 2'};
}
export function sgpPickingFutureShift(fecha,turno,at=new Date()){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(fecha)||!['TURNO 1','TURNO 2'].includes(turno))return true;
 const [y,m,d]=fecha.split('-').map(Number),day=new Date(Date.UTC(y,m-1,d,12));
 if(day.getUTCFullYear()!==y||day.getUTCMonth()!==m-1||day.getUTCDate()!==d)return true;
 const weekday=new Intl.DateTimeFormat('en-US',{timeZone:'America/Bogota',weekday:'short'}).format(day);
 const hour=turno==='TURNO 1'?7:(weekday==='Sun'?18:19);
 return Date.UTC(y,m-1,d,hour+5)>at.getTime();
}
