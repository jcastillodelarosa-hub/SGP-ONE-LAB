import {assemblySheetRows,filterAssemblySheetRows,ASSEMBLY_COLUMNS,assemblyColumnValue,assemblyValueKey} from '../domain/lp01-assembly-sheet.js';
import {retainOrderSaleRows} from './lp01-order-sale-rows.js';
import {compactSummaryMarkup} from './lp01-affectation-summary.js';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const value=v=>v===null||v===undefined?'<span class="lp-assembly-pending">Por validar</span>':esc(v);
const stateLabels={ABIERTAS:'Abierta',PROGRAMADAS:'Sin iniciar',OTRAS:'Sin programar',POR_REVISAR:'Por revisar',COMPLETADAS:'Completada'};
const groups=[
 {key:'ABIERTAS',title:'Órdenes abiertas',subtitle:'Por reserva y parte · incluye arrastres',icon:'◷',states:['ABIERTAS']},
 {key:'PROGRAMADAS',title:'Programadas para este turno · sin iniciar',subtitle:'Por reserva y parte de la reserva',icon:'▦',states:['PROGRAMADAS']},
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
  '<td data-label="Semana" class="lp-assembly-week">'+value(row.week?.label)+'</td>'+
  '<td data-label="Producción" class="lp-assembly-identity"><div class="lp-assembly-identity-line"><span class="lp-assembly-badge"'+(row.reviewReason?' title="'+esc(row.reviewReason)+'"':'')+'>'+stateLabels[row.state]+'</span><button type="button" data-assembly-detail="'+esc(row.key)+'" class="lp-assembly-name"'+(!onDetail?' disabled':'')+' aria-label="Ver detalle de '+esc(row.produccion)+'"><b>'+esc(row.produccion)+'</b></button></div>'+(secondary?'<small class="lp-assembly-context'+(row.scheduled?' is-scheduled':'')+'">'+esc(secondary)+'</small>':'')+'</td>'+
  '<td data-label="Reserva" class="lp-assembly-reservation">'+value(text(row.oficial.reserva_al)||null)+'</td>'+
  '<td data-label="Prioridad" class="lp-assembly-reservation-part">'+value(text(row.oficial.prioridad_reserva)||null)+'</td>'+
  '<td data-label="Sistema" class="lp-assembly-system">'+value(text(row.oficial.sistema)||null)+'</td>'+
  '<td data-label="Saldo Export" class="lp-assembly-number">'+value(row.balance)+'</td>'+
  '<td data-label="Disponible" class="lp-assembly-number lp-assembly-available">'+available+'</td>'+
  '<td data-label="Realizado" class="lp-assembly-number" title="'+esc(realizedTitle(row))+'">'+(row.realized===null?'<span class="lp-assembly-pending">'+realizedLabel(row)+'</span>':realizedLabel(row))+'</td>'+
  '<td data-label="Afectaciones" class="lp-assembly-affectations">'+summaryMarkup(row,summaryFor,onAffectations)+'</td>'+
  '<td data-label="Observaciones" class="lp-assembly-observation"><div data-note-order-key="'+esc(row.key)+'"><span class="lp-assembly-pending">Por consultar</span></div></td>'+
  '<td data-label="Acciones" class="lp-assembly-row-actions"><button type="button" data-assembly-detail="'+esc(row.key)+'" class="lp-assembly-detail"'+(!onDetail?' disabled':'')+' aria-label="Abrir detalle de '+esc(row.produccion)+'"><span class="lp-assembly-detail-text">Detalle</span><span aria-hidden="true"> ›</span></button>'+(onGlass?'<button type="button" class="lp-assembly-glass" data-assembly-glass="'+esc(row.key)+'" aria-label="Ver vidrio de '+esc(row.produccion)+'">Ver vidrio</button>':'')+'</td></tr>';
}
const text=v=>typeof v==='string'?v.trim():'';


