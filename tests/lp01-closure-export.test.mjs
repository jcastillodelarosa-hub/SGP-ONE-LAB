import test from 'node:test';
import assert from 'node:assert/strict';
import {closureExportRealized,previewExportClosure} from '../src/domain/lp01-closure-export.js';
import {normalizePowerBI,POWERBI_VERSION} from '../src/domain/powerbi/adapter.js';
const ctx={stage:'ENSAMBLE',line:'PANELES_2',date:'2026-11-07',shift:1};
const row=(key,name=key)=>({key:key+'|PANELES_2',oficial:{key_produccion:key+'|PANELES_2',id_linea:'PANELES_2',produccion:name}});
const catalog={contract:'LP-HOJA-1',...ctx,productions:[row('A'),row('B'),row('C')]};
const orders=['A','B'].flatMap(key=>[1,2].map(part=>({key:key+'|PANELES_2',linea:ctx.line,etapa:ctx.stage,fecha:ctx.date,turno:ctx.shift,parte:String(part),ejecutado:999})));
const parsed=(records=[{production:'A',quantity:4}])=>({adapter:POWERBI_VERSION,sha256:'b'.repeat(64),stage:ctx.stage,records:records.map((r,i)=>({...ctx,row:i+2,...r}))});
const fixture=()=>{const file={id:'file-id',sha256:'a'.repeat(64),adapter:POWERBI_VERSION,name:'export.xlsx'},snapshot={...ctx,ok:true,id:'close-id',version:4,file,rows:[{key:'A|PANELES_2',power_bi:7,ejecutado:99}]};return {contract:'LP-OPERACION-1',turn:{estado:'CERRADO',revision:4},reports:[{id:'close-id',version:4,archivo:file.id,etapa:ctx.stage,linea:ctx.line,fecha:ctx.date,turno:ctx.shift,snapshot}]};};
test('Realizado exclusively from current confirmed closure and original file provenance',()=>{const got=closureExportRealized(fixture(),ctx);assert.equal(got.status,'CONFIRMED');assert.equal(got.rows[0].quantity,7);assert.equal(got.rows[0].source,'EXPORT_CIERRE');assert.equal(got.file.sha256,'a'.repeat(64));});
test('open or reopened turn has no current Realizado even if an older report/manual count exists',()=>{for(const estado of ['ABIERTO','EN_REVISION','NO_ABIERTO']){const data=fixture();data.turn.estado=estado;assert.deepEqual(closureExportRealized(data,ctx).rows,[]);}});
test('mismatched stage/line/turn/file/version or duplicate latest closure fails closed',()=>{for(const mutate of [d=>d.turn.revision++,d=>d.reports[0].snapshot.shift=2,d=>d.reports[0].snapshot.file.sha256='bad',d=>d.reports[0].archivo='wrong',d=>d.reports.push(d.reports[0]),d=>d.reports[0].snapshot.rows.push(d.reports[0].snapshot.rows[0]),d=>d.reports[0].snapshot.rows[0].power_bi=null]){const data=fixture();mutate(data);assert.deepEqual(closureExportRealized(data,ctx).rows,[]);}});
test('explicit zero is Realizado zero; absent is never manual execution or zero',()=>{const data=fixture();data.reports[0].snapshot.rows[0].power_bi=0;assert.equal(closureExportRealized(data,ctx).rows[0].quantity,0);delete data.reports[0].snapshot.rows[0].power_bi;assert.equal(closureExportRealized(data,ctx).status,'INCOMPATIBLE_CLOSE');});
test('SIN ACTIVIDAD remains explicit empty closure, not quantities fabricated for catalog',()=>{const data=fixture();data.reports[0].tipo='SIN_ACTIVIDAD';Object.assign(data.reports[0].snapshot,{type:'SIN_ACTIVIDAD',rows:[],file:null});assert.equal(closureExportRealized(data,ctx).status,'CONFIRMED_EMPTY');});
test('preview groups by production, preserves absent orders and never writes/allocates roots',()=>{const got=previewExportClosure(parsed(),{...ctx,catalog,orders});assert.equal(got.totalReported,4);assert.equal(got.absent,1);assert.equal(got.rows.find(r=>r.key.startsWith('B')).quantity,null);assert.equal(got.rows.find(r=>r.key.startsWith('B')).preserve,true);assert.equal(got.canApply,false);assert.equal(got.rows.length,2);assert(got.rows.every(r=>r.parte===undefined));});
test('preview accepts explicit zero, distinguishes source outside turn, and filters other shift',()=>{const got=previewExportClosure(parsed([{production:'A',quantity:0},{production:'C',quantity:3},{production:'B',quantity:50,shift:2}]),{...ctx,catalog,orders});assert.equal(got.totalReported,3);assert.equal(got.needsIncorporation,true);assert.equal(got.rows.find(r=>r.key.startsWith('B')).coverage,'ABSENT');assert.equal(got.rows.find(r=>r.key.startsWith('A')).quantity,0);});
test('preview rejects missing/ambiguous canonical identity and wrong context',()=>{assert.throws(()=>previewExportClosure(parsed([{production:'OUT',quantity:2}]),{...ctx,catalog,orders}),/ámbito/);assert.throws(()=>previewExportClosure(parsed(),{...ctx,catalog:{...catalog,productions:[row('A'),row('B','A')]},orders}),/ambigua/);assert.throws(()=>previewExportClosure(parsed(),{...ctx,catalog:{...catalog,stage:'EMPAQUE'},orders}),/Catálogo/);});
test('unchanged parser rejects exact duplicate source rows instead of double counting',()=>{const header=['Año  prog','Semana','Tipo Orden','Proyecto','Produccion','Sistema','Cant. Procesada','Linea PDA','dia_trabajo','turno_trabajo_extra'],detail=[2026,45,'QA','QA','A','QA',2,'PANELES 2','2026-11-07','1. 07:00 am - 07:00 pm'];const values=[header,detail,detail,['Total',null,null,null,null,null,4],['Filtros aplicados:\nlinea_pda es PANELES 2\nIncluido (1) noviembre (mes) + 7 (dia)']];assert.throws(()=>normalizePowerBI({sheet:'Export',rows:values.map((values,i)=>({row:i+1,values}))}),/duplicada/);});

