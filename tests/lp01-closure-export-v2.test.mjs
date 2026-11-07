import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {closureExportRealizedV2,currentClosureExportRealized} from '../src/domain/lp01-closure-export-v2.js';
import {closureExportRealized} from '../src/domain/lp01-closure-export.js';
import {assemblySheetRows,assemblyClosure} from '../src/domain/lp01-assembly-sheet.js';
import {closureV2Fixture,closurePartialReloadFixture} from './fixtures/lp01-closure-export-v2.mjs';

const result=fixture=>closureExportRealizedV2(fixture.data,fixture.context);
const reject=mutate=>{const fixture=closureV2Fixture();mutate(fixture.data.reports[0].snapshot,fixture.data.reports[0],fixture.data,fixture.context);const projected=result(fixture);assert.equal(projected.status,'INCOMPATIBLE_CLOSE');assert.deepEqual(projected.rows,[]);assert.deepEqual(currentClosureExportRealized(fixture.data,fixture.context).rows,[]);};
function legacyFixture(){
 const fixture=closureV2Fixture(),r=fixture.data.reports[0],old=r.snapshot;
 r.snapshot={ok:true,id:r.id,...fixture.context,version:r.version,file:old.file,rows:[{key:'A|PANELES_2',power_bi:7,ejecutado:999}],user:old.user};
 return fixture;
}

