import {CAUSE_LABELS} from '../domain/lp01-affectation-summary.js';
export function summaryMarkup(summary){
 if(!summary)return '<span>Consultando ventanas afectadas…</span>';
 if(summary.status==='UNAVAILABLE')return '<span>Ventanas afectadas: no disponibles</span>';
 return '<small>Ventanas reportadas pendientes de recepción</small>'+Object.entries(CAUSE_LABELS).map(([key,label])=>'<span>'+label+': '+(summary.categories[key]??'No disponible')+(key==='NC_AL'&&summary.aluminumUnknown?' reportadas · PDT pendiente de validar':'')+'</span>').join('')+'<span>Accesorios: no disponible</span><b>Total distinto: '+(summary.total??'Pendiente de validar')+'</b><span>Disponibles: '+(summary.available??'Pendiente de validar')+'</span>';
}

/** B10 row: only positive recorded causes; unknown values never become zero. */
export function compactSummaryMarkup(summary){
 if(!summary)return '<span class="lp-summary-pending">Consultando…</span>';
 if(summary.status==='UNAVAILABLE')return '<span class="lp-summary-pending">Datos pendientes</span>';
 const labels={NC_AL:'NC AL',NC_V:'NC V',TECNO:'Tecno',NOVEDAD:'Novedad'};
 const chips=Object.entries(labels).filter(([key])=>Number.isSafeInteger(summary.categories[key])&&summary.categories[key]>0).map(([key,label])=>'<button type="button" data-summary-cause="'+key+'" class="lp-tracking-chip chip-'+key+'" aria-label="'+summary.categories[key]+' ventanas reportadas · '+label+'">'+summary.categories[key]+' × '+label+'</button>').join('');
 const aluminum=summary.aluminumNeedsIndicator?'<button type="button" data-summary-cause="ALUMINIO" class="lp-tracking-chip chip-NC_AL">Aluminio · ventanas por definir</button>':'';
 const empty=!chips&&!aluminum?'<span class="lp-summary-pending">'+(summary.hasReports?'Sin ventanas pendientes reportadas':summary.aluminumCoverage==='COMPLETE'?'Sin reportes ni pendientes de aluminio devueltos': 'Sin reportes · pendientes de aluminio no disponibles')+'</span>':'';
 const total=summary.total===null||summary.total===undefined?'<span class="lp-summary-pending" title="Total de ventanas distintas pendiente de validación; las causas pueden coincidir">Total distinto: Pendiente de validar</span>':'<small>Total distinto: '+summary.total+' · Disponibles: '+summary.available+'</small>';
 return (chips?'<small>Ventanas reportadas</small>':'')+'<span class="lp-summary-chips">'+chips+aluminum+'</span>'+empty+total;
}
