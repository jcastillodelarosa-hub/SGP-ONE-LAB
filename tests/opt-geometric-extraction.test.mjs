import test from 'node:test';
import assert from 'node:assert/strict';
import {extractCoordinatePlans,thirtySeconds} from '../opt-digital/geometric-extraction.js';
const x=[25,70,140,205,245,315,380,420,490,555,595,665,730,770,810];
const labels=['#perf','Long.','Referencia','Cant.','Long.','Referencia','Cant.','Long.','Referencia','Cant.','Long.','Referencia','Cant.','Rest','Disp.'];
const item=(str,x,y)=>({str,width:0,transform:[1,0,0,1,x,y]});
const row=(values,y)=>values.flatMap((v,i)=>v?[item(v,x[i],y)]:[]);
const start=()=>[item('ES-TEST-001 FINISH',300,500),item('Longitud del perfil: 120", Perfiles usados: 2 UBICACION: X CODIGO: C',16,480),...row(labels,460)];
const page=(items,n=1,width=842)=>({page:n,width,height:595,items});
test('numeric-leading profile requires an exact prior project Pipe entry',()=>{
 const header=['Item','Pipe','Code','Length','Reference','Qty'].map((v,i)=>item(v,20+i*130,580));
 const data=['1','2400ST-057','FINISH','10"','A','2'].map((v,i)=>item(v,20+i*130,560));
 const pattern=[item('2400ST-057 FINISH',300,500),...start().slice(1),...row(['1','10"','A','2'],440)];
 const out=extractCoordinatePlans([page([...header,...data,...pattern])]);
 assert.equal(out.plans.length,1);assert.equal(out.plans[0].ref,'2400ST-057');assert.equal(out.plans[0].cuts.length,2);
 assert.equal(out.reconciliation[0].cutLengthsMatch,true);assert.equal(out.productionEnabled,false);
 const unknown=extractCoordinatePlans([page(pattern)]);
 assert.equal(unknown.plans.length,0);assert(unknown.issues.some(i=>i.code==='PATTERN_WITHOUT_CONTEXT'));
 const other=extractCoordinatePlans([page([...header,...data.map(i=>({...i,str:i.str==='2400ST-057'?'2400ST-058':i.str})),...pattern])]);
 assert.equal(other.plans.length,0);assert(other.issues.some(i=>i.code==='PATTERN_WITHOUT_CONTEXT'));
});
test('geometry preserves column identities, multiple cuts and page continuations',()=>{
 const one=page([...start(),...row(['2','10"','Order A','1','','','','','','','','','','2"'],440),...row(['','','(Line 1) A'],430)]);
 const two=page([...row(['','','(Line 2) B'],550),...row(['','20"','Order B','2'],540)],2);
 const out=extractCoordinatePlans([one,two]);assert.equal(out.plans.length,1);assert.equal(out.plans[0].barqty,2);assert.equal(out.plans[0].cuts.length,6);
 assert.equal(out.plans[0].cuts[0].project,'Order A (Line 1) A (Line 2) B');assert.equal(out.plans[0].cuts[2].length,'20"');assert.deepEqual(out.issues,[]);assert.equal(out.productionEnabled,false);
});
test('missing quantity remains unresolved and cannot contaminate preceding reference',()=>{
 const out=extractCoordinatePlans([page([...start(),...row(['1','10"','Known','1'],440),...row(['','20"','Incomplete'],430),...row(['','','continued'],420)])]);
 assert.equal(out.plans[0].cuts.length,1);assert.equal(out.plans[0].cuts[0].project,'Known');assert.equal(out.plans[0].unresolvedCells[0].project,'Incomplete continued');assert.equal(out.plans[0].unresolvedCells[0].quantity,null);assert(out.plans[0].cuts[0].uncertain);assert(out.issues.some(i=>i.code==='INCOMPLETE_CUT'));
});
test('page gap or changed geometry cannot append identities by inference',()=>{
 const out=extractCoordinatePlans([page([...start(),...row(['1','10"','A','1'],440)]),page(row(['','','B'],550),3)]);
 assert.equal(out.plans[0].cuts[0].project,'A');assert(out.issues.some(i=>i.code==='PAGE_CONTEXT_CHANGED'));
});
test('same counts with a changed length fails independent reconciliation',()=>{
 const projectHeader=['Item','Pipe','Code','Length','Reference','Qty'].map((v,i)=>item(v,20+i*130,580));
 const projectRow=['1','ES-TEST-001','FINISH','11"','A','1'].map((v,i)=>item(v,20+i*130,560));
 const out=extractCoordinatePlans([page([...projectHeader,...projectRow,...start(),...row(['1','10"','A','1'],440)])]);
 const r=out.reconciliation[0];assert.equal(r.cuts,r.printedCuts);assert.equal(r.cutLengthsMatch,false);assert.equal(r.barLengthsMatch,null);assert.equal(r.productionEnabled,false);
});
test('same counts and lengths with different reference cannot pass reference grouping',()=>{
 const header=['Item','Pipe','Code','Length','Reference','Qty'].map((v,i)=>item(v,20+i*130,580));
 const data=['1','ES-TEST-001','FINISH','10"','B','1'].map((v,i)=>item(v,20+i*130,560));
 const out=extractCoordinatePlans([page([...header,...data,...start(),...row(['1','10"','A','1'],440)])]);
 assert.equal(out.reconciliation[0].cutLengthsMatch,true);assert.equal(out.reconciliation[0].referenceGroupsMatch,false);
});
test('fraction arithmetic and page limit reject unsupported precision and size',()=>{
 assert.equal(thirtySeconds('36 5/16"'),1162);assert.equal(thirtySeconds('1 1/3"'),null);assert.throws(()=>extractCoordinatePlans(Array(501).fill({})),/500 páginas/);
});
test('material summary heading ends pattern context without polluting the last cut',()=>{
 const out=extractCoordinatePlans([page([item('Optimizador de corte - OPT-TEST-01',20,570),...start(),...row(['1','10"','A','1'],440)]),page([item('OPT-TEST-01',600,560),item('Requerimientos de material:',60,550)],2)]);
 assert.deepEqual(out.issues,[]);assert.equal(out.plans[0].cuts[0].project,'A');
});
test('short left-aligned project descriptions do not become part of the length',()=>{
 const centers=[25,100,200,300,520,740];
 const header=['Item','Pipe','Code','Length','Reference','Qty'].map((v,i)=>item(v,centers[i],580));
 const data=[item('1',25,560),item('ES-TEST-001',100,560),item('FINISH',200,560),item('10"',300,560),item('A',340,560),item('1',740,560)];
 const out=extractCoordinatePlans([page([...header,...data,...start(),...row(['1','10"','A','1'],440)])]);
 assert.equal(out.reconciliation[0].cutLengthsMatch,true);assert.equal(out.reconciliation[0].referenceGroupsMatch,true);assert.deepEqual(out.issues,[]);
});
test('profile identifiers without hyphens retain their source identity',()=>{
 const header=['Item','Pipe','Code','Length','Reference','Qty'].map((v,i)=>item(v,20+i*130,580));
 const data=['1','PROFILE12','FINISH','10"','A','1'].map((v,i)=>item(v,20+i*130,560));
 const initial=start();initial[0]=item('PROFILE12 FINISH',300,500);
 const out=extractCoordinatePlans([page([...header,...data,...initial,...row(['1','10"','A','1'],440)])]);
 assert.equal(out.plans[0].ref,'PROFILE12');assert.equal(out.reconciliation[0].cutLengthsMatch,true);
});

