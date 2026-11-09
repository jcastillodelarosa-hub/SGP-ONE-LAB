import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assemblyReports,assemblyReportMarkup,assemblyReportCSV,assemblyReportFilename,assemblyReportPdfPages,renderAssemblyReports,exportAssemblyReport,loadAssemblyReportLibraries} from '../src/modules/lp01-assembly-reports.js';
import {POWERBI_VERSION} from '../src/domain/powerbi/adapter.js';
import {closureV2Fixture,closurePartialReloadFixture} from './fixtures/lp01-closure-export-v2.mjs';
const context={stage:'ENSAMBLE',line:'PANELES_2',date:'2026-11-07',shift:1};
const assignment=(key,system,part='p1')=>({key,parte:part,ejecutado:999,sale:999,observacion:'Observación '+part,oficial:{key_produccion:key,id_linea:context.line,sistema:system,produccion:key.split('|')[0]}});
const row=(name,system,sale,power_bi)=>{const key=name+'|PANELES_2';return {key,sale,power_bi,ejecutado:999,assignments:[assignment(key,system),assignment(key,system,'p2')]};};
function report(version=4){
 const file={id:'file-'+version,name:'Ensamble.xlsx',sha256:'a'.repeat(64),adapter:POWERBI_VERSION},id='close-'+version;
 return {id,version,archivo:file.id,tipo:'CON_ACTIVIDAD',etapa:context.stage,linea:context.line,fecha:context.date,turno:context.shift,usuario:'Autor guardado',creado_en:'2026-11-07T14:00:00Z',snapshot:{...context,ok:true,id,version,file,user:'Autor guardado',observation:'Observación general guardada',reasons:{'A|PANELES_2':'Pendiente de aluminio'},rows:[row('A','ES7100',8,6),row('B','ES7100',16,16),row('C','ES9500',16,14)]}};
}
const payload=(reports=[report()])=>({contract:'LP-OPERACION-1',turn:{estado:'CERRADO',revision:4},reports,orders:[{produccion:'No usar identidad actual',ejecutado:777}]});
const model=(data=payload())=>assemblyReports(data,context).reports[0];

