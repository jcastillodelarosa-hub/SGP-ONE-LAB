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
  const key=JSON.stringify([e.id_programacion,e.produccion,system]);
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
