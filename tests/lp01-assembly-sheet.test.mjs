import test from 'node:test';
import {closureV2Fixture,closurePartialReloadFixture} from './fixtures/lp01-closure-export-v2.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assemblySheetRows,assemblyClosure,filterAssemblySheetRows,assemblyValueKey} from '../src/domain/lp01-assembly-sheet.js';
import {assemblySheetMarkup,renderAssemblySheet} from '../src/modules/lp01-assembly-sheet.js';

const context={line:'PANELES_2',stage:'ENSAMBLE',date:'2026-11-07',shift:1};
const key=name=>name+'|PANELES_2';
const plan=(name,id,extra={})=>({id,key_produccion:key(name),cantidad:20,fecha:context.date,turno:1,prioridad:2,estado:'PROGRAMADA',observacion:'',source:'PROGRAMACION_LINEA',...extra});
const production=(name,{balance=20,quantity=20,week=44,assignments=[],...extra}={})=>({key:key(name),oficial:{key_produccion:key(name),id_linea:'PANELES_2',produccion:name,sistema:'ES100',reserva_al:'R-'+name,cantidad:quantity,anio:2026,semana_base:week,saldos_inicializados:true,presente_ultimo_export:true,saldo_ensamble:balance},assignments,...extra});
const operation=(name,part,extra={})=>({key:key(name),parte:part,linea:context.line,etapa:context.stage,fecha:context.date,turno:context.shift,produccion:name,oficial:production(name).oficial,prioridad:2,sale:12,ejecutado:19,abierta:true,observacion:'',...extra});
const data=(productions,orders=[],reports=[])=>({contract:'LP-OPERACION-1',orders,reports,turn:{estado:reports.length?'CERRADO':'ABIERTO',revision:Math.max(0,...reports.map(r=>r.version))},catalog:{contract:'LP-HOJA-1',...context,productions}});
const all=d=>assemblySheetRows(d,context,{includeCompleted:true});
const close=(name,quantity,version=1,extra={})=>({id:'report-'+version,linea:context.line,etapa:context.stage,fecha:context.date,turno:context.shift,version,archivo:'file-'+version,snapshot:{ok:true,id:'report-'+version,...context,version,file:{id:'file-'+version,sha256:'a'.repeat(64),adapter:'LP-PBI-XLSX-1'},rows:[{key:key(name),power_bi:quantity,ejecutado:999,sale:999,assignments:[operation(name,'a')]}]},...extra});

