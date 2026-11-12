import {mountMatrixPanel} from './matrix-panel.js';
import {mountOptCutReport} from './cut-report.js';
import {mountOptScopePanel} from './scope-panel.js';
import {mountSharedCuts} from './shared-cuts.js';
import {mountOptImportPanel} from './import-panel.js';
import {parseIndex,parseIndexWorkbook} from '../src/domain/opt-index-file.js';
export {parseIndex,parseIndexWorkbook} from '../src/domain/opt-index-file.js';
export function reservationGroups(entries){const groups=new Map();for(const entry of entries){if(!entry.reservation||!entry.system)continue;const key=JSON.stringify([entry.origin,entry.reservation,entry.system]);if(!groups.has(key))groups.set(key,{key,origin:entry.origin,reservation:entry.reservation,system:entry.system,opts:[]});const g=groups.get(key);if(!g.opts.includes(entry.opt))g.opts.push(entry.opt);}return [...groups.values()];}
export function mountOptWorkflow(root,viewer,options={}){
 const $=id=>root.querySelector('#'+id),make=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;};
 const main=root.querySelector('main'),header=main.querySelector('header'),library=root.querySelector('.opt-library');
 const tabs=make('div');tabs.className='opt-workflow-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','OPT Digital');
 const load=make('section'),cuts=make('section');load.id='optLoadPanel';cuts.id='optCutsPanel';
 const buttons=['Carga de OPT','Cortes por reserva'].map((label,i)=>{const b=make('button',label);b.id='optWorkflowTab'+i;b.type='button';b.setAttribute('role','tab');b.setAttribute('aria-controls',i?cuts.id:load.id);tabs.append(b);return b;});
 const show=i=>{load.hidden=i!==0;cuts.hidden=i!==1;buttons.forEach((b,n)=>{b.setAttribute('aria-selected',String(n===i));b.tabIndex=n===i?0:-1;});};
 buttons.forEach((b,i)=>{b.onclick=()=>show(i);b.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?1:1-i;show(next);buttons[next].focus();}};});
 for(const [panel,i] of [[load,0],[cuts,1]]){panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',buttons[i].id);}
 for(const child of [...main.children])if(child!==header&&child!==library)cuts.append(child);
 load.append(library);header.after(tabs,load,cuts);
 const notice=make('p','La carga local prepara y revisa los originales. Usa Procesar y guardar OPT en SGP para enviarlos a validación del servidor y crear las OPT compartidas. Solo un recibo válido confirma la importación; revisar un PDF no registra cortes.');notice.className='notice';load.prepend(notice);
 const origin=make('select');origin.id='optIndexOrigin';origin.setAttribute('aria-label','Origen del índice');const originPlaceholder=make('option','Selecciona carga: Retail, Proyecto o individual');originPlaceholder.value='';origin.append(originPlaceholder);for(const value of ['RETAIL','PROYECTO','INDIVIDUAL']){const o=make('option',value);o.value=value;origin.append(o);}
 const input=make('input');input.id='optIndexFile';input.type='file';input.accept='.xlsx,.csv,.json';const label=make('label','Índice de OPT (XLSX, CSV o JSON) ');label.append(input);
 const sheet=make('select');sheet.id='optIndexSheet';sheet.setAttribute('aria-label','Hoja del índice XLSX');for(const name of ['ARCHIVOS','Optimizaciones','Maestro','Reservas']){const o=make('option',name);o.value=name;sheet.append(o);}

 const indexStatus=make('p','Selecciona el origen operativo sin inferirlo del archivo. El índice semana 46 usa ARCHIVOS; otros libros usan Optimizaciones, Maestro o Reservas.');indexStatus.setAttribute('role','status');
 const folder=make('input');folder.id='optPdfFolder';folder.type='file';folder.multiple=true;folder.setAttribute('webkitdirectory','');folder.accept='.pdf';const folderLabel=make('label','Carpeta local de PDF ');folderLabel.append(folder);
 origin.onchange=()=>{const individual=origin.value==='INDIVIDUAL';input.disabled=individual;folder.disabled=individual;sheet.disabled=individual;importPanel?.invalidate();importPanel?.update();};
 const folderNote=make('p','Selecciona la carpeta desde este navegador. No se accede automáticamente a rutas del servidor. Los originales seleccionados solo se envían al pulsar Procesar y guardar OPT en SGP.');
 const filesPanel=make('section');filesPanel.className='panel opt-source-panel';const fileControls=make('div');fileControls.className='opt-source-controls';for(const [field,text] of [[origin,'Tipo de carga'],[sheet,'Hoja del índice']]){const fieldLabel=make('label',text);fieldLabel.append(field);fileControls.append(fieldLabel);}fileControls.append(label,folderLabel);filesPanel.append(make('h2','Archivos de OPT'),fileControls,indexStatus,folderNote);load.prepend(filesPanel);library.querySelector('label').firstChild.textContent='Cargar archivos individuales ';
 library.querySelector('.note').textContent+=' Los individuales no heredan el último índice cargado. El servidor deriva sus asociaciones al procesarlos; la revisión local no las acredita.';
 const unassociated=make('details'),issueTitle=make('summary'),issueNote=make('p','Estas filas permanecen en el índice, pero no se asignan a una reserva por proximidad ni se excluyen como si no pertenecieran a la línea. Requieren asociación acreditada.'),issuePage=make('p'),issueRows=make('div'),issuePrevious=make('button','Anteriores'),issueNext=make('button','Siguientes');unassociated.id='optIndexUnassociated';issueRows.id='optIndexIssueRows';issuePrevious.type=issueNext.type='button';unassociated.append(issueTitle,issueNote,issuePage,issuePrevious,issueNext,issueRows);load.append(unassociated);
 let issueOffset=0,issues=[];
 function renderIssues(){issues=entries.filter(e=>!e.reservation||!e.system);unassociated.hidden=!issues.length;issueTitle.textContent=`${issues.length} filas sin reserva o sistema · pendientes de asociación`;issueOffset=Math.min(issueOffset,Math.max(0,Math.floor((issues.length-1)/50)*50));issueRows.replaceChildren();for(const e of issues.slice(issueOffset,issueOffset+50))issueRows.append(make('p',`${e.origin} · fila ${e.sourceRow} · ${e.opt} · Reserva: ${e.reservation||'ausente'} · Sistema: ${e.system||'ausente'}`));issuePage.textContent=issues.length?`Filas ${issueOffset+1}–${Math.min(issueOffset+50,issues.length)} de ${issues.length}. Todas se conservan hasta cambiar el índice.`:'';issuePrevious.disabled=issueOffset===0;issueNext.disabled=issueOffset+50>=issues.length;}
 issuePrevious.onclick=()=>{issueOffset=Math.max(0,issueOffset-50);renderIssues();};issueNext.onclick=()=>{issueOffset+=50;renderIssues();};
 const reserve=make('select');reserve.id='optReservation';reserve.setAttribute('aria-label','Reserva y sistema del catálogo compartido o candidatos locales');const documents=make('div');documents.id='optReservationDocuments';const detail=make('p','Consulta el ámbito de programación para seleccionar una reserva compartida. No necesitas volver a cargar el índice o PDF.');detail.setAttribute('role','status');const catalogStatus=make('p','Consulta la línea, el año y la semana de origen para cargar el catálogo compartido.');catalogStatus.id='optCatalogStatus';catalogStatus.setAttribute('role','status');const catalogReload=make('button','Actualizar catálogo compartido');catalogReload.id='optCatalogRefresh';catalogReload.type='button';catalogReload.disabled=true;cuts.prepend(catalogStatus,catalogReload,reserve,detail,documents);
 let matrixSystem='',matrixReference='';
 const matrixSlot=make('div');$('refTitle').after(matrixSlot);
 const matrix=mountMatrixPanel(matrixSlot,{api:options.matrixApi});
 const unsubscribeReference=viewer.onReference?.(reference=>{matrixReference=reference;matrix.select(matrixSystem,matrixReference);})||(()=>{});
 const shared=mountSharedCuts(cuts,{...options,openDocument:key=>viewer.openDocument(key)});
 cuts.insertBefore(cuts.lastElementChild,documents.nextSibling);
 const report=mountOptCutReport(cuts,{api:options.reportApi,defaultScope:options.defaultScope});
 let importPanel=null,pendingImportScope='',pendingImportedHashes=[],entries=[],records=[],groups=[],localGroups=[],catalogSnapshot=null,catalogKey='',catalogEpoch=0,closed=false,renderTimer=null,indexOperation=0;const indexGenerations=new Map();
 const scopePanel=mountOptScopePanel(load,{api:options.scopeApi,defaultScope:options.defaultScope,openDocument:key=>viewer.openDocument(key),onChange:plan=>{localGroups=plan.groups;syncCatalog();renderScoped();importPanel?.update();}});
 importPanel=mountOptImportPanel(load,{api:options.importApi,getScope:()=>scopePanel.getScope(),getProgrammingSnapshot:()=>scopePanel.getProgrammingSnapshot(),getOrigin:()=>origin.value,getEntries:()=>entries,getRecords:()=>records,onImported:receipts=>{pendingImportScope=scopeKey(scopePanel.getScope());pendingImportedHashes=receipts.map(r=>r.document.sha256);invalidateCatalog();syncCatalog();renderScoped();}});
 const individualFiles=$('files');const captureIndividual=event=>{importPanel.invalidate('PDF individuales seleccionados para revisión local. El envío requiere el botón Procesar y guardar OPT en SGP.');importPanel.captureFiles([...event.target.files],'INDIVIDUAL');};individualFiles?.addEventListener('change',captureIndividual,true);
 function render(){renderIssues();scopePanel.update(entries,records);}
 const scopeKey=scope=>scope?JSON.stringify([scope.linea,scope.anio,scope.semana,scope.modo]):'';
 function invalidateCatalog(){catalogEpoch++;catalogSnapshot=null;catalogKey='';options.catalogApi?.invalidate();catalogReload.disabled=true;}
 function syncCatalog(){
  const scope=scopePanel.getScope(),key=scopeKey(scope);if(pendingImportScope&&pendingImportScope!==key){pendingImportedHashes=[];pendingImportScope='';}
  if(!scope||scope.linea!=='PANELES_2'){
   if(catalogKey||catalogSnapshot)invalidateCatalog();
   catalogStatus.textContent=scope?'Catálogo compartido disponible solo en BASE PANELES_2.':'Consulta la línea, el año y la semana de origen para cargar el catálogo compartido.';return;
  }
  if(!options.catalogApi){catalogStatus.textContent='Catálogo compartido no disponible. Los archivos locales permanecen como candidatos separados.';return;}
  if(catalogKey===key)return;
  const operation=++catalogEpoch;catalogKey=key;catalogSnapshot=null;catalogReload.disabled=true;
  catalogStatus.textContent='Consultando reservas con manifiestos importados…';
  options.catalogApi.load(scope).then(snapshot=>{
   if(closed||operation!==catalogEpoch||scopeKey(scopePanel.getScope())!==key||!options.catalogApi.isCurrent(snapshot))return;
   catalogSnapshot=snapshot;catalogStatus.textContent=`${snapshot.groups.length} reservas/sistemas con manifiesto importado · semana de origen ${scope.semana}/${scope.anio}. Los permisos y cortes se comprueban al seleccionar la reserva.`;renderScoped();if(pendingImportedHashes.length){const matches=snapshot.groups.filter(g=>g.documentHashes.some(hash=>pendingImportedHashes.includes(hash)));pendingImportedHashes=[];pendingImportScope='';if(matches.length===1){reserve.value=matches[0].key;renderDocuments();}}
  }).catch(error=>{if(!closed&&operation===catalogEpoch){catalogSnapshot=null;catalogStatus.textContent='Catálogo compartido no disponible: '+error.message+'. No se interpreta como ausencia de reservas.';renderScoped();}})
   .finally(()=>{if(!closed&&operation===catalogEpoch)catalogReload.disabled=!scopePanel.getScope();});
 }
 catalogReload.onclick=()=>{invalidateCatalog();syncCatalog();renderScoped();};
 function renderScoped(){
  const selected=reserve.value;groups=[...(options.catalogApi?.isCurrent(catalogSnapshot)?catalogSnapshot.groups:[]),...localGroups];
  reserve.replaceChildren();const empty=make('option','Selecciona reserva de la programación');empty.value='';reserve.append(empty);
  for(const g of groups){const o=make('option',`${g.reservation} · ${g.system} · ${g.origin==='SERVIDOR'?'Compartida · manifiesto importado':'Candidato local · '+g.origin}`);o.value=g.key;reserve.append(o);}
  reserve.value=groups.some(g=>g.key===selected)?selected:'';renderDocuments();
 }
 function renderDocuments(){
  if(groups.length&&!scopePanel.getScope()){scopePanel.invalidate();return;}
  const selected=groups.find(g=>g.key===reserve.value);
  if(selected?.origin==='SERVIDOR'&&!options.catalogApi?.ownsGroup(selected)){invalidateCatalog();renderScoped();return;}
  matrixSystem=selected?.system||'';matrix.select(matrixSystem,matrixReference);
  documents.replaceChildren();shared.select(selected||null,records);
  if(!selected){detail.textContent='Selecciona una reserva compartida para consultar referencias, cortes realizados y pendientes. Los candidatos locales se muestran por separado.';return;}
  const g=selected;
  if(g.origin==='SERVIDOR'){
   detail.textContent=`OPT del servidor: ${g.opts.join(', ')}. El estado compartido verifica las referencias y los cortes vigentes. No necesitas cargar un índice ni un PDF en este navegador.`;
   documents.append(make('p','El PDF original es opcional para revisión documental. Los cortes, sus usuarios y el saldo se muestran desde el servidor debajo.'));
   return;
  }
  detail.textContent=`OPT declaradas: ${g.opts.join(', ')}. Candidato local separado del catálogo compartido; selecciona el PDF para revisión documental. Ninguna marca local equivale a cortado.`;
  for(const item of records){const sources=(item.sources||[]).filter(source=>source.origin===g.origin&&g.opts.includes((source.name||item.name).replace(/\.pdf$/i,'')));if(g.origin==='INDIVIDUAL'?!g.documentHashes.includes(item.key):!sources.length)continue;const name=g.origin==='INDIVIDUAL'?item.name:[...new Set(sources.map(source=>source.name||item.name))].join(' / ');const b=make('button',name+' · revisar documento');b.onclick=()=>viewer.openDocument(item.key);documents.append(b);}
  if(!documents.children.length)documents.append(make('p','No hay PDF con nombre exacto del consecutivo. Revisa el índice y la carpeta; no se asignará por semejanza.'));
 }
 input.onchange=async()=>{const file=input.files[0];input.value='';if(!file)return;const operation=++indexOperation,sourceOrigin=origin.value,sourceSheet=sheet.value;indexGenerations.set(sourceOrigin,operation);importPanel.dropIndex(sourceOrigin);try{if(!['RETAIL','PROYECTO'].includes(sourceOrigin))throw Error('Selecciona el origen operativo Retail o Proyecto antes de cargar el índice.');if(file.size>1024*1024)throw Error('Índice mayor a 1 MiB');const parsed=/\.xlsx$/i.test(file.name)?(await parseIndexWorkbook(await file.arrayBuffer(),sourceOrigin,{sheetName:sourceSheet})).entries:parseIndex(await file.text(),/\.json$/i.test(file.name)?'json':'csv',sourceOrigin);if(closed||indexGenerations.get(sourceOrigin)!==operation)return;entries=[...entries.filter(e=>e.origin!==sourceOrigin),...parsed.map(e=>({...e,sourceKey:sourceOrigin}))];importPanel.setIndex(sourceOrigin,{file,format:/\.xlsx$/i.test(file.name)?'xlsx':/\.json$/i.test(file.name)?'json':'csv',sheet:sourceSheet});render();if(operation===indexOperation)indexStatus.textContent=`${entries.length} filas cargadas temporalmente. ${groups.length} reservas/sistemas; ${issues.length} filas pendientes de asociación. Cruce por semana de origen; cortar después no mueve la reserva. No guardadas en SGP.`;}catch(e){if(!closed&&operation===indexOperation)indexStatus.textContent=e.message;}};
 folder.onchange=()=>{const files=[...folder.files].filter(f=>/\.pdf$/i.test(f.name));folder.value='';if(!['RETAIL','PROYECTO'].includes(origin.value)){indexStatus.textContent='Selecciona Retail o Proyecto para cargar su carpeta; usa Archivos individuales para PDFs sueltos.';return;}importPanel.invalidate('Carpeta seleccionada para revisión local. El envío requiere el botón Procesar y guardar OPT en SGP.');importPanel.captureFiles(files,origin.value);viewer.importFiles(files,{origin:origin.value,mode:'CARPETA'});};reserve.onchange=renderDocuments;
 sheet.onchange=()=>{importPanel.dropIndex(origin.value);indexStatus.textContent='Hoja cambiada: vuelve a seleccionar el índice original para validar y enviar esa hoja.';};
 const reportContextInputs=['optScopeYear','optScopeWeek','optScopeLine'].map($);
 for(const input of reportContextInputs)input.addEventListener('change',report.invalidate);
 const unsubscribe=viewer.onDocuments(items=>{records=items;clearTimeout(renderTimer);renderTimer=setTimeout(()=>{if(!closed)render();},75);});render();show(0);
 return {destroy(){closed=true;unsubscribeReference();matrix.destroy();importPanel.destroy();individualFiles?.removeEventListener('change',captureIndividual,true);invalidateCatalog();clearTimeout(renderTimer);unsubscribe();for(const input of reportContextInputs)input.removeEventListener('change',report.invalidate);report.destroy();shared.destroy();scopePanel.destroy();}};
}
