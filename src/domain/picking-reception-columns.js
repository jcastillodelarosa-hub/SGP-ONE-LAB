import {receptionQuantities,receptionStatus} from './picking-reception-report.js';
export const reportColumns=[['semana_programada','Semana',true],['produccion','Orden / reserva'],['sistema','Sistema'],['total','Total',true],['afectadas','Afectadas',true],['efectiva','Efectiva',true],['fecha_recepcion','Fecha recepción'],['turno_recepcion','Turno'],['nombre_entrego','Entregó'],['revisores','Revisó'],['estado','Estado al recibir'],['pendientes','Pendientes reportados']];
export const newReportColumns=()=>({filters:{},sort:null,direction:'asc'});
const known=value=>value!==null&&value!==undefined&&value!=='';
export function reportColumnValue(row,key){
 if(['total','afectadas','efectiva'].includes(key))return receptionQuantities(row)[key];
 if(key==='semana_programada')return known(row[key])&&Number.isInteger(Number(row[key]))?Number(row[key]):null;
 if(key==='estado')return {completa:'Completa',incompleta:'Incompleta',sin_evidencia:'Sin evidencia histórica'}[receptionStatus(row)];
 if(key==='revisores')return (row.revisiones_areas||[]).map(a=>a.revision?.nombre).filter(Boolean).join(' · ')||row.nombre_recibio||null;
 if(key==='pendientes')return Array.isArray(row.pendientes_al_recibir)?row.pendientes_al_recibir.map(p=>p.perfil||p.referencia).filter(Boolean).join(' · ')||'Sin pendientes':null;
 return known(row[key])?String(row[key]):null;
}
export function compareReportValues(a,b,direction='asc'){if(a===b)return 0;if(a===null)return 1;if(b===null)return -1;const n=typeof a==='number'&&typeof b==='number'?a-b:String(a).localeCompare(String(b),'es',{numeric:true,sensitivity:'base'});return direction==='desc'?-n:n;}
export const reportOptions=(rows,key)=>[...new Map(rows.map(r=>{const v=reportColumnValue(r,key);return [JSON.stringify(v),v];})).entries()].sort((a,b)=>compareReportValues(a[1],b[1]));
export function applyReportColumns(rows,state){const result=rows.filter(r=>Object.entries(state.filters).every(([key,values])=>values.includes(JSON.stringify(reportColumnValue(r,key)))));return state.sort?result.sort((a,b)=>compareReportValues(reportColumnValue(a,state.sort),reportColumnValue(b,state.sort),state.direction)):result;}
