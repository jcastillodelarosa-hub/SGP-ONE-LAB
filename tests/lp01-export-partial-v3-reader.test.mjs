import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {currentClosureExportRealized} from '../src/domain/lp01-closure-export-v2.js';
import {closureExportRealized} from '../src/domain/lp01-closure-export.js';
for(const [fixture,expected] of [['lp01-export-partial-v3-sql-readback.json',[3,5,null]],['lp01-export-partial-v3-corrected-readback.json',[0,2,null]]])test('SQL readback3 retains partial sources: '+fixture,async()=>{
 const {context,readback}=JSON.parse(await readFile(new URL('./fixtures/'+fixture,import.meta.url),'utf8'));
 const projected=currentClosureExportRealized(readback,context),byKey=new Map(projected.rows.map(row=>[row.key,row]));
 assert.equal(projected.status,'CONFIRMED');assert.equal(projected.contract,'LP-REALIZADO-CIERRE-3');
 assert.deepEqual(['PLAN','OPEN','OTHER'].map(name=>byKey.get(name+'|PANELES_2').quantity),expected);
 for(const row of projected.rows){assert.equal(row.plan,null);assert.equal(row.planStatus,'PLAN_SOURCE_REQUIRED');assert.equal(row.budget.available,null);assert.equal(row.continuity.quantity,null);if(row.valueStatus==='PRESERVED'){assert.equal(row.coverage,'ABSENT');assert.notEqual(row.importId,projected.importId);assert.equal(row.fileId,row.valueSource.file.id);}if(row.valueStatus==='NEVER_REPORTED'){assert.equal(row.valueSource,null);assert.equal(row.fileId,null);}}
 assert.equal(closureExportRealized(readback,context).status,'INCOMPATIBLE_CLOSE');
});
