import {performance} from 'node:perf_hooks';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {operationOrders} from '../../src/domain/lp01-operation-orders.js';
import {operationOrderList} from '../../src/modules/lp01-operation-orders.js';
import {enrichOperationEvidence} from '../../src/services/lp01-operation-evidence.js';
const output=[];
for(const count of [50,200,500]){
 const data={contract:'LP-OPERACION-1',orders:Array.from({length:count*2},(_,i)=>({key:'QA'+Math.floor(i/2),parte:'P'+i,produccion:'QA '+Math.floor(i/2),linea:'L',etapa:'ENSAMBLE',fecha:'2026-11-05',turno:1,prioridad:i,sale:10,ejecutado:0,programada:20,total_etapa_parte:0,afectaciones:{},oficial:{id_linea:'L',semana_base:42,anio:2026,sistema:'ES7100'},individualEvidence:{status:'UNAVAILABLE',active:false}}))};
 const samples=[];let html;
 for(let n=0;n<20;n++){const start=performance.now();html=operationOrderList(operationOrders(data),'ENSAMBLE');samples.push(performance.now()-start);}
 samples.sort((a,b)=>a-b);assert.equal(operationOrders(data).length,count);assert.ok(samples.at(-1)<1000);
 let active=0,maxActive=0,calls=0;const began=performance.now();
 const job=enrichOperationEvidence(data,async(_,args)=>{active++;maxActive=Math.max(maxActive,active);calls++;await new Promise(r=>setTimeout(r,100));active--;return {contract:'LP-AFFECTATIONS-2',key:args.p_key,stage:'ENSAMBLE',reports:[],pickingPending:{status:'AVAILABLE',rows:[]}};});
 // Rendering the conservative list does not await the optional evidence reads.
 const firstListReadyMs=performance.now()-began;assert.ok(firstListReadyMs<100);
 await job;assert.equal(calls,count);assert.equal(maxActive,3);
 const r={orders:count,assignments:count*2,renderP50Ms:+samples[10].toFixed(2),renderP95Ms:+samples[19].toFixed(2),htmlBytes:Buffer.byteLength(html),backgroundReads:calls,maxConcurrent:maxActive,simulatedRpcLatencyMs:100,backgroundElapsedMs:+(performance.now()-began).toFixed(2),firstListNotAwaitingEvidenceMs:+firstListReadyMs.toFixed(2)};output.push(r);console.log(JSON.stringify(r));
}
writeFileSync(new URL('./performance-result.json',import.meta.url),JSON.stringify({environment:'Node local synthetic data; 100ms simulated transport, NOT production RPC latency',scenarios:output},null,2)+'\n');
