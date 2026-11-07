import {assemblySheetRows,filterAssemblySheetRows} from '../domain/lp01-assembly-sheet.js';
import {retainOrderSaleRows} from './lp01-order-sale-rows.js';
import {compactSummaryMarkup} from './lp01-affectation-summary.js';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const value=v=>v===null||v===undefined?'<span class="lp-assembly-pending">Por validar</span>':esc(v);
const stateLabels={ABIERTAS:'Abierta',PROGRAMADAS:'Sin iniciar',OTRAS:'Sin programar',POR_REVISAR:'Por revisar',COMPLETADAS:'Completada'};
const groups=[
 {key:'ABIERTAS',title:'Órdenes abiertas',subtitle:'Primero las más antiguas · incluye arrastres',icon:'◷',states:['ABIERTAS']},
 {key:'PROGRAMADAS',title:'Programadas para este turno · sin iniciar',subtitle:'En el orden de prioridad definido',icon:'▦',states:['PROGRAMADAS']},
 {key:'OTRAS',title:'Otras órdenes',subtitle:'Resto de producciones autorizadas · sin duplicar las anteriores',icon:'≡',states:['OTRAS','POR_REVISAR']},
 {key:'COMPLETADAS',title:'Historial · completadas',subtitle:'Saldo Export de Ensamble en cero · conservan su detalle',icon:'✓',states:['COMPLETADAS']}
];
const realizedLabel=row=>row.realizedSource?.valueStatus==='NEVER_REPORTED'?'No informado':row.realized===null?'Pendiente de cierre':esc(row.realized)+(row.realizedSource?.valueStatus==='PRESERVED'?'<small>Conservado</small>':'');
const realizedTitle=row=>row.realizedSource?'Cierre Export del '+row.realizedSource.date+' · turno '+row.realizedSource.shift+' · versión '+row.realizedSource.version+(row.realizedSource.valueSource?' · Fuente: '+row.realizedSource.valueSource.file.name+(row.realizedSource.valueStatus==='PRESERVED'?' (carga anterior)':''):''):'Pendiente de cierre Export del turno consultado';
const tabs=[['','Todas'],['ABIERTAS','Abiertas'],['PROGRAMADAS','Programadas sin iniciar'],['OTRAS','Otras órdenes'],['POR_REVISAR','Por revisar'],['COMPLETADAS','Historial']];

function summaryMarkup(row,summaryFor,onAffectations){
 const summary=summaryFor?.(row);
 const valid=summary&&(summary.status==='UNAVAILABLE'||summary.categories);
 const markup=valid?compactSummaryMarkup(summary):'<span class="lp-assembly-pending">Por consultar</span>';
 const accessories=Number.isSafeInteger(summary?.accessories)&&summary.accessories>0?'<button type="button" data-summary-cause="ACCESORIOS" class="lp-tracking-chip">'+summary.accessories+' × Accesorios</button>':'';
 return '<div class="lp-affect-summary lp-affect-summary-compact" data-order-summary="'+esc(row.key)+'">'+markup+accessories+'</div>'+(!valid&&onAffectations?'<button type="button" class="lp-assembly-link" data-assembly-affect="'+esc(row.key)+'">Consultar</button>':'');
}
function rowMarkup(row,{state,onDetail,onGlass,onAvailable,onAffectations,summaryFor,orderSaleProvider}){
 const selected=state.selected===row.key;
 const secondary=row.oficial.activa!==undefined&&row.oficial.activa!=='SI'?'Inactiva o sin confirmar · no incorporable':row.scheduled?'Programada en este turno':row.state==='ABIERTAS'?'Sin asignación al turno':row.reviewReason||'';
 const available=orderSaleProvider?'<div data-sale-order-key="'+esc(row.key)+'"></div>':onAvailable?'<button type="button" class="lp-assembly-link" data-assembly-available="'+esc(row.key)+'" aria-label="Consultar Disponible de '+esc(row.produccion)+'">Por consultar</button>':'<span class="lp-assembly-pending">Por consultar</span>';
 return '<tr data-assembly-key="'+esc(row.key)+'" data-assembly-state="'+row.state+'"'+(selected?' class="is-selected"':'')+'>'+
  '<td data-label="Producción / reserva" class="lp-assembly-identity"><div class="lp-assembly-identity-line"><span class="lp-assembly-badge"'+(row.reviewReason?' title="'+esc(row.reviewReason)+'"':'')+'>'+stateLabels[row.state]+'</span><button type="button" data-assembly-detail="'+esc(row.key)+'" class="lp-assembly-name"'+(!onDetail?' disabled':'')+' aria-label="Ver detalle de '+esc(row.produccion)+'"><b>'+esc(row.produccion)+'</b></button></div><small class="lp-assembly-reserve">'+(text(row.oficial.reserva_al)?'Reserva '+esc(row.oficial.reserva_al):'Reserva por validar')+'</small>'+(secondary?'<small class="lp-assembly-context'+(row.scheduled?' is-scheduled':'')+'">'+esc(secondary)+'</small>':'')+'</td>'+
  '<td data-label="Semana" class="lp-assembly-week">'+value(row.week?.label)+'</td>'+
  '<td data-label="Sistema" class="lp-assembly-system">'+value(text(row.oficial.sistema)||null)+'</td>'+
  '<td data-label="Saldo Export" class="lp-assembly-number">'+value(row.balance)+'</td>'+
  '<td data-label="Disponible" class="lp-assembly-number lp-assembly-available">'+available+'</td>'+
  '<td data-label="Realizado" class="lp-assembly-number" title="'+esc(realizedTitle(row))+'">'+(row.realized===null?'<span class="lp-assembly-pending">'+realizedLabel(row)+'</span>':realizedLabel(row))+'</td>'+
  '<td data-label="Afectaciones" class="lp-assembly-affectations">'+summaryMarkup(row,summaryFor,onAffectations)+'</td>'+
  '<td data-label="Observaciones" class="lp-assembly-observation"><div data-note-order-key="'+esc(row.key)+'"><span class="lp-assembly-pending">Por consultar</span></div></td>'+
  '<td data-label="Acciones" class="lp-assembly-row-actions"><button type="button" data-assembly-detail="'+esc(row.key)+'" class="lp-assembly-detail"'+(!onDetail?' disabled':'')+' aria-label="Abrir detalle de '+esc(row.produccion)+'"><span class="lp-assembly-detail-text">Detalle</span><span aria-hidden="true"> ›</span></button>'+(onGlass?'<button type="button" class="lp-assembly-glass" data-assembly-glass="'+esc(row.key)+'" aria-label="Ver vidrio de '+esc(row.produccion)+'">Ver vidrio</button>':'')+'</td></tr>';
}
const text=v=>typeof v==='string'?v.trim():'';

