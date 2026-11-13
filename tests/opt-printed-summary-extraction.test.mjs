import test from 'node:test';
import assert from 'node:assert/strict';
import {extractCoordinatePlans} from '../opt-digital/geometric-extraction.js';
const item=(str,x,y)=>({str,width:0,transform:[1,0,0,1,x,y]});
const page=(items,n=1)=>({page:n,width:850,height:600,items});
const heading=item('ES-TEST-001 FINISH',300,540);
const totals=item('Longitud de los cortes: 20", Longitud de los perfiles usados: 30", Length of reused stubs: 5", Longitud del desperdicio: 5"',16,500);
const printed='Yield: 66.67%, Reused: 16.67%, Waste: 16.66% Número de items cortados: 2, Número de perfiles usados: 1, Número planos de corte: 1';
test('preserves printed profile counts and percentage independently of lengths and patterns',()=>{
 const out=extractCoordinatePlans([page([heading,totals,item(printed,16,486)])]);
 assert.equal(out.plans.length,0);const s=out.sourceProfileSummaries[0];
 assert.deepEqual([s.pieces,s.bars,s.plans],[2,1,1]);assert.equal(s.scrapPercentagePrinted,'16.66%');
 assert.equal(s.wasteLength,'5"');assert.equal(s.countsPage,1);assert.equal(s.countsSourceText,printed);
});
test('does not infer counts or attach unbound, displaced, malformed or other-profile lines',()=>{
 const variants=[[],[item(printed,16,450)],[item('Other text',16,493),item(printed,16,486)],[item('ES-TEST-002 OTHER',300,493),item(printed,16,486)],[item(printed.replace('16.66%','101%'),16,486)],[item(printed.replace('cortados: 2','cortados: unknown'),16,486)]];
 for(const tail of variants){const s=extractCoordinatePlans([page([heading,totals,...tail])]).sourceProfileSummaries[0];assert.deepEqual([s.pieces,s.bars,s.plans,s.scrapPercentagePrinted,s.countsPage],[null,null,null,null,null]);}
 const s=extractCoordinatePlans([page([heading,totals]),page([item(printed,16,486)],2)]).sourceProfileSummaries[0];assert.equal(s.countsPage,null);
});
test('material requirement location and observation preserve printed text and empty cells',()=>{
 const centers=[20,100,220,340,420,490,600,730];
 const header=['Item','Referencia','CODE','Longitud','Qty','UBICACION','CODIGO','OBSERVACION'].map((v,i)=>item(v,centers[i],500));
 const row=(values,y)=>values.map((v,i)=>item(v,centers[i],y));
 const out=extractCoordinatePlans([page([...header,...row(['1','ES-TEST-001','FINISH','30"','4','01130','000123','RES-001-A'],480),...row(['2','ES-TEST-002','FINISH','20"','1','','000456',''],460)])]);
 assert.deepEqual(out.sourceMaterialRows.map(r=>[r.location,r.code,r.observation]),[['01130','000123','RES-001-A'],['','000456','']]);
});
test('page-split printed summary requires adjacent pages, same document and no intervening content',()=>{
 const title='OPT-TEST_SITE';
 const first=page([item('Nombre del proyecto: '+title,16,550),heading,{...totals,transform:[1,0,0,1,16,30]},item('(c) 2022 Footer',16,20)]);
 const second=page([item('Optimizador de corte - '+title,16,580),item(printed,16,540)],2);
 const s=extractCoordinatePlans([first,second]).sourceProfileSummaries[0];
 assert.equal(s.page,1);assert.equal(s.countsPage,2);assert.equal(s.bars,1);
 for(const variant of [page([item('Optimizador de corte - OTHER',16,580),item(printed,16,540)],2),page([...second.items,item('unexpected content',16,560)],2),page(second.items,3),{...second,width:900}]){
  assert.equal(extractCoordinatePlans([first,variant]).sourceProfileSummaries[0].countsPage,null);
 }
});
