import {CAUSE_LABELS} from '../domain/lp01-affectation-summary.js';
export function summaryMarkup(summary){
 if(!summary)return '<span>Consultando ventanas afectadas…</span>';
 if(summary.status==='UNAVAILABLE')return '<span>Ventanas afectadas: no disponibles</span>';
 return '<small>Ventanas reportadas pendientes de recepción</small>'+Object.entries(CAUSE_LABELS).map(([key,label])=>'<span>'+label+': '+(summary.categories[key]??'No disponible')+(key==='NC_AL'&&summary.aluminumUnknown?' reportadas · PDT pendiente de validar':'')+'</span>').join('')+'<span>Accesorios: no disponible</span><b>Total distinto: '+(summary.total??'Pendiente de validar')+'</b><span>Disponibles: '+(summary.available??'Pendiente de validar')+'</span>';
}
