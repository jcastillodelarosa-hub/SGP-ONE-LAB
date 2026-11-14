import {validOptProjectData,projectDataView} from '../src/domain/opt-project-data.js';
// Read-only documentary view. It never registers cuts or reconstructs missing source values.
const display=value=>value===null||value===undefined||value===''?'No informado':String(value);
export function mountReservationSummary(container,{api}={}) {
 const make=(tag,text)=>{const el=container.ownerDocument.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
 const section=make('section');section.className='panel opt-reservation-summary';section.id='optReservationSummary';
 const status=make('p','Selecciona una reserva compartida para consultar sus resúmenes.');status.id='optReservationSummaryStatus';status.setAttribute('role','status');
 const refresh=make('button','Actualizar resumen');refresh.type='button';refresh.id='optReservationSummaryRefresh';
 const body=make('div');body.id='optReservationSummaryDocuments';
 section.append(make('h2','Resumen de la reserva'),status,refresh,body);container.append(section);
 let selected=null,active=false,closed=false,epoch=0,loaded=false,loading=false;
 function controls(){refresh.disabled=loading||!selected||selected.origin!=='SERVIDOR'||!api;section.setAttribute('aria-busy',String(loading));}
 function table(title,columns,rows,kind,emptyText='No hay filas documentales disponibles. No se interpreta como cantidad cero.'){
  const block=make('section');block.className='opt-summary-table-section';block.append(make('h3',title));
  const hint=make('p','Desliza la tabla horizontalmente para ver todas las columnas. La primera columna permanece fija.');hint.className='opt-summary-scroll-hint';block.append(hint);
  const wrap=make('div');wrap.className='table-wrap opt-summary-scroll';wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label',title+' · tabla desplazable');
  const table=make('table');table.className='opt-documentary-table '+kind;table.setAttribute('aria-label',title);const head=make('thead'),tr=make('tr');
  for(const [,label]of columns){const th=make('th',label);th.scope='col';tr.append(th);}head.append(tr);table.append(head);
  const tbody=make('tbody');for(const row of rows){const tr=make('tr');for(const [key]of columns)tr.append(make('td',display(row[key])));tbody.append(tr);}table.append(tbody);wrap.append(table);block.append(wrap);
  if(!rows.length)block.append(make('p',emptyText));
  return block;
 }
 function render(result){
  body.replaceChildren();
  for(const doc of result.documents){
   const article=make('article');article.className='opt-summary-document';article.append(make('h2',display(doc.opt)));
   if(doc.status==='NOT_PERSISTED')article.append(make('p','Esta OPT ya está importada, pero su resumen documental no está guardado en el servidor. No se reconstruye con los cortes ni se consideran sus valores como cero.'));
   if(doc.status==='PARTIAL')article.append(make('p','Resumen parcial: faltan una o más tablas impresas. Los datos ausentes no se estiman.'));
   for(const notice of doc.notices||[])article.append(make('p',notice));
   const pages=[...new Set([...(doc.cutRows||[]),...(doc.materialRows||[])].flatMap(row=>[row.sourcePage,row.countsPage]).filter(Number.isSafeInteger))].sort((a,b)=>a-b);
   if(pages.length)article.append(make('p','Fuente: resumen impreso del PDF · páginas '+pages.join(', ')));
   article.append(make('p',doc.scope==='RESERVA'?'Filas documentales acreditadas para la reserva seleccionada.':'Resumen del documento completo asociado a esta reserva. Sus totales no se atribuyen íntegramente a la reserva.'));
   if(doc.projectData&&validOptProjectData(doc.projectData)){
    const controls=make('div');controls.className='opt-project-data-controls';
    const filterLabel=make('label','Filtrar por referencia'),filter=make('input');filter.type='search';filter.className='opt-project-data-filter';filter.placeholder='Buscar en la referencia completa';filterLabel.append(filter);
    const orderLabel=make('label','Orden por referencia'),order=make('select');order.className='opt-project-data-order';
    for(const [value,label] of [['source','Orden del PDF'],['asc','Referencia ascendente'],['desc','Referencia descendente']]){const option=make('option',label);option.value=value;order.append(option);}orderLabel.append(order);
    const clear=make('button','Limpiar filtro');clear.type='button';clear.onclick=()=>{filter.value='';draw();filter.focus();};
    controls.append(filterLabel,orderLabel,clear);const slot=make('div'),counts=make('p');counts.className='opt-project-data-counts';counts.setAttribute('role','status');
    article.append(controls,slot,counts);
    function draw(){
     const left=slot.querySelector('.opt-summary-scroll')?.scrollLeft||0;
     const visible=projectDataView(doc.projectData,{query:filter.value,order:order.value});
     slot.replaceChildren(table('Resumen de cortes · detalle de piezas',[
      ['item','Ítem'],['profile','Perfil'],['code','Código/acabado'],['length','Longitud'],['reference','Referencia'],['quantity','Cantidad']
     ],visible.rows,'opt-project-data-table','No hay coincidencias con el filtro. El documento conserva todas sus filas.'));
     slot.querySelector('.opt-summary-scroll').scrollLeft=left;
     counts.textContent=`${visible.rows.length} de ${visible.totalRows} ítems · ${visible.visibleQuantity} de ${visible.totalQuantity} piezas impresas en el documento. No representa cortes realizados.`;
    }
    filter.oninput=draw;order.onchange=draw;draw();
   }else article.append(make('p','Detalle de piezas (Project data) no disponible. Se conservan los resúmenes existentes; no se reconstruyen referencias ni se supone cantidad cero.'));
   article.append(table('Totales de corte por perfil',[
    ['reference','Perfil'],['finish','Acabado'],['bars','Barras'],['pieces','Piezas OPT'],['plans','Planos'],['scrapPrinted','Scrap impreso']
   ],(doc.cutRows||[]).map(row=>({...row,scrapPrinted:row.scrapPercentagePrinted??(row.scrapPrinted?row.scrapPrinted+' (longitud)':null)})),'opt-cuts-summary-table'));
   article.append(table(doc.scope==='RESERVA'?'Referencias de la reserva · requerimientos de material':'Referencias del documento · requerimientos de material',[
    ['reference','Referencia'],['finish','Acabado'],['length','Longitud'],['quantity','Cant.'],['location','Ubicación'],['code','Código'],['observation','Observación']
   ],doc.materialRows||[],'opt-material-summary-table'));
   body.append(article);
  }
  body.append(make('p','«Piezas OPT» es cantidad documental, no cortes registrados en planta. Scrap muestra el porcentaje impreso cuando existe; si no, la longitud impresa identificada como tal. Los campos no disponibles no se completan con estimaciones. Para seleccionar piezas y registrar cortes, vuelve a Referencias y esquema.'));
  status.textContent=result.documents.length?`${selected.reservation} · ${selected.system} · ${result.documents.length} documentos.`:'No hay resúmenes documentales disponibles para esta reserva. No significa que no existan OPT o cortes guardados.';
 }
 async function load(){
  if(closed||!active||loading||!selected||selected.origin!=='SERVIDOR'||!api)return;
  const operation=++epoch,target=selected;loading=true;body.replaceChildren();status.textContent='Consultando resúmenes documentales…';controls();
  try{const result=await api.load(target);if(closed||operation!==epoch||selected!==target)return;render(result);loaded=true;}
  catch(error){if(!closed&&operation===epoch)status.textContent='No se pudo consultar el resumen: '+error.message+'. Los cortes guardados no se modificaron.';}
  finally{if(!closed&&operation===epoch){loading=false;controls();}}
 }
 refresh.onclick=()=>{loaded=false;load();};
 controls();
 return {
  select(group){if(selected===group)return;selected=group;epoch++;api?.invalidate?.();loading=false;loaded=false;body.replaceChildren();status.textContent=!group?'Selecciona una reserva compartida para consultar sus resúmenes.':group.origin!=='SERVIDOR'?'Candidato local: el resumen compartido requiere una OPT importada en SGP.':!api?'Resumen documental no disponible en esta conexión. Las OPT y los cortes compartidos se consultan en Referencias y esquema.':'Pulsa Resumen para consultar las tablas documentales de la reserva.';controls();load();},
  show(value){active=value;if(active&&!loaded)load();},
  destroy(){closed=true;epoch++;api?.invalidate?.();section.remove();}
 };
}