test('Export alone classifies open, scheduled, other and completed; manual execution does not',()=>{
 const d=data([production('open',{balance:9}),production('scheduled',{assignments:[plan('scheduled','b')]}),production('other'),production('done',{balance:0})],[operation('other','c')]);
 assert.deepEqual(all(d).map(r=>[r.produccion,r.state]),[['open','ABIERTAS'],['scheduled','PROGRAMADAS'],['other','OTRAS'],['done','COMPLETADAS']]);
 assert.equal(assemblySheetRows(d,context).length,3);
});
test('multiple assignments produce one row, one open group, no SALE or manual-total sum',()=>{
 const d=data([production('A',{balance:7,assignments:[plan('A','a'),plan('A','b')]})],[operation('A','a'),operation('A','b')]);
 const before=structuredClone(d),[r]=all(d);
 assert.equal(r.state,'ABIERTAS');assert.equal(r.scheduled,true);assert.equal(r.operationTargets.length,2);assert.equal(r.currentAssignments.length,2);
 assert.equal(r.balance,7);assert.equal(r.available,null);assert.equal(r.realized,null);assert.deepEqual(d,before);assert.equal(all(d).length,1);
});
test('approved Export exclusions leave the active sheet, never erase historical input or infer approval from absence',()=>{
 const hidden=production('hidden',{balance:5}),absent=production('absent');
 hidden.oficial.excluida_export=true;absent.oficial.presente_ultimo_export=false;
 const d=data([hidden,absent,production('active')],[operation('hidden','h')],[close('hidden',4)]);
 const before=structuredClone(d);
 assert.deepEqual(all(d).map(r=>r.produccion).sort(),['absent','active']);
 assert.deepEqual(d,before);assert.equal(assemblyClosure(d,key('hidden'),context).quantity,4);
 const legacy=data([], [operation('hidden','h',{oficial:hidden.oficial}),operation('active','a')]);delete legacy.catalog;
 assert.deepEqual(all(legacy).map(r=>r.produccion),['active']);
});
test('reservation grouping precedes age and planner ranking within state groups',()=>{
 const d=data([production('new',{balance:2,week:44}),production('older',{balance:3,week:40}),production('p2',{assignments:[plan('p2','a',{prioridad:2})]}),production('p1',{assignments:[plan('p1','b',{prioridad:1})]})]);
 assert.deepEqual(all(d).map(r=>r.produccion),['new','older','p1','p2']);
});
test('no invented opening date; missing original week is sorted after known weeks',()=>{
 const [r]=all(data([production('unknown',{balance:1,week:null})]));assert.equal(r.week,null);assert.equal(r.originDate,null);
 const d=data([production('unknown',{balance:1,week:null}),production('known',{balance:2})]);assert.equal(all(d)[0].produccion,'known');
});
test('cancelled, other-turn and other-date assignments do not schedule the selected turn',()=>{
 const assignments=[plan('A','cancel',{estado:'CANCELADA'}),plan('A','shift',{turno:2}),plan('A','date',{fecha:'2026-11-08'})];
 const [r]=all(data([production('A',{assignments})],[operation('A','cancel')]));assert.equal(r.state,'OTRAS');assert.equal(r.currentAssignments.length,0);assert.equal(r.assignments.length,2);assert.equal(r.operationTargets.length,0);
});
test('invalid quantity/balance is pending, not zero or a false completion',()=>{
 for(const [quantity,balance] of [[null,0],[0,0],['',0],[false,0],[20,null],[20,''],[20,false],[20,21],[20,-1],[20,2.5],[20,Infinity]]){
  const [r]=all(data([production('A',{quantity,balance})]));assert.equal(r.state,'POR_REVISAR');assert.equal(r.balance,null);assert.equal(r.realized,null);
 }
});
test('uninitialized or missing-current-Export flags cannot claim available or completed',()=>{
 for(const flag of ['saldos_inicializados','presente_ultimo_export']){const p=production('A',{balance:0});p.oficial[flag]=false;assert.equal(all(data([p]))[0].state,'POR_REVISAR');}
});
test('unknown assignment source or malformed period stays for review without inventing scheduling',()=>{
 for(const extra of [{source:'OTHER'},{fecha:'2026-02-30'},{turno:3},{prioridad:null},{cantidad:null}]){
  const [r]=all(data([production('A',{assignments:[plan('A','a',extra)]})]));assert.equal(r.state,'POR_REVISAR');
 }
});
test('partial positive Export is open even when schedule fields need review',()=>{
 const [r]=all(data([production('A',{balance:4,assignments:[plan('A','a',{prioridad:null})]})]));assert.equal(r.state,'ABIERTAS');assert.match(r.reviewReason,/Programación/);
});
test('strict date, line and operation stage context',()=>{
 for(const patch of [{stage:'FOREIGN'},{line:'FOREIGN'},{date:'2026-02-30'},{shift:'1'},{shift:3}])assert.throws(()=>assemblySheetRows(data([]),{...context,...patch}),/Ámbito/);
});
test('catalog scope, canonical key and duplicate production identity are rejected',()=>{
 for(const patch of [{stage:'EMPAQUE'},{line:'FRAMES_2'},{date:'2026-11-08'},{shift:2},{contract:'wrong'}]){const d=data([production('A')]);Object.assign(d.catalog,patch);assert.throws(()=>all(d),/Catálogo/);}
 const d=data([production('A')]);d.catalog.productions[0].oficial.key_produccion=key('B');assert.throws(()=>all(d),/Identidad/);
 assert.throws(()=>all(data([production('A'),production('A')])),/duplicada/);
});
test('foreign and duplicate plan identities are rejected, even cancelled ones',()=>{
 assert.throws(()=>all(data([production('A',{assignments:[plan('B','a')]})])),/Asignación/);
 assert.throws(()=>all(data([production('A',{assignments:[plan('A','a'),plan('A','a',{estado:'CANCELADA'})]})])),/duplicada/);
});
test('foreign and duplicate operational scope is rejected, not silently mixed',()=>{
 for(const patch of [{linea:'FRAMES_2'},{etapa:'EMPAQUE'},{fecha:'2026-11-08'},{turno:2}])assert.throws(()=>all(data([production('A')],[operation('A','a',patch)])),/ámbito/);
 assert.throws(()=>all(data([production('A')],[operation('A','a'),operation('A','a')])),/duplicado/);
 assert.throws(()=>all(data([production('A')],[operation('B','b')])),/no contiene/);
});
test('same production display name does not collapse different canonical systems/keys',()=>{
 const p=production('B');p.oficial.produccion='A';p.oficial.sistema='ES9500';const rows=all(data([production('A'),p]));assert.equal(rows.length,2);assert.notEqual(rows[0].key,rows[1].key);
});
test('closure Realizado uses latest exact-turn power_bi once, never sum of versions or assignments',()=>{
 const r=close('A',6,2);r.snapshot.rows[0].assignments.push(operation('A','b',{ejecutado:400}));
 const [row]=all(data([production('A')],[operation('A','a',{ejecutado:90})],[close('A',3),r]));
 assert.equal(row.realized,6);assert.equal(row.realizedSource.version,2);assert.equal(row.realizedSource.source,'EXPORT_CIERRE');
});
test('unknown closure is not zero; a real zero closure remains zero',()=>{
 assert.equal(all(data([production('A')]))[0].realized,null);
 assert.equal(all(data([production('A')],[],[close('A',0)]))[0].realized,0);
});
test('foreign turn/stage/line closure cannot supply Realizado',()=>{
 for(const patch of [{turno:2},{etapa:'EMPAQUE'},{linea:'FRAMES_2'},{fecha:'2026-11-08'}])assert.equal(assemblyClosure(data([],[],[close('A',12,1,patch)]),key('A'),context),null);
 const r=close('A',12);r.snapshot.shift=2;assert.equal(assemblyClosure(data([],[],[r]),key('A'),context),null);
});
test('latest invalid or missing production does not revive older Realizado',()=>{
 for(const change of [r=>r.snapshot.rows=[],r=>r.snapshot.rows[0].power_bi=null,r=>r.snapshot.file=null,r=>r.snapshot.ok=false,r=>r.snapshot.version=99,r=>r.snapshot.file.sha256='bad']){
  const r=close('A',8,2);change(r);assert.equal(assemblyClosure(data([],[],[close('A',2),r]),key('A'),context),null);
 }
});
test('duplicate rows, conflicting same-version closures and legacy per-part totals are not added',()=>{
 const r=close('A',12);r.snapshot.rows.push(structuredClone(r.snapshot.rows[0]));assert.equal(assemblyClosure(data([],[],[r]),key('A'),context),null);
 assert.equal(assemblyClosure(data([],[],[close('A',2),close('A',9)]),key('A'),context),null);
 const legacy=close('A',12);legacy.snapshot.file.adapter='LP-CSV-1';assert.equal(assemblyClosure(data([],[],[legacy]),key('A'),context),null);
});
test('assignment snapshots never replace or multiply the consolidated confirmed-close quantity',()=>{
 const report=close('A',12);report.snapshot.rows[0].assignments.push(operation('A','b',{ejecutado:999,sale:999}));
 const got=assemblyClosure(data([],[],[report]),key('A'),context);
 assert.equal(got.quantity,12);assert.equal(got.source,'EXPORT_CIERRE');assert.equal(got.sha256,'a'.repeat(64));
});
test('completed orders require explicit history filter; search is accent-insensitive and keeps all assignments',()=>{
 const d=data([production('Álamo',{balance:0}),production('B',{assignments:[plan('B','a',{observacion:'revisar balcón'}),plan('B','b')]})]);
 assert.equal(assemblySheetRows(d,context,{status:'COMPLETADAS',search:'alamo'}).length,1);
 const [b]=assemblySheetRows(d,context,{search:'balcon'});assert.equal(b.currentAssignments.length,2);assert.equal(b.state,'PROGRAMADAS');
 assert.equal(filterAssemblySheetRows(all(d),{search:'R-Álamo'}).length,0);
});
test('fallback without catalog is partial and never fabricates plan rows or consolidated availability',()=>{
 const d={contract:'LP-OPERACION-1',orders:[operation('A','a'),operation('A','b')],reports:[]};const [r]=all(d);
 assert.equal(r.partial,true);assert.equal(r.state,'OTRAS');assert.equal(r.currentAssignments.length,0);assert.equal(r.available,null);assert.equal(r.realized,null);
 assert.match(assemblySheetMarkup(all(d),{catalogAvailable:false}),/Catálogo completo pendiente/);
});
test('fallback incompatible Export snapshots stay for review instead of selecting one as truth',()=>{
 const r=operation('A','b');r.oficial.saldo_ensamble=0;
 assert.equal(all({contract:'LP-OPERACION-1',orders:[operation('A','a'),r]})[0].state,'POR_REVISAR');
});
test('markup preserves compact PC columns, mobile data labels, real detail and glass actions',()=>{
 const rows=all(data([production('A',{balance:6}),production('B',{assignments:[plan('B','b')]}),production('C'),production('D',{balance:0})]));
 const html=assemblySheetMarkup(rows,{onDetail(){},onGlass(){},onAvailable(){}});
 for(const label of ['Semana','Producción','Reserva','Prioridad','Sistema','Saldo Export','Disponible','Realizado','Afectaciones','Observaciones'])assert.ok(html.includes(label),label);
 assert.equal((html.match(/data-assembly-key=/g)||[]).length,3);
 for(const group of ['ABIERTAS','PROGRAMADAS','OTRAS'])assert.ok(html.includes('data-assembly-group="'+group+'"'));
 assert.match(html,/Pendiente de cierre/);assert.match(html,/data-assembly-glass/);assert.match(html,/data-assembly-detail/);assert.doesNotMatch(html,/>Reportado</);assert.doesNotMatch(html,/>SALE</);
});
test('markup escapes names, notes, keys and query; history has a dedicated filtered view',()=>{
 const p=production('A',{balance:0});p.oficial.produccion='<img onerror="bad">';p.observacion='<script>alert(1)</script>';
 const html=assemblySheetMarkup(all(data([p])),{state:{status:'COMPLETADAS',search:'<img'},onDetail(){}});
 assert.match(html,/data-assembly-group="COMPLETADAS"/);assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img/);assert.doesNotMatch(html,/<script/);
});
test('availability and affectation slots reuse existing shared editors and summaries',()=>{
 const [row]=all(data([production('A')]));const html=assemblySheetMarkup([row],{onDetail(){},orderSaleProvider(){},onAffectations(){},summaryFor:()=>({status:'READY',categories:{NC_AL:2,NC_V:1,TECNO:null,NOVEDAD:null},reportedQuantities:{},aluminumCoverage:'COMPLETE',accessories:3,total:null})});
 assert.match(html,/data-sale-order-key=/);assert.match(html,/2 × NC AL/);assert.match(html,/1 × NC V/);assert.match(html,/3 × Accesorios/);assert.doesNotMatch(html,/Disponible[^<]*[1-9]/);
});
test('B13 CSS retains desktop table and changes same rows to mobile cards with week/system visible',()=>{
 const css=readFileSync(new URL('../src/modules/lp01-assembly-sheet.css',import.meta.url),'utf8');
 assert.match(css,/@media\(max-width:700px\)/);assert.match(css,/grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/);assert.match(css,/data-assembly-state=ABIERTAS/);assert.match(css,/data-assembly-state=PROGRAMADAS/);assert.match(css,/:focus-visible/);assert.match(css,/prefers-reduced-motion/);
 assert.doesNotMatch(css,/lp-assembly-week[^}]*display:none/);
});