const columns=[...ASSEMBLY_COLUMNS.slice(0,6),['available','Disponible'],ASSEMBLY_COLUMNS[6],['affectations','Afectaciones'],['observation','Observaciones'],['actions','Acciones']];
const columnLabel=key=>columns.find(([k])=>k===key)?.[1]||key;
function columnControls(allRows,state){
 const columnOptions=key=>[...new Map(allRows.map(r=>{const v=assemblyColumnValue(r,key);return [assemblyValueKey(v),v];})).entries()].sort((a,b)=>a[1]===null?1:b[1]===null?-1:typeof a[1]==='number'?a[1]-b[1]:String(a[1]).localeCompare(String(b[1]),'es',{numeric:true}));
 const columnPanel=()=>!state.column?'':'<dialog class="lp-column-menu" aria-labelledby="lp-assembly-column-title"><header><b id="lp-assembly-column-title">'+esc(columnLabel(state.column))+'</b><button type="button" data-column-close aria-label="Cerrar menú de columna">×</button></header><details data-menu-section="sort" '+(state.menuSection==='sort'?'open':'')+'><summary>Ordenar columna</summary><button type="button" data-column-order="asc">Ascendente · A → Z</button><button type="button" data-column-order="desc">Descendente · Z → A</button></details><details data-menu-section="filter" '+(state.menuSection==='filter'?'open':'')+'><summary>Filtrar columna</summary><label>Buscar valores<input type="search" data-column-search value="'+esc(state.columnQuery||'')+'"></label><div class="lp-column-selection"><button type="button" data-column-reset>Seleccionar todos</button><button type="button" data-column-none>Desmarcar todos</button></div><fieldset><legend>Valores</legend>'+columnOptions(state.column).map(([key,value])=>'<label data-value-label><input type="checkbox" data-column-value="'+esc(key)+'" '+(!state.columnDraft||state.columnDraft.includes(key)?'checked':'')+'>'+esc(value===null?'Sin dato':state.column==='week'?value.replace(/^(\d+)-W0?(\d+)$/,'$2 · $1'):value)+'</label>').join('')+'</fieldset><footer><button type="button" data-column-cancel>Cancelar</button><button type="button" data-column-apply>Aplicar</button></footer></details></dialog>';
 return '<nav class="lp-mobile-columns" aria-label="Encabezados: ordenar y filtrar">'+ASSEMBLY_COLUMNS.map(([key,label])=>columnButton(key,label,state,'mobile')).join('')+'</nav>'+columnPanel();
}
function columnButton(key,label,state,origin){return '<button type="button" data-column-origin="'+origin+'" data-column-menu="'+key+'" aria-expanded="'+(state.column===key)+'">'+label+(state.sort===key?(state.direction==='desc'?' ↓':' ↑'):' ▾')+(Array.isArray(state.columnFilters?.[key])?' •':'')+'</button>';}
function heading([key,label],state){return '<th scope="col" aria-sort="'+(state.sort===key?(state.direction==='desc'?'descending':'ascending'):'none')+'">'+(ASSEMBLY_COLUMNS.some(([k])=>k===key)?columnButton(key,label,state,'table'):label)+'</th>';}

