/** B19 report model. Production identity is the key, never reservation text. */
export function glassLocationSummary(rows=[]){
 const racks=new Map(),orders=new Set();
 const sums={prepared:0,novelty:0,transfer:0,other:0,racks:0,mixed:0,orders:0};
 for(const row of rows){
  const n=k=>Math.max(0,Number(row[k])||0);
  sums.prepared+=n('preparadas');sums.novelty+=n('novedad');sums.transfer+=n('traslado');
  sums.other+=row.otros!=null?n('otros'):Math.max(0,n('unidades')-n('preparadas')-n('novedad')-n('traslado'));
  if(row.key_produccion)orders.add(String(row.key_produccion));
  const rack=String(row.posicion||'').trim();if(!rack||rack==='SIN UBICACIÓN')continue;
  if(!racks.has(rack))racks.set(rack,new Set());
  // A principal reservation is a group, not several repeated window counts.
  for(const reservation of String(row.reservas_origen||row.reserva||'').split(',').map(x=>x.trim()).filter(Boolean))racks.get(rack).add(reservation);
 }
 sums.racks=racks.size;sums.mixed=[...racks.values()].filter(x=>x.size>1).length;sums.orders=orders.size;return sums;
}
export function glassLocationReportCSV(rows=[],weeks=new Map()){
 const cell=v=>'"'+String(v??'').replace(/^[=+@\-]/,"'$&").replaceAll('"','""')+'"';
 const header=['Semana','Reserva','Prioridad / parte','Producción','Sistema','Acabado','Ventanas (orden)','Burro / ubicación','Preparados','Novedad','Traslado','Otros','Total vidrios'];
 const records=rows.map(r=>[weeks.get(String(r.key_produccion))||'',String(r.reserva||'').split(',')[0].trim(),r.parte,r.produccion,r.sistema,r.acabado,r.ventanas,r.posicion,r.preparadas,r.novedad,r.traslado,r.otros??Math.max(0,(Number(r.unidades)||0)-(Number(r.preparadas)||0)-(Number(r.novedad)||0)-(Number(r.traslado)||0)),r.unidades]);
 return '\uFEFF'+[header,...records].map(row=>row.map(cell).join(';')).join('\r\n');
}
