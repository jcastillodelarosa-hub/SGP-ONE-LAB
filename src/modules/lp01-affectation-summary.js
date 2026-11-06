import {CAUSE_LABELS} from '../domain/lp01-affectation-summary.js';
export function summaryMarkup(summary){
 if(!summary)return '<span>Consultando ventanas afectadas…</span>';
 if(summary.status==='UNAVAILABLE')return '<span>Ventanas afectadas: no disponibles</span>';
 return '<small>Ventanas reportadas pendientes de recepción</small>'+Object.entries(CAUSE_LABELS).map(([key,label])=>'<span>'+label+': '+(summary.categories[key]??'No disponible')+(key==='NC_AL'&&summary.aluminumUnknown?' reportadas · PDT pendiente de validar':'')+'</span>').join('')+'<span>Accesorios: no disponible</span><b>Total distinto: '+(summary.total??'Pendiente de validar')+'</b><span>Disponibles: '+(summary.available??'Pendiente de validar')+'</span>';
}

/** One aluminum badge: saved windows first; one tentative window per pending piece. */
function compactAluminumMarkup(summary){
 const recorded=summary.categories.NC_AL;
 const hasRecorded=Number.isSafeInteger(recorded)&&recorded>=0;
 const reports=summary.reportedQuantities?.NC_AL||[];
 const estimates=(summary.estimates||[]).filter(p=>Number.isSafeInteger(p.quantity)&&p.quantity>0);
 const proposed=estimates.reduce((total,p)=>total+p.quantity,0);
 const estimate=!hasRecorded&&!reports.length&&Number.isSafeInteger(proposed)&&proposed>0?proposed:null;
 const quantity=hasRecorded?recorded:estimate;
 if(quantity===0)return '';
 if(quantity===null&&!reports.length&&!estimates.length&&!summary.aluminumNeedsIndicator)return '';
 const estimated=estimate!==null;
 const label=quantity===null?'NC AL · por validar':quantity+' × NC AL'+(estimated?' · Estimado ⚠':'');
 const overBalance=estimated&&Number.isSafeInteger(summary.stageBalance)&&summary.stageBalance>=0&&quantity>summary.stageBalance;
 const description=quantity===null?'Cantidad de ventanas de aluminio pendiente de validar; ver detalle':quantity+' ventanas '+(estimated?'estimadas · por validar; una por pieza pendiente. '+(overBalance?'Supera el saldo de '+summary.stageBalance+'; ajusta la cantidad antes de confirmar.':'Revisa y ajusta la cantidad antes de confirmar.'):'reportadas · NC AL');
 return '<button type="button" data-summary-cause="NC_AL" class="lp-tracking-chip chip-NC_AL" aria-label="'+description+'" title="'+description+'">'+label+'</button>';
}

/** Export availability is an estimate, never a saved report or physical receipt. */
function compactExportGlassMarkup(summary){
 const glass=summary.exportGlass;if(!glass)return '';
 if(glass.status!=='AVAILABLE')return '<button type="button" data-summary-cause="TECNO" data-summary-source="EXPORT" class="lp-tracking-chip chip-TECNO" title="No hay cantidad y porcentaje vigentes acreditados en Export" aria-label="Vidrio Tecno: datos de Export no disponibles">Tecno · sin dato</button>';
 const quantity=Number(glass.rounded);
 if(!Number.isSafeInteger(quantity)||quantity<=0)return '';
 const description=quantity+' ventanas afectadas estimadas según Export; '+glass.percentage+' % de vidrio disponible. Redondeo hacia arriba. No se suma a reportes ni acredita recepción física.';
 return '<button type="button" data-summary-cause="TECNO" data-summary-source="EXPORT" class="lp-tracking-chip chip-TECNO" aria-label="'+description+'" title="'+description+'">'+quantity+' × Tecno · Export</button>';
}

/** Positive reported causes and a separate Export estimate; unknown is not zero. */
export function compactSummaryMarkup(summary){
 if(!summary)return '<span class="lp-summary-pending">Consultando…</span>';
 const glass=compactExportGlassMarkup(summary);
 if(summary.status==='UNAVAILABLE')return glass+'<span class="lp-summary-pending">Datos pendientes</span>';
 const labels={NC_V:'NC V',TECNO:summary.exportGlass?'Tecno · reportado':'Tecno',NOVEDAD:'Novedad'};
 const chips=Object.entries(labels).filter(([key])=>Number.isSafeInteger(summary.categories[key])&&summary.categories[key]>0).map(([key,label])=>'<button type="button" data-summary-cause="'+key+'" class="lp-tracking-chip chip-'+key+'" aria-label="'+summary.categories[key]+' ventanas reportadas · '+label+'">'+summary.categories[key]+' × '+label+'</button>').join('');
 const reportGroups=Object.entries(labels).filter(([key])=>summary.reportedQuantities?.[key]?.length>1).map(([key,label])=>'<button type="button" data-summary-cause="'+key+'" class="lp-tracking-chip chip-'+key+'">'+label+' · reportadas: '+summary.reportedQuantities[key].join(' / ')+' (sin sumar)</button>').join('');
 const estimates=summary.ncEstimate?'<button type="button" data-summary-cause="NC_V" class="lp-tracking-chip chip-NC_V">NC Vidrio · estimación '+summary.ncEstimate+' (1 por NC)</button>':'';
 const aluminum=compactAluminumMarkup(summary);
 const empty=!chips&&!reportGroups&&!estimates&&!aluminum&&!glass?'<span class="lp-summary-pending" title="'+(summary.hasReports?'Sin ventanas pendientes reportadas':summary.aluminumCoverage==='COMPLETE'?'Sin reportes ni pendientes de aluminio devueltos':'Pendientes de aluminio no disponibles')+'" aria-label="'+(summary.hasReports?'Sin ventanas pendientes reportadas':summary.aluminumCoverage==='COMPLETE'?'Sin reportes ni pendientes de aluminio devueltos':'Pendientes de aluminio no disponibles')+'">'+(summary.aluminumCoverage==='COMPLETE'?'—':'Pendiente')+'</span>':'';
 const glassAffected=summary.exportGlass?.status==='AVAILABLE'&&Number(summary.exportGlass.rounded)>0;
 const total=summary.total===null||summary.total===undefined?(chips||reportGroups||estimates||aluminum||glassAffected?'<span class="lp-summary-pending" title="Total de ventanas distintas pendiente de validación; las causas pueden coincidir">Total por validar</span>':''):'<small title="Total de ventanas distintas validado">Total '+summary.total+(summary.available===null||summary.available===undefined?'':' · Disponibles '+summary.available)+'</small>';
 return '<span class="lp-summary-chips">'+chips+reportGroups+estimates+aluminum+glass+'</span>'+empty+total;
}
