import test from 'node:test';
import assert from 'node:assert/strict';
import {compactSummaryMarkup,summaryMarkup} from '../src/modules/lp01-affectation-summary.js';
const summary=(overrides={})=>({categories:{NC_AL:null,NC_V:3,TECNO:2,NOVEDAD:1},reportedQuantities:{},estimates:[],total:null,aluminumCoverage:'COMPLETE',...overrides});
const aluminum=html=>[...html.matchAll(/<button[^>]*data-summary-cause="NC_AL"[^>]*>(.*?)<\/button>/g)].map(x=>x[1]);
test('saved value wins over multiple proposals and unlinked indicator',()=>{
 const s=summary({categories:{NC_AL:8},estimates:[{quantity:1},{quantity:4}],aluminumNeedsIndicator:true,aluminumReported:true});
 assert.deepEqual(aluminum(compactSummaryMarkup(s)),['8 × NC AL']);
});
test('single proposal is visibly estimated and opens existing aluminum detail',()=>{
 assert.deepEqual(aluminum(compactSummaryMarkup(summary({estimates:[{quantity:4}],aluminumNeedsIndicator:true}))),['4 × NC AL · Estimado ⚠']);
});
test('overlapping reports do not select or sum a quantity or fall back to estimate',()=>{
 assert.deepEqual(aluminum(compactSummaryMarkup(summary({reportedQuantities:{NC_AL:[8,4]},estimates:[{quantity:2}]}))),['NC AL · por validar']);
});
test('pending pieces sum only into an explicitly unvalidated aluminum estimate',()=>{
 assert.deepEqual(aluminum(compactSummaryMarkup(summary({estimates:[{quantity:2},{quantity:3}]}))),['5 × NC AL · Estimado ⚠']);
});
test('explicit zero is not replaced by an estimate',()=>{
 assert.deepEqual(aluminum(compactSummaryMarkup(summary({categories:{NC_AL:0},estimates:[{quantity:3}]}))),[]);
});
test('missing quantity retains a single unresolved indicator, not zero',()=>{
 assert.deepEqual(aluminum(compactSummaryMarkup(summary({aluminumNeedsIndicator:true}))),['NC AL · por validar']);
 assert.deepEqual(aluminum(compactSummaryMarkup(summary())),[]);
});
test('other causes, report groups, glass estimate and validated total preserved',()=>{
 const html=compactSummaryMarkup(summary({reportedQuantities:{TECNO:[2,4]},ncEstimate:1,total:7,available:12}));
 for(const text of ['3 × NC V','2 × Tecno','1 × Novedad','Tecno · reportadas: 2 / 4 (sin sumar)','NC Vidrio · estimación 1 (1 por NC)','Total 7 · Disponibles 12'])assert.ok(html.includes(text),text);
});
test('null/unavailable states and expanded markup retain contract',()=>{
 assert.match(compactSummaryMarkup(null),/Consultando/);
 assert.match(compactSummaryMarkup({status:'UNAVAILABLE'}),/Datos pendientes/);
 assert.match(summaryMarkup(summary({categories:{NC_AL:8},aluminumUnknown:true})),/Aluminio: 8 reportadas · PDT pendiente de validar/);
});

test('equal piece counts are not deduplicated and estimate is not clipped to stage balance',()=>{
 const s=summary({estimates:[{quantity:1},{quantity:1}],stageBalance:1});
 const html=compactSummaryMarkup(s);
 assert.deepEqual(aluminum(html),['2 × NC AL · Estimado ⚠']);
 assert.match(html,/Supera el saldo de 1; ajusta la cantidad antes de confirmar/);
 assert.match(html,/estimadas · por validar; una por pieza pendiente/);
 assert.equal(s.categories.NC_AL,null);assert.equal(s.total,null);
});
test('unsafe estimate is not rendered as a usable count',()=>{
 assert.deepEqual(aluminum(compactSummaryMarkup(summary({estimates:[{quantity:Number.MAX_SAFE_INTEGER},{quantity:1}]}))),['NC AL · por validar']);
});