test('B15 summarizes recorded production rows once, never manual execution or assignments',()=>{
 const r=model();assert.equal(r.valid,true);assert.equal(r.current,true);assert.deepEqual(r.totals,{sale:40,realized:36,compliance:90});
 assert.deepEqual(r.systems.map(s=>[s.name,s.sale,s.realized,s.orders]),[['ES7100',24,22,2],['ES9500',16,14,1]]);
 assert.equal(r.rows[0].realized,6);assert.equal(r.rows[0].production,'A');assert.equal(r.rows[0].compliance,75);
 assert.equal(r.rows[0].observation,'Pendiente de aluminio · Observación p1 · Observación p2');
 assert.equal(r.file.id,'file-4');assert.equal(r.file.sha256,'a'.repeat(64));assert.equal(r.user,'Autor guardado');
});
test('versions retain own snapshot and exact file, rather than latest data overwriting history',()=>{
 const old=report(2),latest=report();old.snapshot.rows[0].power_bi=2;old.snapshot.rows[0].assignments.forEach(a=>a.oficial.sistema='ANTIGUO');
 const data=payload([old,latest]),before=JSON.stringify(data),got=assemblyReports(data,context).reports;
 assert.deepEqual(got.map(r=>[r.version,r.current,r.file.id]),[[4,true,'file-4'],[2,false,'file-2']]);assert.equal(got[1].rows[0].realized,2);assert.equal(got[1].rows[0].system,'ANTIGUO');assert.equal(JSON.stringify(data),before);
});
test('reopening cannot present an archive as current, even when revision still matches',()=>{
 for(const state of ['ABIERTO','EN_REVISION','NO_ABIERTO']){const data=payload();data.turn.estado=state;const r=model(data);assert.equal(r.current,false);assert.equal(r.valid,true);assert.equal(r.totals.realized,36);assert.match(r.state,/Histórico/);}
 const data=payload();data.turn.revision=5;assert.equal(model(data).current,false);
});
test('only the real exact closed revision can be current; future/older archives remain historical',()=>{
 const data=payload([report(6),report(4)]);assert(assemblyReports(data,context).reports.every(r=>!r.current));
 data.turn.revision='4';assert.equal(model(data).current,false);
});
test('missing or malformed Power BI never falls back to manual progress or zero',()=>{
 for(const value of [undefined,null,'6',-1,1.2,NaN,Infinity,Number.MAX_SAFE_INTEGER+1]){const data=payload();data.reports[0].snapshot.rows[0].power_bi=value;const r=model(data);assert.equal(r.valid,false);assert.equal(r.totals,null);assert.deepEqual(r.rows,[]);}
 const data=payload();data.reports[0].snapshot.rows[0].power_bi=0;assert.equal(model(data).rows[0].realized,0);
});
test('missing/invalid Sale and totals exceeding safe precision stay unknown',()=>{
 for(const value of [null,undefined,'8',-1,2.4]){const data=payload();data.reports[0].snapshot.rows[0].sale=value;const r=model(data);assert.equal(r.valid,true);assert.equal(r.totals.sale,null);assert.equal(r.totals.compliance,null);assert.equal(r.systems[0].sale,null);assert.equal(r.totals.realized,36);}
 const data=payload();data.reports[0].snapshot.rows[0].power_bi=Number.MAX_SAFE_INTEGER;assert.equal(model(data).totals.realized,null);
});
test('zero denominator is not 100 percent and overfulfillment is not clipped',()=>{
 const data=payload();data.reports[0].snapshot.rows[0].sale=0;assert.equal(model(data).rows[0].compliance,null);
 data.reports[0].snapshot.rows[0].sale=2;assert.equal(model(data).rows[0].compliance,300);
});
test('bad identity, file, version, author, timestamp, or duplicate rows disables the report',()=>{
 const mutations=[d=>d.reports[0].snapshot.id='other',d=>d.reports[0].snapshot.version=3,d=>d.reports[0].snapshot.shift=2,d=>d.reports[0].snapshot.stage='EMPAQUE',d=>d.reports[0].snapshot.file.sha256='bad',d=>d.reports[0].archivo='other',d=>d.reports[0].snapshot.file.adapter='QA-CSV',d=>d.reports[0].snapshot.user='other',d=>d.reports[0].creado_en=null,d=>d.reports[0].snapshot.rows.push(d.reports[0].snapshot.rows[0]),d=>d.reports[0].snapshot.rows[0].key='A|FRAMES_2',d=>d.reports[0].tipo='SIN_ACTIVIDAD'];
 for(const mutate of mutations){const data=payload();mutate(data);assert.equal(model(data).valid,false,String(mutate));assert.equal(model(data).current,false);}
});
test('duplicate closure IDs or versions invalidate every ambiguous record',()=>{
 for(const type of ['id','version']){const a=report(2),b=report(4);if(type==='id'){b.id=a.id;b.snapshot.id=a.id;}else{b.version=a.version;b.snapshot.version=a.version;}
 const got=assemblyReports(payload([a,b]),context);assert(got.reports.every(r=>!r.valid));assert(got.reports.every(r=>!r.current));}
});
test('no cross-stage, line, date or shift report is shown',()=>{
 for(const [field,value] of [['etapa','EMPAQUE'],['linea','FRAMES_2'],['fecha','2026-11-06'],['turno',2]]){const data=payload();data.reports[0][field]=value;assert.deepEqual(assemblyReports(data,context).reports,[]);}
 assert.deepEqual(assemblyReports(payload(),{...context,stage:'EMPAQUE'}).reports,[]);assert.throws(()=>assemblyReports({...payload(),contract:'wrong'},context),/Contrato/);
});
test('system and production identities come only from agreeing immutable assignments',()=>{
 const data=payload();data.reports[0].snapshot.rows[0].assignments[1].oficial.sistema='OTHER';let r=model(data);assert.equal(r.rows[0].system,'Sistema por validar');assert.equal(r.rows[0].realized,6);assert.equal(r.systems.find(s=>s.name==='Sistema por validar').realized,6);assert.match(r.warning,/identidades/);
 data.reports[0].snapshot.rows[0].assignments[1].oficial.sistema='';assert.equal(model(data).rows[0].system,'Sistema por validar');
 data.reports[0].snapshot.rows[0].assignments[1].key='FOREIGN';assert.equal(model(data).rows[0].production,'A|PANELES_2');
 data.reports[0].snapshot.rows[0].assignments=[];r=model(data);assert.equal(r.rows[0].production,'A|PANELES_2');assert.doesNotMatch(r.rows[0].production,/actual/);
});
test('explicit empty closure is distinct from unknown realized; it has no file',()=>{
 const empty=report();Object.assign(empty,{tipo:'SIN_ACTIVIDAD',archivo:null});Object.assign(empty.snapshot,{type:'SIN_ACTIVIDAD',confirmed:true,file:null,rows:[]});
 const r=model(payload([empty]));assert.equal(r.valid,true);assert.equal(r.empty,true);assert.equal(r.current,true);assert.deepEqual(r.totals,{sale:0,realized:0,compliance:null});assert.equal(r.file,null);assert.match(assemblyReportMarkup(r),/SIN ACTIVIDAD/);
 empty.snapshot.file={id:'unexpected'};assert.equal(model(payload([empty])).valid,false);
});
test('B15 result markup contains provenance, system table and production details, never a raw JSON dump',()=>{
 const markup=assemblyReportMarkup(model());for(const text of ['Resultado del turno','Resumen por sistema','Detalle por producción','Observación general del turno','Versión 4','Autor guardado','file-4','SHA256','Cierre vigente','Power BI','distinto del Disponible global actual'])assert(markup.includes(text));
 assert.doesNotMatch(markup,/<pre>|999|777/);assert.match(markup,/scope="col"/);assert.match(markup,/data-label="Realizado"/);
});
test('all snapshot text is escaped including metadata, system, reason and observation',()=>{
 const data=payload(),source=data.reports[0],attack='<img src=x onerror="evil()">';source.usuario=attack;source.snapshot.user=attack;source.snapshot.observation=attack;source.snapshot.file.name=attack;source.snapshot.rows[0].assignments.forEach(a=>a.oficial.sistema=attack);source.snapshot.reasons['A|PANELES_2']=attack;
 const markup=assemblyReportMarkup(model(data));assert.doesNotMatch(markup,/<img/);assert.match(markup,/&lt;img/);assert.match(markup,/&quot;evil/);
});
test('PDF pagination covers each source pixel exactly once with margins and no blank terminal page',()=>{
 const pages=assemblyReportPdfPages(2200,12000);let covered=0;for(const page of pages){assert.equal(page.sourceY,covered);assert(page.height<=277);assert.equal(page.y,10);covered+=page.sourceHeight;}assert.equal(covered,12000);assert(pages.length>1);
 assert.equal(assemblyReportPdfPages(190,277).length,1);assert.throws(()=>assemblyReportPdfPages(0,2),/Dimensiones/);assert.throws(()=>assemblyReportPdfPages(2,2,{margin:110}),/Dimensiones/);assert.throws(()=>assemblyReportPdfPages(1,9999),/demasiado largo/);
});
test('filenames retain version and period and reject unsupported formats',()=>{
 assert.equal(assemblyReportFilename(model(),'png'),'LP-ENSAMBLE-PANELES_2-2026-11-07-T1-V4.png');assert.throws(()=>assemblyReportFilename(model(),'html'),/Formato/);
});
test('module does not invoke write RPCs, introduce external dependencies or change existing CSV/XLSX exports',()=>{
 const code=readFileSync(new URL('../src/modules/lp01-assembly-reports.js',import.meta.url),'utf8');assert.doesNotMatch(code,/\.rpc\(|https?:\/\/|send\(['"]CERRAR|from ['"]https/);assert.match(code,/data-report=/);assert.match(code,/data-original=/);assert.match(code,/html2canvas\.min\.js/);assert.match(code,/jspdf\.umd\.min\.js/);
});

// DOM coverage is optional in a default clean checkout; the existing isolated
// QA installation can be supplied without adding any project dependency.
const domModule=process.env.LP_DOM_PACKAGE?await import(process.env.LP_DOM_PACKAGE):null;
const domTest=(name,fn)=>test(name,{skip:!domModule},fn);
function dom(){const {window}=domModule.parseHTML('<html><head></head><body><main id="reports"></main></body></html>');return {window,document:window.document,host:window.document.querySelector('main')};}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
domTest('DOM: preserved CSV/XLSX hooks, expanded history and callbacks with exact IDs',async()=>{
 const {host}=dom(),calls=[],data=payload([report(2),report(4)]);
 renderAssemblyReports({host,data,context,onCSV:id=>calls.push(['csv',id]),onOriginal:id=>calls.push(['xlsx',id])});
 assert.equal(host.querySelectorAll('[data-report]').length,2);assert.equal(host.querySelectorAll('[data-original]').length,2);assert(host.querySelector('[data-report-id="close-4"]').hasAttribute('open'));
 host.querySelector('[data-report-id="close-2"]').setAttribute('open','');host.querySelector('[data-report="close-2"]').click();await flush();host.querySelector('[data-original="file-2"]').click();await flush();assert.deepEqual(calls,[['csv','close-2'],['xlsx','file-2']]);
 renderAssemblyReports({host,data,context});assert(host.querySelector('[data-report-id="close-2"]').hasAttribute('open'));
 host.querySelectorAll('details').forEach(el=>el.removeAttribute('open'));renderAssemblyReports({host,data,context});assert.equal(host.querySelectorAll('details[open]').length,0);
 data.turn.estado='EN_REVISION';renderAssemblyReports({host,data,context});assert.equal(host.querySelectorAll('.is-current').length,0);assert.match(host.textContent,/Turno reabierto/);
});
domTest('DOM: invalid snapshot, empty results and session reset cannot retain downloads',()=>{
 const {host}=dom();renderAssemblyReports({host,data:payload(),context});const invalid=payload();invalid.reports[0].archivo='wrong';renderAssemblyReports({host,data:invalid,context});assert.equal(host.querySelectorAll('button').length,0);assert.match(host.textContent,/No se puede validar/);
 renderAssemblyReports({host,data:payload([]),context});assert.match(host.textContent,/No hay cierres/);renderAssemblyReports({host,data:null,context});assert.match(host.textContent,/Consulta un turno/);assert.equal(host.querySelectorAll('details').length,0);
});
domTest('DOM: double export click is suppressed, errors are visible, and rerender invalidates work',async()=>{
 const {host}=dom();let release,calls=0,exportCurrent;
 const pending=new Promise(resolve=>release=resolve);renderAssemblyReports({host,data:payload(),context,exportReport:async({isCurrent})=>{calls++;exportCurrent=isCurrent;await pending;}});
 const button=host.querySelector('[data-assembly-report-export="pdf"]');button.click();button.click();assert.equal(calls,1);assert(button.disabled);assert.equal(exportCurrent(),true);
 renderAssemblyReports({host,data:null,context});assert.equal(exportCurrent(),false);release();await flush();assert.match(host.textContent,/Consulta un turno/);
 renderAssemblyReports({host,data:payload(),context,exportReport:async()=>{throw Error('Librería ausente');}});host.querySelector('[data-assembly-report-export]').click();await flush();assert.match(host.textContent,/Librería ausente/);assert.equal(host.querySelector('[data-assembly-report-export]').disabled,false);
});
domTest('DOM: PNG export uses exact snapshot, cleans capture, and stale export does not download',async t=>{
 const {document,window}=dom(),clicks=[],originalClick=window.HTMLElement.prototype.click;t.after(()=>{window.HTMLElement.prototype.click=originalClick;});window.HTMLElement.prototype.click=function(){clicks.push(this.download);};
 let current=true;window.html2canvas=async sheet=>{assert.match(sheet.textContent,/Versión 4/);assert.doesNotMatch(sheet.textContent,/999/);return {width:2200,height:1000,toDataURL:()=> 'data:image/png;base64,AA=='};};
 await exportAssemblyReport({report:model(),format:'png',document,window,loadLibraries:async()=>{}});assert.deepEqual(clicks,['LP-ENSAMBLE-PANELES_2-2026-11-07-T1-V4.png']);assert.equal(document.querySelector('.lp-assembly-report-export'),null);
 window.html2canvas=async()=>{current=false;return {width:2,height:2,toDataURL:()=> 'data:image/png;base64,AA=='};};
 await assert.rejects(exportAssemblyReport({report:model(),format:'png',document,window,isCurrent:()=>current,loadLibraries:async()=>{}}),/contexto cambió/);assert.equal(clicks.length,1);assert.equal(document.querySelector('.lp-assembly-report-export'),null);
});
domTest('DOM: PDF constructs all page bands and saves exact version; canvas failures clean up',async()=>{
 const {document,window}=dom(),images=[],saved=[],bands=[];
 const create=document.createElement.bind(document);document.createElement=name=>{if(name==='canvas')return {getContext:()=>({drawImage:(...args)=>bands.push(args)}),toDataURL:()=> 'data:image/jpeg;base64,AA=='};return create(name);};
 window.html2canvas=async()=>({width:2200,height:12000});window.jspdf={jsPDF:class{internal={pageSize:{getWidth:()=>210,getHeight:()=>297}};addPage(){}addImage(...args){images.push(args);}save(name){saved.push(name);}}};
 await exportAssemblyReport({report:model(),format:'pdf',document,window,loadLibraries:async()=>{}});assert.equal(images.length,assemblyReportPdfPages(2200,12000).length);assert.equal(bands.reduce((sum,band)=>sum+band[4],0),12000);assert.deepEqual(saved,['LP-ENSAMBLE-PANELES_2-2026-11-07-T1-V4.pdf']);assert.equal(document.querySelector('.lp-assembly-report-export'),null);
 window.html2canvas=async()=>{throw Error('Canvas failed');};await assert.rejects(exportAssemblyReport({report:model(),format:'png',document,window,loadLibraries:async()=>{}}),/Canvas failed/);assert.equal(document.querySelector('.lp-assembly-report-export'),null);
});
domTest('DOM: local export libraries deduplicate loads and permit retry after explicit error',async()=>{
 const {document,window}=dom();delete window.html2canvas;delete window.jspdf;const loads=[],append=document.head.appendChild.bind(document.head);
 document.head.appendChild=script=>{loads.push(script.src);append(script);queueMicrotask(()=>{if(script.src.endsWith('html2canvas.min.js'))window.html2canvas=()=>{};else window.jspdf={jsPDF:class{}};script.onload();});return script;};
 await Promise.all([loadAssemblyReportLibraries({document,window,needPdf:true}),loadAssemblyReportLibraries({document,window,needPdf:true})]);assert.equal(loads.length,2);assert(loads.every(src=>src.includes('/vendor/')));
 const retry=dom();delete retry.window.html2canvas;let attempts=0;
 retry.document.head.appendChild=script=>{attempts++;queueMicrotask(()=>{if(attempts===1)script.onerror();else{retry.window.html2canvas=()=>{};script.onload();}});return script;};
 await assert.rejects(loadAssemblyReportLibraries(retry),/recursos locales/);await loadAssemblyReportLibraries(retry);assert.equal(attempts,2);
});

// Versioned read-only coverage: these fixtures do not activate CERRAR or import.
const v2Model=fixture=>assemblyReports(fixture.data,fixture.context).reports[0];
const v2Source=fixture=>fixture.data.reports[0].snapshot;
const refreshCurrentSources=s=>s.rows.filter(row=>row.coverage==='PRESENT').forEach(row=>{row.valueStatus='CURRENT_FILE';row.valueSource={importId:s.importId,importVersion:s.version-1,universeRevision:s.universeRevision,context:{stage:s.stage,line:s.line,date:s.date,shift:s.shift},file:{...s.file},sourceRows:[...row.sourceRows]};});
const withIdentity=fixture=>{v2Source(fixture).rows.forEach((row,index)=>row.identity={key:row.key,line:fixture.context.line,production:'Orden histórica '+index,system:index?'ES9500':'ES7100'});return fixture;};
function parseCSV(csv){
 const rows=[];let row=[],cell='',quoted=false;csv=csv.replace(/^\uFEFF/,'');
 for(let i=0;i<csv.length;i++){
  const char=csv[i];if(char==='"'){if(quoted&&csv[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
  else if(char===';'&&!quoted){row.push(cell);cell='';}
  else if(char==='\r'&&!quoted&&csv[i+1]==='\n'){row.push(cell);rows.push(row);row=[];cell='';i++;}
  else cell+=char;
 }
 row.push(cell);rows.push(row);return rows;
}
test('V2 B15 keeps PRESENT, explicit zero and ABSENT separate without any manual-plan aliases',()=>{
 const fixture=closureV2Fixture(),snapshot=v2Source(fixture),present=snapshot.rows.find(row=>row.coverage==='PRESENT');present.realized=0;
 const r=v2Model(fixture);assert.equal(r.valid,true);assert.equal(r.kind,'EXPORT_V2');assert.equal(r.contract,'LP-EXPORT-CLOSE-3');assert.equal(r.authority,'EXPORT_PRODUCTION_V2');assert.equal(r.current,true);
 assert.equal(r.rows.find(row=>row.key===present.key).realized,0);const absent=r.rows.find(row=>row.coverage==='ABSENT');assert.equal(absent.realized,null);assert.equal(absent.preserve,true);assert.equal(r.totals.realized,null);assert.equal(r.totals.plan,null);assert.equal(r.totals.compliance,null);assert.equal(r.totals.sale,undefined);assert.equal(r.canContinue,false);
 for(const row of r.rows){assert.equal(row.plan,null);assert.equal(row.compliance,null);assert.equal(row.sale,undefined);assert.equal(row.ejecutado,undefined);assert.equal(row.budget.available,null);assert.equal(row.continuity.quantity,null);}
});
test('V2 complete coverage has an exact realized sum but plan and comparison remain unknown',()=>{
 const fixture=closureV2Fixture();v2Source(fixture).rows.forEach((row,index)=>Object.assign(row,{coverage:'PRESENT',realized:index+1,preserve:false,sourceRows:[100+index]}));refreshCurrentSources(v2Source(fixture));
 const r=v2Model(fixture),expected=r.rows.reduce((total,row)=>total+row.realized,0);assert.equal(r.valid,true);assert.equal(r.totals.realized,expected);assert.equal(r.totals.reported,expected);assert.equal(r.totals.absent,0);assert.equal(r.totals.plan,null);assert.equal(r.comparisonComplete,false);assert.equal(r.totals.compliance,null);
});
test('V2 system and production labels use only immutable validated identity',()=>{
 const fixture=withIdentity(closureV2Fixture());fixture.data.catalog={productions:v2Source(fixture).rows.map(row=>({key:row.key,oficial:{sistema:'NO USAR ACTUAL',produccion:'NO USAR ACTUAL'}}))};
 const r=v2Model(fixture);assert.equal(r.valid,true);assert.equal(r.rows[0].production,'Orden histórica 0');assert.equal(r.rows[0].system,'ES7100');assert.deepEqual(r.systems.map(system=>system.name),['ES7100','ES9500']);assert.equal(r.systems[0].plan,null);assert.equal(r.warning,undefined);
 delete v2Source(fixture).rows[0].identity;v2Source(fixture).rows[1].identity.system=null;const unknown=v2Model(fixture);assert.equal(unknown.rows[0].production,unknown.rows[0].key);assert.equal(unknown.rows[0].system,'Sistema por validar');assert.equal(unknown.rows[1].system,'Sistema por validar');assert.doesNotMatch(JSON.stringify(unknown),/NO USAR ACTUAL/);
});
test('V2 history retains file, import and universe identities and reopening never creates current quantities',()=>{
 const fixture=closureV2Fixture(),old=structuredClone(fixture.data.reports[0]);old.version--;old.snapshot.version=old.version;old.id='historic-v2-id';old.snapshot.id=old.id;old.archivo='historic-file';old.snapshot.file.id=old.archivo;old.snapshot.importId='historic-import';old.snapshot.universeRevision='c'.repeat(64);old.snapshot.rows.find(row=>row.coverage==='PRESENT').realized=3;refreshCurrentSources(old.snapshot);
 fixture.data.reports.push(old);let reports=assemblyReports(fixture.data,fixture.context).reports;assert.deepEqual(reports.map(r=>r.current),[true,false]);assert.equal(reports[1].file.id,'historic-file');assert.equal(reports[1].importId,'historic-import');assert.equal(reports[1].universeRevision,'c'.repeat(64));
 fixture.data.turn.estado='EN_REVISION';reports=assemblyReports(fixture.data,fixture.context).reports;assert(reports.every(r=>r.valid&&!r.current));assert(reports.every(r=>/Histórico/.test(r.state)));
});
test('mixed legacy/V2 versions stay separate; current V2 is never computed from older Sale or manual execution',()=>{
 const fixture=closureV2Fixture(),old=report(1);fixture.data.reports.push(old);const reports=assemblyReports(fixture.data,fixture.context).reports;
 assert.equal(reports[0].kind,'EXPORT_V2');assert.equal(reports[0].totals.sale,undefined);const legacy=reports.find(r=>r.kind==='LEGACY');assert.equal(legacy.totals.sale,40);assert.equal(legacy.totals.realized,36);assert.equal(legacy.current,false);assert.throws(()=>assemblyReportCSV(legacy),/CSV V2/);
});
test('V2 malformed provenance, coverage, pending plan, continuity or historical identity disables exports',()=>{
 const mutations=[s=>s.importId='',s=>s.universeRevision='bad',s=>s.authority='OTHER',s=>s.contract='LP-EXPORT-CLOSE-2',s=>s.canContinue=true,s=>s.comparisonComplete=true,s=>s.rows[0].plan=999,s=>s.rows[0].budget.available=99,s=>s.rows[0].continuity.quantity=99,s=>s.rows.find(row=>row.coverage==='ABSENT').realized=0,s=>s.rows.find(row=>row.coverage==='PRESENT').realized=null,s=>s.rows[0].identity={key:'FOREIGN',line:'PANELES_2',production:'False name',system:'False system'}];
 for(const mutate of mutations){const fixture=closureV2Fixture();mutate(v2Source(fixture));const r=v2Model(fixture);assert.equal(r.valid,false,String(mutate));assert.equal(r.current,false);assert.deepEqual(r.rows,[]);assert.throws(()=>assemblyReportCSV(r),/validado/);}
});
test('V2 report and export markup explains plan, absent coverage and unreconciled continuity',()=>{
 const r=v2Model(closureV2Fixture()),markup=assemblyReportMarkup(r);
 for(const phrase of ['Disponible coordinador','Disponible o estado sin evidencia del turno: Por validar','Subtotal informado','Nunca informado · no equivale a cero','Importación actual ID:','Huella de universo actual:','LP-EXPORT-CLOSE-3','EXPORT_PRODUCTION_V2','no autoriza arrastre'])assert(markup.includes(phrase),phrase);
 assert.doesNotMatch(markup,/Sale validado|No calculable|>999</);assert.match(markup,/is-pending">Por validar/);assert.match(markup,/Disponible coordinador/);
});
test('V2 CSV preserves numeric null versus explicit zero and every provenance/status column',()=>{
 const fixture=withIdentity(closureV2Fixture()),source=v2Source(fixture);source.rows.find(row=>row.coverage==='PRESENT').realized=0;
 const r=v2Model(fixture),csv=assemblyReportCSV(r),[header,...records]=parseCSV(csv),read=(row,column)=>row[header.indexOf(column)];
 assert.equal(csv[0],'\uFEFF');assert.equal(records.length,r.rows.length);assert(records.every(row=>row.length===header.length));
 const absent=records.find(row=>read(row,'Cobertura archivo actual')==='ABSENT'),present=records.find(row=>read(row,'Cobertura archivo actual')==='PRESENT');assert.equal(read(absent,'Realizado'),'');assert.equal(read(absent,'Conservar'),'true');assert.equal(read(present,'Realizado'),'0');assert.equal(read(present,'Conservar'),'false');
 for(const record of records){assert.equal(read(record,'Plan del turno'),'');assert.equal(read(record,'Estado del plan'),'PLAN_SOURCE_REQUIRED');assert.equal(read(record,'Cumplimiento sobre Disponible (%)'),'');assert.equal(read(record,'Comparación completa'),'false');assert.equal(read(record,'Disponible coordinador del turno'),'');assert.equal(read(record,'Conciliación'),'RECONCILIATION_REQUIRED');assert.equal(read(record,'Continuidad'),'');assert.equal(read(record,'Puede continuar'),'false');assert.equal(read(record,'ID importación actual'),r.importId);assert.equal(read(record,'Huella de universo actual'),r.universeRevision);assert.equal(read(record,'SHA256 actual'),r.file.sha256);assert.equal(read(record,'ID cierre'),r.id);}
 assert(!header.includes('Sale'));assert(!header.includes('ejecutado'));assert(!header.includes('manualHistory'));
});
test('V2 CSV escapes formula cells, quotes, delimiters and newlines; invalid models cannot export',()=>{
 const fixture=withIdentity(closureV2Fixture()),source=v2Source(fixture);source.observation='=1+1; "quoted"\nsecond line';source.file.name='@SUM(1).xlsx';source.rows[0].identity.system='-DANGEROUS';refreshCurrentSources(source);
 const r=v2Model(fixture),csv=assemblyReportCSV(r),[header,...records]=parseCSV(csv),read=(row,column)=>row[header.indexOf(column)];
 assert.equal(read(records[0],'Observación general'),"'=1+1; \"quoted\"\nsecond line");assert.equal(read(records[0],'Archivo actual'),"'@SUM(1).xlsx");assert.equal(read(records[0],'Sistema'),"'-DANGEROUS");assert.throws(()=>assemblyReportCSV({...r,valid:false}),/validado/);
});
domTest('DOM V2: CSV callback receives exact validated model and no write controls',async()=>{
 const {host}=dom(),fixture=closureV2Fixture(),received=[];renderAssemblyReports({host,data:fixture.data,context:fixture.context,onCSV:(id,model)=>received.push({id,model,csv:assemblyReportCSV(model)})});
 host.querySelector('[data-report]').click();await flush();assert.equal(received.length,1);assert.equal(received[0].id,fixture.data.reports[0].id);assert.equal(received[0].model.contract,'LP-EXPORT-CLOSE-3');assert.match(received[0].csv,/ABSENT/);assert.match(received[0].csv,/PLAN_SOURCE_REQUIRED/);assert.equal(host.querySelectorAll('[data-close],[data-bi-file],input,textarea').length,0);assert.match(host.textContent,/Disponible coordinador/);
});
domTest('DOM V2: PNG/PDF capture input retains unknown plan, coverage and continuity instead of manual quantities',async t=>{
 const {document,window}=dom(),fixture=closureV2Fixture(),originalClick=window.HTMLElement.prototype.click;t.after(()=>{window.HTMLElement.prototype.click=originalClick;});let captures=0;window.HTMLElement.prototype.click=function(){};
 window.html2canvas=async sheet=>{captures++;assert([...sheet.querySelectorAll('details')].every(d=>d.open));assert.match(sheet.textContent,/Disponible coordinador/);assert.match(sheet.textContent,/Nunca informado · no equivale a cero/);assert.match(sheet.textContent,/Disponible o estado sin evidencia del turno: Por validar/);assert.doesNotMatch(sheet.textContent,/Sale validado|999/);return {width:2200,height:1000,toDataURL:()=> 'data:image/png;base64,AA=='};};
 const create=document.createElement.bind(document);document.createElement=name=>name==='canvas'?{getContext:()=>({drawImage(){}}),toDataURL:()=> 'data:image/jpeg;base64,AA=='}:create(name);
 const saved=[];window.jspdf={jsPDF:class{internal={pageSize:{getWidth:()=>210,getHeight:()=>297}};addPage(){}addImage(){}save(name){saved.push(name);}}};
 for(const format of ['png','pdf'])await exportAssemblyReport({report:v2Model(fixture),format,document,window,loadLibraries:async()=>{}});assert.equal(captures,2);assert.equal(saved.length,1);assert.equal(document.querySelector('.lp-assembly-report-export'),null);
});


test('partial reload B15 preserves A3/B5 as eight, while historic A7/B5 stays twelve',()=>{
 const fixture=closurePartialReloadFixture(),original=JSON.stringify(fixture),reports=assemblyReports(fixture.data,fixture.context).reports;
 const [current,historical]=reports;assert.equal(current.valid,true);assert.equal(historical.valid,true);assert.equal(current.current,true);assert.equal(historical.current,false);
 assert.deepEqual(current.totals,{plan:null,realized:8,compliance:null,present:1,absent:1,preserved:1,neverReported:0,reported:3,preservedReported:5,knownReported:8,available:null,comparableRealized:null,included:0,excluded:2,closed:0,opened:0,advanced:0,classificationPending:2});
 assert.equal(historical.totals.realized,12);assert.equal(current.rows.find(row=>row.key==='B|PANELES_2').valueSource.file.name,'earlier-full-export.xlsx');
 assert.equal(current.sourceFiles.length,2);assert.equal(current.file.name,'ensamble-export.xlsx');
 const markup=assemblyReportMarkup(current);for(const phrase of ['valor anterior conservado','Subtotal conocido: 8','earlier-full-export.xlsx','Fuente conservada','no se suman las recargas'])assert(markup.includes(phrase),phrase);
 assert.doesNotMatch(markup,/Realizado total por validar/);assert.equal(JSON.stringify(fixture),original);
});
test('partial reload CSV has per-value provenance, not the latest file for preserved values',()=>{
 const fixture=closurePartialReloadFixture(),model=assemblyReports(fixture.data,fixture.context).reports[0],[header,...records]=parseCSV(assemblyReportCSV(model));
 const at=(row,key)=>row[header.indexOf(key)],b=records.find(row=>at(row,'Producción (key)')==='B|PANELES_2'),a=records.find(row=>at(row,'Producción (key)')==='A|PANELES_2');
 assert.equal(at(b,'Realizado'),'5');assert.equal(at(b,'Cobertura archivo actual'),'ABSENT');assert.equal(at(b,'Estado del valor'),'PRESERVED');assert.equal(at(b,'Filas archivo actual'),'');assert.equal(at(b,'Filas de origen del valor'),'3');
 assert.equal(at(b,'Archivo actual'),'ensamble-export.xlsx');assert.equal(at(b,'Archivo del valor'),'earlier-full-export.xlsx');assert.notEqual(at(b,'ID importación actual'),at(b,'ID importación del valor'));assert.notEqual(at(b,'SHA256 actual'),at(b,'SHA256 del valor'));
 assert.equal(at(b,'Versión importación del valor'),'1');assert.equal(at(b,'Fecha operativa del valor'),fixture.context.date);assert.equal(at(b,'Turno del valor'),'1');assert.equal(at(a,'Realizado'),'3');assert.equal(at(a,'SHA256 actual'),at(a,'SHA256 del valor'));
 assert(records.every(row=>row.length===header.length));
});
test('explicit zero retained from earlier file remains known, not absent-null or old total',()=>{
 const fixture=closurePartialReloadFixture(),snapshot=fixture.data.reports.find(report=>report.version===5).snapshot;
 snapshot.rows.find(row=>row.valueStatus==='PRESERVED').realized=0;
 const current=assemblyReports(fixture.data,fixture.context).reports[0];assert.equal(current.valid,true);assert.equal(current.totals.realized,3);assert.equal(current.totals.preservedReported,0);assert.equal(current.totals.neverReported,0);assert.match(assemblyReportMarkup(current),/valor anterior conservado/);
});
domTest('partial reload report downloads each genuine source and stale source buttons are inert',async()=>{
 const {host}=dom(),fixture=closurePartialReloadFixture(),received=[];let current=true;
 const result=renderAssemblyReports({host,data:fixture.data,context:fixture.context,isCurrent:()=>current,onOriginal:id=>received.push(id)}),latest=result.reports[0];
 const detail=host.querySelector('[data-report-id="'+latest.id+'"]'),buttons=[...detail.querySelectorAll('[data-original]')];assert.equal(buttons.length,2);
 for(const button of buttons){button.click();await flush();}assert.deepEqual(received,latest.sourceFiles.map(file=>file.id));
 current=false;buttons[1].click();await flush();assert.equal(received.length,2);
});
