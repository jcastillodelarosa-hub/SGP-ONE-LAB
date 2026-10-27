/** Canonical selection is scoped to the production, reserve and physical source.
 * A reference/fabrication/length tuple is never a global identifier. */
export const PDT_ORIGINS=Object.freeze(['PICKING','ENSAMBLE','EMPAQUE']);
const text=v=>String(v??'').trim();
export function sourceKey(p){return JSON.stringify([p.key_produccion,p.reserva,p.id_pieza]);}
export function registrationPieces(origin,sources,entries){
 if(!PDT_ORIGINS.includes(origin))throw new Error('Origen PDT inválido');
 if(!Array.isArray(entries)||!entries.length||entries.length>100)throw new Error('Agrega entre 1 y 100 piezas');
 if(new Set(entries.map(e=>e.source)).size!==entries.length)throw new Error('La misma pieza está repetida en esta operación');
 return entries.map(entry=>{
  const matches=sources.filter(s=>sourceKey(s)===entry.source);
  if(matches.length!==1)throw new Error('La pieza no tiene una identidad verificable. Actualiza las fuentes.');
  const p=matches[0],quantity=Number(entry.cantidad),nc=text(entry.nc);
  if(!p.id_pieza||!p.key_produccion||!p.reserva||!p.reserva_principal||!text(p.acabado)||p.tipo_pieza!=='PANEL'||p.id_linea!=='PANELES_2')throw new Error('Identidad PANEL incompleta');
  if(!Number.isSafeInteger(quantity)||quantity<=0||p.cantidad_referencia==null||quantity>Number(p.cantidad_referencia))throw new Error('Cantidad fuera de la referencia de la pieza');
  if(origin!=='PICKING'&&!nc)throw new Error('La NC es obligatoria en '+origin);
  if(nc.length>120||/[\x00-\x1f\x7f]/.test(nc))throw new Error('NC inválida');
  return {id_pieza:p.id_pieza,key_produccion:p.key_produccion,produccion:p.produccion,reserva:p.reserva,reserva_principal:p.reserva_principal,perfil:p.codigo_sap,fabricacion:p.fabricacion,longitud:p.longitud,acabado:p.acabado,cantidad:quantity,nc,observacion:text(entry.observacion)};
 });
}
export function ncAssignment(row){
 const refs=(row.ncs||[]).filter(x=>x?.referencia||x?.consecutivo);
 const linked=refs.some(x=>x.origen==='VINCULO')||row.nc_enlazada===true;
 if(linked)return 'VINCULADA';
 if(text(row.nc)||text(row.nc_historica)||refs.length)return 'REFERENCIA_SIN_ENLACE';
 return 'PENDIENTE';
}
export function filterPdtRegistrations(rows,filters={}){
 return rows.filter(r=>(!filters.contract||r.contrato_pdt===filters.contract)&&(!filters.origen||r.origen===filters.origen)&&(!filters.nc||ncAssignment(r)===filters.nc)&&(!filters.desde||String(r.fecha_reporte||'').slice(0,10)>=filters.desde)&&(!filters.hasta||String(r.fecha_reporte||'').slice(0,10)<=filters.hasta));
}
/** Explicit contract in locally generated reports; never infer missing metadata. */
export function pdtReportCsv(rows){
 const columns=[['Contrato','contrato_pdt'],['PDT','id_pendiente'],['Producción','produccion'],['Reserva','reserva'],['Referencia','perfil'],['Origen','origen'],['Cantidad reportada','cantidad'],['Validación','validacion_estado'],['Estado','estado'],['Reposición','estado_repo'],['NC','nc'],['Fecha','fecha_reporte']];
 const cell=value=>{let text=String(value??'');if(/^[\s]*[=+@-]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';};
 return '\ufeff'+[columns.map(c=>c[0]),...rows.map(r=>columns.map(([,key])=>key==='contrato_pdt'?r.contrato_pdt||'NO INFORMADO':key==='nc'?r.nc||r.nc_historica||'':r[key]))].map(row=>row.map(cell).join(';')).join('\r\n');
}
