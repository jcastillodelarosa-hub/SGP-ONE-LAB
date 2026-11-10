import {pendingFlowGuidance} from './pdt-flow-guidance.js';
import {repoAvailabilityHtml} from './pdt-v2-presentation.js';
export function productionPdtVisible(row){
 return row.estado==='PENDIENTE'&&!(row.contrato_pdt==='LEGACY'&&row.estado_repo==='PICKING');
}
export function productionPdtGroup(row){
 // Group by the recorded stage, not by NC, inferred availability or a zero balance.
 return row.estado_repo==='PROCESADO'||(row.contrato_pdt==='V2'&&row.estado_repo==='PICKING')?'delivery':'processing';
}
export function productionPdtActions(row,role,capabilities){
 if(!pendingFlowGuidance(row,role,capabilities).action||row.contrato_pdt!=='V2')return [];
 const items=[['distribution','Distribución']];
 if(row.estado_repo!=='PICKING'&&['ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO','LIDER'].includes(role))items.push(['advances','Registrar avance']);
 if(capabilities.picking_cuantitativo)items.push(['picking','Entregas Picking']);
 items.push(['nc','NC vinculadas'],['history','Historial']);return items;
}
export function productionPdtControls(row,role,capabilities,esc){
 const actions=productionPdtActions(row,role,capabilities);
 if(!actions.length)return '';
 const id=esc(row.id_pendiente);
 return '<button type="button" class="repo-v2-entry" data-pdt-open="'+id+'" data-pdt-target="distribution">Abrir</button><details class="pdt-list-menu"><summary aria-label="Más acciones del PDT">⋯</summary><div><button type="button" data-pdt-open="'+id+'" data-pdt-target="distribution">Ver detalle</button>'+actions.map(([key,label])=>'<button type="button" data-pdt-open="'+id+'" data-pdt-target="'+key+'">'+label+'</button>').join('')+'</div></details>';
}
export function productionPdtStatus(row,validationHtml,esc){
 const known=row.contrato_pdt==='V2'&&row.validacion_estado==='VALIDADO'&&row.cantidad_validada!==null&&row.avance_neto!==null&&Number.isSafeInteger(Number(row.cantidad_validada))&&Number(row.cantidad_validada)>0&&Number.isSafeInteger(Number(row.avance_neto))&&Number(row.avance_neto)>=0&&Number(row.avance_neto)<=Number(row.cantidad_validada);
 return '<small class="pdt-status-label">Mecanizado</small><b class="repo-state">'+esc(row.estado_repo||'PENDIENTE')+'</b>'+(known?'<span>'+esc(row.avance_neto)+' de '+esc(row.cantidad_validada)+' procesadas</span>':'')+'<span>'+validationHtml+'</span>'+repoAvailabilityHtml(row,esc);
}
export function productionPdtDeliveryStatus(summary,esc){
 let label='Entrega por consultar',detail='Consulta el detalle de Picking; no se presume cantidad entregada.',kind='unknown';
 if(summary?.status==='loading'){label='Consultando entrega…';detail='Se conservan el PDT y sus datos de mecanizado.';}
 if(summary?.status==='unavailable'){label='Entrega no disponible';detail='No se pudo consultar. Actualiza o abre el detalle para reintentar.';}
 if(summary?.status==='legacy'){label='Entrega anterior por conciliar';detail='Consulta Picking e historial; no se presume cobertura.';}
 if(summary?.status==='verified'){
  kind=summary.pending===0?'complete':'pending';
  label=summary.pending===0?(summary.finished?'ENTREGADO':'Entrega completa · por finalizar'):summary.delivered>0?'ENTREGA PARCIAL':'POR ENTREGAR';
  detail=summary.delivered+' entregadas · '+summary.pending+' por entregar';
  if(summary.pending>0&&summary.available<summary.pending)detail+=' · '+summary.available+' procesadas disponibles';
 }
 return '<small class="pdt-status-label">Entrega a línea</small><b class="pdt-delivery-badge pdt-delivery-'+kind+'">'+esc(label)+'</b><span>'+esc(detail)+'</span>';
}
