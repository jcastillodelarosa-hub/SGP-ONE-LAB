import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assertReaderReadback} from './lp01-export-close-v2/reader.mjs';
import {currentClosureExportRealized} from '../src/domain/lp01-closure-export-v2.js';
import {assemblyReports} from '../src/modules/lp01-assembly-reports.js';
const read=async name=>JSON.parse(await readFile(new URL('./fixtures/'+name,import.meta.url),'utf8'));

test('actual SQL partial-import readback reaches reader3, B15 and CSV with original row provenance',async()=>{
 const {context,readback}=await read('lp01-export-partial-v3-sql-readback.json');await assertReaderReadback(readback,context);
});
test('actual SQL corrected readback keeps zero, older source files and all three immutable closes',async()=>{
 const {context,readback}=await read('lp01-export-partial-v3-corrected-readback.json');await assertReaderReadback(readback,context,{corrected:true});
});
test('superseded contract2 readback is explicitly incompatible, not silently migrated or exported',async()=>{
 const {context,readback}=await read('lp01-export-close-v2-sql-readback.json');assert.equal(currentClosureExportRealized(readback,context).status,'INCOMPATIBLE_CLOSE');assert(assemblyReports(readback,context).reports.every(report=>!report.valid));
});
