const text=v=>String(v??'').trim();
export const groupKey=(reservation,priority)=>JSON.stringify([text(reservation),text(priority)]);
export function preparationGroups(payload){
 if(payload?.contract!=='GLASS-PREPARATION-1'||!Array.isArray(payload.rows)||!Array.isArray(payload.dates))throw new Error('Respuesta de preparación incompatible');
 const groups=new Map(),dates=new Map(payload.dates.map(d=>[groupKey(d.reservation,d.priority),d])),fingerprints=new Map((payload.fingerprints||[]).map(d=>[groupKey(d.reservation,d.priority),d.fingerprint]));
 for(const r of payload.rows){const id=groupKey(r.reservation,r.priority);if(!groups.has(id))groups.set(id,{id,reservation:text(r.reservation),priority:text(r.priority),rows:[],windows:0,systems:new Set(),finishes:new Set(),machiningLots:new Set(),glassLots:new Set(),conflict:false});const g=groups.get(id);if(g.rows.some(x=>x.key===r.key))continue;g.rows.push(r);g.windows+=Number(r.windows)||0;g.systems.add(text(r.system));g.finishes.add(text(r.finish));if(r.machining_lot)g.machiningLots.add(text(r.machining_lot));if(r.glass_lot)g.glassLots.add(text(r.glass_lot));g.conflict||=r.conflict===true;}
 return [...groups.values()].map(g=>{const d=dates.get(g.id);return {...g,system:[...g.systems].filter(Boolean).join(' / '),finish:[...g.finishes].filter(Boolean).join(' / '),machiningLot:[...g.machiningLots].join(' / '),glassLot:[...g.glassLots].join(' / '),date:d?.preparation_date||'',revision:Number(d?.revision||0),fingerprint:fingerprints.get(g.id)||'',writable:!!g.priority&&!g.conflict};}).sort((a,b)=>a.priority.localeCompare(b.priority,'es',{numeric:true})||a.reservation.localeCompare(b.reservation,'es',{numeric:true}));
}
export function preparationExport(groups){return groups.flatMap(g=>g.rows.map(r=>({'Prioridad':g.priority||'Sin prioridad','Reserva':g.reservation,'Producción':r.production,'Sistema':r.system,'Acabado':r.finish,'Ventanas':r.windows,'Fecha preparación':g.date||'Sin fecha','Lote mecanizado':r.machining_lot||'','Lote vidrio':r.glass_lot||'','OVES':r.oves||''})));}
export function preparationCommand(payload,groups,changes,id){
 if(!payload.canWrite)throw new Error('Solo el coordinador o administrador puede guardar fechas.');
 const rows=groups.filter(g=>changes.has(g.id)).map(g=>{const date=changes.get(g.id);if(!g.writable||!g.fingerprint||!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('Selecciona una fecha válida para una prioridad definida.');return {reservation:g.reservation,priority:g.priority,date,revision:g.revision,fingerprint:g.fingerprint};});
 if(!rows.length)throw new Error('No hay fechas modificadas.');
 return {id,year:payload.year,week:payload.week,line:payload.line,changes:rows};
}
