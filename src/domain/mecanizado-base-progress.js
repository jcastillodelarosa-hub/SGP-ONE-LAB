/** Read-only reconciliation. Base quantities are never inferred from machining assignments. */
const text=value=>String(value??'').trim();
const quantity=value=>{
 if(value===null||value===undefined||value===''||!Number.isSafeInteger(Number(value))||Number(value)<0)throw new Error('Cantidad inválida o ausente');
 return Number(value);
};
/** The protected weekly-base RPC scopes rows by semana_base, not semana_actual. */
const weekOf=row=>Number(row.semana_base);
const primary=row=>text(row.reserva_al??row.reserva).split(',')[0].trim();
const pct=(value,total)=>value===null||!total?null:100*value/total;
function deduplicate(rows,key,signature){
 if(!Array.isArray(rows))throw new Error('Fuente de conciliación incompleta');
 const result=new Map();
 for(const row of rows){const id=key(row);if(!id)throw new Error('Registro sin identidad verificable');
  if(result.has(id)&&signature(result.get(id))!==signature(row))throw new Error('Duplicados contradictorios en fuente de conciliación');
  result.set(id,row);
 }return [...result.values()];
}

export function basePhysicalProgress(input,{year,weeks,line='PANELES_2',system=''}){
 const {base,receipts,shared,schedule,executions,orderExecutions,moves,links,coverage}=input;
 for(const rows of [base,receipts,shared,schedule,executions,orderExecutions,moves,links,coverage])if(!Array.isArray(rows))throw new Error('Consulta de conciliación incompleta');
 for(const r of receipts)if(!text(r.reserva))throw new Error('Recepción sin identidad de reserva');
 for(const r of shared)if(!text(r.key_produccion))throw new Error('Relación compartida sin identidad de producción');
 for(const r of links)if(!text(r.key_produccion)||!text(r.reserva)||!text(r.id_linea))throw new Error('Relación maestra incompleta');
 for(const r of executions)if(!text(r.id_programacion)||!text(r.estado))throw new Error('Ejecución agregada incompleta');
 for(const r of orderExecutions)if(!text(r.id_programacion)||!text(r.produccion)||!text(r.estado))throw new Error('Ejecución por orden incompleta');
 for(const r of moves)if(!text(r.id_origen)||!text(r.id_destino))throw new Error('Reprogramación incompleta');
 const chosen=new Set(weeks.map(Number));
 if(!Number.isInteger(year)||year<2020||year>2100||![...chosen].every(w=>Number.isInteger(w)&&w>=1&&w<=53))throw new Error('Año o semana inválidos');
 if(line!=='PANELES_2')throw new Error('Línea no habilitada para este resumen de mecanizado');
 const warnings=new Set(),issues=new Map();
 const warn=(key,message)=>{warnings.add(message);const set=issues.get(key)||new Set();set.add(message);issues.set(key,set);};
 const productions=deduplicate(base,row=>text(row.key_produccion),row=>JSON.stringify([row.id_linea,row.anio,weekOf(row),row.sistema,row.cantidad,row.produccion,row.reserva_al]));
 const records=new Map();
 for(const row of productions){
  // Validate the whole payload identity even if an RPC unexpectedly returns another scope.
  if(!row.id_linea||!Number.isInteger(Number(row.anio))||!Number.isInteger(weekOf(row)))throw new Error('La base no acredita línea/año/semana');
  if(row.id_linea!==line||Number(row.anio)!==year||!chosen.has(weekOf(row)))continue;
  const key=text(row.key_produccion),q=quantity(row.cantidad);
  records.set(key,{...row,key,system:text(row.sistema)||'SIN SISTEMA',programmed:q,received:null,partialReceiptBase:0,processed:0,assigned:0,allocationInvalid:false});
 }
 const relation=key=>shared.filter(row=>text(row.key_produccion)===key);
 const requiredReserves=p=>{
  const metadata=relation(p.key);if(metadata.length>1&&new Set(metadata.map(m=>JSON.stringify([m.reserva_principal,m.es_reserva_compartida,m.reservas]))).size>1)throw new Error('Relaciones de reserva contradictorias');
  const item=metadata[0];
  if(p.reserva_compartida===true&&!item?.es_reserva_compartida)throw new Error('Producción compartida sin relaciones acreditadas');
  const principal=text(item?.reserva_principal)||primary(p);
  const required=new Set(principal?[principal]:[]);
  if(item?.es_reserva_compartida){
   if(!Array.isArray(item.reservas))throw new Error('Reserva compartida sin detalle verificable');
   for(const r of item.reservas)if(r.tipo==='PRINCIPAL'||r.es_principal_compartida===true||r.tipo==='COMPARTIDA')required.add(text(r.reserva));
   if(required.size<2)throw new Error('Reserva compartida con relaciones incompletas');
  }
  required.delete('');return [...required];
 };
 const reserveSets=new Map();
 for(const p of records.values()){
  try{
   const reserves=requiredReserves(p);reserveSets.set(p.key,new Set(reserves));
   if(!reserves.length)throw new Error('Producción sin reserva de recepción verificable');
   const statuses=reserves.map(reserve=>{
    const rows=receipts.filter(r=>text(r.reserva)===reserve);
    if(!rows.length)return 'pending';
    const signatures=new Set(rows.map(r=>JSON.stringify([r.estado,r.completa,r.fecha_recepcion??r.fecha_recepcion_operativa])));
    if(signatures.size!==1)throw new Error('Recepciones contradictorias para una reserva');
    const r=rows[0];
    if(text(r.estado).toUpperCase()!=='RECIBIDA')return 'pending';
    const date=r.fecha_recepcion??r.fecha_recepcion_operativa;if(!date||Number.isNaN(Date.parse(date)))throw new Error('Recepción sin fecha verificable');
    if(r.completa!==true)throw new Error('Recepción parcial sin cantidad de ventanas por producción: pendiente de conciliación');
    return 'complete';
   });
   if(statuses.every(s=>s==='complete'))p.received=p.programmed;
   else if(statuses.every(s=>s==='pending'))p.received=0;
   else throw new Error('Material compartido con recepciones distintas: cantidad de ventanas sin conciliar');
  }catch(error){if(error.message.includes('Recepción parcial sin cantidad'))p.partialReceiptBase=p.programmed;warn(p.key,error.message);}
 }
 const schedules=deduplicate(schedule.filter(r=>r.tipo!=='ARRASTRE'&&!r.arrastre),r=>text(r.id_programacion),r=>JSON.stringify([r.reserva,r.sistema,r.produccion,r.cantidad_programada,r.estado,r.prioridad_semanal]));
 const byId=new Map(schedules.map(r=>[text(r.id_programacion),r]));
 const exec=new Map(deduplicate(executions,r=>text(r.id_programacion),r=>JSON.stringify([r.estado,r.cantidad_procesada])).map(r=>[text(r.id_programacion),r]));
 const orders=deduplicate(orderExecutions,r=>JSON.stringify([r.id_programacion,r.produccion]),r=>text(r.estado));
 const events=deduplicate(moves,r=>JSON.stringify([r.id_origen,r.id_destino,r.produccion]),r=>JSON.stringify([r.id_origen,r.id_destino,r.produccion]));
 const affected=row=>[...records.values()].filter(p=>p.system===text(row.sistema)&&(!row.produccion||text(p.produccion)===text(row.produccion))&&(reserveSets.get(p.key)?.has(text(row.reserva))||links.some(l=>text(l.key_produccion)===p.key&&text(l.reserva)===text(row.reserva))));
 const fail=(rows,message)=>{for(const p of rows){p.allocationInvalid=true;warn(p.key,message);}};
 const root=row=>{
  const seen=new Set();while(true){const id=text(row.id_programacion);if(seen.has(id))throw new Error('Ciclo de reprogramaciones');seen.add(id);
   const parents=[...new Set(events.filter(m=>text(m.id_destino)===id).map(m=>text(m.id_origen)))];if(!parents.length)return row;
   if(parents.length!==1||!byId.has(parents[0]))throw new Error('Origen de traslado sin identidad verificable');
   const parent=byId.get(parents[0]);if(text(parent.reserva)!==text(row.reserva)||text(parent.sistema)!==text(row.sistema))throw new Error('Traslado con reserva/sistema contradictorios');row=parent;
  }
 };
 for(const row of schedules){
  if(['CANCELADA','REPROGRAMADO'].includes(row.estado))continue;
  const candidates=affected(row);if(!candidates.length)continue;let failureCandidates=candidates;
  try{
   const outgoing=events.filter(e=>text(e.id_origen)===text(row.id_programacion));
   if(outgoing.some(e=>!byId.has(text(e.id_destino))))throw new Error('Destino de traslado no disponible');
   if(!row.produccion)failureCandidates=candidates.filter(p=>!outgoing.some(e=>e.produccion===p.produccion));
   if(outgoing.some(e=>!e.produccion||e.produccion===row.produccion))continue;
   const origin=root(row),originYear=Number(origin.anio??String(origin.fecha_programacion||'').slice(0,4));
   if(originYear!==year)throw new Error('Asignación de otro año o sin año de origen verificable');
   const q=quantity(row.cantidad_programada);let allocations=[];
   if(row.produccion){
    if(candidates.length!==1)throw new Error('Producción/reserva/sistema no identifican una asignación única');
    allocations=[{p:candidates[0],q}];
   }else{
    const group=coverage.filter(c=>text(c.reserva)===text(row.reserva)&&text(c.prioridad_semanal)===text(row.prioridad_semanal)&&c.estado_orden==='PROGRAMADA');
    const unique=deduplicate(group,c=>text(c.key_produccion)||text(c.produccion),c=>JSON.stringify([c.cantidad,c.produccion,c.key_produccion]));
    if(!unique.length)throw new Error('Parte sin detalle canónico de cantidades');
    let before=0,after=0;
    for(const c of unique){
     const cq=quantity(c.cantidad);before+=cq;
     if(outgoing.some(e=>e.produccion===c.produccion))continue;
     after+=cq;
     const matches=candidates.filter(p=>c.key_produccion?text(c.key_produccion)===p.key:text(c.produccion)===text(p.produccion)&&links.some(l=>text(l.key_produccion)===p.key&&text(l.reserva)===text(row.reserva)));
     if(matches.length>1)throw new Error('Detalle de parte ambiguo por producción');
     if(matches.length===1)allocations.push({p:matches[0],q:cq});
    }
    if(q!==before&&q!==after)throw new Error('Cantidad de parte no concilia con órdenes restantes');
   }
   const e=exec.get(text(row.id_programacion)),oe=orders.filter(o=>text(o.id_programacion)===text(row.id_programacion));
   const partial=e&&e.estado!=='PROCESADO'?quantity(e.cantidad_procesada??0):0;
   if(outgoing.length&&partial>0)throw new Error('Avance parcial de origen trasladado sin distribución verificable');
   const allocated=allocations.reduce((a,x)=>a+x.q,0);
   if(!row.produccion&&partial>0&&allocated!==q)throw new Error('Avance agregado incluye producciones fuera del alcance, sin distribución verificable');
   if(e?.estado==='PROCESADO'&&quantity(e.cantidad_procesada??0)>0&&quantity(e.cantidad_procesada)!==q)throw new Error('Estado PROCESADO y cantidad registrada no concilian');
   if(partial>0&&allocations.length!==1)throw new Error('Avance agregado parcial sin distribución por producción');
   if(partial>allocated)throw new Error('Cantidad procesada supera su asignación: no se recorta');
   for(const {p,q:aq} of allocations){
    p.assigned+=aq;
    const complete=e?.estado==='PROCESADO'||oe.some(o=>o.produccion===p.produccion&&o.estado==='PROCESADO');
    if(complete&&partial>0&&partial!==aq)throw new Error('Ejecución agregada y por orden contradictorias');
    p.processed+=complete?aq:partial;
   }
  }catch(error){fail(failureCandidates,error.message);}
 }
 for(const p of records.values()){
  if(p.assigned>p.programmed){p.allocationInvalid=true;warn(p.key,'Asignaciones acumuladas superan la programación base: no se recortan');}
  if(p.allocationInvalid)p.processed=null;
  if(p.processed!==null&&p.received!==null&&p.processed>p.received)warn(p.key,'Procesadas supera recibidas registradas; revisar origen, sin recorte silencioso');
 }
 const grouped=new Map();
 for(const p of records.values()){
  if(system&&p.system!==system)continue;
  const r=grouped.get(p.system)||{system:p.system,programmed:0,received:0,processed:0,receivedKnown:0,partialReceiptBase:0,processedKnown:0,unresolved:0,warnings:new Set()};
  r.programmed+=p.programmed;r.receivedKnown+=p.received??0;r.partialReceiptBase+=p.partialReceiptBase;r.processedKnown+=p.processed??0;
  r.received=r.received===null||p.received===null?null:r.received+p.received;
  r.processed=r.processed===null||p.processed===null?null:r.processed+p.processed;
  if(issues.has(p.key)){r.unresolved++;for(const message of issues.get(p.key))r.warnings.add(message);}
  grouped.set(p.system,r);
 }
 const finish=r=>({...r,pending:r.processed===null?null:r.programmed-r.processed,receivedPercent:pct(r.received,r.programmed),percent:pct(r.processed,r.programmed),consistent:r.unresolved===0&&r.received!==null&&r.processed!==null&&r.programmed>=r.received&&r.received>=r.processed,warnings:[...r.warnings]});
 const rows=[...grouped.values()].sort((a,b)=>a.system.localeCompare(b.system)).map(finish);
 const t=rows.reduce((a,r)=>({programmed:a.programmed+r.programmed,received:a.received===null||r.received===null?null:a.received+r.received,processed:a.processed===null||r.processed===null?null:a.processed+r.processed,receivedKnown:a.receivedKnown+r.receivedKnown,partialReceiptBase:a.partialReceiptBase+r.partialReceiptBase,processedKnown:a.processedKnown+r.processedKnown,unresolved:a.unresolved+r.unresolved,warnings:new Set([...a.warnings,...r.warnings])}),{programmed:0,received:0,processed:0,receivedKnown:0,processedKnown:0,unresolved:0,warnings:new Set()});
 const total=finish(t);return {rows,total,warnings:[...t.warnings],complete:rows.every(r=>r.consistent&&r.unresolved===0),baseCount:[...records.values()].filter(p=>!system||p.system===system).length};
}
