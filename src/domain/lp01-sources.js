/** Read boundaries only. Missing Export and historical material summaries grant no credit. */
export function exportQuantity(value){
 if(!['number','string'].includes(typeof value)||String(value).trim()==='')return null;
 const n=Number(value);return Number.isSafeInteger(n)&&n>=0?n:null;
}
export function exportBalance(production,stage){
 if(!['ENSAMBLE','EMPAQUE'].includes(stage)||production?.saldos_inicializados!==true||production?.presente_ultimo_export!==true)return null;
 return exportQuantity(production[stage==='ENSAMBLE'?'saldo_ensamble':'saldo_empaque']);
}
export function materialContext(sheet,row){
 const line=row?.oficial?.id_linea;
 if(!['ENSAMBLE','EMPAQUE'].includes(row?.etapa)||!['PANELES_2','FRAMES_2'].includes(line)||typeof row?.key!=='string'||!row.key.endsWith('|'+line))throw Error('Identidad operativa incompleta o incompatible');
 if(!Array.isArray(sheet?.filas))throw Error('Contrato de consulta de materiales incompatible');
 const matches=sheet.filas.filter(p=>p?.key_produccion===row.key);
 if(matches.length!==1)throw Error(matches.length?'La consulta devolvió una identidad de producción ambigua':'La consulta no devolvió esta identidad de producción');
 const p=matches[0];if(p.id_linea!==line)throw Error('La consulta devolvió otra línea para la producción');
 const text=v=>typeof v==='string'&&v.trim()&&v.trim()!=='—'?v.trim():null;
 const ambiguous=p.identity_ambiguous===true;
 return {key:row.key,line,stage:row.etapa,mechanized:ambiguous?null:text(p.estado_mecanizado),note:ambiguous?null:text(p.observacion_mecanizado),pending:ambiguous?null:text(p.pendientes_mecanizado),ambiguousByName:ambiguous,scope:'HISTORICAL_NAME_AGGREGATE',releaseAccredited:false};
}
