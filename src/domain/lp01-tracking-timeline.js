/** Latest recorded LP total per exact assignment/day/shift, never summed snapshots. */
export function trackingTimeline(row){
 const seen=new Set();
 return (row.operationTargets||[]).map(o=>{
  if(o.key!==row.key||o.linea!==row.linea||o.etapa!==row.etapa||!o.parte||!/^\d{4}-\d{2}-\d{2}$/.test(o.fecha)||![1,2].includes(Number(o.turno)))throw Error('Contexto de historial incompatible');
  const id=JSON.stringify([o.key,o.linea,o.etapa,o.fecha,Number(o.turno),o.parte]);
  if(seen.has(id))throw Error('Contexto de historial duplicado');seen.add(id);
  if(o.ejecutado!==null&&o.ejecutado!==undefined&&typeof o.ejecutado!=='number'&&!/^\d+$/.test(String(o.ejecutado)))throw Error('Avance de historial inválido');
  const quantity=o.ejecutado===null||o.ejecutado===undefined?null:Number(o.ejecutado);
  if(quantity!==null&&(!Number.isSafeInteger(quantity)||quantity<0))throw Error('Avance de historial inválido');
  return {date:o.fecha,shift:Number(o.turno),assignment:o.parte,quantity};
 }).sort((a,b)=>a.date.localeCompare(b.date)||a.shift-b.shift||a.assignment.localeCompare(b.assignment));
}