/** Pure B13 table markup. The same semantic rows become cards on mobile. */
export function assemblySheetMarkup(allRows,{state={},onDetail,onGlass,onAvailable,onAffectations,summaryFor,orderSaleProvider,catalogAvailable=true}={}){
 const visible=filterAssemblySheetRows(allRows,state);
 const opts={state,onDetail,onGlass,onAvailable,onAffectations,summaryFor,orderSaleProvider};
 const toolbar='<div class="lp-assembly-toolbar"><nav aria-label="Estado de las órdenes de Ensamble">'+tabs.filter(([key])=>key!=='POR_REVISAR'||allRows.some(r=>r.state===key)).map(([key,label])=>{const count=filterAssemblySheetRows(allRows,{status:key}).length;return '<button type="button" data-assembly-filter="'+key+'" aria-pressed="'+((state.status||'')===key)+'">'+label+' <span>('+count+')</span></button>';}).join('')+'</nav><label class="lp-assembly-search"><span class="lp-assembly-sr-only">Buscar producción, reserva o sistema</span><input type="search" data-assembly-search value="'+esc(state.search||'')+'" placeholder="Buscar producción o reserva" autocomplete="off"></label></div>';
 const sections=groups.map(group=>{
  const rows=visible.filter(r=>group.states.includes(r.state));if(!rows.length)return '';
  return '<section class="lp-assembly-group" data-assembly-group="'+group.key+'"><header><span class="lp-assembly-group-icon" aria-hidden="true">'+group.icon+'</span><div><h4>'+group.title+' · '+rows.length+'</h4><p>'+group.subtitle+'</p></div></header><div class="lp-assembly-table-wrap" tabindex="0" aria-label="'+group.title+': tabla desplazable"><table class="lp-assembly-table"><caption class="lp-assembly-sr-only">'+group.title+'</caption><colgroup><col class="lp-assembly-col-identity"><col class="lp-assembly-col-week"><col class="lp-assembly-col-system"><col class="lp-assembly-col-number"><col class="lp-assembly-col-number"><col class="lp-assembly-col-number"><col class="lp-assembly-col-affects"><col class="lp-assembly-col-notes"><col class="lp-assembly-col-actions"></colgroup><thead><tr>'+['Producción / reserva','Semana','Sistema','Saldo Export','Disponible','Realizado','Afectaciones','Observaciones','Acciones'].map(h=>'<th scope="col">'+h+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>rowMarkup(r,opts)).join('')+'</tbody></table></div></section>';
 }).join('');
 return toolbar+(!catalogAvailable?'<p class="lp-assembly-notice" role="status">Catálogo completo pendiente. Esta consulta solo muestra las producciones incorporadas al turno.</p>':'')+'<div class="lp-assembly-count" role="status" aria-live="polite">'+visible.length+' producci'+(visible.length===1?'ón':'ones')+'</div>'+sections+(!visible.length?'<p class="lp-assembly-empty">No hay producciones que coincidan con los filtros de esta consulta.</p>':'')+'<p class="lp-assembly-footnote">Saldo: último Export. Disponible: definición guardada por orden. Realizado: cierre Export del turno consultado. Una producción aparece una sola vez; las afectaciones pueden coincidir.</p>';
}

