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
