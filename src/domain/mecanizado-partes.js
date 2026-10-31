export function positiveInteger(value,label='Cantidad'){
 const n=Number(value);
 if(value==null||value===''||!Number.isSafeInteger(n)||n<1)throw new Error(label+' debe ser un entero positivo.');
 return n;
}
export function proposeParts(available,capacity){
 const qty=positiveInteger(available),cap=positiveInteger(capacity,'Capacidad');
 if(Math.ceil(qty/cap)>100)throw new Error('La propuesta supera 100 partes. Usa una capacidad mayor.');
 const result=[];for(let left=qty;left>0;left-=cap)result.push(Math.min(left,cap));return result;
}
export function validateParts(parts,available){
 if(!Array.isArray(parts)||!parts.length||parts.length>100)throw new Error('Agrega entre 1 y 100 partes.');
 const rows=parts.map(p=>{
  const cantidad=positiveInteger(p.cantidad),prioridad=positiveInteger(p.prioridad,'Prioridad');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(p.fecha)||Number.isNaN(Date.parse(p.fecha+'T12:00:00Z'))||new Date(p.fecha+'T12:00:00Z').toISOString().slice(0,10)!==p.fecha)throw new Error('Selecciona una fecha válida para cada parte.');
  if(!['TURNO 1','TURNO 2'].includes(p.turno))throw new Error('Selecciona el turno de cada parte.');
  return {...p,cantidad,prioridad};
 });
 if(rows.reduce((sum,p)=>sum+p.cantidad,0)>Number(available))throw new Error('Las cantidades superan el saldo disponible. Actualiza las partes.');
 return rows;
}
export function coverageAmount(row){
 if(row.cantidad_programada!=null)return Number(row.cantidad_programada);
 return row.estado_orden==='PROGRAMADA'?Number(row.cantidad||0):0;
}

/** Registered window totals and unresolved material are independent. */
export function partDeliveryStatus(row){
 const remaining=Math.max(0,Number(row.cantidad_ventanas)-Number(row.cantidad_entregada||0));
 const materialPending=Number(row.pdt_abiertos||0)>0;
 return {remaining,materialPending,done:remaining===0&&!materialPending};
}