/** Mount with existing transports/callbacks. This module owns no RPC or writes.
 * onDetail/onGlass/onAvailable(row); onAffectations({row,cause}).
 * Stable orderSaleProvider reuses existing editors and pending commands.
 * beforeRender({host,rows}) may park other editors and return an attach function.
 * Both hooks run on every render, including internal search/filter changes.
 */
export function renderAssemblySheet(options){
 const {host,data,context,state={},onDetail,onGlass,onAvailable,onAffectations,summaryFor,orderSaleProvider=null,beforeRender}=options;
 // Validate before detaching reusable editors or replacing any visible content.
 const allRows=assemblySheetRows(data,context,{includeCompleted:true});
 const byKey=new Map(allRows.map(r=>[r.key,r]));
 const active=host.contains(document.activeElement)?document.activeElement:null;
 const focusedAttribute=['data-assembly-search','data-assembly-filter','data-assembly-detail','data-assembly-glass','data-assembly-available'].find(name=>active?.hasAttribute(name));
 const focusedValue=focusedAttribute?active.getAttribute(focusedAttribute):null;
 const selection=active?.tagName==='INPUT'?{start:active.selectionStart,end:active.selectionEnd}:null;
 const scroll=new Map([...host.querySelectorAll('[data-assembly-group]')].map(g=>[g.dataset.assemblyGroup,{left:g.querySelector('.lp-assembly-table-wrap')?.scrollLeft||0,top:g.querySelector('.lp-assembly-table-wrap')?.scrollTop||0}]));
 const markup=assemblySheetMarkup(allRows,{state,onDetail,onGlass,onAvailable,onAffectations,summaryFor,orderSaleProvider,catalogAvailable:data.catalog?.contract==='LP-HOJA-1'});
 const attach=beforeRender?.({host,rows:allRows});
 const attachSale=retainOrderSaleRows(host,orderSaleProvider,allRows.map(r=>r.key));
 host.classList.add('lp-assembly-sheet');
 host.innerHTML=markup;
 attachSale();
 attach?.();
 const rerender=()=>renderAssemblySheet({...options,state});
 host.querySelector('[data-assembly-search]').oninput=e=>{state.search=e.target.value;rerender();};
 host.querySelectorAll('[data-assembly-filter]').forEach(button=>button.onclick=()=>{state.status=button.dataset.assemblyFilter;state.includeCompleted=false;rerender();});
 const choose=(callback,key)=>{const row=byKey.get(key);if(row)callback?.(row);};
 host.querySelectorAll('[data-assembly-detail]').forEach(button=>button.onclick=()=>{state.selected=button.dataset.assemblyDetail;host.querySelectorAll('[data-assembly-key]').forEach(r=>r.classList.toggle('is-selected',r.dataset.assemblyKey===state.selected));choose(onDetail,state.selected);});
 host.querySelectorAll('[data-assembly-glass]').forEach(button=>button.onclick=()=>choose(onGlass,button.dataset.assemblyGlass));
 host.querySelectorAll('[data-assembly-available]').forEach(button=>button.onclick=()=>choose(onAvailable,button.dataset.assemblyAvailable));
 host.querySelectorAll('[data-assembly-affect]').forEach(button=>button.onclick=()=>{const row=byKey.get(button.dataset.assemblyAffect);if(row)onAffectations?.({row,cause:null});});
 host.querySelectorAll('[data-summary-cause]').forEach(button=>{button.disabled=!onAffectations;button.onclick=()=>{const row=byKey.get(button.closest('[data-assembly-key]')?.dataset.assemblyKey);if(row)onAffectations?.({row,cause:button.dataset.summaryCause});};});
 host.querySelectorAll('[data-assembly-group]').forEach(group=>{const previous=scroll.get(group.dataset.assemblyGroup),wrap=group.querySelector('.lp-assembly-table-wrap');if(previous){wrap.scrollLeft=previous.left;wrap.scrollTop=previous.top;}});
 if(focusedAttribute){const control=[...host.querySelectorAll('['+focusedAttribute+']')].find(el=>el.getAttribute(focusedAttribute)===focusedValue);control?.focus({preventScroll:true});if(control&&selection&&selection.start!==null)control.setSelectionRange?.(selection.start,selection.end);}
 return {rows:allRows,visibleRows:filterAssemblySheetRows(allRows,state),refresh:rerender};
}
