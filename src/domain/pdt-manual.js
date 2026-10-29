const clean=value=>String(value??'').trim();
export const MANUAL_ORIGINS=Object.freeze(['PICKING','ENSAMBLE','EMPAQUE']);
export function manualGroupKey(row){
 return JSON.stringify([row.key_produccion,row.reserva,row.codigo_sap,clean(row.fabricacion).toLowerCase(),clean(row.marca).toLowerCase(),Number(row.longitud),clean(row.acabado).toUpperCase()]);
}
export function groupPanelSources(rows){
 const groups=new Map();
 for(const row of rows||[]){
  if(row.tipo_pieza!=='PANEL'||row.id_linea!=='PANELES_2'||!row.id_pieza||!row.key_produccion||!row.reserva||!row.codigo_sap)continue;
  const key=manualGroupKey(row),existing=groups.get(key);
  if(existing){
   if(!existing.sourceIds.includes(row.id_pieza)){existing.sourceIds.push(row.id_pieza);existing.cantidad_referencia+=Number(row.cantidad_referencia)||0;}
  }else groups.set(key,{key,key_produccion:row.key_produccion,reserva:row.reserva,produccion:row.produccion,sistema:row.sistema,acabado:row.acabado,codigo_sap:row.codigo_sap,fabricacion:row.fabricacion,marca:row.marca,longitud:Number(row.longitud),cantidad_referencia:Number(row.cantidad_referencia)||0,sourceIds:[row.id_pieza]});
 }
 return [...groups.values()].sort((a,b)=>a.codigo_sap.localeCompare(b.codigo_sap,undefined,{numeric:true})||String(a.fabricacion).localeCompare(String(b.fabricacion),undefined,{numeric:true})||a.longitud-b.longitud);
}
export function manualReportPayload({context,origin,groups,entries,observation}){
 if(!MANUAL_ORIGINS.includes(origin))throw new Error('Selecciona un origen autorizado');
 if(!context?.key_produccion||!context?.reserva||!context?.produccion)throw new Error('Selecciona una producción y reserva verificadas');
 if(!Array.isArray(entries)||!entries.length||entries.length>100)throw new Error('Agrega entre 1 y 100 detalles');
 const used=new Set(),details=entries.map(entry=>{
  const matches=groups.filter(group=>group.key===entry.key);
  if(matches.length!==1)throw new Error('La fabricación seleccionada ya no es verificable');
  const group=matches[0],quantity=Number(entry.cantidad),ncs=(entry.ncs??[entry.nc??'']).map(clean).filter(Boolean),nc=ncs[0]||'';
  if(used.has(group.key))throw new Error('La fabricación está repetida; indica una sola cantidad consolidada');used.add(group.key);
  if(group.key_produccion!==context.key_produccion||group.reserva!==context.reserva||group.produccion!==context.produccion)throw new Error('Fuente ajena a la producción o reserva');
  if(!Number.isSafeInteger(quantity)||quantity<1||quantity>group.cantidad_referencia)throw new Error('Cantidad fuera del total de referencia');
  if(ncs.length>20||new Set(ncs).size!==ncs.length||ncs.some(value=>value.length>120||/[\x00-\x1f\x7f]/.test(value)))throw new Error('NC inválida, repetida o excede 20 NC por pieza');
  return {key:group.key,perfil:group.codigo_sap,fabricacion:group.fabricacion,marca:group.marca,longitud:group.longitud,acabado:group.acabado,cantidad:quantity,nc,ncs,observacion:clean(entry.observacion)};
 });
 return {context:{key_produccion:context.key_produccion,reserva:context.reserva,produccion:context.produccion},origin,observation:clean(observation),details};
}
