/** Presentation validation only. The server re-resolves every write independently. */
export function masterProductionLine(master){
 if(!master||master.activo!=='SI')throw new Error('La pieza no tiene una clasificación activa verificable en el maestro.');
 const type=String(master.tipo_pieza||'').trim().toUpperCase();
 const destination=String(master.destino_productivo||'').trim().toUpperCase();
 if(!['PANEL','FRAME','COVER','REFUERZO','MUNTIN'].includes(type)||!['PANEL','FRAME'].includes(destination))throw new Error('Clasificación del maestro incompleta.');
 if(['PANEL','FRAME'].includes(type)&&destination!==type)throw new Error('El tipo y el destino del maestro son inconsistentes.');
 return destination==='PANEL'?'PANELES_2':'FRAMES_2';
}
export function validatedNoveltySource(source,context){
 if(!source?.id_pieza||!source.key_produccion)throw new Error('Selecciona una pieza real con identidad verificada.');
 const line=masterProductionLine(source);
 if(source.id_linea!==line)throw new Error('La línea no coincide con la clasificación del maestro.');
 if(source.codigo_sap!==String(context.perfil||'').trim()||source.reserva!==context.reserva
  ||String(source.acabado||'').trim().toUpperCase()!==String(context.acabado||'').trim().toUpperCase()
  ||(context.produccion&&source.produccion!==context.produccion))throw new Error('La pieza no corresponde al perfil, producción, reserva o acabado seleccionado.');
 return {...source,id_linea:line};
}
export function exactSharedIdentity(rows,key){
 const matches=(rows||[]).filter(r=>r.key_produccion===key);
 if(matches.length>1)throw new Error('Relación de reservas ambigua para la clave de producción.');
 return matches[0]||null;
}
