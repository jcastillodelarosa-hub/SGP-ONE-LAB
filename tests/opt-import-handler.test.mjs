import test from 'node:test';
import assert from 'node:assert/strict';
import * as pdfjs from 'pdfjs-dist/build/pdf.mjs';
import {DOMParser} from '@xmldom/xmldom';
import {createOptImportHandler,OPT_IMPORT_LIMITS} from '../src/server/opt-import-handler.js';
import {createOptPdfReader} from '../src/server/opt-pdf-reader.js';
import {body,binding,base64,fullPdf} from './opt-digital/import-fixtures.mjs';
const origin='https://sgp-one-lab.web.app',readPdf=createOptPdfReader(pdfjs);
const request=(b=body(),options={})=>new Request('https://example.invalid/functions/v1/opt-import',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(b),...options});
function setup(overrides={}){
 const calls=[],writes=[];let reads=0;
 const rpc=async(name,args)=>{calls.push(name);if(overrides[name])return overrides[name](args);
  if(name==='sgp_sesion_actual')return {data:{valida:true,rol:'LIDER MECANIZADO'}};
  if(name==='sgp_mis_accesos')return {data:[{ventana:'mecanizado.proceso'}]};
  if(name==='sgp_opt_import_contexto_v1')return {data:{contract:'OPT-IMPORT-CONTEXT-1',scope:args.p_scope,revision:'a'.repeat(32),bindings:[structuredClone(binding)]}};
  if(name==='sgp_opt_importar_validado_v1'){writes.push(args);return {data:{contract_version:2,id_documento:'11111111-1111-4111-8111-111111111111',duplicado:false,cantidad_piezas:args.p_manifest.length,sin_asignacion:args.p_manifest.filter(p=>p.asignacion===null).length,import_contract:'OPT-IMPORT-1',ok:true,physical_completion_verified:false}};}
  throw Error('Unexpected RPC');};
 return {calls,writes,reads:()=>reads,handler:createOptImportHandler({rpc,readPdf:async bytes=>{reads++;return overrides.readPdf?overrides.readPdf(bytes):readPdf(bytes);},DOMParser,allowedOrigins:[origin]})};
}
test('original complete PDF and CSV pass real parser+core, only private RPC writes exact pending units',async()=>{
 const s=setup(),res=await s.handler(request()),out=await res.json();assert.equal(res.status,200,JSON.stringify(out));assert.equal(out.contract,'OPT-IMPORT-1');assert.equal(out.data.cantidad_piezas,4);assert.equal(out.physical_completion_verified,false);assert.equal(out.totals.cutLength32,1284);
 assert.deepEqual(s.calls,['sgp_sesion_actual','sgp_mis_accesos','sgp_opt_import_contexto_v1','sgp_opt_importar_validado_v1']);
 const w=s.writes[0];assert.equal(w.p_pdf,'\\x'+Buffer.from(fullPdf()).toString('hex'));assert(w.p_manifest.every(p=>p.longitud_mm===254.79375));assert(w.p_manifest.every(p=>!Object.hasOwn(p,'estado')));assert.equal(w.p_sources[0].source_key,'OPT:OPT-SYNTH');assert.equal(w.p_evidence.sgp_binding.revision,'a'.repeat(32));assert.match(w.p_evidence.original_index.sha256,/^[a-f0-9]{64}$/);
});
test('individual derives canonical OPT and documentary production JOIN, not filename or generic manual approval',async()=>{
 const s=setup(),b=body();b.source={mode:'INDIVIDUAL',origin:'DESCONOCIDO',opt:'arbitrary-upload-name'};delete b.index;
 const res=await s.handler(request(b)),out=await res.json();assert.equal(res.status,200,JSON.stringify(out));assert.equal(out.document.opt,'OPT-SYNTH');assert.equal(out.document.source_key,'SHA256:'+out.document.sha256);assert.equal(s.writes.length,1);
});
test('individual preserves competing SGP reservation/program candidates and fails without writing',async()=>{
 const s=setup({sgp_opt_import_contexto_v1:async args=>({data:{contract:'OPT-IMPORT-CONTEXT-1',scope:args.p_scope,revision:'b'.repeat(32),bindings:[binding,{...binding,id_programacion:'22222222-2222-4222-8222-222222222222'}]}})}),b=body();b.source.mode='INDIVIDUAL';delete b.index;
 const res=await s.handler(request(b)),out=await res.json();assert.equal(res.status,422);assert.equal(out.definitive,true);assert(out.blockers.some(b=>b.code==='SGP_BINDING_AMBIGUOUS'));assert.equal(s.writes.length,0);
});
test('individual missing production relation produces concrete blockers',async()=>{
 const s=setup({sgp_opt_import_contexto_v1:async args=>({data:{contract:'OPT-IMPORT-CONTEXT-1',scope:args.p_scope,revision:'b'.repeat(32),bindings:[]}})}),b=body();b.source.mode='INDIVIDUAL';delete b.index;
 const out=await(await s.handler(request(b))).json();assert.equal(out.ok,false);assert(out.blockers.some(b=>b.code==='SGP_BINDING_MISSING'));assert.equal(s.writes.length,0);
});
test('client extraction/evidence/manifest, sourceKey and nested extras are rejected before parsing',async()=>{
 for(const change of [b=>b.extraction={},b=>b.bindings=[],b=>b.evidence={},b=>b.plans=[],b=>b.source.sourceKey='RETAIL',b=>b.pdf.sha256='a'.repeat(64),b=>b.scope.approved=true]){const s=setup(),b=body();change(b);assert.equal((await s.handler(request(b))).status,422);assert.equal(s.reads(),0);assert.equal(s.calls.length,0);}
});
test('SGP session, real role and exact access are required before parsing',async()=>{
 for(const overrides of [ {sgp_sesion_actual:async()=>({data:{valida:false}})}, {sgp_sesion_actual:async()=>({data:{valida:true,rol:'RECEPCION'}})}, {sgp_sesion_actual:async()=>({data:{valida:true,rol:'LIDER'}})}, {sgp_sesion_actual:async()=>({data:{valida:true,rol:'LIDER LINEA'}})}, {sgp_mis_accesos:async()=>({data:[{ventana:'mecanizado.recepcion'}]})} ]){const s=setup(overrides),response=await s.handler(request());assert([401,403].includes(response.status));assert.equal(s.reads(),0);assert.equal(s.writes.length,0);}
});
test('CORS, content type, HTTP and request bounds fail before reading original bytes',async()=>{
 for(const options of [{headers:{origin:'https://hostile.invalid','content-type':'application/json'}},{headers:{origin,'content-type':'text/plain'}},{headers:{origin,'content-type':'application/json','content-length':String(OPT_IMPORT_LIMITS.requestBytes+1)}}]){const s=setup(),res=await s.handler(request(body(),options));assert([403,413,415].includes(res.status));assert.equal(s.calls.length,0);}
 const s=setup();assert.equal((await s.handler(new Request('https://example.invalid',{method:'OPTIONS',headers:{origin}}))).status,204);assert.equal((await s.handler(new Request('https://example.invalid'))).status,405);
});
test('noncanonical base64, missing index and unrelated PDF title cannot write',async()=>{
 for(const change of [b=>b.pdf.base64='AAAA===',b=>b.pdf.name='x.html',b=>delete b.index,b=>b.source.opt='UNRELATED',b=>b.index.base64=base64(new TextEncoder().encode('OPT,Reserva,Sistema\nOTHER,SYNTH-R,SYNTH-SYS'))]){const s=setup(),b=body();change(b);const res=await s.handler(request(b));assert.equal(res.status,422);assert.equal(s.writes.length,0);}
});
test('one unit/fraction discrepancy blocks the entire document, not a partial import',async()=>{
 const s=setup({readPdf:async bytes=>{const e=await readPdf(bytes);e.sourceProjectRows[0].length='10 1/16"';return e;}}),res=await s.handler(request()),out=await res.json();assert.equal(res.status,422);assert(out.blockers.some(b=>b.code==='FINAL_REFERENCE_LENGTH_QUANTITY_MISMATCH'));assert.equal(s.writes.length,0);
});
test('old original week remains assigned and same bytes produce same source key',async()=>{
 const s=setup(),b=body(),first=await(await s.handler(request(b))).json();b.scope.semana=47;const second=await(await s.handler(request(b))).json();assert.equal(first.document.source_key,second.document.source_key);assert.deepEqual(s.writes[0].p_manifest,s.writes[1].p_manifest);assert.equal(second.scopeTotals.assigned,4);
});
test('SQL P0001 rejection is definitive; lost write response/transport is uncertain, never success',async()=>{
 for(const [invoke,definitive] of [[async()=>({error:{code:'P0001',message:'OPT_CONTEXTO_CAMBIO_REINTENTAR'}}),true],[async()=>{throw Error('network failure');},false],[async()=>({data:{ok:true}}),false],[async()=>({error:{code:'PGRST504'}}),false]]){const s=setup({sgp_opt_importar_validado_v1:invoke}),out=await(await s.handler(request())).json();assert.equal(out.ok,false);assert.equal(out.definitive,definitive);if(!definitive)assert.equal(out.code,'OPT_IMPORT_OUTCOME_UNKNOWN');}
});
test('concurrent request on same isolate returns retryable busy and never overlaps parsing',async()=>{
 let release;const gate=new Promise(r=>release=r),s=setup({readPdf:async bytes=>{await gate;return readPdf(bytes);}});const first=s.handler(request());while(!s.reads())await new Promise(r=>setTimeout(r,0));const second=await s.handler(request());assert.equal(second.status,429);release();assert.equal((await first).status,200);assert.equal(s.reads(),1);
});
test('XLSX and JSON original index formats use shared server parser; unknown sheet never falls back',async()=>{
 const {indexWorkbook}=await import('./opt-digital/import-fixtures.mjs');
 const xlsx=await indexWorkbook();
 for(const index of [{name:'index.xlsx',format:'xlsx',sheet:'ARCHIVOS',base64:base64(xlsx)},{name:'index.json',format:'json',base64:base64(new TextEncoder().encode(JSON.stringify([{OPT:'OPT-SYNTH',Reserva:'SYNTH-R',Sistema:'SYNTH-SYS'}])))}]){
  const s=setup(),b=body();b.index=index;const res=await s.handler(request(b)),out=await res.json();assert.equal(res.status,200,JSON.stringify(out));assert.equal(s.writes.length,1);
 }
 const s=setup(),b=body();b.index={name:'index.xlsx',format:'xlsx',sheet:'Wrong',base64:base64(xlsx)};assert.equal((await s.handler(request(b))).status,422);assert.equal(s.writes.length,0);
});