test('global observation slot never presents plan or local-turn notes as the global note',()=>{
 const p=production('A',{assignments:[plan('A','a',{observacion:'PRIVATE PLAN NOTE'})]});
 const rows=all(data([p],[operation('A','a',{observacion:'LOCAL TURN NOTE'})]));
 const html=assemblySheetMarkup(rows,{onDetail(){}});
 assert.match(html,/data-note-order-key=/);assert.doesNotMatch(html,/PRIVATE PLAN NOTE|LOCAL TURN NOTE/);
 assert.equal(rows[0].observations.length,2);
});
test('official active/production-state metadata survives unchanged and cannot redefine balance state',()=>{
 const p=production('A',{balance:5});p.oficial.activa=false;p.oficial.estado_produccion='SUSPENDIDA';
 const [r]=all(data([p]));assert.equal(r.state,'ABIERTAS');assert.equal(r.oficial.activa,false);assert.equal(r.oficial.estado_produccion,'SUSPENDIDA');
});


test('beforeRender parks and reattaches the same editor on mount, search, state filter and refresh',()=>{
 const oldDocument=globalThis.document;
 globalThis.document={activeElement:null,createDocumentFragment:()=>({append(){}})};
 const events=[],draft={text:'Borrador sin guardar',revision:4};let html='initial',search,filter;
 const host={note:draft,contains:()=>false,classList:{add(){}},
  querySelectorAll:selector=>selector==='[data-assembly-filter]'?[filter]:[],
  querySelector:selector=>selector==='[data-assembly-search]'?search:selector==='[data-columns-reset]'?{}:null,
  get innerHTML(){return html;},
  set innerHTML(value){events.push('replace');html=value;this.note=null;search={};filter={dataset:{assemblyFilter:'COMPLETADAS'}};}
 };
 const state={};
 try{
  const result=renderAssemblySheet({host,data:data([production('A'),production('B',{balance:0})]),context,state,
   beforeRender:({host:target,rows})=>{
    events.push('before');assert.equal(target,host);assert.deepEqual(rows.map(r=>r.key),[key('A'),key('B')]);
    const parked=target.note;assert.equal(parked,draft);
    return ()=>{events.push('attach');assert.match(target.innerHTML,/lp-assembly-toolbar/);target.note=parked;};
   }
  });
  search.oninput({target:{value:'B'}});assert.equal(state.search,'B');assert.match(host.innerHTML,/0 producciones/);assert.equal(host.note,draft);
  filter.onclick();assert.equal(state.status,'COMPLETADAS');assert.match(host.innerHTML,/data-note-order-key=/);
  result.refresh();
  assert.deepEqual(events,Array.from({length:4},()=>['before','replace','attach']).flat());
  assert.equal(host.note,draft);assert.equal(host.note.text,'Borrador sin guardar');assert.equal(host.note.revision,4);
 }finally{if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;}
});
test('invalid scope rejects before calling beforeRender or replacing content',()=>{
 let called=false;const host={innerHTML:'original'};const d=data([production('A')]);d.catalog.line='FRAMES_2';
 assert.throws(()=>renderAssemblySheet({host,data:d,context,beforeRender:()=>{called=true;}}),/Catálogo/);
 assert.equal(called,false);assert.equal(host.innerHTML,'original');
});