test('reimport is a replacement projection, never added to the prior preview or manual count',()=>{const first=previewExportClosure(parsed([{production:'A',quantity:4}]),{...ctx,catalog,orders});const next=previewExportClosure({...parsed([{production:'A',quantity:3},{production:'B',quantity:2}]),sha256:'c'.repeat(64)},{...ctx,catalog,orders});assert.equal(first.totalReported,4);assert.equal(next.totalReported,5);assert.equal(next.rows.find(r=>r.key.startsWith('A')).quantity,3);assert.equal(next.absent,0);assert.equal(next.sha256,'c'.repeat(64));assert.equal(first.sha256,'b'.repeat(64));});


test('both sides of closure and file identities must be present and nonblank',()=>{
 for(const invalid of [undefined,null,'',' ','\t\n',' close-id ',0,false,{},[]]){
  for(const pair of ['closure','file']){
   const d=fixture(),report=d.reports[0];
   if(pair==='closure'){report.id=invalid;report.snapshot.id=invalid;}
   else{report.archivo=invalid;report.snapshot.file.id=invalid;}
   const got=closureExportRealized(d,ctx);assert.equal(got.status,'INCOMPATIBLE_CLOSE',pair+' '+String(invalid));assert.deepEqual(got.rows,[]);
  }
 }
 const d=fixture();delete d.reports[0].id;delete d.reports[0].snapshot.id;delete d.reports[0].archivo;delete d.reports[0].snapshot.file.id;
 assert.equal(closureExportRealized(d,ctx).status,'INCOMPATIBLE_CLOSE');
});
test('one absent closure or file identifier is rejected without trimming or matching a different identity',()=>{
 for(const mutate of [d=>delete d.reports[0].id,d=>delete d.reports[0].snapshot.id,d=>delete d.reports[0].archivo,d=>delete d.reports[0].snapshot.file.id,d=>d.reports[0].snapshot.id=' other ',d=>d.reports[0].snapshot.file.id='other']){
  const d=fixture();mutate(d);assert.equal(closureExportRealized(d,ctx).status,'INCOMPATIBLE_CLOSE');
 }
});
test('current and preview closure contexts require actual calendar dates',()=>{
 for(const date of ['2026-02-29','2026-02-30','2026-04-31','2026-00-07','2026-13-07','2026-11-00','0000-01-01','2026-1-07','2026-11-07T00:00:00Z',null,20261107]){
  const invalid={...ctx,date};
  assert.throws(()=>closureExportRealized(fixture(),invalid),/Contexto de cierre/);
  assert.throws(()=>previewExportClosure(parsed(),{...invalid,catalog,orders}),/Contexto o adaptador/);
 }
 const leap={...ctx,date:'2028-02-29'},d=fixture();d.reports[0].fecha=leap.date;d.reports[0].snapshot.date=leap.date;
 assert.equal(closureExportRealized(d,leap).status,'CONFIRMED');
});
test('turn revisions, closure versions and quantities cannot be coerced or exceed safe integers',()=>{
 for(const invalid of ['4',true,false,null,'',[],{},-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1]){
  for(const field of ['revision','version','quantity']){
   const d=fixture();
   if(field==='revision')d.turn.revision=invalid;
   if(field==='version'){d.turn.revision=invalid;d.reports[0].version=invalid;d.reports[0].snapshot.version=invalid;}
   if(field==='quantity')d.reports[0].snapshot.rows[0].power_bi=invalid;
   assert.equal(closureExportRealized(d,ctx).status,'INCOMPATIBLE_CLOSE',field+' '+String(invalid));
  }
 }
 const d=fixture();d.reports[0].snapshot.rows[0].power_bi=Number.MAX_SAFE_INTEGER;assert.equal(closureExportRealized(d,ctx).rows[0].quantity,Number.MAX_SAFE_INTEGER);
});
test('unsafe shift coercions and malformed report collections never confirm a closure',()=>{
 for(const shift of ['1',true,' 1 ',1.5,null]){
  const d=fixture();d.reports[0].turno=shift;assert.notEqual(closureExportRealized(d,ctx).status,'CONFIRMED');
  const s=fixture();s.reports[0].snapshot.shift=shift;assert.equal(closureExportRealized(s,ctx).status,'INCOMPATIBLE_CLOSE');
 }
 for(const reports of [{},'reports',[null],[[]]]){const d=fixture();d.reports=reports;assert.equal(closureExportRealized(d,ctx).status,'INCOMPATIBLE_CLOSE');}
 for(const row of [null,{}, {key:'|PANELES_2',power_bi:1}]){const d=fixture();d.reports[0].snapshot.rows=[row];assert.equal(closureExportRealized(d,ctx).status,'INCOMPATIBLE_CLOSE');}
});
test('empty activity close still requires linked IDs and an actual empty rows array',()=>{
 const d=fixture();d.reports[0].tipo='SIN_ACTIVIDAD';Object.assign(d.reports[0].snapshot,{type:'SIN_ACTIVIDAD',rows:[],file:null});
 delete d.reports[0].id;delete d.reports[0].snapshot.id;assert.equal(closureExportRealized(d,ctx).status,'INCOMPATIBLE_CLOSE');
 d.reports[0].id='close-id';d.reports[0].snapshot.id='close-id';d.reports[0].snapshot.rows='';assert.equal(closureExportRealized(d,ctx).status,'INCOMPATIBLE_CLOSE');
});
