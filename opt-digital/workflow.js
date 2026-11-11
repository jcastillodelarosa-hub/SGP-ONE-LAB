import {mountOptCutReport} from './cut-report.js';
import {mountOptScopePanel} from './scope-panel.js';
import {mountSharedCuts} from './shared-cuts.js';
import {readWorksheetGrid} from '../src/domain/powerbi/xlsx-reader.js';
import {normalizeOptRows,validateOptColumns} from '../src/domain/opt-index-importer.js';
// Import preparation only. These groups are index claims, never validated SGP identities.
export function parseIndex(text,format,origin){
 let rows;
 if(format==='json')rows=JSON.parse(text);
 else {
  const delimiter=text.split(/\r?\n/,1)[0].includes(';')?';':',';const grid=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===delimiter&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(Boolean))grid.push(row);row=[];cell='';}else cell+=c;}
  if(quoted)throw Error('Comillas incompletas en índice');row.push(cell);if(row.some(Boolean))grid.push(row);
  const headers=grid.shift()||[];if(new Set(headers).size!==headers.length)throw Error('Columnas duplicadas');rows=grid.map(values=>Object.fromEntries(headers.map((key,i)=>[key,values[i]||''])));
 }
 if(!Array.isArray(rows)||rows.length>20000||!validateOptColumns(rows,origin).valid)throw Error('Índice inválido: requiere OPT, Reserva y Sistema');
 return normalizeOptRows(rows,origin);
}
export async function parseIndexWorkbook(bytes,origin,{sheetName=origin==='PROYECTO'?'Optimizaciones':'ARCHIVOS',DOMParser=globalThis.DOMParser}={}){
 const grid=await readWorksheetGrid(bytes,{sheetName,DOMParser,allowOtherSheets:true,allowUnusedMacroDefault:true,allowStringCells:true,maxFileBytes:5*1024*1024});
 const [header,...data]=grid.rows;if(!header)throw Error('Índice vacío');
 const keys=header.values.map(v=>String(v??'').trim());if(keys.some(k=>!k)||new Set(keys).size!==keys.length)throw Error('Cabecera vacía o duplicada');
 const rows=data.map(row=>Object.fromEntries(keys.map((key,i)=>[key,row.values[i]??''])));
 if(!validateOptColumns(rows,origin).valid)throw Error('La hoja no contiene OPT, Reserva y Sistema');
 return {sheet:grid.sheet,entries:normalizeOptRows(rows,origin),sourceRows:data.length};
}
export function reservationGroups(entries){const groups=new Map();for(const entry of entries){if(!entry.reservation||!entry.system)continue;const key=JSON.stringify([entry.origin,entry.reservation,entry.system]);if(!groups.has(key))groups.set(key,{key,origin:entry.origin,reservation:entry.reservation,system:entry.system,opts:[]});const g=groups.get(key);if(!g.opts.includes(entry.opt))g.opts.push(entry.opt);}return [...groups.values()];}
export function mountOptWorkflow(root,viewer,options={}){
 const $=id=>root.querySelector('#'+id),make=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;};
 const main=root.querySelector('main'),header=main.querySelector('header'),library=root.querySelector('.opt-library');
 const tabs=make('div');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','OPT Digital');
 const load=make('section'),cuts=make('section');load.id='optLoadPanel';cuts.id='optCutsPanel';
 const buttons=['Carga de OPT','Cortes por reserva'].map((label,i)=>{const b=make('button',label);b.id='optWorkflowTab'+i;b.type='button';b.setAttribute('role','tab');b.setAttribute('aria-controls',i?cuts.id:load.id);tabs.append(b);return b;});
 const show=i=>{load.hidden=i!==0;cuts.hidden=i!==1;buttons.forEach((b,n)=>{b.setAttribute('aria-selected',String(n===i));b.tabIndex=n===i?0:-1;});};
 buttons.forEach((b,i)=>{b.onclick=()=>show(i);b.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?1:1-i;show(next);buttons[next].focus();}};});
 for(const [panel,i] of [[load,0],[cuts,1]]){panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',buttons[i].id);}
 for(const child of [...main.children])if(child!==header&&child!==library)cuts.append(child);
 load.append(library);header.after(tabs,load,cuts);
 const notice=make('p','Preparación local: los índices proponen asociaciones. No crean reservas SGP ni acreditan piezas. El registro compartido requiere un manifiesto aprobado en servidor, el PDF exacto y los permisos vigentes.');notice.className='notice';load.prepend(notice);
 const origin=make('select');origin.id='optIndexOrigin';origin.setAttribute('aria-label','Origen del índice');const originPlaceholder=make('option','Selecciona carga: Retail, Proyecto o individual');originPlaceholder.value='';origin.append(originPlaceholder);for(const value of ['RETAIL','PROYECTO','INDIVIDUAL']){const o=make('option',value);o.value=value;origin.append(o);}
 const input=make('input');input.id='optIndexFile';input.type='file';input.accept='.xlsx,.csv,.json';const label=make('label','Índice de OPT (XLSX, CSV o JSON) ');label.append(input);
 const sheet=make('select');sheet.id='optIndexSheet';sheet.setAttribute('aria-label','Hoja del índice XLSX');for(const name of ['ARCHIVOS','Optimizaciones','Maestro','Reservas']){const o=make('option',name);o.value=name;sheet.append(o);}

 const indexStatus=make('p','Selecciona el origen operativo sin inferirlo del archivo. El índice semana 46 usa ARCHIVOS; otros libros usan Optimizaciones, Maestro o Reservas.');indexStatus.setAttribute('role','status');
 const folder=make('input');folder.id='optPdfFolder';folder.type='file';folder.multiple=true;folder.setAttribute('webkitdirectory','');folder.accept='.pdf';const folderLabel=make('label','Carpeta local de PDF ');folderLabel.append(folder);
 origin.onchange=()=>{const individual=origin.value==='INDIVIDUAL';input.disabled=individual;folder.disabled=individual;sheet.disabled=individual;};
 const folderNote=make('p','Selecciona la carpeta desde este navegador. No se accede automáticamente a rutas del servidor ni se suben los PDF.');
 load.prepend(origin,sheet,label,indexStatus,folderLabel,folderNote);library.querySelector('label').firstChild.textContent='Cargar archivos individuales ';
 library.querySelector('.note').textContent+=' Los individuales quedan sin origen/asociación hasta revisarlos; no heredan el último índice cargado.';
 const unassociated=make('details'),issueTitle=make('summary'),issueNote=make('p','Estas filas permanecen en el índice, pero no se asignan a una reserva por proximidad ni se excluyen como si no pertenecieran a la línea. Requieren asociación acreditada.'),issuePage=make('p'),issueRows=make('div'),issuePrevious=make('button','Anteriores'),issueNext=make('button','Siguientes');unassociated.id='optIndexUnassociated';issueRows.id='optIndexIssueRows';issuePrevious.type=issueNext.type='button';unassociated.append(issueTitle,issueNote,issuePage,issuePrevious,issueNext,issueRows);load.append(unassociated);
 let issueOffset=0,issues=[];
 function renderIssues(){issues=entries.filter(e=>!e.reservation||!e.system);unassociated.hidden=!issues.length;issueTitle.textContent=`${issues.length} filas sin reserva o sistema · pendientes de asociación`;issueOffset=Math.min(issueOffset,Math.max(0,Math.floor((issues.length-1)/50)*50));issueRows.replaceChildren();for(const e of issues.slice(issueOffset,issueOffset+50))issueRows.append(make('p',`${e.origin} · fila ${e.sourceRow} · ${e.opt} · Reserva: ${e.reservation||'ausente'} · Sistema: ${e.system||'ausente'}`));issuePage.textContent=issues.length?`Filas ${issueOffset+1}–${Math.min(issueOffset+50,issues.length)} de ${issues.length}. Todas se conservan hasta cambiar el índice.`:'';issuePrevious.disabled=issueOffset===0;issueNext.disabled=issueOffset+50>=issues.length;}
 issuePrevious.onclick=()=>{issueOffset=Math.max(0,issueOffset-50);renderIssues();};issueNext.onclick=()=>{issueOffset+=50;renderIssues();};
 const reserve=make('select');reserve.id='optReservation';reserve.setAttribute('aria-label','Reserva y sistema declarados en índice');const documents=make('div');documents.id='optReservationDocuments';const detail=make('p','Carga un índice para seleccionar una reserva. Sin avance físico compartido disponible.');detail.setAttribute('role','status');cuts.prepend(reserve,detail,documents);
 const shared=mountSharedCuts(cuts,{...options,openDocument:key=>viewer.openDocument(key)});
 cuts.insertBefore(cuts.lastElementChild,documents.nextSibling);
 const report=mountOptCutReport(cuts,{api:options.reportApi,defaultScope:options.defaultScope});
 let entries=[],records=[],groups=[],closed=false,renderTimer=null,indexOperation=0;const indexGenerations=new Map();
 const scopePanel=mountOptScopePanel(load,{api:options.scopeApi,defaultScope:options.defaultScope,openDocument:key=>viewer.openDocument(key),onChange:plan=>{groups=plan.groups;renderScoped();}});
 function render(){renderIssues();scopePanel.update(entries,records);}
 function renderScoped(){const selected=reserve.value;reserve.replaceChildren();const empty=make('option','Selecciona reserva de la programación');empty.value='';reserve.append(empty);for(const g of groups){const o=make('option',`${g.reservation} · ${g.system} · ${g.origin}`);o.value=g.key;reserve.append(o);}reserve.value=groups.some(g=>g.key===selected)?selected:'';renderDocuments();}
 function renderDocuments(){if(groups.length&&!scopePanel.getScope()){scopePanel.invalidate();return;}documents.replaceChildren();const g=groups.find(g=>g.key===reserve.value);shared.select(g||null,records);if(!g){detail.textContent='Consulta la programación y selecciona una reserva candidata de la línea. El estado compartido se consulta solo desde el servidor.';return;}detail.textContent=`OPT declaradas: ${g.opts.join(', ')}. Asociación por índice pendiente de validación SGP; selecciona el PDF para revisión documental. Ninguna marca local equivale a cortado.`;for(const item of records){const sources=(item.sources||[]).filter(source=>source.origin===g.origin&&g.opts.includes((source.name||item.name).replace(/\.pdf$/i,'')));if(g.origin==='INDIVIDUAL'?!g.documentHashes.includes(item.key):!sources.length)continue;const name=g.origin==='INDIVIDUAL'?item.name:[...new Set(sources.map(source=>source.name||item.name))].join(' / ');const b=make('button',name+' · revisar documento');b.onclick=()=>viewer.openDocument(item.key);documents.append(b);}if(!documents.children.length)documents.append(make('p','No hay PDF con nombre exacto del consecutivo. Revisa el índice y la carpeta; no se asignará por semejanza.'));}
 input.onchange=async()=>{const file=input.files[0];input.value='';if(!file)return;const operation=++indexOperation,sourceOrigin=origin.value,sourceSheet=sheet.value;indexGenerations.set(sourceOrigin,operation);try{if(!['RETAIL','PROYECTO'].includes(sourceOrigin))throw Error('Selecciona el origen operativo Retail o Proyecto antes de cargar el índice.');if(file.size>5*1024*1024)throw Error('Índice mayor a 5 MB');const parsed=/\.xlsx$/i.test(file.name)?(await parseIndexWorkbook(await file.arrayBuffer(),sourceOrigin,{sheetName:sourceSheet})).entries:parseIndex(await file.text(),/\.json$/i.test(file.name)?'json':'csv',sourceOrigin);if(closed||indexGenerations.get(sourceOrigin)!==operation)return;entries=[...entries.filter(e=>e.origin!==sourceOrigin),...parsed.map(e=>({...e,sourceKey:sourceOrigin}))];render();if(operation===indexOperation)indexStatus.textContent=`${entries.length} filas cargadas temporalmente. ${groups.length} reservas/sistemas; ${issues.length} filas pendientes de asociación. Cruce por semana de origen; cortar después no mueve la reserva. No guardadas en SGP.`;}catch(e){if(!closed&&operation===indexOperation)indexStatus.textContent=e.message;}};
 folder.onchange=()=>{const files=[...folder.files].filter(f=>/\.pdf$/i.test(f.name));folder.value='';if(!['RETAIL','PROYECTO'].includes(origin.value)){indexStatus.textContent='Selecciona Retail o Proyecto para cargar su carpeta; usa Archivos individuales para PDFs sueltos.';return;}viewer.importFiles(files,{origin:origin.value,mode:'CARPETA'});};reserve.onchange=renderDocuments;
 const reportContextInputs=['optScopeYear','optScopeWeek','optScopeLine'].map($);
 for(const input of reportContextInputs)input.addEventListener('change',report.invalidate);
 const unsubscribe=viewer.onDocuments(items=>{records=items;clearTimeout(renderTimer);renderTimer=setTimeout(()=>{if(!closed)render();},75);});render();show(0);
 return {destroy(){closed=true;clearTimeout(renderTimer);unsubscribe();for(const input of reportContextInputs)input.removeEventListener('change',report.invalidate);report.destroy();shared.destroy();scopePanel.destroy();}};
}