test('Realizado is unavailable after reopen or without the current confirmed turn revision',()=>{
 for(const estado of ['ABIERTO','EN_REVISION','NO_ABIERTO',null]){
  const d=data([production('A')],[operation('A','a',{ejecutado:999})],[close('A',12)]);d.turn.estado=estado;
  assert.equal(all(d)[0].realized,null);assert.equal(all(d)[0].realizedSource,null);
 }
 for(const revision of [0,2,null]){const d=data([production('A')],[],[close('A',12)]);d.turn.revision=revision;assert.equal(all(d)[0].realized,null);}
 const d=data([production('A')],[],[close('A',12)]);delete d.turn;assert.equal(all(d)[0].realized,null);
});
test('Realizado requires matching report id, file id and a full SHA256, never a free-form hash',()=>{
 for(const mutate of [r=>r.snapshot.id='foreign',r=>delete r.snapshot.id,r=>r.archivo='foreign',r=>delete r.archivo,r=>r.snapshot.file.id='foreign',r=>r.snapshot.file.sha256='hash-1',r=>r.snapshot.file.sha256='g'.repeat(64)]){
  const report=close('A',12);mutate(report);assert.equal(all(data([production('A')],[],[report]))[0].realized,null);
 }
});
test('duplicate latest closure is rejected rather than summed, deduplicated or replaced with an older close',()=>{
 const report=close('A',12,2);const d=data([production('A')],[],[close('A',3),report,structuredClone(report)]);
 assert.equal(all(d)[0].realized,null);assert.equal(all(d)[0].realizedSource,null);
});
test('raw report arrays alone cannot establish current Realizado',()=>{
 assert.equal(assemblyClosure([close('A',12)],key('A'),context),null);
});

