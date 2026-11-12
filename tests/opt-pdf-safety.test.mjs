import test from 'node:test';
import assert from 'node:assert/strict';
import {validatedPdfBytes} from '../opt-digital/pdf-safe-view.js';
const file=(content,type='application/pdf')=>new Blob([content],{type});
test('PDF accepts signature and EOF only with compatible MIME; parser still required',async()=>{
 const text='%PDF-1.7\nsynthetic\n%%EOF\n';
 for(const type of ['application/pdf','application/octet-stream',''])assert((await validatedPdfBytes(file(text,type))).length>0);
 for(const type of ['text/html','image/svg+xml','application/xhtml+xml'])await assert.rejects(validatedPdfBytes(file(text,type)),/Tipo/);
});
test('HTML prefixes, spoofed MIME, appended active content and absent EOF fail closed',async()=>{
 for(const text of ['<html>PDF</html>','<script>1</script>%PDF-1.7\n%%EOF','%PDF-1.7\n%%EOF\n<script>1</script>','%PDF-1.7\ntruncated'])await assert.rejects(validatedPdfBytes(file(text)),/Contenido/);
});
test('oversize documents rejected before allocation',async()=>{
 await assert.rejects(validatedPdfBytes({size:31*1024*1024,arrayBuffer:()=>{throw Error('should not read');}}),/30 MB/);
});
