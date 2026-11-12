import {validatedPdfBytes,pdfLibrary,createPdfView,PDF_READ_OPTIONS} from './pdf-safe-view.js';
import {fileIdentity, serialQueue, validatePlans, openLibrary} from './library.js';
import {paintedRules} from './pdf-grid.js';
import {linesFromItems} from './extraction.js';
import {extractCoordinatePlans} from './geometric-extraction.js';
export function mountOptDigital(root=document, options={}) {
const shell=root.querySelector('#optShell') || document.body;
const lifecycle=new AbortController();let disposed=false;const readOnly=options.readOnly===true;
const $ = id => root.querySelector('#'+id);
const node = (tag, text, cls) => {const el=document.createElement(tag); if(text!==undefined)el.textContent=text; if(cls)el.className=cls; return el;};
const documentListeners=new Set(),referenceListeners=new Set();
const queue=serialQueue(); let db, current, ref='', index=0, hasPdf=false, records=[], selectionEpoch=0;
const status = message => {if(!disposed && $('status'))$('status').textContent=message;};
const pdfView=createPdfView({canvas:$('pdfCanvas'),message:$('pdfStatus'),previous:$('pdfPrevious'),next:$('pdfNext'),position:$('pdfPosition')});
const drawer=$('refDrawer'),refsPanel=$('refsPanel'),dock=$('refDock');
function closeDrawer(){if(drawer.open)drawer.close();dock.replaceWith(refsPanel);refsPanel.before(dock);dock.hidden=true;}
function nav(mode) {
  const modal=mode==='open'&&matchMedia('(max-width:760px)').matches;
  if(modal){drawer.append(refsPanel);if(!drawer.open)drawer.showModal();}else closeDrawer();
  shell.classList.toggle('opt-refs-open',modal);shell.classList.toggle('opt-refs-rail',mode==='rail');
  for(const [id,value] of [['openRefs','open'],['railRefs','rail'],['hideRefs','hidden']])$(id).setAttribute('aria-pressed',String(mode===value));
  $('openRefs').setAttribute('aria-expanded',String(modal));
}
$('openRefs').onclick=()=>{nav('open');$('filter').focus();};$('closeRefs').onclick=()=>{nav('hidden');$('openRefs').focus();};
$('railRefs').onclick=()=>nav('rail');$('hideRefs').onclick=()=>nav('hidden');$('shade').onclick=()=>nav('hidden');
drawer.addEventListener('cancel',e=>{e.preventDefault();nav('hidden');$('openRefs').focus();},{signal:lifecycle.signal});
window.addEventListener('resize',()=>{if(drawer.open&&!matchMedia('(max-width:760px)').matches)nav('hidden');},{signal:lifecycle.signal});
function list() {
  const seen=new Set();$('library').replaceChildren();
  for(const item of [...records].sort((a,b)=>b.savedAt.localeCompare(a.savedAt))) {
    if($('versions').value==='latest' && seen.has(item.name))continue;seen.add(item.name);
    if(!item.name.toLowerCase().includes($('search').value.toLowerCase()))continue;
    const b=node('button',undefined,'opt-library-entry');b.setAttribute('aria-current',String(current?.key===item.key));
    b.append(node('strong',item.name),node('small',item.key.slice(0,12)+' · '+item.data.plans.length+' patrones'),node('small','Sin conciliación individual'));
    b.onclick=()=>{const epoch=++selectionEpoch;queue(async()=>{const data=await db.get(item.key);if(epoch===selectionEpoch)activate(data);}).catch(e=>status(e.message));};$('library').append(b);
  }
}
async function refresh(){records=await db.all();if(!disposed){list();for(const listener of documentListeners)listener(records);}}
function activate(item) {
  if(disposed)return;
  if(!item)throw Error('Documento no encontrado');
  pdfView.clear();hasPdf=item.format==='pdf';
  current=item;ref=item.view?.ref||item.data.plans[0]?.ref||'';index=item.view?.index||0;
  $('name').textContent=item.name;$('summary').textContent=item.data.pdfPages+' páginas · '+item.data.plans.length+' patrones provisionales · '+(readOnly?'Datos de ejemplo':item.format==='pdf'?'Extractor v'+(item.extractorVersion||15):'Paquete JSON')+(readOnly?' · Escenario sintético':' · SHA '+item.key.slice(0,12));
  $('pdf').hidden=true;$('pdfToggle').setAttribute('aria-expanded','false');$('pdfToggle').disabled=!hasPdf;$('reextract').disabled=readOnly||!hasPdf;
  $('issues').textContent=(item.issues||[]).join('\n')||'Sin conciliación independiente. No certificada.';
  $('text').textContent=(item.auditPages||[]).join('\n\n');$('filter').value='';renderRefs();renderPlan();list();
}
function renderRefs(){ $('refs').replaceChildren(); for(const value of new Set(current?.data.plans.map(p=>p.ref)||[])){
  if(!value.toLowerCase().includes($('filter').value.toLowerCase()))continue;
  const b=node('button',value,value===ref?'active':'');b.onclick=()=>{ref=value;index=0;renderRefs();renderPlan();saveView();nav('hidden');};$('refs').append(b);
}}
function saveView(){if(readOnly||!current)return; const key=current.key,expected=current.extractionId||current.savedAt,view={ref,index};queue(async()=>{const item=await db.get(key);if((item.extractionId||item.savedAt)!==expected)return;item.view=view;await db.put(item);}).catch(e=>status('No se guardó la posición: '+e.message));}
function renderPlan(){
  const plans=current?.data.plans.filter(p=>p.ref===ref)||[];index=Math.max(0,Math.min(index,plans.length-1));const p=plans[index];
  $('refTitle').textContent=ref||'Sin patrones interpretables';
  for(const listener of referenceListeners)listener(ref);
  $('individualCoverage').textContent='Sin conciliación individual calculada para esta extracción.';const coverage=current?.individualCoverage;if(coverage){const cuts=coverage.cuts.filter(c=>c.profile===ref),bars=coverage.bars.filter(b=>b.profile===ref);$('individualCoverage').textContent=`Cobertura documental de esta referencia: ${cuts.filter(c=>c.productionStatus==='DOCUMENT_ID_MATCH').length}/${cuts.length} cortes con número de producción presente en Project data; ${cuts.filter(c=>c.status==='UNIQUE_DOCUMENT_ROW').length} con fila documental única; ${cuts.filter(c=>c.status==='ROW_GROUP_MATCH').length} conciliados solo como grupo repetido. Barras representadas por patrón: ${bars.filter(b=>b.distributionStatus==='PDF_PATTERN_REPETITION').length}/${bars.length}. Remanentes: ${bars.filter(b=>b.remainderStatus==='ARITHMETIC_EQUALITY').length} con igualdad aritmética; ${bars.filter(b=>b.remainderStatus==='KERF_OR_ALLOWANCE_UNVERIFIED').length} con diferencia pendiente de justificar; ${bars.filter(b=>b.remainderStatus==='INCONSISTENT').length} inconsistentes. Comparación aritmética con espesor y extremos impresos: ${bars.filter(b=>b.arithmeticModels?.some(m=>m.delta32===0)).length}/${bars.length} coincide bajo una hipótesis de pasadas, no certificada. Ninguna producción SGP ni barra física enlazada. Repeticiones sin identidad individual quedan pendientes.`;}
  $('reconciliation').replaceChildren();for(const audit of current?.reconciliation?.filter(a=>a.reference===ref)||[]){const item=node('p');const match=v=>v===true?'coincide':v===false?'difiere':'sin fuente';item.textContent=`${audit.finish}: barras ${audit.bars} / ${audit.printedBars??'N/D'} PDF; cortes ${audit.cuts} / ${audit.printedCuts??'N/D'} PDF. Longitudes de barras: ${match(audit.barLengthsMatch)}; cortes: ${match(audit.cutLengthsMatch)}. Grupos de referencia: ${audit.referenceGroupsMatch===true?'coinciden':audit.referenceGroupsMatch===false?'difieren o están agrupados de otra manera; revisar identidad':'sin fuente'}. ${audit.incomplete?'Hay datos incompletos o incidencias.':'Sin incidencias sintácticas detectadas.'} Estado provisional; no acredita cada pieza.`;$('reconciliation').append(item);}
  for(const balance of current?.individualCoverage?.profileBalances?.filter(b=>b.ref===ref)||[]){
    const value=v=>v===null?'N/D':`${v}/32 pulgadas`;
    $('reconciliation').append(node('p',`Resumen impreso · página ${balance.page}: diferencia del balance total ${value(balance.summaryBalanceDelta32)}; barras representadas frente al resumen ${value(balance.patternStockDelta32)}; cortes frente al resumen ${value(balance.patternCutsDelta32)}. Reutilización por umbral mínimo impreso: diferencia ${value(balance.thresholdReuseDelta32)}. Comparación documental e hipótesis de reutilización; no certifica inventario ni pérdidas.`));
  }
  $('referenceAudit').textContent=plans.length?`${plans.length} patrones · ${plans.reduce((n,p)=>n+p.barqty,0)} barras declaradas · ${plans.reduce((n,p)=>n+p.cuts.length,0)} cortes representados. Estado provisional: longitudes, identidad y remanentes sin certificación individual.`:'Sin patrones interpretables: conservar PDF y revisar manualmente.';$('position').textContent=p?`${index+1} / ${plans.length}`:'0 / 0';
  $('previous').disabled=index===0;$('next').disabled=index>=plans.length-1;
  $('cuts').replaceChildren();$('bar').replaceChildren();$('detail').textContent='';$('unresolvedList').replaceChildren();for(const cell of p?.unresolvedCells||[]){$('unresolvedList').append(node('li',`Dato incompleto · página ${cell.page??'N/D'}, columna ${cell.column??'N/D'}: ${cell.length||'Longitud ausente'} · ${cell.project||'Referencia ausente'} · cantidad desconocida (no contada).`));}
  $('planIssues').textContent=p?.issues?.length?`Datos incompletos: ${p.issues.join(', ')}. ${p.unresolvedCells?.length||0} celdas sin cantidad interpretable; no se incluyeron en el conteo.`:'';$('planMeta').textContent=p?`${p.finish} · Barra ${p.length} · ${p.barqty} barras declaradas · Código ${p.code||'N/D'} · Ubicación ${p.location||'N/D'} · Página ${p.page??'N/D'}`:'';
  if(!p)return;
  const tracks=new Map();
  p.cuts.forEach((c,i)=>{
    const barNumber=Number.isSafeInteger(c.profileInstance)?c.profileInstance:null;let track=tracks.get(barNumber);if(!track){const box=node('section',undefined,'physical-bar');box.append(node('div',barNumber?`Repetición ${barNumber} del patrón · identidad física pendiente · no a escala`:'Distribución por barra pendiente','physical-bar-title'));track=node('div',undefined,'physical-track');box.append(track);const evidence=current?.individualCoverage?.bars.find(b=>b.patternId===p.id&&b.instance===barNumber);if(evidence)box.append(node('p',`Remanente impreso: ${evidence.printedRemainder32===null?'N/D':evidence.printedRemainder32/32+' pulgadas'}. Diferencia tras cortes y remanente: ${evidence.unexplainedLength32===null?'N/D':evidence.unexplainedLength32/32+' pulgadas'}. Sierra y extremos: comparación aritmética, sin certificación.`, 'note'));$('bar').append(box);tracks.set(barNumber,track);}
    const key=JSON.stringify([p.id,i]),b=node('button',c.length,'segment');
    b.onclick=()=>{$('detail').textContent=`Corte ${i+1}: ${c.length} · ${c.project} · Fila ${c.sourceRow} · Repetición ${c.profileInstance} · Unidad ${c.unitInstance} · Remanente ${c.rest||'N/D'}`;};track.append(b);
    const row=node('tr');row.append(node('td',i+1),node('td',c.length),node('td',(c.project||'Referencia incompleta')+(c.uncertain?' · Dato incierto':'')));
    const cell=node('td'),label=node('label',' Revisado (no cortado)'),check=node('input');check.type='checkbox';check.disabled=readOnly;check.checked=Boolean(current.review?.[key]);check.setAttribute('aria-label',`Revisado corte ${i+1}`);
    check.onchange=()=>{if(readOnly){check.checked=Boolean(current.review?.[key]);return;}const documentKey=current.key,expected=current.extractionId||current.savedAt,value=check.checked;check.disabled=true;queue(async()=>{const item=await db.get(documentKey);if((item.extractionId||item.savedAt)!==expected)throw Error('La extracción cambió; revisa el dato nuevamente');item.review={...item.review,[key]:value};await db.put(item);if(current?.key===documentKey)current.review=item.review;}).catch(e=>{check.checked=!value;status('Revisión NO guardada: '+e.message);}).finally(()=>check.disabled=false);};label.prepend(check);cell.append(label);row.append(cell);$('cuts').append(row);
  });
}
async function importFile(file,epoch,reprocess=false,provenance=null){
  if(disposed)throw Error('Vista cerrada');
  if(readOnly)throw Error('Demostración de solo lectura');
  if(file.size>30*1024*1024)throw Error('Archivo mayor a 30 MB');
  if(/\.pdf$/i.test(file.name))await validatedPdfBytes(file);
  status('Leyendo '+file.name);const key=await fileIdentity(file),existing=await db.get(key);
  const source={origin:['RETAIL','PROYECTO'].includes(provenance?.origin)?provenance.origin:'UNKNOWN',sourceKey:['RETAIL','PROYECTO'].includes(provenance?.origin)?provenance.origin:'INDIVIDUAL:'+key,mode:provenance?.mode==='CARPETA'?'CARPETA':'INDIVIDUAL',name:file.name};
  const sources=[...(existing?.sources||[])];if(!sources.some(s=>s.sourceKey===source.sourceKey&&s.mode===source.mode&&s.name===source.name))sources.push(source);
  if(existing&&!reprocess){existing.sources=sources;await db.put(existing);await refresh();if(epoch===selectionEpoch)activate(existing);status('Contenido ya guardado; se conserva su revisión. Para actualizar el lector usa Releer PDF.');return;}
  if(reprocess&&!/\.pdf$/i.test(file.name))throw Error('Solo se pueden releer PDF originales');
  let data,auditPages=[],issues=[],format,reconciliation=[],individualCoverage=null,sourceProjectRows=[];
  if(/\.json$/i.test(file.name)){format='json';data=validatePlans(JSON.parse(await file.text()));}
  else if(/\.pdf$/i.test(file.name)){
    format='pdf';const lib=await pdfLibrary(),task=lib.getDocument({...PDF_READ_OPTIONS,data:await validatedPdfBytes(file)});
    try {const doc=await task.promise,all=[];let totalItems=0;if(doc.numPages>500)throw Error('PDF fuera del límite de 500 páginas');for(let n=1;n<=doc.numPages;n++){if(disposed)throw Error('Vista cerrada');const page=await doc.getPage(n);const items=(await page.getTextContent()).items;if(items.length>100000||(totalItems+=items.length)>500000)throw Error('PDF fuera del límite de lectura');all.push({page:n,rotation:page.rotate,width:page.view[2]-page.view[0],height:page.view[3]-page.view[1],rules:paintedRules(await page.getOperatorList(),lib.OPS),items});}
      const parsed=extractCoordinatePlans(all);data=validatePlans(parsed);reconciliation=parsed.reconciliation;individualCoverage=parsed.individualCoverage;sourceProjectRows=parsed.sourceProjectRows;issues=parsed.issues.map(i=>`Página ${i.page} · ${i.reference||'Sin referencia'} · ${i.code}${i.detail?' · '+i.detail:''}`);auditPages=all.map(p=>linesFromItems(p.items).join('\n'));
      if(!data.plans.length)issues.push('Sin patrones interpretables: PDF conservado para revisión manual.');
    } finally {await task.destroy();}
  }else throw Error('Selecciona PDF o JSON');
  const item={key,sources,extractionId:crypto.randomUUID(),name:file.name,file,format,data,auditPages,issues,reconciliation,individualCoverage,sourceProjectRows,extractorVersion:21,history:existing?[...(existing.history||[]),{extractionId:existing.extractionId,data:existing.data,review:existing.review,view:existing.view,reconciliation:existing.reconciliation,individualCoverage:existing.individualCoverage,sourceProjectRows:existing.sourceProjectRows,issues:existing.issues,extractorVersion:existing.extractorVersion||15,savedAt:existing.savedAt}]:[],savedAt:new Date().toISOString(),review:{}};
  if(disposed)throw Error('Vista cerrada');await db.put(item);await refresh();if(epoch===selectionEpoch)activate(item);status('Guardado localmente. Pendiente de conciliación individual.');
}
$('files').onchange=e=>{const files=[...e.target.files],epoch=++selectionEpoch;e.target.value='';for(const file of files)queue(()=>importFile(file,epoch)).catch(err=>status(file.name+': '+err.message));};
$('reextract').onclick=()=>{if(readOnly||!current||current.format!=='pdf')return;const file=current.file,epoch=++selectionEpoch;$('reextract').disabled=true;queue(()=>importFile(file,epoch,true)).catch(e=>status('No se releyó el PDF: '+e.message)).finally(()=>{if(!disposed)$('reextract').disabled=readOnly||!hasPdf;});};
$('search').oninput=list;$('versions').onchange=list;$('refresh').onclick=()=>queue(refresh).catch(e=>status(e.message));$('filter').oninput=renderRefs;
$('previous').onclick=()=>{index--;renderPlan();saveView();};$('next').onclick=()=>{index++;renderPlan();saveView();};$('pdfToggle').onclick=()=>{$('pdf').hidden=!$('pdf').hidden;$('pdfToggle').setAttribute('aria-expanded',String(!$('pdf').hidden));if(!$('pdf').hidden&&hasPdf)pdfView.open(current.file);else pdfView.clear();};
if(readOnly){$('files').closest('label').hidden=true;$('reextract').hidden=true;$('reextract').nextElementSibling.hidden=true;}
const demoRecords=readOnly?(options.demoDocuments||[]).map(item=>({...item,data:validatePlans(item.data)})):[];
const library=readOnly?Promise.resolve({all:async()=>demoRecords,get:async key=>demoRecords.find(item=>item.key===key),put:async()=>{throw Error('Demostración de solo lectura');},close:()=>{}}):openLibrary(options.storageScope);
$('files').disabled=true;library.then(async lib=>{if(disposed){lib.close();return;}db=lib;await refresh();$('files').disabled=readOnly;if(readOnly&&records.length)activate(records[0]);status(readOnly?'Demostración sintética · solo lectura · sin almacenamiento ni conexión a SGP':'Biblioteca disponible · '+records.length+' documentos');}).catch(e=>status('Biblioteca no disponible: '+e.message));
const cleanup=()=>{disposed=true;closeDrawer();lifecycle.abort();pdfView.clear();db?.close();};
window.addEventListener('pagehide',cleanup,{signal:lifecycle.signal});nav('hidden');
return {destroy:cleanup,
 onReference(listener){referenceListeners.add(listener);listener(ref);return ()=>referenceListeners.delete(listener);},
 onDocuments(listener){documentListeners.add(listener);listener(records);return ()=>documentListeners.delete(listener);},
 openDocument(key){const epoch=++selectionEpoch;return queue(async()=>{if(disposed)throw Error('Vista cerrada');const item=await db.get(key);if(epoch===selectionEpoch)activate(item);}).catch(e=>status(e.message));},
 importFiles(files,provenance=null){if(readOnly||disposed)return;const epoch=++selectionEpoch;for(const file of files)queue(async()=>{await library;return importFile(file,epoch,false,provenance);}).catch(e=>status(file.name+': '+e.message));}
};
}
if(document.querySelector('#optShell[data-opt-standalone]'))mountOptDigital();