test('inactive catalog sources stay visible but are explicitly not incorporable',()=>{
 const p=production('inactive');p.oficial.activa='NO';
 const markup=assemblySheetMarkup(all(data([p])),{onDetail:()=>{}});
 assert.match(markup,/Inactiva o sin confirmar · no incorporable/);
});


test('sheet renders partial-reload retained quantities with the genuine prior source',()=>{
 const fixture=closurePartialReloadFixture(),rows=assemblySheetRows(fixture.data,fixture.context),b=rows.find(row=>row.key==='B|PANELES_2');
 assert.equal(b.realized,5);assert.equal(b.realizedSource.valueStatus,'PRESERVED');
 const markup=assemblySheetMarkup([b],{onDetail(){}});assert.match(markup,/>5<small>Conservado<\/small>/);assert.match(markup,/earlier-full-export.xlsx \(carga anterior\)/);
});
test('sheet never-reported row is unknown, not a missing close or explicit zero',()=>{
 const fixture=closureV2Fixture(),row=assemblySheetRows(fixture.data,fixture.context).find(row=>row.key==='B|PANELES_2'),markup=assemblySheetMarkup([row]);
 assert.equal(row.realized,null);assert.match(markup,/>No informado<\/span>/);assert.doesNotMatch(markup,/>Pendiente de cierre<\/span>/);
});

 test('reservation parts use natural order and never planner priority or assignment UUID',()=>{
 const ps=['late','early','other'].map(name=>production(name,{assignments:[plan(name,'uuid-'+name,{prioridad:name==='late'?1:9})]}));
 ps[0].oficial.reserva_al='R1';ps[0].oficial.prioridad_reserva='1.10';
 ps[1].oficial.reserva_al='R1';ps[1].oficial.prioridad_reserva='1.2';
 ps[2].oficial.reserva_al='R2';
 assert.deepEqual(all(data(ps)).map(r=>r.produccion),['early','late','other']);
 const html=assemblySheetMarkup(all(data(ps)));
 assert.ok(html.indexOf('data-column-menu="week"')<html.indexOf('data-column-menu="production"'));
 assert.match(html,/data-label="Prioridad"[^>]*>1.2/);
 assert.doesNotMatch(html,/data-label="Prioridad"[^>]*>9/);
 });