test('V2 mixed coverage preserves explicit quantities, absence, file/batch and unresolved plan/continuity',()=>{
 const fixture=closureV2Fixture(),before=structuredClone(fixture),got=result(fixture);
 assert.equal(got.contract,'LP-REALIZADO-CIERRE-3');assert.equal(got.status,'CONFIRMED');assert.equal(got.authority,'EXPORT_PRODUCTION_V2');
 assert.deepEqual(got.rows.map(r=>[r.key,r.quantity,r.coverage,r.preserve]),[['A|PANELES_2',7,'PRESENT',false],['B|PANELES_2',null,'ABSENT',true]]);
 assert.equal(got.importId,fixture.data.reports[0].snapshot.importId);assert.equal(got.universeRevision,'b'.repeat(64));assert.equal(got.file.sha256,'a'.repeat(64));
 assert.equal(got.canContinue,false);assert.equal(got.comparisonComplete,false);assert.equal(got.planComparison,'PLAN_SOURCE_REQUIRED');assert.equal(got.reconciliation,'RECONCILIATION_REQUIRED');
 for(const row of got.rows){assert.equal(row.plan,null);assert.equal(row.difference,null);assert.equal(row.pendingAgainstPlan,null);assert.equal(row.budget.available,null);assert.equal(row.continuity.quantity,null);assert.equal(row.continuity.allocation,'NONE');assert.equal(row.source,'EXPORT_CIERRE_V2');}
 assert.deepEqual(fixture,before);
});
test('PRESENT zero and maximum safe integer remain exact; absent is still null',()=>{
 for(const n of [0,Number.MAX_SAFE_INTEGER]){const f=closureV2Fixture();f.data.reports[0].snapshot.rows[0].realized=n;assert.equal(result(f).rows[0].quantity,n);assert.equal(result(f).rows[1].quantity,null);}
 for(const n of [null,undefined,'0',false,true,-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1])reject(s=>s.rows[0].realized=n);
});
test('missing fields cannot establish V2 authority, a valid current close or provenance',()=>{
 for(const field of ['contract','authority','id','stage','line','date','shift','ok','type','version','importId','universeRevision','file','rows','reasons','canContinue','comparisonComplete','planComparison','reconciliation'])reject(s=>delete s[field]);
});
test('latest unique V2 version replaces all previous values without summing versions or assignment UUIDs',()=>{
 const f=closureV2Fixture(),latest=f.data.reports[0],old=structuredClone(latest);old.id='old-close';old.version=3;old.snapshot.id=old.id;old.snapshot.version=3;old.snapshot.rows[0].realized=50;
 f.data.reports.unshift(old);assert.equal(result(f).rows[0].quantity,7);assert.equal(result(f).version,4);
 latest.snapshot.rows[0].manualHistory.assignments.forEach(a=>{a.ejecutado=900;a.sale=500;});assert.equal(result(f).rows[0].quantity,7);
});
test('duplicates of latest report, report id, production, source row and assignment reference fail closed',()=>{
 reject((s,r,d)=>d.reports.push(structuredClone(r)));
 reject((s,r,d)=>{const old=structuredClone(r);old.version=3;old.snapshot.version=3;d.reports.unshift(old);});
 reject(s=>s.rows.push(structuredClone(s.rows[0])));
 reject(s=>s.rows[0].sourceRows.push(s.rows[0].sourceRows[0]));
 reject(s=>{Object.assign(s.rows[1],{coverage:'PRESENT',realized:1,preserve:false,sourceRows:[2]});});
 reject(s=>s.rows[0].assignmentRefs[1]=s.rows[0].assignmentRefs[0]);
 reject(s=>{s.rows[1].assignmentRefs[0]=s.rows[0].assignmentRefs[0];s.rows[1].manualHistory.assignments[0].parte=s.rows[0].assignmentRefs[0];});
});
test('reopening invalidates current projection while an explicitly historical envelope remains readable',()=>{
 for(const state of ['ABIERTO','EN_REVISION','NO_ABIERTO',null]){
  const f=closureV2Fixture();f.data.turn.estado=state;
  assert.equal(result(f).status,'NO_CONFIRMED_CLOSE');assert.equal(currentClosureExportRealized(f.data,f.context).status,'NO_CONFIRMED_CLOSE');
  const report=f.data.reports[0],archive={contract:'LP-OPERACION-1',turn:{estado:'CERRADO',revision:report.version},reports:[report]};
  assert.equal(closureExportRealizedV2(archive,f.context).status,'CONFIRMED');assert.equal(f.data.turn.estado,state);
 }
});
test('invalid envelope, absent reports and wrong period do not claim a current close',()=>{
 const f=closureV2Fixture();assert.equal(result({...f,data:{...f.data,contract:'FOREIGN'}}).status,'NO_CONFIRMED_CLOSE');
 assert.equal(result({...f,data:{...f.data,reports:[]}}).status,'NO_CONFIRMED_CLOSE');
 for(const patch of [{fecha:'2026-11-08'},{turno:2},{linea:'FRAMES_2'},{etapa:'EMPAQUE'}]){const p=closureV2Fixture();Object.assign(p.data.reports[0],patch);assert.equal(result(p).status,'NO_CONFIRMED_CLOSE');}
 for(const reports of [{},[null],[[]]])reject((s,r,d)=>d.reports=reports);
});
test('calendar dates and context types must be valid before selecting any report',()=>{
 for(const patch of [{date:'2026-02-29'},{date:'2026-02-30'},{date:'0000-01-01'},{date:'2026-04-31'},{date:'2026-13-01'},{shift:'1'},{shift:true},{line:'OTHER'},{stage:'OTHER'}]){
  const f=closureV2Fixture();assert.throws(()=>closureExportRealizedV2(f.data,{...f.context,...patch}),/Contexto/);assert.throws(()=>currentClosureExportRealized(f.data,{...f.context,...patch}),/Contexto/);
 }
 const f=closureV2Fixture();f.context.date='2028-02-29';const r=f.data.reports[0];r.fecha=f.context.date;r.snapshot.date=f.context.date;f.data.turn.fecha=f.context.date;
 r.snapshot.rows.forEach(row=>{row.manualHistory.assignments.forEach(a=>a.fecha=f.context.date);if(row.valueSource)row.valueSource.context.date=f.context.date;});assert.equal(result(f).status,'CONFIRMED');
});
test('snapshot/turn scope must match exactly; V2 cannot extend its contained stage/line pilot',()=>{
 for(const patch of [{stage:'EMPAQUE'},{line:'FRAMES_2'},{date:'2026-11-08'},{shift:2},{shift:'1'}])reject(s=>Object.assign(s,patch));
 reject((s,r,d)=>d.turn.turno=2);
 for(const patch of [{stage:'EMPAQUE'},{line:'FRAMES_2'}]){
  const f=closureV2Fixture();Object.assign(f.context,patch);const r=f.data.reports[0];Object.assign(r.snapshot,patch);r.etapa=f.context.stage;r.linea=f.context.line;f.data.turn.etapa=f.context.stage;f.data.turn.linea=f.context.line;
  assert.equal(result(f).status,'INCOMPATIBLE_CLOSE');
 }
});
test('safe current revision and exact snapshot/report version are required, with no coercion',()=>{
 for(const value of ['4',null,true,-1,0,4.5,Infinity,Number.MAX_SAFE_INTEGER+1])reject((s,r,d)=>{d.turn.revision=value;});
 for(const value of [undefined,'4',null,true,-1,4.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1])reject((s,r)=>r.version=value);
 reject(s=>s.version=3);reject(s=>s.version='4');
});
test('closure, original-file and imported-batch identifiers cannot be absent or whitespace',()=>{
 for(const value of [undefined,null,'',' ','\t\n',' leading',0,false,{},[]]){
  reject((s,r)=>{s.id=value;r.id=value;});
  reject((s,r)=>{s.file.id=value;r.archivo=value;});
  reject(s=>s.importId=value);
 }
 reject(s=>s.id='other-close');reject((s,r)=>r.archivo='other-file');
});
test('file/hash/import universe provenance is required without fabricating a browser digest',()=>{
 for(const value of [undefined,null,'','short','x'.repeat(64),'a'.repeat(63),'a'.repeat(65)]){reject(s=>s.file.sha256=value);reject(s=>s.universeRevision=value);}
 reject(s=>s.file.adapter='UNKNOWN');reject(s=>delete s.file.name);reject(s=>s.file.name=' ');
 const f=closureV2Fixture();f.data.reports[0].snapshot.file.sha256='A'.repeat(64);f.data.reports[0].snapshot.rows[0].valueSource.file.sha256='A'.repeat(64);assert.equal(result(f).file.sha256,'A'.repeat(64));
});
test('NEVER_REPORTED requires explicit null, preserve true, empty sources and its recorded reason',()=>{
 for(const value of [undefined,0,'',false,7])reject(s=>s.rows[1].realized=value);
 for(const value of [undefined,null,false,'true'])reject(s=>s.rows[1].preserve=value);
 reject(s=>s.rows[1].sourceRows=[4]);reject(s=>s.rows[1].reason=null);reject(s=>delete s.reasons['B|PANELES_2']);reject(s=>s.reasons['B|PANELES_2']='other');
 reject(s=>{s.rows[1].reason='';s.reasons['B|PANELES_2']='';});reject(s=>s.reasons['OTHER|PANELES_2']='foreign');
});
test('PRESENT requires nonempty unique integer sources and preserve false',()=>{
 for(const sources of [undefined,[],[0],[-1],[1.5],['2'],[false],[Infinity],[Number.MAX_SAFE_INTEGER+1]])reject(s=>s.rows[0].sourceRows=sources);
 for(const value of [undefined,null,true,'false'])reject(s=>s.rows[0].preserve=value);
 for(const coverage of [undefined,null,'present','UNKNOWN'])reject(s=>s.rows[0].coverage=coverage);
});
test('plan/comparison/budget/continuity cannot be silently calculated or marked ready',()=>{
 for(const mutate of [s=>s.canContinue=true,s=>s.comparisonComplete=true,s=>s.planComparison='READY',s=>s.reconciliation='READY',s=>s.rows[0].plan=20,s=>s.rows[0].planStatus='READY',s=>s.rows[0].difference=0,s=>s.rows[0].pendingAgainstPlan=0,s=>s.rows[0].budget.available=0,s=>s.rows[0].budget.status='READY',s=>s.rows[0].continuity.quantity=0,s=>s.rows[0].continuity.status='READY',s=>s.rows[0].continuity.allocation='BY_ASSIGNMENT'])reject(mutate);
 for(const field of ['plan','planStatus','difference','pendingAgainstPlan','budget','continuity'])reject(s=>delete s.rows[0][field]);
});
test('historical references must remain scoped and explicitly historical, without supply or allocation credit',()=>{
 for(const mutate of [s=>s.rows[0].manualHistory.authority='CURRENT',s=>s.rows[0].manualHistory.assignments=[],s=>s.rows[0].manualHistory.assignments[0].key='B|PANELES_2',s=>s.rows[0].manualHistory.assignments[0].turno=2,s=>s.rows[0].manualHistory.assignments[0].parte='foreign',s=>s.rows[0].scheduledReference.authority='CURRENT',s=>s.rows[0].scheduledReference.quantity=2])reject(mutate);
 const f=closureV2Fixture(),s=f.data.reports[0].snapshot;
 s.rows[0].scheduledReference.assignments=[{id:'scheduled-A',key_produccion:s.rows[0].key,fecha:f.context.date,turno:1,estado:'PROGRAMADA',cantidad:500}];
 assert.equal(result(f).rows[0].plan,null);assert.equal(result(f).rows[0].quantity,7);
 for(const patch of [{estado:'CANCELADA'},{key_produccion:'B|PANELES_2'},{fecha:'2026-11-08'},{turno:2},{id:' '}]){const next=structuredClone(f);Object.assign(next.data.reports[0].snapshot.rows[0].scheduledReference.assignments[0],patch);assert.equal(result(next).status,'INCOMPATIBLE_CLOSE');}
});
test('historical identity is copied from the close and cannot be completed from today or manual history',()=>{
 const f=closureV2Fixture();f.data.catalog.productions[0].oficial.produccion='CURRENT NAME';f.data.reports[0].snapshot.rows[0].manualHistory.assignments[0].oficial.produccion='MANUAL NAME';
 const got=result(f);assert.equal(got.rows[0].identity.production,'A');assert.equal(got.rows[1].identity.system,null);
 delete f.data.reports[0].snapshot.rows[0].identity;assert.equal(result(f).rows[0].identity,null);
 for(const patch of [{key:'B|PANELES_2'},{line:'FRAMES_2'},{production:''},{production:null},{system:undefined},{system:''}])reject(s=>Object.assign(s.rows[0].identity,patch));
});
test('unknown contracts, missing discriminators and hybrid aliases never fall back to old/manual data',()=>{
 for(const mutate of [s=>s.contract='LP-EXPORT-CLOSE-99',s=>s.authority='OTHER',s=>delete s.contract,s=>delete s.authority,s=>{delete s.contract;delete s.authority;},s=>s.rows[0].power_bi=999,s=>s.rows[0].ejecutado=999,s=>s.rows[0].sale=999])reject(mutate);
 const f=legacyFixture();f.data.reports[0].snapshot.contract='UNKNOWN';assert.equal(currentClosureExportRealized(f.data,f.context).status,'INCOMPATIBLE_CLOSE');
 f.data.reports[0].snapshot.contract=null;assert.equal(currentClosureExportRealized(f.data,f.context).status,'INCOMPATIBLE_CLOSE');
});
test('unknown current contract cannot revive an older valid legacy close',()=>{
 const f=closureV2Fixture(),legacy=legacyFixture().data.reports[0];legacy.id='older';legacy.snapshot.id='older';legacy.version=3;legacy.snapshot.version=3;
 f.data.reports.unshift(legacy);f.data.reports[1].snapshot.contract='UNKNOWN';assert.equal(currentClosureExportRealized(f.data,f.context).status,'INCOMPATIBLE_CLOSE');
});
test('native legacy and empty legacy route to the unchanged pinned helper',()=>{
 const f=legacyFixture();assert.deepEqual(currentClosureExportRealized(f.data,f.context),closureExportRealized(f.data,f.context));assert.equal(result(f).status,'INCOMPATIBLE_CLOSE');
 const report=f.data.reports[0];Object.assign(report,{tipo:'SIN_ACTIVIDAD',archivo:null});Object.assign(report.snapshot,{type:'SIN_ACTIVIDAD',rows:[],file:null,confirmed:true});
 assert.deepEqual(currentClosureExportRealized(f.data,f.context),closureExportRealized(f.data,f.context));assert.equal(currentClosureExportRealized(f.data,f.context).status,'CONFIRMED_EMPTY');
 const source=readFileSync(new URL('../src/domain/lp01-closure-export.js',import.meta.url));assert.equal(createHash('sha256').update(source).digest('hex'),'146999f4d1921807954b21208d2752efcfde9077f5cd45de978b692aca1c56ab');
});
test('malformed current snapshot and row containers fail closed without throwing',()=>{
 for(const value of [null,[],{},'rows',{some:true}])reject(s=>s.rows=value);
 for(const value of [null,[],1])reject(s=>s.rows[0]=value);
 const f=legacyFixture();f.data.reports[0].snapshot.rows={some:true};assert.equal(currentClosureExportRealized(f.data,f.context).status,'INCOMPATIBLE_CLOSE');
});
test('assembly sheet uses the versioned reader, retaining ABSENT provenance while Realizado stays null',()=>{
 const f=closureV2Fixture();const rows=assemblySheetRows(f.data,f.context,{includeCompleted:true});
 assert.equal(rows.find(r=>r.key==='A|PANELES_2').realized,7);
 const absent=rows.find(r=>r.key==='B|PANELES_2');assert.equal(absent.realized,null);assert.equal(absent.realizedSource.coverage,'ABSENT');assert.equal(absent.realizedSource.preserve,true);
 assert.equal(assemblyClosure(f.data,'A|PANELES_2',f.context).source,'EXPORT_CIERRE_V2');
 f.data.turn.estado='EN_REVISION';assert(assemblySheetRows(f.data,f.context,{includeCompleted:true}).every(r=>r.realized===null&&r.realizedSource===null));
});


