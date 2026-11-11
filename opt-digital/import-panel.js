import {fileIdentity} from './library.js';
// Originals are retained in memory/the existing PDF library, never inferred from extraction.
export function mountOptImportPanel(container,{api,getScope,getOrigin,getEntries,getRecords,onImported=()=>{}}){
 const make=(tag,text)=>{const element=container.ownerDocument.createElement(tag);if(text)element.textContent=text;return element;};
 const panel=make('section');panel.id='optImportPanel';panel.className='panel';
 const button=make('button','Procesar y guardar OPT en SGP');button.id='optImportProcess';button.type='button';
 const status=make('p');status.id='optImportStatus';status.setAttribute('role','status');
 const pendingNotice=make('p');pendingNotice.id='optImportPending';
 const results=make('div');results.id='optImportResults';results.setAttribute('aria-live','polite');
 panel.append(make('h2','Crear OPT compartidas'),make('p','Al pulsar Procesar y guardar OPT en SGP, se envían el PDF original y su índice a Supabase para validarlos contra la programación y crear las OPT compartidas. Los individuales se validan con su PDF y SGP. No se envían revisiones, planes ni asociaciones locales. Esto no registra cortes realizados.'),button,status,pendingNotice,results);container.append(panel);
 const originals=new Map(),indexes=new Map();let closed=false,busy=false,epoch=0,capturing=0,lastScope='';
 const scopeKey=()=>{const s=getScope();return s?JSON.stringify([s.linea,s.anio,s.semana,s.modo]):'';};
 function availability(){const pending=api?.pending?.();pendingNotice.textContent=pending===null?'No se pudo leer el registro de cargas anteriores. No se enviarán archivos hasta que esté disponible.':pending?.length?'Cargas anteriores sin confirmar. Reintenta con los mismos originales y ámbito: '+pending.map(p=>`${p.pdf?.name} · ${p.source?.origin} · ${p.scope?.semana}/${p.scope?.anio} · índice ${p.index?.name||'no corresponde'}`).join('; ')+'. Pueden haberse guardado en SGP.':'';button.disabled=closed||busy||capturing>0||!api||getScope()?.linea!=='PANELES_2'||!['RETAIL','PROYECTO','INDIVIDUAL'].includes(getOrigin());if(!busy&&!status.textContent)status.textContent=!api?'La carga compartida no está disponible. Puedes conservar y revisar los archivos localmente.':'Consulta PANELES_2 y selecciona Retail, Proyecto o individual. Los originales no se envían hasta pulsar el botón.';}
 function invalidate(message='Selección cambiada. Revisa el origen y los archivos antes de procesar.'){
  epoch++;api?.invalidate();results.replaceChildren();status.textContent=busy?'Cambió el contexto durante la carga. Una petición ya enviada puede haberse guardado. Consulta su catálogo o reintenta exactamente el mismo PDF, índice, origen y ámbito para confirmar.':message;availability();
 }
 async function captureFiles(files,origin){
  capturing++;availability();
  try{for(const file of files){if(!/\.pdf$/i.test(file.name)||typeof file.arrayBuffer!=='function')continue;try{const hash=await fileIdentity(file);if(closed)return;originals.set(JSON.stringify([origin,file.name,hash]),{file,origin,name:file.name,hash});}catch(error){if(!closed)status.textContent=file.name+': no se conservó el original para enviar: '+error.message;}}}
  finally{capturing--;availability();}
 }
 function availableFiles(origin){
  const found=new Map([...originals].filter(([,item])=>item.origin===origin));
  for(const record of getRecords()){
   if(record.format!=='pdf'||!record.file||typeof record.file.arrayBuffer!=='function')continue;
   for(const source of record.sources?.length?record.sources:[{origin:'UNKNOWN',mode:'INDIVIDUAL',name:record.name}]){
    const own=source.mode==='INDIVIDUAL'?'INDIVIDUAL':source.origin;if(own!==origin)continue;
    const name=source.name||record.name,key=JSON.stringify([origin,name,record.key]);
    if(!found.has(key))found.set(key,{origin,name,hash:record.key,file:{name,size:record.file.size,arrayBuffer:()=>record.file.arrayBuffer()}});
   }
  }
  return [...found.values()];
 }
 function jobsFor(origin){
  const files=availableFiles(origin);
  if(origin==='INDIVIDUAL')return files.map(item=>({...item,opt:item.name.replace(/\.pdf$/i,'')}));
  const index=indexes.get(origin),entries=getEntries().filter(e=>e.origin===origin),opts=[...new Set(entries.map(e=>e.opt))],jobs=[];
  if(!index){return files.length?files.map(item=>({...item,error:'Falta el índice original de '+origin+'. Cárgalo antes de enviar este archivo.'})):[{name:origin,error:'Faltan el índice original y los PDF de este origen.'}];}
  for(const opt of opts){const matches=files.filter(item=>item.name===opt+'.pdf'||item.name.replace(/\.pdf$/i,'')===opt);if(matches.length===1)jobs.push({...matches[0],opt,index});else jobs.push({name:opt+'.pdf',error:matches.length?'Hay varios PDF con ese nombre exacto y contenido distinto. No se elige uno automáticamente.':'Falta PDF con nombre exacto. No se asigna por semejanza.'});}
  for(const item of files)if(!opts.includes(item.name.replace(/\.pdf$/i,'')))jobs.push({...item,error:'Este PDF no tiene consecutivo exacto en el índice de '+origin+'.'});
  return jobs;
 }
 button.onclick=async()=>{
  if(button.disabled||busy)return;const scope=getScope(),origin=getOrigin(),jobs=jobsFor(origin),operation=++epoch;busy=true;results.replaceChildren();availability();
  let succeeded=0,rejected=0,uncertain=0;const confirmed=[];
  try{
   if(!jobs.length){status.textContent='No hay PDF originales para este origen. Selecciona su carpeta o los archivos individuales.';return;}
   for(let i=0;i<jobs.length;i++){
    if(closed||operation!==epoch)return;const job=jobs[i],row=make('p');row.dataset.file=job.name;results.append(row);
    if(job.error){row.textContent=job.name+' · Bloqueado: '+job.error;rejected++;continue;}
    row.textContent=job.name+' · Enviando original '+(i+1)+' de '+jobs.length+'…';status.textContent='Procesando secuencialmente. Cada archivo tiene su propio resultado.';
    try{
     const result=await api.process({scope:{...scope},source:{origin:origin==='INDIVIDUAL'?'DESCONOCIDO':origin,opt:job.opt,mode:origin==='INDIVIDUAL'?'INDIVIDUAL':'INDICE'},pdf:job.file,...(job.index?{index:job.index}:{})});
     if(closed||operation!==epoch)return;
     succeeded++;confirmed.push(result);row.textContent=job.name+' · '+(result.data.duplicado?'Duplicado confirmado, sin crear otra OPT':'Guardado en SGP')+` · ${result.data.cantidad_piezas} piezas documentales; ${result.scopeTotals.assigned} asignadas a PANELES_2 según su semana de origen; ${result.scopeTotals.outsideScope} sin asignación a PANELES_2 y no disponibles para cortar. Documento ${result.data.id_documento}. No acredita cortes realizados.`;
    }catch(error){
     if(closed||operation!==epoch)return;
     const unknown=error.uncertain===true;unknown?uncertain++:rejected++;
     const blockers=Array.isArray(error.blockers)?error.blockers.slice(0,12).map(value=>typeof value==='string'?value:JSON.stringify(value)).join(' · '):'';
     row.textContent=job.name+' · '+(unknown?'Resultado incierto. Puede haberse guardado; reintenta con exactamente el mismo PDF, índice, origen y ámbito. ':'No guardado en este intento: ')+error.message+(blockers?' · '+blockers:'');
    }
   }
   if(!closed&&operation===epoch){status.textContent=`${succeeded} confirmados · ${rejected} rechazados o bloqueados · ${uncertain} inciertos. Los fallos no acreditan otros archivos.`;if(confirmed.length)onImported(confirmed);}
  }finally{busy=false;availability();}
 };
 availability();
 return {captureFiles,dropIndex(origin){indexes.delete(origin);invalidate('Leyendo índice nuevo. El índice anterior ya no se usa para enviar.');},setIndex(origin,index){indexes.set(origin,index);invalidate('Índice original conservado para el envío explícito. La revisión local no crea OPT en SGP.');},invalidate,update(){const next=scopeKey();if(next!==lastScope){lastScope=next;invalidate();}availability();},destroy(){closed=true;epoch++;api?.invalidate();originals.clear();indexes.clear();panel.remove();}};
}
