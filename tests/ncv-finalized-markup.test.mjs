import test from 'node:test';import assert from 'node:assert/strict';
import {ncFinalizedMarkup,compactSummaryMarkup} from '../src/modules/lp01-affectation-summary.js';
test('green source notice is explicit, escaped and does not alter affected quantities',()=>{
 const summary={categories:{NC_V:1},ncEstimate:1,hasReports:true,aluminumCoverage:'COMPLETE',total:null};
 const before=compactSummaryMarkup(summary);const notice=ncFinalizedMarkup([{reference:'12922461<script>'}]);
 assert.match(notice,/NCV finalizada/);assert.match(notice,/lp-ncv-finalized/);assert.match(notice,/No confirma recepción física/);assert.doesNotMatch(notice,/<script>/);
 assert.equal(compactSummaryMarkup(summary),before);assert.equal(ncFinalizedMarkup([]),'');
});

import vm from 'node:vm';import {readFileSync} from 'node:fs';
test('shared detail shows source closure while leaving unsolved and unconfirmed quantities unchanged',()=>{
 const source=readFileSync(new URL('../src/modules/lp01-shared-affectations-panel.js',import.meta.url),'utf8');
 const start=source.indexOf(' function list(){'),end=source.indexOf('\n function show(',start);
 const box={innerHTML:''},history={innerHTML:'',insertAdjacentHTML:()=>{}};
 const report={id:'r1',cause:'NC_V',quantity:1,solved:0,confirmed:0,nc_reference:'12922461',sourceNotice:{reference:'12922461',state:'CERRADA'},observation:'proveedor',origin_stage:'ENSAMBLE'};
 const context=vm.createContext({editor:{state:{snapshot:{reports:[report],history:[]}}},host:{querySelector:s=>s==='[data-shared-list]'?box:history},legacyRows:()=>[],native:null,fixedCause:'NC_V',labels:{NC_V:'NC Vidrio'},ncFinalizedMarkup,esc:v=>String(v??'')});
 vm.runInContext(source.slice(start,end)+';list();',context);
 assert.match(box.innerHTML,/NCV finalizada/);assert.match(box.innerHTML,/Estado fuente: CERRADA/);assert.doesNotMatch(box.innerHTML,/Sin dato confirmado/);
 assert.match(box.innerHTML,/0 solucionadas · 0 confirmadas físicamente/);assert.match(box.innerHTML,/Número informado · por verificar/);
 assert.equal(report.confirmed,0);assert.equal(report.solved,0);
});