test('recorded multiline reasons and original file names retain their exact server text',()=>{
 const f=closureV2Fixture(),s=f.data.reports[0].snapshot;
 s.reasons['B|PANELES_2']='  Primera línea\nSegunda línea\n  ';s.rows[1].reason='Primera línea\nSegunda línea\n';s.file.name=' Export con espacios.xlsx ';s.rows[0].valueSource.file.name=s.file.name;
 const got=result(f);assert.equal(got.status,'CONFIRMED');assert.equal(got.rows[1].reason,'Primera línea\nSegunda línea\n');assert.equal(got.file.name,' Export con espacios.xlsx ');
});


test('contract3 partial reload A7/B5 then A3 preserves B5 and each actual file without adding versions',()=>{
 const f=closurePartialReloadFixture(),before=structuredClone(f),got=result(f);
 assert.equal(got.status,'CONFIRMED');assert.equal(got.contract,'LP-REALIZADO-CIERRE-3');
 assert.deepEqual(got.rows.map(r=>[r.key,r.quantity,r.coverage,r.valueStatus]),[['A|PANELES_2',3,'PRESENT','CURRENT_FILE'],['B|PANELES_2',5,'ABSENT','PRESERVED']]);
 const [a,b]=got.rows,old=f.data.reports[0];
 assert.equal(a.fileId,got.file.id);assert.equal(b.fileId,old.archivo);assert.notEqual(b.fileId,got.file.id);
 assert.equal(b.importId,old.snapshot.importId);assert.equal(b.sha256,old.snapshot.file.sha256);assert.equal(b.universeRevision,old.snapshot.universeRevision);
 assert.deepEqual(b.sourceRows,[]);assert.deepEqual(b.valueSource.sourceRows,[3]);assert.equal(b.preserve,true);
 // Current file row 3 and earlier file row 3 describe distinct physical rows.
 assert(a.sourceRows.includes(3));assert.equal(b.valueSource.importVersion,1);
 const archive={contract:f.data.contract,turn:{estado:'CERRADO',revision:old.version},reports:[old]};
 assert.deepEqual(closureExportRealizedV2(archive,f.context).rows.map(r=>r.quantity),[7,5]);
 assert.deepEqual(f,before);
});
test('preserved explicit zero remains zero; never reported remains null with no forged file attribution',()=>{
 const f=closurePartialReloadFixture();f.data.reports[1].snapshot.rows[1].realized=0;
 const zero=result(f).rows[1];assert.equal(zero.quantity,0);assert.equal(zero.valueStatus,'PRESERVED');assert.equal(zero.fileId,f.data.reports[0].archivo);
 const never=result(closureV2Fixture()).rows[1];assert.equal(never.valueStatus,'NEVER_REPORTED');assert.equal(never.quantity,null);assert.equal(never.valueSource,null);
 for(const field of ['fileId','sha256','importId','universeRevision'])assert.equal(never[field],null);
});
test('the superseded undeployed contract2 is rejected, never silently reinterpreted',()=>{
 reject(s=>s.contract='LP-EXPORT-CLOSE-2');
 reject(s=>{s.contract='LP-EXPORT-CLOSE-2';for(const row of s.rows){delete row.valueSource;delete row.valueStatus;}});
});
test('current-file provenance must bind the exact current import, version, file, universe and rows',()=>{
 for(const field of ['valueStatus','valueSource'])reject(s=>delete s.rows[0][field]);
 for(const field of ['importId','importVersion','universeRevision','context','file','sourceRows'])reject(s=>delete s.rows[0].valueSource[field]);
 for(const patch of [{importId:'other'},{importVersion:1},{importVersion:'3'},{importVersion:0},{importVersion:Infinity},{universeRevision:'e'.repeat(64)},{context:{}},{sourceRows:[2]}])reject(s=>Object.assign(s.rows[0].valueSource,patch));
 for(const patch of [{stage:'EMPAQUE'},{line:'FRAMES_2'},{date:'2026-11-08'},{shift:2}])reject(s=>Object.assign(s.rows[0].valueSource.context,patch));
 for(const patch of [{id:'other'},{sha256:'e'.repeat(64)},{name:'other.xlsx'},{adapter:'UNKNOWN'}])reject(s=>Object.assign(s.rows[0].valueSource.file,patch));
 for(const status of ['PRESERVED','NEVER_REPORTED',null,'UNKNOWN'])reject(s=>s.rows[0].valueStatus=status);
 reject(s=>s.rows[1].valueSource=structuredClone(s.rows[0].valueSource));
});
test('preserved provenance must be earlier and scoped, never invented from the new filtered file',()=>{
 const rejectPreserved=mutate=>{const f=closurePartialReloadFixture(),s=f.data.reports[1].snapshot;mutate(s.rows[1],s);assert.equal(result(f).status,'INCOMPATIBLE_CLOSE');};
 for(const n of [null,undefined,'5',-1,1.2,NaN,Infinity,Number.MAX_SAFE_INTEGER+1])rejectPreserved(row=>row.realized=n);
 for(const field of ['valueSource','valueStatus'])rejectPreserved(row=>delete row[field]);
 for(const n of [0,-1,'1',4,5,Number.MAX_SAFE_INTEGER+1])rejectPreserved(row=>row.valueSource.importVersion=n);
 rejectPreserved((row,s)=>row.valueSource.importId=s.importId);
 rejectPreserved(row=>row.valueSource.context.shift=2);
 rejectPreserved(row=>row.valueSource.file.sha256='invalid');
 rejectPreserved(row=>row.valueSource.file.id='');
 rejectPreserved(row=>row.valueSource.file.adapter='UNKNOWN');
 for(const sources of [[],[0],['3'],[3,3],[Infinity]])rejectPreserved(row=>row.valueSource.sourceRows=sources);
 rejectPreserved((row,s)=>row.valueSource.file.id=s.file.id); // Same id, conflicting recorded file metadata.
 rejectPreserved(row=>row.sourceRows=[3]);
 rejectPreserved(row=>row.preserve=false);
 rejectPreserved(row=>row.valueStatus='CURRENT_FILE');
 rejectPreserved(row=>row.valueStatus='NEVER_REPORTED');
});
test('same original import/file cannot claim inconsistent provenance or reuse one physical row for two keys',()=>{
 const f=closureV2Fixture(),s=f.data.reports[0].snapshot,b=s.rows[1];
 Object.assign(b,{coverage:'PRESENT',realized:5,preserve:false,valueStatus:'CURRENT_FILE',sourceRows:[4],valueSource:{...structuredClone(s.rows[0].valueSource),sourceRows:[4]}});
 assert.equal(result(f).status,'CONFIRMED');
 b.valueSource.file.name='mislabelled.xlsx';assert.equal(result(f).status,'INCOMPATIBLE_CLOSE');
 b.valueSource.file.name=s.file.name;b.sourceRows=[2];b.valueSource.sourceRows=[2];assert.equal(result(f).status,'INCOMPATIBLE_CLOSE');
});
