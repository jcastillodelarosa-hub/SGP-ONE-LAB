/* Four-tab navigation; presentation-only, no database writes. */
(()=>{
 const byId=id=>document.getElementById(id);
 const tabs=byId('productionAssemblyTab')?.parentElement;
 const assembly=byId('productionAssemblyTab'),packing=byId('productionPackingTab');
 const assemblyPanel=byId('productionAssemblyPanel'),packingPanel=byId('productionPackingPanel');
 const locations=byId('assemblyLocationReportPanel'),sheet=byId('assemblySheetPanel');
 if(!tabs||!assembly||!packing||!assemblyPanel||!packingPanel||!locations||!sheet)return;
 const planner=document.createElement('button');
 planner.type='button';planner.id='productionPlannerTab';planner.textContent='Planificador';
 const report=document.createElement('button');
 report.type='button';report.id='productionLocationsTab';report.textContent='Reporte de ubicaciones';
 tabs.insertBefore(planner,assembly);tabs.append(report);
 const plannerPanel=document.createElement('div');
 plannerPanel.id='productionPlannerPanel';plannerPanel.className='production-packing-empty';
 plannerPanel.innerHTML='<h3>Planificador de Línea de Producción</h3><p>En preparación: prioridades operativas por línea y turno. No se modifican datos ni reglas de programación.</p>';
 tabs.after(plannerPanel);
 const oldSubtabs=byId('assemblySheetTab')?.parentElement;
 if(oldSubtabs)oldSubtabs.hidden=true;
 const style=document.createElement('style');
 style.textContent='.production-line-tabs{flex-wrap:nowrap;overflow-x:auto}.production-line-tabs button{min-width:max-content}.assembly-table-wrap,.packing-preview-scroll{overflow:auto;max-height:65vh;border-radius:14px;border:1px solid #dce5f2}.assembly-table-wrap thead th,.packing-preview-table thead th{position:sticky;top:0;z-index:2;background:#eaf1fc;color:#284d80}.assembly-table-wrap tbody tr:nth-child(even),.packing-preview-table tbody tr:nth-child(even){background:#f6f9ff}.assembly-table-wrap tbody tr:hover,.packing-preview-table tbody tr:hover{background:#e8f1ff}';
 style.textContent+=' .production-table-sortbar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:12px;margin:10px 0;background:#fff;border:1px solid #dce5f2;border-radius:12px}.production-table-sortbar label{display:grid;gap:3px;font-size:12px}.production-table-sortbar select{max-width:170px;padding:7px;border:1px solid #cbdcf0;border-radius:7px}.production-table-sortbar small{color:#64748b}@media(max-width:700px){.production-table-sortbar label{flex:1;min-width:100px}.production-line-tabs{scroll-snap-type:x proximity}.production-line-tabs button{scroll-snap-align:start}}';
 style.textContent+=' .production-table-quickfilter{min-width:180px;flex:1;padding:9px;border:1px solid #cbdcf0;border-radius:9px}.assembly-table-wrap tbody tr[hidden],.packing-preview-scroll tbody tr[hidden]{display:none!important}';
 style.textContent+=' .production-table-count{margin-left:auto;color:#526781;font-size:12px;white-space:nowrap}';
 style.textContent+=' @media(max-width:680px){.assembly-table-wrap,.packing-preview-scroll{max-height:none;overflow:visible;border:0;background:transparent}.assembly-table-wrap table,.packing-preview-table{min-width:0!important;width:100%!important;display:block}.assembly-table-wrap thead,.packing-preview-scroll thead{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}.assembly-table-wrap tbody,.packing-preview-scroll tbody{display:grid;gap:12px}.assembly-table-wrap tbody tr,.packing-preview-scroll tbody tr{display:block;background:#fff!important;border:1px solid #dce6f4;border-radius:14px;padding:8px 12px;box-shadow:0 2px 8px #163b6810}.assembly-table-wrap tbody td,.packing-preview-scroll tbody td{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;padding:9px 2px!important;border-bottom:1px solid #e7eef7;min-width:0;overflow-wrap:anywhere;text-align:right}.assembly-table-wrap tbody td::before,.packing-preview-scroll tbody td::before{content:attr(data-mobile-label);font-weight:700;color:#536d92;text-align:left;flex:0 0 42%}.assembly-table-wrap tbody tr.production-table-empty td,.packing-preview-scroll tbody tr.production-table-empty td{display:block;text-align:center}.assembly-table-wrap tbody tr.production-table-empty td::before,.packing-preview-scroll tbody tr.production-table-empty td::before{content:none}}';
 style.textContent+=' .sheet-filter-menu{box-sizing:border-box;max-height:min(76dvh,560px)!important;display:flex;flex-direction:column;overscroll-behavior:contain}.sheet-filter-menu .sheet-filter-values{flex:1 1 auto;min-height:80px;max-height:none!important;overflow-y:auto!important;overscroll-behavior:contain;scrollbar-width:thin}.sheet-filter-menu .sheet-filter-check{flex-shrink:0}.sheet-filter-menu .sheet-apply{flex-shrink:0}@media(max-height:650px){.sheet-filter-menu{max-height:calc(100dvh - 20px)!important}}';
 style.textContent+=' .sheet-filter-menu{box-sizing:border-box!important;max-height:75dvh!important;overflow-y:auto!important;overscroll-behavior:contain}.sheet-filter-values{max-height:32dvh!important;overflow-y:auto!important}.sheet-filter-menu .sheet-apply{position:sticky;bottom:0;z-index:3;background:#2563eb;color:#fff}@media(max-width:700px){.sheet-filter-menu{max-height:80dvh!important}}';
 style.textContent+=' .sheet-filter-menu{position:fixed!important;top:12px!important;bottom:12px!important;height:auto!important;max-height:none!important;display:flex!important;flex-direction:column!important;overflow-y:auto!important}.sheet-filter-menu .sheet-filter-values{flex:1 1 auto!important;min-height:65px!important;max-height:none!important;overflow-y:auto!important}.sheet-filter-menu .sheet-apply{flex-shrink:0!important;position:sticky!important;bottom:0!important;margin-top:auto!important;min-height:44px!important}';
 document.head.append(style);
 // Read-only multi-level ordering for the rendered tables, without changing source data.
 function enhanceTable(tableId,host){
  const element=byId(tableId),table=element?.tagName==='TABLE'?element:element?.closest('table'),body=table?.tBodies?.[0];
  if(!table||!body||!host)return;
  const bar=document.createElement('div');
  bar.className='production-table-sortbar';
  bar.innerHTML='<strong>Ordenar por niveles</strong><label>Nivel 1 <select data-sort-level="0"></select></label><label>Nivel 2 <select data-sort-level="1"></select></label><label>Nivel 3 <select data-sort-level="2"></select></label><button type="button" data-sort-reset>Limpiar orden</button><small>Solo cambia el orden visual; no modifica prioridades guardadas.</small>';
  table.parentElement.before(bar);
  const count=document.createElement('span');count.className='production-table-count';count.setAttribute('aria-live','polite');bar.append(count);
  const direction=document.createElement('button');direction.type='button';direction.textContent='Orden: A → Z';direction.setAttribute('aria-label','Invertir orden de filas');bar.append(direction);
  let descending=false;
  direction.addEventListener('click',()=>{descending=!descending;direction.textContent=descending?'Orden: Z → A':'Orden: A → Z';sortRows();});
  const search=document.createElement('input');
  search.type='search';search.placeholder='Filtrar filas visibles…';search.setAttribute('aria-label','Filtrar filas de la tabla');
  search.className='production-table-quickfilter';
  bar.insertBefore(search,bar.querySelector('small'));
  const selectors=[...bar.querySelectorAll('select')];
  function filterRows(){
   const query=search.value.trim().toLocaleLowerCase('es');
   let visible=0;for(const row of body.rows){
    const text=(row.textContent||'').toLocaleLowerCase('es');
    row.hidden=!!query&&!text.includes(query);if(!row.hidden)visible++;
   }
   count.textContent=visible+' de '+body.rows.length+' filas';
  }
  search.addEventListener('input',filterRows);
  const optionLabels=()=>[...table.tHead?.querySelectorAll('th')||[]].map((th,i)=>({index:i,label:(th.textContent||'').trim().replace(/[▾▲▼]/g,'').trim()||'Columna '+(i+1)}));
  const refreshOptions=()=>{
   const options=optionLabels();
   selectors.forEach(select=>{
    const old=select.value;
    select.replaceChildren(new Option('Sin ordenar',''),...options.map(o=>new Option(o.label,String(o.index))));
    if([...select.options].some(o=>o.value===old))select.value=old;
   });
  };
  function labelMobileCells(){
   const headings=optionLabels().map(x=>x.label);
   for(const row of body.rows){
    const isEmpty=row.cells.length===1&&row.cells[0].colSpan>1;
    row.classList.toggle('production-table-empty',isEmpty);
    for(let i=0;i<row.cells.length;i++){
     const cell=row.cells[i],label=headings[i]||'Detalle';
     if(cell.dataset.mobileLabel!==label)cell.dataset.mobileLabel=label;
    }
   }
  }
  const collator=new Intl.Collator('es',{numeric:true,sensitivity:'base'});
  let busy=false;
  function sortRows(){
   const columns=selectors.map(x=>x.value).filter(x=>x!=='').map(Number);
   if(!columns.length)return;
   const rows=[...body.rows];
   const compare=(a,b)=>{
    for(const index of columns){
     const va=a.cells[index]?.textContent?.trim()||'',vb=b.cells[index]?.textContent?.trim()||'';
     const result=collator.compare(va,vb);if(result)return descending?-result:result;
    }
    return 0;
   };
   const ordered=[...rows].sort(compare);if(ordered.every((row,i)=>row===rows[i]))return;busy=true;ordered.forEach(row=>body.append(row));busy=false;
  }
  selectors.forEach(s=>s.addEventListener('change',sortRows));
  bar.querySelector('[data-sort-reset]').addEventListener('click',()=>{selectors.forEach(s=>s.value='');const refresh=tableId==='assemblyTable'?byId('loadAssembly'):null;if(refresh)refresh.click();else byId('packingPreviewSort')?.dispatchEvent(new Event('input',{bubbles:true}));});
  refreshOptions();labelMobileCells();filterRows();
  const observer=new MutationObserver(()=>{if(busy)return;refreshOptions();labelMobileCells();sortRows();filterRows();});
  observer.observe(body,{childList:true});
  if(table.tHead)observer.observe(table.tHead,{childList:true,subtree:true});
 }
 enhanceTable('assemblyTable',assemblyPanel);
 enhanceTable('packingPreviewBody',packingPanel);

 document.addEventListener('click',event=>{
  if(!event.target.closest('[data-sheet-filter]'))return;
  queueMicrotask(()=>{
   const menu=document.querySelector('.sheet-filter-menu');if(!menu)return;
   const rect=menu.getBoundingClientRect(),margin=10;
   menu.style.top=Math.max(margin,Math.min(rect.top,window.innerHeight-rect.height-margin))+'px';
   menu.style.left=Math.max(margin,Math.min(rect.left,window.innerWidth-rect.width-margin))+'px';
  });
 });
 const all=[['planificador',planner,plannerPanel],['ensamble',assembly,assemblyPanel],['empaque',packing,packingPanel],['ubicaciones',report,locations]];
 all.forEach(([name,button,panel])=>{button.setAttribute('role','tab');button.setAttribute('aria-controls',panel.id);button.addEventListener('click',()=>select(name));});
 tabs.addEventListener('keydown',event=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  const index=all.findIndex(([,button])=>button===document.activeElement);
  if(index<0)return;
  event.preventDefault();
  const next=event.key==='Home'?0:event.key==='End'?all.length-1:(index+(event.key==='ArrowRight'?1:-1)+all.length)%all.length;
  all[next][1].focus();all[next][1].click();
 });
 function select(name){
  for(const [key,button] of all){const active=key===name;button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;}
  plannerPanel.hidden=name!=='planificador';
  assemblyPanel.hidden=!(name==='ensamble'||name==='ubicaciones');
  packingPanel.hidden=name!=='empaque';
  sheet.hidden=name!=='ensamble';
  locations.hidden=name!=='ubicaciones';
  if(name==='ubicaciones')byId('assemblyLocationReportTab')?.click();
  if(name==='ensamble')byId('assemblySheetTab')?.click();
  // Restore visibility after legacy handlers, without overriding the active top-level tab.
  queueMicrotask(()=>{assemblyPanel.hidden=!(name==='ensamble'||name==='ubicaciones');packingPanel.hidden=name!=='empaque';sheet.hidden=name!=='ensamble';locations.hidden=name!=='ubicaciones';});
 }
 select('planificador');
})();
