import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {closureExportRealizedV4,closureExportRealizedV2,currentClosureExportRealized} from '../src/domain/lp01-closure-export-v2.js';
import {assemblyReports,assemblyReportMarkup,assemblyReportCSV,renderAssemblyReports} from '../src/modules/lp01-assembly-reports.js';
const fixture=()=>JSON.parse(readFileSync(new URL('fixtures/lp01-closure-plan-v4-synthetic.json',import.meta.url)));
const source=f=>f.readback.reports.find(r=>r.version===f.readback.turn.revision).snapshot;
const project=f=>closureExportRealizedV4(f.readback,f.context);
const reject=mutate=>{const f=fixture();mutate(source(f),f);assert.equal(project(f).status,'INCOMPATIBLE_CLOSE');assert.deepEqual(currentClosureExportRealized(f.readback,f.context).rows,[]);};

test('synthetic SQL readback V4 retains exact plan, absent unknown and initial-reference containment',()=>{
 const f=fixture(),before=structuredClone(f),r=project(f);
 assert.equal(f.provenance,'SYNTHETIC_SQL_V4_NOT_PRODUCTION');assert.equal(r.status,'CONFIRMED');assert.equal(r.contract,'LP-REALIZADO-CIERRE-4');
 assert.deepEqual(r.rows.map(x=>[x.key,x.plan,x.quantity,x.difference,x.pendingAgainstPlan]),[['OPEN|PANELES_2',5,5,0,0],['OTHER|PANELES_2',2,null,null,null],['PLAN|PANELES_2',10,7,-3,3]]);
 assert.equal(r.planSnapshot.changes.at(-1).operation,'INCORPORAR');assert.equal(r.planSnapshot.baseline.historyBefore,'UNKNOWN');
 assert.equal(r.comparisonComplete,false);assert.equal(r.operationalReady,false);assert.equal(r.canContinue,false);assert.equal(r.initialReference.cut,null);
 assert.deepEqual(currentClosureExportRealized(f.readback,f.context),r);assert.deepEqual(f,before);
});
test('strict V3 is not silently upgraded; V4 requires every explicit discriminator and initial-reference boundary',()=>{
 const f=fixture();assert.equal(closureExportRealizedV2(f.readback,f.context).status,'INCOMPATIBLE_CLOSE');
 for(const field of ['planSnapshot','planComparison','comparisonComplete','operationalReady','initialReference'])reject(s=>delete s[field]);
 for(const mutate of [s=>s.contract='LP-EXPORT-CLOSE-5',s=>s.operationalReady=true,s=>s.canContinue=true,s=>s.initialReference.cut='invented',s=>s.initialReference.includedClosureVersions=[],s=>s.initialReference.status='READY'])reject(mutate);
});
test('historical plan must be structurally complete and exactly match every production comparison',()=>{
 for(const mutate of [s=>s.planSnapshot.date='2026-11-08',s=>s.planSnapshot.targets[0].quantity++,s=>s.planSnapshot.changes[1].motive='',s=>s.planSnapshot.historyComplete=true,s=>s.rows[0].plan++,s=>s.rows[0].difference=1,s=>s.rows[0].pendingAgainstPlan=1,s=>s.comparisonComplete=true,s=>s.rows=s.rows.filter(r=>r.key!=='PLAN|PANELES_2')])reject(mutate);
});
test('unchanged Export provenance is still enforced independently of the plan',()=>{
 for(const mutate of [s=>s.rows[0].valueSource.file.sha256='0'.repeat(64),s=>s.rows[0].sourceRows=[],s=>s.rows[0].valueSource.importVersion=99,s=>s.rows[1].realized=0,s=>s.rows[0].budget.available=1,s=>s.rows[0].continuity.quantity=0])reject(mutate);
});
test('absence and pending against plan require reasons, but overachievement does not add a new obligation',()=>{
 reject(s=>{const r=s.rows.find(r=>r.key==='PLAN|PANELES_2');r.reason=null;delete s.reasons[r.key];});
 reject(s=>{const r=s.rows.find(r=>r.key==='OTHER|PANELES_2');r.reason=null;delete s.reasons[r.key];});
 const f=fixture(),s=source(f),r=s.rows.find(r=>r.key==='PLAN|PANELES_2');Object.assign(r,{realized:11,difference:1,pendingAgainstPlan:0,reason:null});delete s.reasons[r.key];assert.equal(project(f).status,'CONFIRMED');
});
test('reopened turn has no current quantity, archive uses the captured plan rather than current catalog',()=>{
 const f=fixture();f.readback.turn.estado='EN_REVISION';f.readback.catalog={productions:[]};assert.equal(project(f).status,'NO_CONFIRMED_CLOSE');
 const r=assemblyReports(f.readback,f.context).reports[0];assert.equal(r.valid,true);assert.equal(r.current,false);assert.match(r.state,/Histórico/);assert.equal(r.rows.find(x=>x.key==='PLAN|PANELES_2').plan,10);
});
test('B15 and CSV expose plan, reason/time and incomplete coverage without claiming operational activation',()=>{
 const f=fixture(),r=assemblyReports(f.readback,f.context).reports[0],html=assemblyReportMarkup(r),csv=assemblyReportCSV(r);
 assert.equal(r.sourceContract,'LP-EXPORT-CLOSE-4');assert.equal(r.totals.plan,17);assert.equal(r.totals.realized,null);assert.equal(r.totals.compliance,null);
 assert.equal(r.rows.find(x=>x.key==='PLAN|PANELES_2').compliance,null);assert.match(html,/Disponible coordinador/);assert.match(html,/excluidas del porcentaje/);assert.match(html,/Por validar/);
 assert.match(csv,/Diferencia vs plan/);assert.match(csv,/EXPORT_CUT_REFERENCE_REQUIRED/);assert.match(csv,/"-3";"3"/);assert.doesNotMatch(csv,/"'-3"/);
});

test('new plan metadata is escaped and CSV text formulas are not executable',()=>{
 const f=fixture(),s=source(f),attack='<img src=x onerror="bad()">';s.planSnapshot.changes[1].motive=attack;s.rows[0].identity.production=attack;s.observation='=HYPERLINK("https://invalid.example")';
 const r=assemblyReports(f.readback,f.context).reports[0],html=assemblyReportMarkup(r),csv=assemblyReportCSV(r);
 assert.doesNotMatch(html,/<img/);assert.match(html,/&lt;img/);assert.match(csv,/"'=HYPERLINK/);
});

const domModule=process.env.LP_DOM_PACKAGE?await import(process.env.LP_DOM_PACKAGE):null;
test('V4 DOM keeps exact download hooks and disables them on a changed invalid snapshot',{skip:!domModule},()=>{
 const {document}=domModule.parseHTML('<html><body><main></main></body></html>'),host=document.querySelector('main'),f=fixture(),calls=[];
 renderAssemblyReports({host,data:f.readback,context:f.context,onCSV:(id,model)=>calls.push([id,model.sourceContract])});
 assert.match(host.textContent,/Disponible coordinador/);host.querySelector('[data-report]').click();assert.deepEqual(calls,[[source(f).id,'LP-EXPORT-CLOSE-4']]);
 source(f).planSnapshot.targets[0].quantity++;renderAssemblyReports({host,data:f.readback,context:f.context});assert.equal(host.querySelectorAll('button').length,0);assert.match(host.textContent,/No se puede validar/);
});
