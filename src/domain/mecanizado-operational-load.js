/** Read models only: operational workload is not physical progress or schedule history. */
export const normalizeShift=value=>{const text=String(value??'').trim().toUpperCase();return ['1','T1','TURNO 1'].includes(text)?'TURNO 1':['2','T2','TURNO 2'].includes(text)?'TURNO 2':null;};
export const displayMachiningState=value=>!value||value==='PROGRAMADA'?'SIN INICIAR':value;
const amount=value=>{const n=Number(value);if(!Number.isSafeInteger(n)||n<0)throw new Error('Cantidad operativa inválida');return n;};
const identity=row=>JSON.stringify([row.reserva,row.key_produccion||row.produccion,row.sistema,row.acabado]);
export function normalizeCarry(rows,date,shift){
 const target=normalizeShift(shift);if(!target||!Array.isArray(rows))throw new Error('Respuesta de arrastres inválida');
 const seen=new Map();
 for(const row of rows){
  if(!row.id_programacion_origen||!row.key_produccion)throw new Error('Arrastre sin identidad de origen/pieza de producción');
  if(row.estado==='CANCELADA'||row.estado==='REPROGRAMADO')continue;
  // A completion belongs only to the shift certified by the RPC. Never roll it forward ourselves.
  if(row.estado==='PROCESADO'&&!row.culminado_en_turno&&!row.fecha_culminacion)continue;
  const key=JSON.stringify([date,target,row.id_programacion_origen,row.reserva,row.key_produccion]);
  const normalized={...row,_targetDate:date,_targetShift:target};
  if(seen.has(key)){if(amount(seen.get(key).cantidad)!==amount(row.cantidad))throw new Error('Arrastre duplicado con cantidades contradictorias');continue;}
  amount(row.cantidad);seen.set(key,normalized);
 }
 return [...seen.values()];
}
export function applyScheduleMoves(schedule,moves=[],dates=null){
 const byId=new Map(schedule.map(row=>[String(row.id_programacion),row]));const notes=[],adjusted=new Map(),seen=new Set(),warnings=[];
 for(const move of moves){
  const source=byId.get(String(move.id_origen));if(!source||(dates&&!dates.includes(source.fecha_programacion)))continue;
  const target=byId.get(String(move.id_destino));
  const key=JSON.stringify([move.id_origen,move.id_destino,move.produccion]);if(seen.has(key))continue;seen.add(key);
  const date=target?.fecha_programacion||move.fecha_destino,shift=normalizeShift(target?.turno||move.turno_destino);
  const note={...source,tipo:'MOVIDA',produccion:move.produccion||source.produccion,fecha_destino:date,turno_destino:shift,cantidad_programada:0};notes.push(note);
  if(!date||!shift)warnings.push('Destino no disponible para la programación '+source.id_programacion);
  const current=adjusted.get(String(source.id_programacion))??amount(source.cantidad_programada);
  if(!move.produccion||source.produccion===move.produccion)adjusted.set(String(source.id_programacion),0);
  else if(Array.isArray(source._ordenes_operativas)){
   // Only a server-provided list of remaining orders can resolve a partial source safely.
   adjusted.set(String(source.id_programacion),source._ordenes_operativas.filter(order=>!moves.some(event=>String(event.id_origen)===String(source.id_programacion)&&event.produccion===order.produccion)).reduce((sum,order)=>sum+amount(order.cantidad),0));
  }else if(move.cantidad_origen_antes!=null&&move.cantidad_origen_despues!=null&&[amount(move.cantidad_origen_antes),amount(move.cantidad_origen_despues)].includes(current)){
   adjusted.set(String(source.id_programacion),amount(move.cantidad_origen_despues));
  }
  else {adjusted.set(String(source.id_programacion),0);warnings.push('Cantidad del traslado parcial no verificable: '+source.id_programacion);}
 }
 const rows=schedule.map(row=>({...row,cantidad_programada:adjusted.get(String(row.id_programacion))??row.cantidad_programada})).filter(row=>(!dates||dates.includes(row.fecha_programacion))&&row.estado!=='CANCELADA'&&row.estado!=='REPROGRAMADO'&&amount(row.cantidad_programada)>0);
 return {rows,notes,warnings};
}
export function operationalLoad(schedule,carry,moves=[],dates=null){
 const moved=applyScheduleMoves(schedule,moves,dates),rows=[],seen=new Map();
 for(const row of moved.rows){if(!normalizeShift(row.turno)){moved.warnings.push('Turno no reconocido: '+row.id_programacion);continue;}const key=String(row.id_programacion);if(seen.has(key)){if(JSON.stringify(seen.get(key))!==JSON.stringify(row))throw new Error('Programación duplicada contradictoria');continue;}seen.set(key,row);rows.push({...row,tipo:'NUEVA',turno:normalizeShift(row.turno),estado_ejecucion:displayMachiningState(row.estado_ejecucion||row._estado_produccion||row.ejecucion?.estado),fecha_origen:row.fecha_programacion,turno_origen:row.turno});}
 const carries=new Map();
 for(const row of carry){
  const date=row._targetDate,shift=normalizeShift(row._targetShift);if(!date||!shift)throw new Error('Arrastre sin turno destino');
  const key=JSON.stringify([date,shift,identity(row)]);
  if(carries.has(key)){const previous=carries.get(key);if(amount(previous.cantidad)!==amount(row.cantidad))throw new Error('Arrastre duplicado contradictorio');if(String(previous.id_programacion_origen)!==String(row.id_programacion_origen))throw new Error('Dos orígenes para el mismo arrastre');continue;}
  carries.set(key,row);
  // An explicit same-order destination schedule wins over carry; never match by production name alone.
  if(moves.some(move=>String(move.id_origen)===String(row.id_programacion_origen)&&(!move.produccion||move.produccion===row.produccion)&&rows.some(target=>String(target.id_programacion)===String(move.id_destino)&&target.fecha_programacion===date&&target.turno===shift&&target.reserva===row.reserva&&target.sistema===row.sistema)))continue;
  if(rows.some(x=>x.fecha_programacion===date&&x.turno===shift&&identity(x)===identity(row)&&x.key_produccion))continue;
  rows.push({...row,tipo:'ARRASTRE',fecha_programacion:date,turno:shift,cantidad_programada:amount(row.cantidad),estado_ejecucion:displayMachiningState(row.estado)});
 }
 return {...moved,rows};
}
export function workloadTotals(rows){
 const bySystem={};let nuevas=0,arrastre=0;
 for(const row of rows){const n=amount(row.cantidad_programada);if(row.tipo==='ARRASTRE')arrastre+=n;else nuevas+=n;const s=row.sistema||'SIN SISTEMA';bySystem[s]=(bySystem[s]||0)+n;}
 const total=nuevas+arrastre;return {nuevas,arrastre,total,bySystem,capacity:90,occupancy:total/90*100};
}

