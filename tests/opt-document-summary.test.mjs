import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildOptDocumentSummary,validOptDocumentSummary} from '../src/domain/opt-document-summary.js';
import {createOptDocumentSummary} from '../src/services/opt-document-summary.js';
const summary=buildOptDocumentSummary({sourceProfileSummaries:[{ref:'SYNTHETIC',finish:'TEST',page:2,cutLength:'8"',stockLength:'10"',reusedLength:'2"',wasteLength:'0"'}],sourceMaterialRows:[{ref:'SYNTHETIC',finish:'TEST',length:'10"',quantity:1,code:'',page:3}]});
const group={reservation:'SYNTHETIC',system:'TEST',scope:{linea:'PANELES_2',anio:2099,semana:1,modo:'BASE'},references:[{id_documento:'11111111-1111-4111-8111-111111111111',sha256:'a'.repeat(64),fuentes:[{consecutivo:'OPT2099-1-TEST'}]}]};
const response=()=>({data:{contract:'OPT-DOCUMENT-SUMMARIES-1',scope:group.scope,reservation:group.reservation,system:group.system,documents:[{id_documento:group.references[0].id_documento,sha256:'a'.repeat(64),opt:'OPT2099-1-TEST',scope:'DOCUMENTO',status:'AVAILABLE',summary}]}});
const service=(fn,opts={})=>createOptDocumentSummary({rpc:fn},()=> 'token',{catalog:{ownsGroup:g=>g===group},...opts});
test('preserves explicit zero scrap and missing printed counts; never operational totals',()=>{assert.equal(summary.cutRows[0].scrapPrinted,'0"');assert.equal(summary.cutRows[0].bars,null);assert.equal(summary.materialRows[0].location,null);assert.ok(validOptDocumentSummary(summary));assert.equal(validOptDocumentSummary({...summary,scope:'RESERVA'}),false);});
test('loads only owned group with exact scope and document identity',async()=>{let args;const result=await service(async(n,a)=>{args=a;return response();}).load(group);assert.equal(args.p_reserva,'SYNTHETIC');assert.equal(result.documents[0].scope,'DOCUMENTO');await assert.rejects(service(async()=>response()).load({...group}),/GRUPO/);});
test('historical unavailable is explicit, no reconstructed data',async()=>{const r=response();Object.assign(r.data.documents[0],{status:'NOT_PERSISTED',summary:null});const result=await service(async()=>r).load(group);assert.deepEqual(result.documents[0].cutRows,[]);assert.equal(result.documents[0].status,'NOT_PERSISTED');});
test('rejects omission, duplication, hash substitution, invented totals and scope attribution',async()=>{for(const change of [r=>r.data.documents=[],r=>r.data.documents.push(r.data.documents[0]),r=>r.data.documents[0].sha256='b'.repeat(64),r=>r.data.documents[0].summary.cutRows[0].bars=1,r=>r.data.documents[0].scope='RESERVA']){const r=structuredClone(response());change(r);await assert.rejects(service(async()=>r).load(group),/CONTRATO/);}});
test('invalidated pending response cannot populate UI',async()=>{let done;const api=service(()=>new Promise(resolve=>done=resolve));const pending=api.load(group);api.invalidate();done(response());await assert.rejects(pending,/OBSOLETO/);});
test('missing documentary table is explicitly partial, never rejected or invented',async()=>{const r=structuredClone(response());r.data.documents[0].summary.materialRows=[];r.data.documents[0].status='PARTIAL';assert.ok(validOptDocumentSummary(r.data.documents[0].summary));assert.equal((await service(async()=>r).load(group)).documents[0].status,'PARTIAL');r.data.documents[0].status='AVAILABLE';await assert.rejects(service(async()=>r).load(group),/CONTRATO/);});
test('printed counts and percentage require page/text provenance, zero is preserved',()=>{const e={sourceProfileSummaries:[{ref:'SYNTHETIC',finish:'TEST',page:2,cutLength:'8"',stockLength:'10"',reusedLength:'2"',wasteLength:'0"',bars:1,pieces:2,plans:1,scrapPercentagePrinted:'0%',countsPage:2,countsSourceText:'Waste 0% Items 2 Bars 1 Plans 1'}],sourceMaterialRows:[]};const s=buildOptDocumentSummary(e);assert.ok(validOptDocumentSummary(s));assert.equal(s.cutRows[0].scrapPercentagePrinted,'0%');s.cutRows[0].countsPage=null;assert.equal(validOptDocumentSummary(s),false);});
test('optional Project data reaches service intact without changing existing summaries',async()=>{
 const {buildOptProjectData}=await import('../src/domain/opt-project-data.js');
 const projectData=buildOptProjectData([{sourceId:'project-p1-item1',page:1,ref:'TEST',finish:'A/ B',length:'10 1/4"',reference:'ORDER FINAL LOCATION',quantity:2}]);
 const r=structuredClone(response());r.data.documents[0].summary.projectData=projectData;
 const d=(await service(async()=>r).load(group)).documents[0];assert.deepEqual(d.projectData,projectData);assert.deepEqual(d.cutRows,summary.cutRows);
 r.data.documents[0].summary.projectData.totalQuantity=99;await assert.rejects(service(async()=>r).load(group),/CONTRATO/);
 assert.equal((await service(async()=>response()).load(group)).documents[0].projectData,null);
});
test('session change rejects pending Project data response',async()=>{
 let token='a',done;const api=createOptDocumentSummary({rpc:()=>new Promise(r=>done=r)},()=>token,{catalog:{ownsGroup:g=>g===group}});
 const pending=api.load(group);token='b';done(response());await assert.rejects(pending,/OBSOLETO/);
});
