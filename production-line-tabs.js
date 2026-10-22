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
 document.head.append(style);
 const all=[['planificador',planner,plannerPanel],['ensamble',assembly,assemblyPanel],['empaque',packing,packingPanel],['ubicaciones',report,locations]];
 all.forEach(([name,button,panel])=>{button.setAttribute('role','tab');button.setAttribute('aria-controls',panel.id);button.addEventListener('click',()=>select(name));});
 function select(name){
  for(const [key,button] of all){const active=key===name;button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;}
  plannerPanel.hidden=name!=='planificador';
  assemblyPanel.hidden=!(name==='ensamble'||name==='ubicaciones');
  packingPanel.hidden=name!=='empaque';
  sheet.hidden=name!=='ensamble';
  locations.hidden=name!=='ubicaciones';
  if(name==='ubicaciones')byId('assemblyLocationReportTab')?.click();
  if(name==='ensamble')byId('assemblySheetTab')?.click();
 }
 select('planificador');
})();
