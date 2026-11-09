import {estimatedClassification} from '../domain/lp01-estimated-classification.js';
import {reportLineGoal,availableNotDefined,goalCompliance} from '../domain/line-turn-goal.js';
import {turnReportEvidence,turnReportTotals} from '../domain/lp01-turn-report.js';
import {turnReportMarkup} from './lp01-turn-report.js';
import {currentClosureExportRealized} from '../domain/lp01-closure-export-v2.js';

const esc=value=>String(value??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text=value=>typeof value==='string'?value.trim():'';
const quantity=value=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:null;
const number=value=>value===null?'Por validar':value.toLocaleString('es-CO');
const compliance=(sale,realized)=>sale!==null&&sale>0&&realized!==null?realized/sale*100:null;
const percent=value=>value===null?'No calculable':value.toLocaleString('es-CO',{maximumFractionDigits:1})+' %';
const samePeriod=(report,context)=>report?.etapa===context.stage&&report.linea===context.line&&report.fecha===context.date&&report.turno===context.shift;
const sum=(rows,field)=>{let total=0;for(const row of rows){if(row[field]===null)return null;total+=row[field];if(!Number.isSafeInteger(total))return null;}return total;};
const totals=rows=>{const sale=sum(rows,'sale'),realized=sum(rows,'realized');return {sale,realized,compliance:compliance(sale,realized)};};
const unique=values=>[...new Set(values.map(text).filter(Boolean))];
const v2Totals=rows=>({plan:sum(rows,'plan'),realized:sum(rows,'realized'),compliance:compliance(sum(rows,'plan'),sum(rows,'realized')),
 present:rows.filter(row=>row.coverage==='PRESENT').length,absent:rows.filter(row=>row.coverage==='ABSENT').length,
 preserved:rows.filter(row=>row.valueStatus==='PRESERVED').length,neverReported:rows.filter(row=>row.valueStatus==='NEVER_REPORTED').length,
 reported:sum(rows.filter(row=>row.valueStatus==='CURRENT_FILE'),'realized'),preservedReported:sum(rows.filter(row=>row.valueStatus==='PRESERVED'),'realized'),knownReported:sum(rows.filter(row=>row.realized!==null),'realized')});
const valueLabel=row=>row.valueStatus==='CURRENT_FILE'?'Informado en archivo actual':row.valueStatus==='PRESERVED'?'Ausente del archivo actual · valor anterior conservado':'Nunca informado · no equivale a cero';
const sourceCopy=source=>source?{...source,context:{...source.context},file:{...source.file},sourceRows:[...source.sourceRows]}:null;

/** Read immutable LP-OPERACION-1 closure snapshots, not today's catalog or manual
 * ejecutado. The shared validator checks each archive's exact version/file. Its
 * synthetic closed envelope is ONLY archive validation: current status is always
 * determined separately from the actual turn and complete report collection. */
export function assemblyReports(data,context,currentGoal,classifications={}){
 if(!['ENSAMBLE','EMPAQUE'].includes(context?.stage))throw Error('Etapa de informes incompatible.');
 if(data?.contract!=='LP-OPERACION-1'||!Array.isArray(data.reports))throw Error('Contrato de informes incompatible.');
 const current=currentClosureExportRealized(data,context);
 const reports=data.reports.filter(report=>samePeriod(report,context)).map(report=>{
  const duplicate=data.reports.filter(r=>samePeriod(r,context)&&(r.id===report.id||r.version===report.version)).length!==1;
  const archived=currentClosureExportRealized({contract:data.contract,turn:{estado:'CERRADO',revision:report.version},reports:[report]},context);
  const snapshot=report.snapshot;
  const metadataValid=Boolean(text(report.usuario))&&typeof report.creado_en==='string'&&Number.isFinite(Date.parse(report.creado_en))&&snapshot?.user===report.usuario;
  const empty=archived.status==='CONFIRMED_EMPTY';
  const valid=!duplicate&&metadataValid&&['CONFIRMED','CONFIRMED_EMPTY'].includes(archived.status)&&(empty?(report.archivo===null&&snapshot.file===null&&snapshot.confirmed===true):report.tipo==='CON_ACTIVIDAD');
  const isV4=archived.contract==='LP-REALIZADO-CIERRE-4',isV2=isV4||archived.contract==='LP-REALIZADO-CIERRE-3';
  const model={kind:isV2?'EXPORT_V2':'LEGACY',id:report.id,version:report.version,user:report.usuario,createdAt:report.creado_en,context:{...context},valid,empty,
   current:valid&&['CONFIRMED','CONFIRMED_EMPTY'].includes(current.status)&&current.closureId===report.id,
   observation:text(snapshot?.observation)||'Sin observación general registrada.',file:valid?archived.file??null:null,rows:[],systems:[],totals:null};
  model.state=model.current?'Cierre vigente':data.turn?.estado==='EN_REVISION'?'Histórico · turno reabierto':'Histórico · no vigente';
  if(!valid){model.warning='No se puede validar la identidad, versión, archivo o autor de este cierre. No se muestran cantidades ni se habilitan descargas.';return model;}
  if(isV2){
   Object.assign(model,{contract:isV4?'LP-EXPORT-CLOSE-4':'LP-EXPORT-CLOSE-3',sourceContract:isV4?'LP-EXPORT-CLOSE-4':'LP-EXPORT-CLOSE-3',authority:archived.authority,importId:archived.importId,universeRevision:archived.universeRevision,canContinue:archived.canContinue,comparisonComplete:archived.comparisonComplete,planComparison:archived.planComparison,reconciliation:archived.reconciliation});
   // Only the identity persisted by CERRAR can label a V2 production/system.
   // Older V2 snapshots remain unknown, without consulting today's catalog.
   model.rows=archived.rows.map(row=>({key:row.key,production:row.identity?.production??row.key,system:row.identity?.system??'Sistema por validar',identity:row.identity?{...row.identity}:null,realized:row.quantity,coverage:row.coverage,preserve:row.preserve,sourceRows:[...row.sourceRows],valueStatus:row.valueStatus,valueSource:sourceCopy(row.valueSource),
    plan:row.plan,planStatus:row.planStatus,compliance:isV4?compliance(row.plan,row.quantity):null,difference:row.difference,pendingAgainstPlan:row.pendingAgainstPlan,budget:{...row.budget},continuity:{...row.continuity},
    reason:row.reason,observation:text(row.reason)||'Sin observación registrada.',identityPending:!row.identity?.production||!row.identity?.system}));
   if(isV4)Object.assign(model,{planSnapshot:structuredClone(archived.planSnapshot),operationalReady:false,initialReference:{...archived.initialReference}});
  }else model.rows=snapshot.rows.map(row=>{
   const assignments=Array.isArray(row.assignments)?row.assignments:[];
   const matching=assignments.length>0&&assignments.every(a=>a&&a.key===row.key&&(!a.oficial?.key_produccion||a.oficial.key_produccion===row.key)&&(!a.oficial?.id_linea||a.oficial.id_linea===context.line));
   const systems=matching?unique(assignments.map(a=>a.oficial?.sistema)):[];
   const names=matching?unique(assignments.map(a=>a.oficial?.produccion||a.produccion)):[];
   const sameSystem=systems.length===1&&assignments.every(a=>text(a.oficial?.sistema)),sameName=names.length===1&&assignments.every(a=>text(a.oficial?.produccion||a.produccion));
   const system=sameSystem?systems[0]:'Sistema por validar';
   const observations=unique([snapshot.reasons?.[row.key],...assignments.filter(a=>a?.key===row.key).map(a=>a.observacion)]);
   const sale=quantity(row.sale),realized=row.power_bi;
   return {key:row.key,production:sameName?names[0]:row.key,system,sale,realized,compliance:compliance(sale,realized),
    observation:observations.join(' · ')||'Sin observación registrada.',identityPending:!matching||!sameSystem||!sameName};
  });
  if(isV2){model.rows=turnReportEvidence(snapshot.reportEvidence,context,report.id,model.rows);model.lineGoal=reportLineGoal(snapshot.reportEvidence,context,report.id,currentGoal);model.availableNotDefined=availableNotDefined(snapshot.reportEvidence,context,report.id);if(model.availableNotDefined)model.rows=model.rows.map(r=>({...r,complianceState:'No aplica'}));}
  if(isV2){const estimated=estimatedClassification(classifications?.[report.id],context,report.id,model.rows);if(estimated){model.rows=estimated.rows;model.classification={status:'ESTIMATED_REFERENCE',source:estimated.source};}}
  model.sourceFiles=isV2?[...new Map([model.file,...model.rows.map(row=>row.valueSource?.file).filter(Boolean)].map(file=>[file.id,{...file}])).values()]:model.file?[{...model.file}]:[];
  const systems=new Map();for(const row of model.rows){if(!systems.has(row.system))systems.set(row.system,[]);systems.get(row.system).push(row);}
  const summarize=isV2?rows=>({...v2Totals(rows),...turnReportTotals(rows)}):totals;
  model.systems=[...systems].map(([name,rows])=>({name,orders:rows.length,...summarize(rows)}));model.totals=summarize(model.rows);
  if(model.rows.some(row=>row.identityPending))model.warning='Hay identidades de sistema o producción pendientes en el snapshot. No se reparten cantidades entre sistemas ni se completa con datos del turno actual.';
  return model;
 }).sort((a,b)=>(quantity(b.version)??-1)-(quantity(a.version)??-1));
 return {reports,currentStatus:current.status};
}

/** Standalone, escaped B15 result used on screen and in image/PDF exports. */
export function assemblyReportMarkup(report){
 const c=report.context;
 const header='<header class="lp-assembly-report-heading"><div><h3>Resultado del turno · '+(c.stage==='EMPAQUE'?'Empaque':'Ensamble')+'</h3><p>'+esc(c.line)+' · '+esc(c.date)+' · Turno '+esc(c.shift)+'</p></div><span class="lp-assembly-report-state'+(report.current?' is-current':'')+'">'+esc(report.state)+'</span></header>'+
  '<p class="lp-assembly-report-provenance">Versión '+esc(report.version)+' · '+esc(report.createdAt)+' · '+esc(report.user)+'<br>Identificador del cierre: '+esc(report.id)+'</p>';
 if(!report.valid)return header+'<p class="lp-followup-blocked" role="status">'+esc(report.warning)+'</p>';
 if(report.kind==='EXPORT_V2')return '<div class="lp-turn-heading">'+header+'</div>'+turnReportMarkup(report)+
 '<section class="lp-assembly-report-card"><h4>Observaciones del turno</h4><p class="lp-assembly-report-observation">'+esc(report.observation)+'</p></section>'+
 '<details class="lp-turn-provenance"><summary>Datos del archivo y trazabilidad</summary><p>Subtotal informado: '+number(report.totals.reported)+' · Subtotal conocido: '+number(report.totals.knownReported)+'. Los valores conservados no se suman las recargas.</p>'+report.rows.filter(r=>r.valueStatus==='PRESERVED').map(r=>'<p>Fuente conservada · valor anterior conservado · '+esc(r.production)+': '+esc(r.valueSource?.file.name)+'</p>').join('')+'<p>Realizado corresponde al Export de este turno. Las recargas sustituyen únicamente lo informado; las producciones ausentes conservan su valor anterior acreditado.</p><p class="lp-assembly-report-provenance">Archivo: '+esc(report.file?.name)+' · SHA256 '+esc(report.file?.sha256)+' · '+esc(report.sourceContract)+' · '+esc(report.authority)+'<br>Importación actual ID: '+esc(report.importId)+'<br>Huella de universo actual: '+esc(report.universeRevision)+'</p><p>Disponible o estado sin evidencia del turno: Por validar. Este reporte no autoriza arrastre al siguiente turno.</p></details>';

 const v2=report.kind==='EXPORT_V2',v4=report.sourceContract==='LP-EXPORT-CLOSE-4',planLabel=v2?'Plan del turno':'Sale',plan=value=>v2?value.plan:value.sale,pct=value=>v2&&!v4&&value===null?'Por validar':percent(value);
 const summary='<div class="lp-followup-summary lp-assembly-report-kpis"><div>'+(v2?planLabel:'Sale validado')+'<b>'+number(plan(report.totals))+(plan(report.totals)===null?'':'<small> und</small>')+'</b></div><div>Realizado · '+(v2?'Export':'Power BI')+'<b>'+number(report.totals.realized)+(report.totals.realized===null?'':'<small> und</small>')+'</b></div><div>Cumplimiento<b>'+pct(report.totals.compliance)+'</b></div></div>';
 const coverage=v2?'<p class="lp-assembly-report-footnote">Archivo actual: '+report.totals.present+' producciones presentes · '+report.totals.absent+' ausentes. Subtotal informado en este archivo: '+number(report.totals.reported)+' und. Valores conservados: '+report.totals.preserved+' producciones / '+number(report.totals.preservedReported)+' und. Subtotal conocido: '+number(report.totals.knownReported)+' und. '+(report.totals.neverReported?report.totals.neverReported+' producciones nunca informadas: Realizado total por validar, no equivale a cero.':'Todas las producciones tienen valor conocido; los ausentes conservan su última cantidad, no se suman las recargas.')+'</p>':'';
 const systems='<section class="lp-assembly-report-card"><h4>Resumen por sistema</h4><div class="lp-assembly-report-table-wrap"><table class="lp-assembly-report-table"><thead><tr><th scope="col">Sistema</th><th scope="col">'+planLabel+'</th><th scope="col">Realizado</th><th scope="col">Cumplimiento</th></tr></thead><tbody>'+report.systems.map(system=>'<tr><th scope="row">'+esc(system.name)+'</th><td>'+number(plan(system))+'</td><td>'+number(system.realized)+'</td><td>'+pct(system.compliance)+'</td></tr>').join('')+'</tbody><tfoot><tr><th scope="row">Total</th><td>'+number(plan(report.totals))+'</td><td>'+number(report.totals.realized)+'</td><td>'+pct(report.totals.compliance)+'</td></tr></tfoot></table></div></section>';
 const orders='<section class="lp-assembly-report-card"><h4>Detalle por producción · '+report.rows.length+'</h4><div class="lp-assembly-report-table-wrap"><table class="lp-assembly-report-table lp-assembly-report-orders"><thead><tr>'+['Producción','Sistema',planLabel,'Realizado','Cumplimiento','Observación'].map(label=>'<th scope="col">'+label+'</th>').join('')+'</tr></thead><tbody>'+report.rows.map(row=>'<tr><th scope="row" data-label="Producción"><b>'+esc(row.production)+'</b>'+(row.production!==row.key?'<small>'+esc(row.key)+'</small>':'')+'</th><td data-label="Sistema">'+esc(row.system)+'</td><td data-label="'+planLabel+'">'+number(plan(row))+'</td><td data-label="Realizado">'+number(row.realized)+(v2?'<small>'+esc(valueLabel(row))+(row.valueSource?'<br>Fuente: '+esc(row.valueSource.file.name)+' · filas '+esc(row.valueSource.sourceRows.join(', ')):'')+'</small>':'')+'</td><td data-label="Cumplimiento">'+pct(row.compliance)+'</td><td data-label="Observación">'+esc(row.observation)+'</td></tr>').join('')+'</tbody></table></div></section>';
 const source=report.file?'<p class="lp-assembly-report-provenance">'+(v2?'Archivo actual: ':'Archivo: ')+esc(report.file.name||'Nombre no informado')+'<br>Archivo ID: '+esc(report.file.id)+'<br>SHA256: '+esc(report.file.sha256)+(v2?'<br>Contrato: '+esc(report.sourceContract)+' · '+esc(report.authority)+'<br>Importación actual ID: '+esc(report.importId)+'<br>Huella de universo actual: '+esc(report.universeRevision):'')+'</p>'+(v2?report.rows.filter(row=>row.valueStatus==='PRESERVED').map(row=>'<p class="lp-assembly-report-provenance">Fuente conservada · '+esc(row.production)+': '+esc(row.valueSource.file.name)+'<br>Archivo ID: '+esc(row.valueSource.file.id)+' · importación '+esc(row.valueSource.importId)+' · versión '+esc(row.valueSource.importVersion)+'<br>SHA256: '+esc(row.valueSource.file.sha256)+'<br>Filas de origen: '+esc(row.valueSource.sourceRows.join(', '))+'</p>').join(''):''):'<p>Sin archivo Power BI · turno sin órdenes.</p>';
 const historical=report.planComparison==='HISTORICAL_UNAVAILABLE';
 const planHistory=historical?'<section class="lp-assembly-report-card"><h4>Plan histórico no disponible</h4><p>Este cierre acredita únicamente las cantidades del Export. No reconstruye metas históricas ni calcula cumplimiento, diferencias o pendientes contra un plan desconocido.</p></section>':v4&&report.context.stage==='EMPAQUE'?'<section class="lp-assembly-report-card"><h4>Plan vigente al cierre · Empaque</h4><p>Inclusiones explícitas capturadas '+esc(report.planSnapshot.capturedAt)+'. No utiliza el plan de Ensamble.</p><ul>'+report.planSnapshot.sourceRows.map(r=>'<li>'+esc(r.key)+' · '+r.cantidad+' · '+esc(r.usuario)+' · '+esc(r.motivo)+' · '+esc(r.creado_en)+'</li>').join('')+'</ul></section>':v4?'<section class="lp-assembly-report-card"><h4>Plan vigente al cierre · versión '+esc(report.planSnapshot.version)+'</h4><p>Capturado '+esc(report.planSnapshot.capturedAt)+'. Primera observación '+esc(report.planSnapshot.baseline.capturedAt)+': historia anterior desconocida, no es un plan original reconstruido.</p><ul>'+report.planSnapshot.changes.map(change=>'<li>'+esc(change.operation)+' · '+esc(change.at)+(change.actor?' · '+esc(change.actor)+' · '+esc(change.motive):' · Observación inicial sin atribución retrospectiva')+'</li>').join('')+'</ul><p>La comparación usa exclusivamente esta versión guardada, no la programación actual. Un plan de cero no permite calcular un porcentaje.</p></section>':'';
 const pending=v2?'<aside class="lp-followup-blocked">'+(historical?'<p>Comparación con planificación histórica no disponible. No equivale a una meta de cero.</p>':v4?'<p>Plan vigente acreditado en esta versión. '+(report.comparisonComplete?'Comparación completa.':'Comparación incompleta: hay valores de Realizado nunca informados.')+'</p>':'<p>Plan y cumplimiento: Por validar. La regla aprobada usa el plan vigente al cierre; falta conectar su versión persistida y los cambios con motivo/hora. Sale y avance manual no sustituyen ese plan.</p>')+'<p>Disponible y continuidad: Por validar. Falta la referencia del corte Export; este cierre no autoriza continuar ni acredita cantidades para el siguiente turno.</p></aside>':'';
 return header+summary+coverage+(report.empty?'<p class="lp-assembly-report-empty">SIN ACTIVIDAD · Cierre confirmado sin órdenes.</p>':systems+orders)+planHistory+pending+
  (report.warning?'<p class="lp-followup-blocked">'+esc(report.warning)+'</p>':'')+'<section class="lp-assembly-report-card"><h4>Observación general del turno</h4><p class="lp-assembly-report-observation">'+esc(report.observation)+'</p></section>'+source+
  '<p class="lp-assembly-report-footnote">Cantidades de esta versión de cierre. '+(v2?'Realizado procede de los archivos Export acreditados por producción. Cada recarga sustituye solo las cantidades incluidas; no suma ni borra las ausentes.':'Sale es el valor guardado del turno, distinto del Disponible global actual. Realizado procede únicamente de Power BI; no del avance manual.')+' '+(report.current?'Solo el coordinador autoriza correcciones posteriores.':'Este informe histórico no acredita el estado vigente del turno.')+'</p>';
}

const renderScopes=new WeakMap();
/** data-report/data-original are retained for the operation controller's existing
 * CSV/XLSX download handlers. Callbacks are optional alternatives to those hooks. */
export function renderAssemblyReports({host,data,context,onCSV,onOriginal,isCurrent=()=>true,exportReport=exportAssemblyReport,currentGoal,loadCurrentGoal,classifications,loadClassification,classificationLoadError}){
 const previousScope=renderScopes.get(host),scope={context:JSON.stringify(context)};renderScopes.set(host,scope);
 const hadReports=previousScope?.context===scope.context&&Boolean(host.querySelector('[data-assembly-report-index]'));
 const expanded=new Set([...host.querySelectorAll('details[data-report-id][open]')].map(el=>el.dataset.reportId));
 host.className='lp-followup lp-assembly-reports';
 if(!data){host.innerHTML='<h3>Reportes · cierres de producción</h3><p>Consulta un turno. Los informes aparecen después de guardar un cierre real.</p>';return {reports:[]};}
 let result;try{result=assemblyReports(data,context,currentGoal,classifications);}catch(error){host.innerHTML='<h3>Reportes · cierres de producción</h3><p role="status">'+esc(error.message)+'</p>';return {reports:[],error};}
 if((loadCurrentGoal&&currentGoal===undefined)||(loadClassification&&classifications===undefined))Promise.all([
  loadCurrentGoal&&currentGoal===undefined?Promise.resolve().then(loadCurrentGoal).catch(()=>null):currentGoal,
  loadClassification&&classifications===undefined?Promise.all(result.reports.filter(r=>r.valid).map(async r=>[r.id,await loadClassification(r.id)])).then(Object.fromEntries).catch(()=>({error:true})):classifications
 ]).then(([goal,loaded])=>{if(isCurrent()&&renderScopes.get(host)===scope)renderAssemblyReports({host,data,context,onCSV,onOriginal,isCurrent,exportReport,currentGoal:goal??null,classifications:loaded?.error?{}:loaded??{},classificationLoadError:loaded?.error});});
 const openDefault=!hadReports&&expanded.size===0?result.reports.find(report=>report.current)?.id:null;
 host.innerHTML='<h3>Reportes · cierres de producción</h3><p>'+esc(context.line)+' · '+esc(context.date)+' / T'+esc(context.shift)+'</p>'+
  (data.turn?.estado==='EN_REVISION'?'<p class="lp-followup-blocked">Turno reabierto. Los cierres anteriores se conservan como históricos; no hay Realizado vigente hasta confirmar un nuevo cierre.</p>':'')+
  (result.reports.length?result.reports.map((report,index)=>'<details data-report-id="'+esc(report.id)+'" data-assembly-report-index="'+index+'" '+(expanded.has(report.id)||report.id===openDefault?'open':'')+'><summary>Versión '+esc(report.version)+' · '+esc(report.user)+' · '+esc(report.createdAt)+' · '+esc(report.state)+'</summary><article class="lp-assembly-report" data-assembly-report-content>'+assemblyReportMarkup(report)+'</article>'+(report.valid?'<div class="lp-assembly-actions lp-assembly-report-downloads" data-report-actions><button type="button" data-report="'+esc(report.id)+'">CSV para Excel</button>'+(report.sourceFiles?.map(file=>'<button type="button" data-original="'+esc(file.id)+'">'+esc(file.id===report.file?.id?'XLSX original actual':'XLSX conservado · '+file.name)+'</button>').join('')||'')+'<button type="button" data-assembly-report-export="pdf">PDF</button><button type="button" data-assembly-report-export="png">Imagen</button></div><p data-assembly-report-status role="status" aria-live="polite"></p>':'')+'</details>').join(''):'<p>No hay cierres confirmados devueltos para este turno.</p>')+
  (classificationLoadError?'<p role="status">No se pudo consultar la clasificación complementaria. Vuelve a abrir Reportes para reintentar.</p>':'')+'<p>'+result.reports.length+' versiones de cierre. Cada informe conserva su fecha, autor y archivo.</p>';
 for(const details of host.querySelectorAll('[data-assembly-report-index]')){
  const report=result.reports[Number(details.dataset.assemblyReportIndex)];if(!report.valid)continue;
  const status=details.querySelector('[data-assembly-report-status]');let busy=false;
  const alive=()=>renderScopes.get(host)===scope&&host.contains(details)&&isCurrent();
  const run=async action=>{if(busy||!alive())return;busy=true;const buttons=[...details.querySelectorAll('[data-report-actions] button')];buttons.forEach(button=>button.disabled=true);status.textContent='Preparando descarga…';
   try{await action();if(alive())status.textContent='Archivo preparado para descargar.';}catch(error){if(alive())status.textContent='No se pudo preparar la descarga: '+error.message;}
   finally{busy=false;if(alive())buttons.forEach(button=>button.disabled=false);}
  };
  if(onCSV)details.querySelector('[data-report]').onclick=()=>run(()=>onCSV(report.id,report));
  if(onOriginal)details.querySelectorAll('[data-original]').forEach(button=>button.onclick=()=>run(()=>onOriginal(button.dataset.original)));
  details.querySelectorAll('[data-assembly-report-export]').forEach(button=>button.onclick=()=>run(()=>exportReport({report,format:button.dataset.assemblyReportExport,document:host.ownerDocument,isCurrent:alive})));
 }
 return result;
}

const libraryLoads=new WeakMap();
/** Use the same pinned, local vendor resources as app.js; never a CDN. */
export async function loadAssemblyReportLibraries({document,window=document.defaultView,needPdf=false}){
 let loads=libraryLoads.get(document);if(!loads){loads=new Map();libraryLoads.set(document,loads);}
 const load=async(path,ready,label)=>{
  if(ready())return;
  if(!loads.has(path))loads.set(path,new Promise((resolve,reject)=>{
   const script=document.createElement('script');let timer;
   const finish=error=>{clearTimeout(timer);script.onload=null;script.onerror=null;if(error){script.remove();reject(error);}else resolve();};
   script.src=new URL('../../vendor/'+path,import.meta.url).href;
   script.onload=()=>finish(ready()?null:Error(label+' no se inicializó.'));
   script.onerror=()=>finish(Error('No se pudo cargar '+label+' desde los recursos locales.'));
   timer=setTimeout(()=>finish(Error('Se agotó el tiempo de carga de '+label+'.')),15000);document.head.appendChild(script);
  }).catch(error=>{loads.delete(path);throw error;}));
  await loads.get(path);
 };
 await load('html2canvas.min.js',()=>typeof window.html2canvas==='function','html2canvas');
 if(needPdf)await load('jspdf.umd.min.js',()=>typeof window.jspdf?.jsPDF==='function','jsPDF');
}
/** CSV for the validated V2 model. Null numeric values stay empty and their
 * coverage/status columns explain why; no legacy manual-history aliases. */
export function assemblyReportCSV(report){
 if(!report?.valid||report.kind!=='EXPORT_V2'||!['LP-EXPORT-CLOSE-3','LP-EXPORT-CLOSE-4'].includes(report.sourceContract))throw Error('El CSV V2 requiere un modelo de cierre validado.');
 const cell=value=>'"'+(typeof value==='number'&&Number.isFinite(value)?String(value):String(value??'').replace(/^\s*[=+@-]/,match=>"'"+match)).replace(/"/g,'""')+'"';
 const header=['Contrato','Autoridad','Etapa','Línea','Fecha operativa','Turno','ID cierre','Versión','Fecha/hora de cierre','Autor','Estado de versión','ID importación actual','Huella de universo actual','ID archivo actual','Archivo actual','SHA256 actual','Producción (key)','Producción','Sistema','Cobertura archivo actual','Filas archivo actual','Estado del valor','ID importación del valor','Versión importación del valor','Huella de universo del valor','Etapa del valor','Línea del valor','Fecha operativa del valor','Turno del valor','ID archivo del valor','Archivo del valor','SHA256 del valor','Filas de origen del valor','Realizado','Conservar','Plan del turno','Estado del plan','Cumplimiento sobre Disponible (%)','Comparación completa','Disponible coordinador del turno','Conciliación','Continuidad','Asignación continuidad','Puede continuar','Motivo','Observación general'];
 const rows=report.rows.map(row=>[report.sourceContract,report.authority,report.context.stage,report.context.line,report.context.date,report.context.shift,report.id,report.version,report.createdAt,report.user,report.state,report.importId,report.universeRevision,report.file.id,report.file.name,report.file.sha256,row.key,row.production,row.system,row.coverage,row.sourceRows.join(', '),row.valueStatus,row.valueSource?.importId,row.valueSource?.importVersion,row.valueSource?.universeRevision,row.valueSource?.context.stage,row.valueSource?.context.line,row.valueSource?.context.date,row.valueSource?.context.shift,row.valueSource?.file.id,row.valueSource?.file.name,row.valueSource?.file.sha256,row.valueSource?.sourceRows.join(', '),row.realized,row.preserve,row.plan,row.planStatus,row.compliance,report.comparisonComplete,row.available,row.budget.status,row.continuity.quantity,row.continuity.allocation,report.canContinue,row.reason,report.observation]);
 if(report.sourceContract==='LP-EXPORT-CLOSE-4'){
  header.push('Diferencia vs plan','Pendiente vs plan','Versión del plan','ID versión del plan','Huella del plan','Hora del plan','Historia antes de observación','Referencia inicial Export','Operación habilitada');
  rows.forEach((row,index)=>row.push(report.rows[index].difference,report.rows[index].pendingAgainstPlan,report.planSnapshot.version,report.planSnapshot.versionId,report.planSnapshot.fingerprint,report.planSnapshot.capturedAt,report.planComparison==='HISTORICAL_UNAVAILABLE'?'HISTORICAL_UNAVAILABLE':report.planSnapshot.baseline?.historyBefore??'NO_APLICA_LEDGER_INMUTABLE',report.initialReference.status,report.operationalReady));
 }
 header.push('Tipo clasificación','Archivo referencia clasificación','Fecha referencia clasificación','Meta línea','Tipo meta línea','Cumplimiento meta línea (%)','Resultado Disponible','Clasificación acreditada','Cerrada','Abierta durante turno','Avanzada sin cerrar','Saldo inicial','Saldo final','Referencia Disponible','Evento Disponible');
 rows.forEach((row,index)=>{const r=report.rows[index];row.push(report.classification?.status,report.classification?.source?.file,report.classification?.source?.at,report.lineGoal?.quantity,report.lineGoal?.label,goalCompliance(report.rows,report.lineGoal),r.complianceState,r.classificationKnown,r.closed,r.opened,r.advanced,r.initialBalance,r.finalBalance,r.evidence?.available?.referenceId,r.evidence?.available?.sourceEventId);});
 return '\uFEFF'+[header,...rows].map(row=>row.map(cell).join(';')).join('\r\n');
}
export function assemblyReportFilename(report,extension){
 if(!['png','pdf'].includes(extension))throw Error('Formato de informe no compatible.');
 return ('LP-'+report.context.stage+'-'+report.context.line+'-'+report.context.date+'-T'+report.context.shift+'-V'+report.version).replace(/[^a-zA-Z0-9_.-]/g,'_')+'.'+extension;
}
/** Integer pixel bands prevent gaps/overlaps between pages of long reports. */
export function assemblyReportPdfPages(width,height,{pageWidth=210,pageHeight=297,margin=10}={}){
 if(![width,height,pageWidth,pageHeight].every(n=>Number.isFinite(n)&&n>0)||!Number.isFinite(margin)||margin<0||margin*2>=Math.min(pageWidth,pageHeight))throw Error('Dimensiones del informe no válidas.');
 if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height))throw Error('Dimensiones del informe no válidas.');
 const w=pageWidth-margin*2,available=pageHeight-margin*2,pixels=Math.floor(available*width/w);
 if(pixels<1)throw Error('Dimensiones del informe no válidas.');
 const count=Math.ceil(height/pixels);
 if(count>200)throw Error('El informe es demasiado largo para PDF. Descarga el CSV o XLSX original.');
 return Array.from({length:count},(_,page)=>{const sourceY=page*pixels,sourceHeight=Math.min(pixels,height-sourceY);return {x:margin,y:margin,width:w,height:sourceHeight*w/width,sourceY,sourceHeight};});
}
export async function exportAssemblyReport({report,format,document=globalThis.document,window=document?.defaultView,isCurrent=()=>true,loadLibraries=loadAssemblyReportLibraries}){
 if(!report?.valid)throw Error('El cierre no está validado.');
 const filename=assemblyReportFilename(report,format);
 const assertCurrent=()=>{if(!isCurrent())throw Error('El contexto cambió. Vuelve a abrir el informe antes de descargarlo.');};
 assertCurrent();await loadLibraries({document,window,needPdf:format==='pdf'});assertCurrent();
 const sheet=document.createElement('article');sheet.className='lp-assembly-report lp-assembly-report-export';sheet.innerHTML=assemblyReportMarkup(report);
 Object.assign(sheet.style,{position:'fixed',left:'-12000px',top:'0',width:'1100px',maxWidth:'none',background:'#fff',padding:'24px',boxSizing:'border-box'});
 sheet.querySelectorAll('details').forEach(detail=>detail.open=true);
 document.body.appendChild(sheet);
 try{
  if(document.fonts?.ready)await document.fonts.ready;assertCurrent();
  if(sheet.scrollHeight*2>30000||sheet.scrollWidth*sheet.scrollHeight*4>64000000)throw Error('El informe supera el tamaño de captura seguro. Descarga el CSV o XLSX original.');
  const canvas=await window.html2canvas(sheet,{scale:2,useCORS:false,backgroundColor:'#fff',windowWidth:1200,windowHeight:Math.max(900,sheet.scrollHeight),width:sheet.scrollWidth,height:sheet.scrollHeight});assertCurrent();
  if(!canvas.width||!canvas.height)throw Error('La captura del informe está vacía.');
  if(format==='png'){
   const link=document.createElement('a');link.download=filename;link.href=canvas.toDataURL('image/png');
   if(!link.href.startsWith('data:image/png'))throw Error('No se pudo crear la imagen del informe.');
   document.body.appendChild(link);try{assertCurrent();link.click();}finally{link.remove();}
  }else{
   const pdf=new window.jspdf.jsPDF({orientation:'portrait',unit:'mm',format:'a4'}),pages=assemblyReportPdfPages(canvas.width,canvas.height,{pageWidth:pdf.internal.pageSize.getWidth(),pageHeight:pdf.internal.pageSize.getHeight()});
   for(const [index,page] of pages.entries()){
    const slice=document.createElement('canvas');slice.width=canvas.width;slice.height=page.sourceHeight;
    const graphics=slice.getContext('2d');if(!graphics)throw Error('No se pudo preparar una página PDF.');
    graphics.drawImage(canvas,0,page.sourceY,canvas.width,page.sourceHeight,0,0,canvas.width,page.sourceHeight);
    if(index)pdf.addPage();pdf.addImage(slice.toDataURL('image/jpeg',.94),'JPEG',page.x,page.y,page.width,page.height);
   }assertCurrent();pdf.save(filename);
  }
  return {filename,format};
 }finally{sheet.remove();}
}
