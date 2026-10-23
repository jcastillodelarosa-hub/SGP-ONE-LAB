import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCsv,auditInventory,inspectPdf} from '../scripts/opt-week44-batch.mjs';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
test('CSV soporta comas, comillas y CRLF',()=>{
 assert.deepEqual(parseCsv('opt,nota\r\nA,"uno, dos"\r\nB,"texto ""literal"""\r\n'),
 [['opt','nota'],['A','uno, dos'],['B','texto "literal"']]);
});
test('inventario detecta faltantes, extras y duplicados',()=>{
 const result=auditInventory('opt\nA\nB\n','opt\nA\nA\nC\n');
 assert.deepEqual(result,{expected:2,found:2,missing:['B'],unexpected:['C'],duplicates:['A']});
});
test('PDF identificado no queda aprobado sin auditoría física',()=>{
 const dir=mkdtempSync(join(tmpdir(),'sgp-opt-'));
 try {const file=join(dir,'OPT2026-44-5-PLI-132.pdf');writeFileSync(file,'%PDF-1.7\nprueba');
 const r=inspectPdf(file);
 assert.equal(r.opt,'OPT2026-44-5-PLI-132');
 assert.equal(r.pdfHeader,true);
 assert.equal(r.status,'PENDIENTE_AUDITORIA_FISICA');
 assert.equal(r.sha256.length,64);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