test('Otras and Por revisar share reservation ordering without changing their states',()=>{
 const ready=production('ready'),pending=production('pending',{quantity:null});
 ready.oficial.reserva_al='R10';pending.oficial.reserva_al='R1';
 const rows=all(data([ready,pending]));
 assert.deepEqual(rows.map(r=>[r.produccion,r.state]),[['pending','POR_REVISAR'],['ready','OTRAS']]);
});

test('sheet column filters compose, support an empty selection and never mutate data',()=>{
 const rows=all(data([production('A',{week:44,balance:10}),production('B',{week:45,balance:2}),production('C',{week:45,balance:3})]));
 const before=structuredClone(rows);
 assert.deepEqual(filterAssemblySheetRows(rows,{columnFilters:{week:[assemblyValueKey('2026-W45')],balance:[assemblyValueKey(2)]}}).map(r=>r.produccion),['B']);
 assert.equal(filterAssemblySheetRows(rows,{columnFilters:{week:[]}}).length,0);
 assert.deepEqual(rows,before);
});
test('column sort is numeric, preserves groups, and keeps missing data last both ways',()=>{
 const rows=all(data([production('A',{balance:10}),production('B',{balance:2}),production('C',{balance:20})]));
 assert.deepEqual(filterAssemblySheetRows(rows,{sort:'balance',direction:'asc'}).map(r=>r.produccion),['B','A','C']);
 assert.deepEqual(filterAssemblySheetRows(rows,{sort:'balance',direction:'desc'}).map(r=>r.produccion),['A','B','C']);
 rows[0].realized=null;rows[1].realized=3;rows[2].realized=9;
 for(const direction of ['asc','desc'])assert.equal(filterAssemblySheetRows(rows,{sort:'realized',direction})[1].realized,null);
});
test('sheet exposes Seguimiento-style sorting and checkbox filters without filtering unloaded editors',()=>{
 const html=assemblySheetMarkup(all(data([production('A')])),{state:{column:'week',columnFilters:{week:[]}}});
 for(const label of ['Ordenar columna','Filtrar columna','Seleccionar todos','Desmarcar todos','Aplicar','Cancelar'])assert.ok(html.includes(label));
 assert.match(html,/data-column-menu="reservation"/);assert.match(html,/data-column-menu="part"/);
 assert.doesNotMatch(html,/data-column-menu="(?:available|affectations|observation)"/);
});
