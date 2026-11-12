const normalized=value=>String(value??'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ');

/** Display only: use explicit source values, never infer origin from a missing supplier. */
export function ncGlassOrigin(row={}){
 const reason=normalized(row.motivo),line=normalized(row.linea_afectada);
 const supplier=reason==='PROVEEDOR'||line==='PROVEEDOR';
 const process=reason==='PROCESO';
 const plant=reason==='PLANTA'||line==='PLANTA'||process;
 const warehouse=reason==='BODEGA'||line==='BODEGA DE VIDRIO';
 if([supplier,plant,warehouse].filter(Boolean).length>1)return 'Por validar';
 if(supplier)return 'Proveedor';
 if(plant)return process?'Planta (proceso)':'Planta';
 if(warehouse)return 'Bodega';
 return 'Sin clasificar';
}

export function ncGlassOriginSource(row={}){
 return `Motivo: ${String(row.motivo??'').trim()||'Sin dato'} · Línea afectada: ${String(row.linea_afectada??'').trim()||'Sin dato'}`;
}