/** @deprecated Assigned-only historical model. Current base denominator uses mecanizado-base-progress.js.
 * Kept for compatibility; never use this model as the production-base denominator. */
export function physicalProgress({schedule,executions,orderExecutions,moves,links,coverage},weeks,system=''){
 for(const value of [schedule,executions,orderExecutions,moves,links,coverage])if(!Array.isArray(value))throw new Error('Consulta de avance incompleta');
 const selected=new Set(weeks.map(Number)),warnings=[],excluded=new Set(),byId=new Map(),totals=new Map();
 const warn=(row,message)=>{excluded.add(String(row.id_programacion));warnings.push(message);};
 const n=v=>{if(v==null||v===''||!Number.isSafeInteger(Number(v))||Number(v)<0)throw new Error('Cantidad de avance inválida');return Number(v);};
 const id=v=>String(v??'');
 const unique=(rows,key)=>{const result=new Map();for(const row of rows){const k=key(row);if(result.has(k)&&JSON.stringify(result.get(k))!==JSON.stringify(row))throw new Error('Registros de avance duplicados contradictorios');result.set(k,row);}return [...result.values()];};
 for(const row of unique(schedule.filter(x=>x.tipo!=='ARRASTRE'&&!x.arrastre),x=>id(x.id_programacion))){if(!row.id_programacion)throw new Error('Programación sin identidad');byId.set(id(row.id_programacion),row);}
 const exec=new Map(unique(executions,x=>id(x.id_programacion)).map(x=>[id(x.id_programacion),x]));
 const oe=unique(orderExecutions,x=>JSON.stringify([x.id_programacion,x.produccion]));
 const events=unique(moves,x=>JSON.stringify([x.id_origen,x.id_destino,x.produccion]));
 const root=row=>{const seen=new Set();while(true){const key=id(row.id_programacion);if(seen.has(key))throw new Error('Ciclo de reprogramaciones');seen.add(key);const parents=[...new Set(events.filter(m=>id(m.id_destino)===key).map(m=>id(m.id_origen)))];if(!parents.length)return row;if(parents.length!==1||!byId.has(parents[0]))throw new Error('Origen de reprogramación no disponible');const parent=byId.get(parents[0]);if(id(parent.reserva)!==id(row.reserva)||parent.sistema!==row.sistema)throw new Error('Reprogramación con identidad de reserva/sistema inconsistente');row=parent;}};
 const lineLinks=row=>links.filter(l=>l.id_linea==='PANELES_2'&&id(l.reserva)===id(row.reserva)&&(!row.produccion||l.produccion===row.produccion)&&(!row.acabado||!l.acabado_reserva||l.acabado_reserva===row.acabado));
 const originWeek=row=>{const explicit=['semana_origen','semana_programacion','semana_prog','semana'].map(k=>Number(row[k])).find(v=>Number.isInteger(v)&&v>=1&&v<=53);if(explicit)return explicit;const matches=lineLinks(row),weeks=matches.map(l=>Number(l.semana_produccion));if(!matches.length||weeks.some(v=>!Number.isInteger(v)||v<1||v>53))return null;const values=new Set(weeks);return values.size===1?[...values][0]:null;};
 for(const row of byId.values()){
  if(row.tipo==='ARRASTRE'||row.arrastre||row.estado==='CANCELADA'||row.estado==='REPROGRAMADO')continue;
  const name=String(row.sistema||'SIN SISTEMA').trim();if(system&&name!==system)continue;
  let origin,week;try{origin=root(row);week=originWeek(origin);}catch(e){warn(row,e.message);continue;}
  if(week===null){warn(row,'Programaciones excluidas: semana de origen no inequívoca.');continue;}if(!selected.has(week))continue;
  try{
   const outgoing=events.filter(m=>id(m.id_origen)===id(row.id_programacion));
   if(outgoing.some(m=>!byId.has(id(m.id_destino))))throw new Error('Destino de reprogramación no disponible');
   if(outgoing.some(m=>!m.produccion||m.produccion===row.produccion)){
    if(outgoing.some(m=>!byId.has(id(m.id_destino))))throw new Error('Destino de reprogramación no disponible');
    continue;
   }
   const header=n(row.cantidad_programada),state=exec.get(id(row.id_programacion));
   const orders=oe.filter(e=>id(e.id_programacion)===id(row.id_programacion)&&!outgoing.some(m=>m.produccion===e.produccion));
   const completed=orders.filter(e=>e.estado==='PROCESADO');let quantity=header,orderDone=0;
   if(outgoing.length||completed.length&&!row.produccion){
    // Existing coverage RPC supplies canonical quantities; only accept an exact part/identity match.
    const candidates=coverage.filter(c=>id(c.reserva)===id(row.reserva)&&id(c.prioridad_semanal)===id(row.prioridad_semanal)&&c.estado_orden==='PROGRAMADA'&&lineLinks(row).some(l=>l.produccion===c.produccion&&(!c.key_produccion||c.key_produccion===l.key_produccion)));
    const quantities=new Map();for(const c of candidates){const keys=new Set(lineLinks(row).filter(l=>l.produccion===c.produccion&&(!c.key_produccion||c.key_produccion===l.key_produccion)).map(l=>l.key_produccion));if(keys.size!==1)throw new Error('Identidad de orden no inequívoca');const q=n(c.cantidad);if(quantities.has(c.produccion)&&quantities.get(c.produccion)!==q)throw new Error('Cantidad por orden ambigua');quantities.set(c.produccion,q);}
    const remaining=[...quantities].filter(([production])=>!outgoing.some(m=>m.produccion===production));
    const before=[...quantities.values()].reduce((a,b)=>a+b,0),after=remaining.reduce((a,[,q])=>a+q,0);
    if(!quantities.size||!(header===before||header===after))throw new Error('Detalle por orden no conciliado con la programación');
    quantity=after;for(const order of completed){if(!remaining.some(([production])=>production===order.produccion))throw new Error('Ejecución por orden sin cantidad verificable');orderDone+=quantities.get(order.produccion);}
   }else if(row.produccion&&completed.some(e=>e.produccion===row.produccion))orderDone=quantity;
   if(outgoing.length&&state&&state.estado!=='PROCESADO'&&n(state.cantidad_procesada??0)>0)throw new Error('Avance agregado de origen parcialmente trasladado requiere conciliación por orden');
   let processed=state?.estado==='PROCESADO'?quantity:Math.min(quantity,Math.max(0,state?n(state.cantidad_procesada??0):0));
   if(processed>0&&processed<quantity&&orderDone>0&&processed!==orderDone)throw new Error('Ejecución parcial agregada y por orden requieren conciliación');
   processed=Math.max(processed,Math.min(quantity,orderDone));
   const total=totals.get(name)||{system:name,programmed:0,processed:0,pending:0,percent:null};total.programmed+=quantity;total.processed+=processed;totals.set(name,total);
  }catch(e){warn(row,e.message);}
 }
 const rows=[...totals.values()].sort((a,b)=>a.system.localeCompare(b.system));
 for(const r of rows){r.pending=r.programmed-r.processed;r.percent=r.programmed?100*r.processed/r.programmed:null;}
 const total=rows.reduce((a,r)=>({programmed:a.programmed+r.programmed,processed:a.processed+r.processed,pending:a.pending+r.pending}),{programmed:0,processed:0,pending:0});total.percent=total.programmed?100*total.processed/total.programmed:null;
 return {rows,total,warnings:[...new Set(warnings)],excluded:excluded.size,complete:excluded.size===0};
}
