// Picking delivery report v1 — pure frontend model, no database calls.
// IMPORTANT: event counts are not physical units delivered.
export function normalizeReportFilters({from,to,shift='',system=''}={}){
 const date=/^\d{4}-\d{2}-\d{2}$/;
 if(!date.test(from||'')||!date.test(to||'')||from>to)throw new Error('Seleccione un rango de fechas válido');
 if(shift&&!['TURNO 1','TURNO 2'].includes(shift))throw new Error('Turno inválido');
 return {from,to,shift,system:String(system||'').trim()};
}
export function summarizeDeliveryEvents(events=[]){
 const unique=new Set(),bySystem=new Map();
 let complete=0,partial=0,missingRows=0,missingQuantity=0;
 for(const e of events){
  const system=String(e.sistema||'SIN SISTEMA');
  const key=JSON.stringify([e.key_produccion_parte||e.id_programacion,e.key_produccion_parte?'':e.produccion,system]);
  unique.add(key);
  if(!bySystem.has(system))bySystem.set(system,{sistema:system,movimientos:0,completas:0,parciales:0,producciones:new Set(),faltantes:0});
  const group=bySystem.get(system);
  group.movimientos++;
  group.producciones.add(key);
  if(e.completa===true){complete++;group.completas++;}else{partial++;group.parciales++;}
  const missing=Array.isArray(e.faltantes)?e.faltantes:[];
  missingRows+=missing.length;group.faltantes+=missing.length;
  missingQuantity+=missing.reduce((n,f)=>n+(Number(f.cantidad)||0),0);
 }
 return {movimientos:events.length,produccionesUnicas:unique.size,completas:complete,parciales:partial,filasFaltantes:missingRows,cantidadPiezasFaltantes:missingQuantity,porSistema:[...bySystem.values()].map(g=>({sistema:g.sistema,movimientos:g.movimientos,produccionesUnicas:g.producciones.size,completas:g.completas,parciales:g.parciales,filasFaltantes:g.faltantes})).sort((a,b)=>a.sistema.localeCompare(b.sistema))};
}
export function flattenDeliveryDetails(events=[]){
 return events.flatMap(e=>(Array.isArray(e.faltantes)?e.faltantes:[]).map(f=>({id_entrega:e.id_entrega,fecha_operativa:e.fecha_operativa,turno_entrega:e.turno_entrega,reserva:e.reserva,parte:e.parte,produccion:e.produccion,sistema:e.sistema,perfil:f.perfil,longitud:f.longitud,fabricacion:f.fabricacion,marca:f.marca,cantidad:f.cantidad,nc:f.nc,reserva_pendiente:f.reserva_pendiente})));
}

// Quantities are counted once per programming/production/system, not once per delivery movement.
// Each missing physical piece reduces the effective count by one, per approved operational rule.
export function summarizeDeliveredWindows(events=[]){
 const orders=new Map();
 for(const e of events){
  const system=String(e.sistema||'SIN SISTEMA');
  const key=JSON.stringify([e.id_programacion,e.produccion,system]);
  const quantity=e.cantidad_programada==null?NaN:Number(e.cantidad_programada);
  if(!orders.has(key))orders.set(key,{system,quantity:Number.isFinite(quantity)&&quantity>=0?quantity:null,missing:0,part:!!e.parte_id,delivered:0});
  const order=orders.get(key);
  if(order.quantity===null&&Number.isFinite(quantity)&&quantity>=0)order.quantity=quantity;
  order.missing+=(Array.isArray(e.faltantes)?e.faltantes:[]).reduce((sum,f)=>sum+Math.max(0,Number(f.cantidad)||0),0);
  if(e.parte_id){if(e.cantidad_ventanas_entregadas==null||!Number.isSafeInteger(Number(e.cantidad_ventanas_entregadas)))order.delivered=null;else if(order.delivered!==null)order.delivered+=Number(e.cantidad_ventanas_entregadas);}
 }
 const systems=new Map();let known=0,effective=0,unknown=0;
 for(const order of orders.values()){
  if(!systems.has(order.system))systems.set(order.system,{sistema:order.system,cantidad_orden:0,cantidad_efectiva:0,ordenes_sin_cantidad:0});
  const g=systems.get(order.system);
  if(order.quantity===null||(order.part&&order.delivered===null)){g.ordenes_sin_cantidad++;unknown++;continue;}
  g.cantidad_orden+=order.quantity;
  g.cantidad_efectiva+=order.part?order.delivered:Math.max(0,order.quantity-order.missing);
  known+=order.quantity;effective+=order.part?order.delivered:Math.max(0,order.quantity-order.missing);
 }
 return {porSistema:[...systems.values()],cantidad_orden:known,cantidad_efectiva:effective,ordenes_sin_cantidad:unknown};
}

// Aggregate new parts from explicit window movements; historical formulas remain unchanged.
export function reportQuantityGroups(rows){
 const orders=new Map();
 for(const row of rows){
  const key=JSON.stringify([row.id_programacion,row.produccion,row.sistema]);
  if(!orders.has(key))orders.set(key,{row,delivered:0});
  const order=orders.get(key);
  if(row.parte_id){
   if(row.cantidad_ventanas_entregadas==null||!Number.isSafeInteger(Number(row.cantidad_ventanas_entregadas))||Number(row.cantidad_ventanas_entregadas)<0)order.delivered=null;
   else if(order.delivered!==null)order.delivered+=Number(row.cantidad_ventanas_entregadas);
  }
 }
 const groups=new Map();
 for(const {row,delivered} of orders.values()){
  const key=row.sistema||'SIN SISTEMA';if(!groups.has(key))groups.set(key,{known:0,actual:0,unknown:0});
  const g=groups.get(key),qty=Number(row.cantidad_produccion);
  if(row.cantidad_produccion==null||!Number.isFinite(qty)||(row.parte_id&&delivered===null)){g.unknown++;continue;}
  g.known+=qty;
  g.actual+=row.parte_id?delivered:Math.max(0,qty-(row.faltantes||[]).reduce((n,f)=>n+Math.max(0,Number(f.ventanas_afectadas)||0),0));
 }
 return groups;
}
