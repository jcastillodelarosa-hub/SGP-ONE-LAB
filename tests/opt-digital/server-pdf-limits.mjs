// Boundary/control-flow tests supplement, never replace the real-engine smoke.
import assert from 'node:assert/strict';
import {createOptPdfReader} from '../../src/server/opt-pdf-reader.js';
const bytes=new TextEncoder().encode('%PDF-fixture');
let destroyed=0,cleaned=0;
const OPS={constructPath:1};
const page=(overrides={})=>({rotate:0,getViewport:()=>({width:300,height:200}),streamTextContent:()=>new ReadableStream({start(c){c.enqueue({items:[]});c.close();}}),getOperatorList:async()=>({fnArray:[],argsArray:[]}),cleanup(){cleaned++;},...overrides});
const engine=(pages,count=pages.length)=>({version:'4.10.38',OPS,getDocument(options){assert.equal(options.isEvalSupported,false);assert.equal(options.useWorkerFetch,false);assert.equal(options.useSystemFonts,false);return {promise:Promise.resolve({numPages:count,getPage:async i=>pages[i-1]}),destroy:async()=>{destroyed++;}};}});
await assert.rejects(createOptPdfReader(engine([],101))(bytes),error=>error.code==='OPT_PDF_PAGE_LIMIT'&&error.status===422);
await assert.rejects(createOptPdfReader(engine([page(),page({getOperatorList:async()=>{throw Error('broken second page');}})]))(bytes),/broken second page/);
await assert.rejects(createOptPdfReader(engine([page({streamTextContent:()=>new ReadableStream({start(c){c.enqueue({items:[{str:'x'.repeat(1000001)}]});c.close();}})})]))(bytes),/TEXT_LIMIT/);
await assert.rejects(createOptPdfReader(engine([page({getOperatorList:async()=>({fnArray:new Array(50001),argsArray:[]})})]))(bytes),/OPERATOR_LIMIT/);
await assert.rejects(createOptPdfReader(engine([page({getOperatorList:async()=>({fnArray:[1],argsArray:[[[1],new Array(100001)]]})})]))(bytes),/PATH_LIMIT/);
await assert.rejects(createOptPdfReader(engine([page({rotate:90})]))(bytes),/PAGE_UNSUPPORTED/);
await assert.rejects(createOptPdfReader(engine([]))(new Uint8Array(1024*1024+1)),/BYTES_INVALID/);
assert.equal(destroyed,6);assert.equal(cleaned,6);
console.log('PASS: page, bytes, streamed text, operator/path budgets and no partial result; cleanup on every failure.');

const before=destroyed,cleanedBefore=cleaned;await createOptPdfReader(engine(Array.from({length:100},()=>page())))(bytes);assert.equal(destroyed,before+1);assert.equal(cleaned,cleanedBefore+100);
console.log('PASS: all 100 pages consumed; 101 rejected in full.');
