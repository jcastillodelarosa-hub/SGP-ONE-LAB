import {exportBalance} from './lp01-sources.js';
/** Contracts for the stage-specific engine; never mix local execution with Export. */
export const BI_HEADER='etapa;fecha;turno;key_produccion;parte;cantidad';
export const AFFECTATIONS=['NC_AL','NC_V','TECNO','NOVEDAD'];
export const quantity=value=>{if(!/^(0|[1-9]\d*)$/.test(String(value))||!Number.isSafeInteger(Number(value)))throw Error('Escribe una cantidad entera no negativa');return Number(value);};
export function operationalRows(data,{line='',search=''}={}){
 if(data?.contract!=='LP-OPERACION-1'||!Array.isArray(data.orders))throw Error('Contrato de operación incompatible');
 const seen=new Set(),q=search.trim().toLocaleLowerCase('es');
 return data.orders.filter(r=>{const id=[r.linea,r.etapa,r.fecha,r.turno,r.key,r.parte].join('/');if(seen.has(id))throw Error('Orden/parte duplicada');seen.add(id);return(!line||r.oficial?.id_linea===line)&&(!q||[r.produccion,r.key,r.parte,r.observacion,r.oficial?.sistema,r.oficial?.reserva_al].some(x=>String(x??'').toLocaleLowerCase('es').includes(q)));})
 .sort((a,b)=>bucket(a)-bucket(b)||String(a.antiguedad_fecha||a.origen_fecha||a.fecha).localeCompare(String(b.antiguedad_fecha||b.origen_fecha||b.fecha))||Number(a.antiguedad_turno||a.origen_turno||a.turno)-Number(b.antiguedad_turno||b.origen_turno||b.turno)||Number(a.prioridad)-Number(b.prioridad)||a.key.localeCompare(b.key)||a.parte.localeCompare(b.parte));
}
const bucket=r=>r.abierta?(r.sale>0?0:1):2;
export function officialBalance(row,stage){return exportBalance(row?.oficial,stage);}
export function validateAffectations(affectations,consolidated){
 const values=AFFECTATIONS.map(k=>quantity(affectations[k]??0));
 if(consolidated===undefined)return null;
 const total=quantity(consolidated);if(total<Math.max(...values)||total>values.reduce((a,b)=>a+b,0))throw Error('El consolidado debe cubrir la categoría mayor sin superar la suma. Confirma los solapamientos.');return total;
}
export function previewBI(content,{stage,date,shift,orders}){
 if(typeof content!=='string'||content.length>2000000)throw Error('Archivo demasiado grande o inválido');
 const lines=content.replace(/\r/g,'').split('\n');if(lines.shift()!==BI_HEADER)throw Error('Formato CSV pendiente de correspondencia con el Power BI aprobado');
 const found=new Map();for(const line of lines.filter(Boolean)){
  const c=line.split(';');if(c.length!==6||c[0]!==stage||c[1]!==date||c[2]!==String(shift))throw Error('Archivo de otra etapa, fecha o turno');
  const id=c[3]+'/'+c[4];if(found.has(id)||!orders.some(r=>r.key===c[3]&&r.parte===c[4]))throw Error('Orden ajena o repetida en Power BI');found.set(id,quantity(c[5]));
 }
 if(!orders.length||found.size!==orders.length)throw Error('Faltan órdenes del turno en el archivo');
 return orders.map(r=>({...r,power_bi:found.get(r.key+'/'+r.parte),difference:found.get(r.key+'/'+r.parte)-r.ejecutado}));
}
export function reportCSV(snapshot){
 const cell=v=>'"'+(typeof v==='number'&&Number.isFinite(v)?String(v):String(v??'').replace(/^[=+@-]/,"'$&")).replace(/"/g,'""')+'"';
 if(snapshot.type==='SIN_ACTIVIDAD')return '\uFEFF'+[['Tipo de cierre','Etapa','Línea','Fecha operativa','Turno','Responsable','Fecha/hora de cierre','Motivo','Versión','Archivo Power BI'],['SIN ACTIVIDAD',snapshot.stage,snapshot.line,snapshot.date,snapshot.shift,snapshot.user,snapshot.closedAt,snapshot.observation,snapshot.version,'No aplica: turno sin órdenes']].map(r=>r.map(cell).join(';')).join('\r\n');
 return '\uFEFF'+[['Etapa','Línea','Fecha','Turno','Producción','Parte','SALE','Líder','Power BI','Diferencia','Saldo Export','Motivo','Observación general','Versión','SHA256'],...snapshot.rows.map(r=>[snapshot.stage,snapshot.line,snapshot.date,snapshot.shift,r.key,r.assignments?r.assignments.map(a=>a.parte).join(', '):r.parte,r.sale,r.ejecutado,r.power_bi,r.diferencia,r.saldo_oficial,snapshot.reasons?.[r.assignments?r.key:r.key+'/'+r.parte],snapshot.observation,snapshot.version,snapshot.file.sha256])].map(r=>r.map(cell).join(';')).join('\r\n');
}

export function salePendingReason(row){
 if(row.sale_estado==='AFECTACIONES_REQUIEREN_COORDINADOR')return 'El coordinador debe evaluar las afectaciones antes de aumentar la ejecución';
 if(row.sale!==null&&row.sale!==undefined)return row.sale_fuente==='OFICIAL_ELEGIBLE'?'Inicializado desde saldo oficial elegible':'Decisión conservada del coordinador';
 return ({EXPORT_NO_ELEGIBLE:'Saldo oficial pendiente de validar',EXPORT_CAMBIO_REQUIERE_CONCILIACION:'La nueva carga Export requiere conciliación',REPARTO_COORDINADOR_REQUERIDO:'El coordinador debe definir el reparto entre asignaciones',DECISION_PREVIA_REQUIERE_COORDINADOR:'Revalidar la decisión del turno anterior',AFECTACIONES_REQUIEREN_COORDINADOR:'El coordinador debe evaluar las afectaciones',CAPACIDAD_ASIGNACION_INCOMPATIBLE:'Revisar la capacidad restante de la asignación',CAPACIDAD_TURNO_PENDIENTE:'El coordinador debe indicar la capacidad de Empaque',CAPACIDAD_REQUIERE_COORDINADOR:'La disponibilidad supera la capacidad: ajustar por asignación',CONTINUIDAD_REVALIDAR:'Validar disponibilidad del nuevo turno'})[row.sale_estado]||'SALE pendiente de validar';
}
