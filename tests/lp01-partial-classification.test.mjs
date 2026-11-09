import test from 'node:test';
import assert from 'node:assert/strict';
import {estimatedClassification} from '../src/domain/lp01-estimated-classification.js';
import {assemblyReports,assemblyReportMarkup,assemblyReportCSV} from '../src/modules/lp01-assembly-reports.js';
import {partialClassificationFixture} from './fixtures/lp01-partial-classification.mjs';
const read=(f,p=f.payload)=>estimatedClassification(p,f.context,f.report.id,f.report.snapshot.rows);
test('partial chained estimate preserves original quantities and pending row, with provenance',()=>{
 const f=partialClassificationFixture(),before=JSON.stringify(f),result=read(f);
 assert(result);assert(result.rows[0].closed);assert(!result.rows[0].advanced);assert(!result.rows[0].opened);
 assert(!result.rows[1].classificationKnown);assert.equal(result.rows[1].initialBalance,null);assert.equal(result.rows[1].realized,5);assert.equal(result.rows[1].classificationReason,'NEXT_REFERENCE_MISSING');
 assert.equal(result.rows[0].classificationProvenance.priorMovements[0].quantity,2);assert.equal(JSON.stringify(f),before);
 const model=assemblyReports(f.data,f.context,90,{[f.report.id]:f.payload}).reports[0];
 assert(model.valid);assert.equal(model.totals.closed,1);assert.equal(model.totals.classificationPending,1);assert.equal(model.totals.knownReported,8);
 const html=assemblyReportMarkup(model),csv=assemblyReportCSV(model);
 for(const text of ['Clasificación parcial estimada','1 de 2 órdenes','Al menos 1','morning-synthetic.xlsx','next-synthetic.xlsx','Falta en el Export de contraste','no acredita producción cero'])assert(html.includes(text),text);
 for(const text of ['CHAINED_CLOSURES_RECONCILED','next-synthetic.xlsx','NEXT_REFERENCE_MISSING','prior-synthetic'])assert(csv.includes(text),text);
});
test('chain rejects corrupted balance, provenance, key, scope and unsafe aggregate',()=>{
 const f=partialClassificationFixture();
 for(const change of [p=>p.rows[0].baseBalance++,p=>p.rows[0].verificationBalance++,p=>p.rows[0].realized++,p=>p.rows[0].priorMovements[0].closureId='unlinked',p=>p.priorClosures[0].context.shift=2,p=>p.priorClosures[0].snapshotHash='bad',p=>p.rows[0].referenceRowId=null,p=>p.verificationSource.at='bad',p=>p.rows[1].initialBalance=0,p=>p.rows[1].reason='',p=>p.rows[1].key=p.rows[0].key,p=>p.rows.pop(),p=>p.rows[0].status='EXACT',p=>p.historyComplete=true,p=>p.exactCut=true,p=>p.context.stage='EMPAQUE',p=>p.rows[0].priorMovements.push({...p.rows[0].priorMovements[0]}),p=>p.rows[0].priorMovements[0].quantity=Number.MAX_SAFE_INTEGER+1]){
  const p=structuredClone(f.payload);change(p);assert.equal(read(f,p),null);
 }
});
test('no prior record stays a retrospective comparison, not a zero production claim',()=>{
 const f=partialClassificationFixture();f.payload.rows[0].baseBalance=3;f.payload.rows[0].priorMovements=[];
 const result=read(f);assert(result);assert.deepEqual(result.rows[0].classificationProvenance.priorMovements,[]);
 f.payload.rows[0]={...f.payload.rows[1],key:f.payload.rows[0].key,realized:3};assert.equal(read(f),null);
});
test('untrusted source names are escaped and frozen evidence takes precedence',()=>{
 const f=partialClassificationFixture();f.payload.source.file='<script>alert(1)</script>';
 const model=assemblyReports(f.data,f.context,90,{[f.report.id]:f.payload}).reports[0];assert(!assemblyReportMarkup(model).includes('<script>'));
 f.report.snapshot.reportEvidence={classification:{status:'UNAVAILABLE'}};
 const unavailable=assemblyReports(f.data,f.context,90,{[f.report.id]:f.payload}).reports[0];assert.equal(unavailable.totals.classificationPending,2);
});