test('rotated pages fail closed instead of assigning cuts to wrong columns',()=>{
 assert.throws(()=>extractCoordinatePlans([{...page(start()),rotation:90}]),/rotado/);
});

test('wrapped title requires matching independent metadata and cannot contaminate continued patterns',()=>{
 const first=page([item('Optimizador de corte - OPT-TEST-ES-',16,580),item('EL400',16,563),item('Nombre del proyecto: OPT-TEST-ES-EL400',16,530),...start(),...row(['1','10"','A','1'],440)]);
 const second=page([item('Optimizador de corte - OPT-TEST-ES-',16,580),item('EL400',16,563),item('OPT-TEST-ES-EL400',200,530),item('Requerimientos de material:',16,500)],2);
 const out=extractCoordinatePlans([first,second]);assert.deepEqual(out.issues,[]);assert.equal(out.plans[0].cuts[0].project,'A');assert.deepEqual(out.plans[0].unresolvedCells,[]);assert.equal(out.productionEnabled,false);
});
test('unverified or misplaced wrapped-header-like text remains an extraction issue',()=>{
 for(const variant of ['missing-metadata','wrong-suffix','wrong-position']){
  const first=page([...(variant==='missing-metadata'?[]:[item('Nombre del proyecto: OPT-TEST-ES-EL400',16,530)]),...start(),...row(['1','10"','A','1'],440)]);
  const second=page([item('Optimizador de corte - OPT-TEST-ES-',16,580),item(variant==='wrong-suffix'?'DIFFERENT':'EL400',16,variant==='wrong-position'?520:563)],2);
  const out=extractCoordinatePlans([first,second]);assert(out.issues.some(i=>i.code==='UNCLASSIFIED_ROW'),variant);assert.equal(out.plans[0].cuts[0].uncertain,true);assert.equal(out.productionEnabled,false);
 }
});

