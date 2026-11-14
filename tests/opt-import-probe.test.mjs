import test from 'node:test';
import assert from 'node:assert/strict';
import {DOMParser} from '@xmldom/xmldom';
import {createOptImportProbe} from '../src/server/opt-import-probe.js';
import {extractCoordinatePlans} from '../opt-digital/geometric-extraction.js';
import {body,binding,base64,pages} from './opt-digital/import-fixtures.mjs';
const secret='a'.repeat(64);
function input(){const request=body();request.index.base64=base64(new TextEncoder().encode('OPT,Reserva,Sistema,Proyecto,Acabado\nOPT-SYNTH,9000001,SYNTH-SYS,123456 - Synthetic,FINISH\n'));return {request,context:{contract:'OPT-IMPORT-CONTEXT-RETAIL-3',revision:'a'.repeat(32),scope:request.scope,opt:'OPT-SYNTH',selectores:[{documentProduction:'123456',produccion:'123456 - Synthetic',reserva:'9000001',sistema:'SYNTH-SYS'}],referencias:['R1'],profileDestinations:[{referencia:'R1',tipo_pieza:'PANEL',destino_productivo:'PANEL',activa:'SI'}],bindings:[{...binding,documentLabel:'123456 - Synthetic',sgpProductionId:'700000',reserva:'9000001',reserva_principal:'9000001',programacion_reserva:'9000001',reserva_snapshot:'9000001'}]}};}
const request=(data,key=secret)=>new Request('https://offline.invalid',{method:'POST',headers:{'x-opt-probe-secret':key},body:JSON.stringify(data)});
test('probe requires independent secret before parsing, limits input, and never returns identities',async()=>{
 let reads=0;const probe=createOptImportProbe({secret,DOMParser,readPdf:async()=>{reads++;return extractCoordinatePlans(pages());}});
 assert.equal((await probe(request(input(),'wrong'))).status,403);assert.equal(reads,0);
 assert.equal((await probe(request({unexpected:true}))).status,400);
 assert.equal((await probe(request('x'.repeat(16*1024*1024)))).status,413);
 const out=await (await probe(request(input()))).json();assert.equal(out.outcome,'VALIDATED_STOPPED_BEFORE_WRITE');assert.equal(out.writes,0);assert.equal(out.boundary.pieces,4);
 assert(!JSON.stringify(out).includes('9000001'));assert(!JSON.stringify(out).includes('700000'));assert(!JSON.stringify(out).includes('OUTCOME_UNKNOWN'));
});
test('probe distinguishes compatible warnings from failed reconciliation without persistence',async()=>{
 for(const [total,accepted] of [['40 3/32',true],['39',false]]){
 const source=pages();const summary=source[1].items.find(i=>i.str.startsWith('Longitud de los cortes:'));summary.str=summary.str.replace('40 1/8',total);
 const probe=createOptImportProbe({secret,DOMParser,readPdf:async()=>extractCoordinatePlans(source)});
 const out=await (await probe(request(input()))).json();assert.equal(out.writes,0);assert.equal(out.outcome,accepted?'VALIDATED_STOPPED_BEFORE_WRITE':'VALIDATION_BLOCKED');
 if(accepted)assert.deepEqual(out.boundary.warningCodes,['OPT_PRINTED_ROUNDING_COMPATIBLE']);else assert.equal(out.boundary,null);
 }
});