/** Pure B13 table markup. The same semantic rows become cards on mobile. */
export function assemblySheetMarkup(allRows,{state={},onDetail,onGlass,onAvailable,onAffectations,summaryFor,orderSaleProvider,catalogAvailable=true}={}){
 const visible=filterAssemblySheetRows(allRows,state);
 const opts={state,onDetail,onGlass,onAvailable,onAffectations,summaryFor,orderSaleProvider};
 const toolbar='<div class="lp-assembly-toolbar"><nav aria-label="Estado de las órdenes de Ensamble">'+tabs.filter(([key])=>key!=='POR_REVISAR'||allRows.some(r=>r.state===key)).map(([key,label])=>{const count=filterAssemblySheetRows(allRows,{status:key}).length;return '<button type="button" data-assembly-filter="'+key+'" aria-pressed="'+((state.status||'')===key)+'">'+label+' <span>('+count+')</span></button>';}).join('')+'</nav><label class="lp-assembly-search"><span class="lp-assembly-sr-only">Buscar producción, reserva o sistema</span><input type="search" data-assembly-search value="'+esc(state.search||'')+'" placeholder="Buscar producción o reserva" autocomplete="off"></label><button type="button" data-columns-reset>Limpiar filtros y orden</button></div>';
 const sections=groups.map(group=>{
  const rows=visible.filter(r=>group.states.includes(r.state));if(!rows.length)return '';
  return '<section class="lp-assembly-group" data-assembly-group="'+group.key+'"><header><span class="lp-assembly-group-icon" aria-hidden="true">'+group.icon+'</span><div><h4>'+group.title+' · '+rows.length+'</h4><p>'+(state.sort?'Orden: '+columnLabel(state.sort)+(state.direction==='desc'?' ↓':' ↑'):group.subtitle)+'</p></div></header><div class="lp-assembly-table-wrap" tabindex="0" aria-label="'+group.title+': tabla desplazable"><table class="lp-assembly-table"><caption class="lp-assembly-sr-only">'+group.title+'</caption><colgroup><col class="lp-assembly-col-week"><col class="lp-assembly-col-identity"><col class="lp-assembly-col-reservation"><col class="lp-assembly-col-reservation-part"><col class="lp-assembly-col-system"><col class="lp-assembly-col-number"><col class="lp-assembly-col-number"><col class="lp-assembly-col-number"><col class="lp-assembly-col-affects"><col class="lp-assembly-col-notes"><col class="lp-assembly-col-actions"></colgroup><thead><tr>'+columns.map(c=>heading(c,state)).join('')+'</tr></thead><tbody>'+rows.map(r=>rowMarkup(r,opts)).join('')+'</tbody></table></div></section>';
 }).join('');
 return toolbar+columnControls(allRows,state)+(!catalogAvailable?'<p class="lp-assembly-notice" role="status">Catálogo completo pendiente. Esta consulta solo muestra las producciones incorporadas al turno.</p>':'')+'<div class="lp-assembly-count" role="status" aria-live="polite">'+visible.length+' producci'+(visible.length===1?'ón':'ones')+'</div>'+sections+(!visible.length?'<p class="lp-assembly-empty">No hay producciones que coincidan con los filtros de esta consulta.</p>':'')+'<p class="lp-assembly-footnote">Saldo: último Export. Disponible: definición guardada por orden. Realizado: cierre Export del turno consultado. Una producción aparece una sola vez; las afectaciones pueden coincidir.</p>';
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
 const chooseColumn=(key,origin,anchor)=>{state.menuAnchor={left:anchor.left,bottom:anchor.bottom};state.column=key;state.menuOrigin=origin;state.menuGroup=anchor.group||null;state.menuSection=null;state.columnQuery='';state.columnDraft=state.columnFilters?.[key]?[...state.columnFilters[key]]:null;rerender();host.querySelector('[data-column-close]')?.focus({preventScroll:true});};
 host.querySelectorAll('[data-column-menu]').forEach(b=>b.onclick=()=>chooseColumn(b.dataset.columnMenu,b.dataset.columnOrigin,{left:b.getBoundingClientRect().left,bottom:b.getBoundingClientRect().bottom,group:b.closest('[data-assembly-group]')?.dataset.assemblyGroup}));
 const closeColumn=()=>{const key=state.column,origin=state.menuOrigin;state.column=null;state.columnDraft=null;rerender();host.querySelector((state.menuGroup?'[data-assembly-group="'+state.menuGroup+'"] ':'')+'[data-column-origin="'+origin+'"][data-column-menu="'+key+'"]')?.focus({preventScroll:true});};
 const menu=host.querySelector('.lp-column-menu');
 if(menu){
  menu.showModal();
  if(matchMedia('(min-width: 701px)').matches&&state.menuAnchor){const top=Math.max(12,Math.min(state.menuAnchor.bottom+4,innerHeight-360));menu.style.margin='0';menu.style.left=Math.max(12,Math.min(state.menuAnchor.left,innerWidth-364))+'px';menu.style.top=top+'px';menu.style.maxHeight=(innerHeight-top-12)+'px';}
  menu.addEventListener('cancel',e=>{e.preventDefault();closeColumn();});
  menu.onkeydown=e=>{if(e.key!=='Tab')return;const controls=[...menu.querySelectorAll('button:not(:disabled),summary,input:not(:disabled)')].filter(el=>el.checkVisibility());const first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}};
  menu.querySelector('[data-column-close]').onclick=closeColumn;
  menu.querySelector('[data-column-cancel]').onclick=closeColumn;
  menu.querySelectorAll('[data-menu-section]').forEach(d=>d.querySelector('summary').onclick=e=>{e.preventDefault();d.open=!d.open;state.menuSection=d.open?d.dataset.menuSection:null;menu.querySelectorAll('[data-menu-section]').forEach(other=>{if(other!==d)other.open=false;});});
  menu.querySelectorAll('[data-column-order]').forEach(b=>b.onclick=()=>{state.sort=state.column;state.direction=b.dataset.columnOrder;closeColumn();});
  const inputs=()=>[...menu.querySelectorAll('[data-column-value]')];
  const remember=()=>{state.columnDraft=inputs().filter(x=>x.checked).map(x=>x.dataset.columnValue);};
  const filterValues=()=>{const query=menu.querySelector('[data-column-search]').value.toLocaleLowerCase('es');state.columnQuery=query;menu.querySelectorAll('[data-value-label]').forEach(label=>label.hidden=!label.textContent.toLocaleLowerCase('es').includes(query));};
  menu.querySelector('[data-column-search]').oninput=filterValues;filterValues();
  menu.querySelector('[data-column-reset]').onclick=()=>{inputs().forEach(x=>x.checked=true);state.columnDraft=null;};
  menu.querySelector('[data-column-none]').onclick=()=>{inputs().forEach(x=>x.checked=false);remember();};
  inputs().forEach(el=>el.onchange=remember);
  menu.querySelector('[data-column-apply]').onclick=()=>{state.columnFilters??={};if(state.columnDraft===null)delete state.columnFilters[state.column];else state.columnFilters[state.column]=[...state.columnDraft];closeColumn();};
 }
 host.querySelector('[data-columns-reset]').onclick=()=>{state.columnFilters={};state.search='';state.sort='';state.direction='asc';rerender();};
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