test('split project Reference cell joins only adjacent documented grid continuations',()=>{
 const centers=[25,100,200,300,520,740];
 const grid=(top,bottom,left=350)=>[
  ...[top,bottom].map(y=>({x1:10,y1:y,x2:800,y2:y})),
  ...[left,700].map(x=>({x1:x,y1:bottom,x2:x,y2:top}))];
 const header=['Item','Pipe','Code','Length','Reference','Qty'].map((v,i)=>item(v,centers[i],580));
 const first=['5','ES-TEST-001','FINISH','10"','12345 - Order (Line 1),','2'].map((v,i)=>item(v,centers[i],40));
 const next=['6','ES-TEST-001','FINISH','20"','12346 - Other','1'].map((v,i)=>item(v,centers[i],520));
 const one={...page([item('Optimizador de corte - OPT-TEST-01',20,590),...header,...first]),rules:grid(50,30)};
 const two={...page([item('Optimizador de corte - OPT-TEST-01',20,590),item('(Line 2)',400,555),...next],2),rules:[...grid(565,545),...grid(530,510)]};
 const result=extractCoordinatePlans([one,two]);
 assert.equal(result.sourceProjectRows[0].reference,'12345 - Order (Line 1), (Line 2)');
 assert.deepEqual(result.sourceProjectRows[0].sourceContinuations.map(x=>x.page),[2]);
 assert.equal(result.sourceProjectRows[0].quantity,2);assert.equal(result.productionEnabled,false);
 for(const bad of [
  {...two,items:two.items.map(i=>({...i,str:i.str==='Optimizador de corte - OPT-TEST-01'?'Optimizador de corte - OTHER':i.str}))},
  {...two,items:two.items.map(i=>({...i,str:i.str==='6'?'8':i.str}))},
  {...two,rules:[...grid(565,545,370),...grid(530,510)]},
  {...two,items:[...two.items,item('unassigned',200,555)]},
  {...two,page:3},
  {...two,width:840}
 ]){
  const out=extractCoordinatePlans([one,bad]);
  assert.equal(out.sourceProjectRows[0].reference,'12345 - Order (Line 1),');
  assert.equal(out.sourceProjectRows[0].sourceContinuations,undefined);
  assert.equal(out.productionEnabled,false);
 }
});
