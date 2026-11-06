import {CAUSE_LABELS} from '../domain/lp01-affectation-summary.js';
export function summaryMarkup(summary){
 if(!summary)return '<span>Consultando ventanas afectadas…</span>';
 if(summary.status==='UNAVAILABLE')return '<span>Ventanas afectadas: no disponibles</span>';
 return '<small>Ventanas reportadas pendientes de recepción</small>'+Object.entries(CAUSE_LABELS).map(([key,label])=>'<span>'+label+': '+(summary.categories[key]??'No disponible')+(key==='NC_AL'&&summary.aluminumUnknown?' reportadas · PDT pendiente de validar':'')+'</span>').join('')+'<span>Accesorios: no disponible</span><b>Total distinto: '+(summary.total??'Pendiente de validar')+'</b><span>Disponibles: '+(summary.available??'Pendiente de validar')+'</span>';
}

/** One aluminum badge; overlapping values stay unresolved rather than being summed. */
function compactAluminumMarkup(summary){
 const recorded=summary.categories.NC_AL;
 const hasRecorded=Number.isSafeInteger(recorded)&&recorded>=0;
 const reports=summary.reportedQuantities?.NC_AL||[];
 const estimates=(summary.estimates||[]).filter(p=>Number.isSafeInteger(p.quantity)&&p.quantity>0);
 const estimate=!hasRecorded&&!reports.length&&estimates.length===1?estimates[0].quantity:null;
 const quantity=hasRecorded?recorded:estimate;
 if(quantity===0)return '';
 if(quantity===null&&!reports.length&&!estimates.length&&!summary.aluminumNeedsIndicator)return '';
 const estimated=estimate!==null;
 const label=quantity===null?'NC AL · por validar':quantity+' × NC AL'+(estimated?' · Estimado':'');
 const description=quantity===null?'Cantidad de ventanas de aluminio pendiente de validar; ver detalle':quantity+' ventanas '+(estimated?'estimadas; editar en el detalle':'reportadas · NC AL');
 return '<button type="button" data-summary-cause="NC_AL" class="lp-tracking-chip chip-NC_AL" aria-label="'+description+'">'+label+'</button>';
}

/** B10 row: only positive recorded causes; unknown values never become zero. */
export function compactSummaryMarkup(summary){
 if(!summary)return '<span class="lp-summary-pending">Consultando…</span>';
 if(summary.status==='UNAVAILABLE')return '<span class="lp-summary-pending">Datos pendientes</span>';
 const labels={NC_V:'NC V',TECNO:'Tecno',NOVEDAD:'Novedad'};
 const chips=Object.entries(labels).filter(([key])=>Number.isSafeInteger(summary.categories[key])&&summary.categories[key]>0).map(([key,label])=>'<button type="button" data-summary-cause="'+key+'" class="lp-tracking-chip chip-'+key+'" aria-label="'+summary.categories[key]+' ventanas reportadas · '+label+'">'+summary.categories[key]+' × '+label+'</button>').join('');
 const reportGroups=Object.entries(labels).filter(([key])=>summary.reportedQuantities?.[key]?.length>1).map(([key,label])=>'<button type="button" data-summary-cause="'+key+'" class="lp-tracking-chip chip-'+key+'">'+label+' · reportadas: '+summary.reportedQuantities[key].join(' / ')+' (sin sumar)</button>').join('');
 const estimates=summary.ncEstimate?'<button type="button" data-summary-cause="NC_V" class="lp-tracking-chip chip-NC_V">NC Vidrio · estimación '+summary.ncEstimate+' (1 por NC)</button>':'';
 const aluminum=compactAluminumMarkup(summary);
 const empty=!chips&&!reportGroups&&!estimates&&!aluminum?'<span class="lp-summary-pending" title="'+(summary.hasReports?'Sin ventanas pendientes reportadas':summary.aluminumCoverage==='COMPLETE'?'Sin reportes ni pendientes de aluminio devueltos':'Pendientes de aluminio no disponibles')+'" aria-label="'+(summary.hasReports?'Sin ventanas pendientes reportadas':summary.aluminumCoverage==='COMPLETE'?'Sin reportes ni pendientes de aluminio devueltos':'Pendientes de aluminio no disponibles')+'">'+(summary.aluminumCoverage==='COMPLETE'?'—':'Pendiente')+'</span>':'';
 const total=summary.total===null||summary.total===undefined?(chips||reportGroups||estimates||aluminum?'<span class="lp-summary-pending" title="Total de ventanas distintas pendiente de validación; las causas pueden coincidir">Total por validar</span>':''):'<small title="Total de ventanas distintas validado">Total '+summary.total+(summary.available===null||summary.available===undefined?'':' · Disponibles '+summary.available)+'</small>';
 return '<span class="lp-summary-chips">'+chips+reportGroups+estimates+aluminum+'</span>'+empty+total;
}

