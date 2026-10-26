import {pendingFlowGuidance} from './pdt-flow-guidance.js';
import {repoAvailabilityHtml} from './pdt-v2-presentation.js';
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
 return '<b class="repo-state">'+esc(row.estado_repo||'PENDIENTE')+'</b><span>'+validationHtml+'</span>'+repoAvailabilityHtml(row,esc);
}
