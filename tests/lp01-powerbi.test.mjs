import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {DOMParser} from '@xmldom/xmldom';
import {parsePowerBI,normalizePowerBI,reconcilePowerBI,selectedPowerBI,POWERBI_VERSION} from '../src/domain/powerbi/adapter.js';
import {readExportGrid,unzipXlsx} from '../src/domain/powerbi/xlsx-reader.js';
const bytes=readFileSync('tests/lp01-powerbi/fixtures/ensamble.xlsx');
const parsed=await parsePowerBI(bytes,{DOMParser});const grid=await readExportGrid(bytes,{DOMParser});
const ctx={stage:'ENSAMBLE',line:'PANELES_2',date:'2026-10-31',shift:1};
const groups=selectedPowerBI(parsed,ctx);
const assignments=groups.flatMap((g,i)=>[{key:'K'+i,parte:'A'+i,produccion:g.production,etapa:ctx.stage,fecha:ctx.date,turno:1,oficial:{id_linea:ctx.line},sale:g.quantity,ejecutado:g.quantity,revision:1}]);
const clone=()=>structuredClone(grid);
test('formatos reales de ambos XLSX: hoja/encabezados, detalle y total sin sumar Total',async()=>{
 const packing=await parsePowerBI(readFileSync('tests/lp01-powerbi/fixtures/empaque.xlsx'),{DOMParser});
 assert.equal(parsed.adapter,POWERBI_VERSION);assert.equal(parsed.records.length,33);assert.equal(packing.records.length,37);assert.equal(parsed.total,186);assert.equal(packing.total,186);assert.equal(packing.stage,'EMPAQUE');assert.equal(parsed.sha256.length,64);
});
test('dos turnos conservan dia_trabajo sin desplazamiento nocturno ni confundir semana programada',()=>{
 assert.equal(parsed.periods.length,2);assert.ok(parsed.records.every(r=>r.date==='2026-10-31'));assert.ok(parsed.records.some(r=>r.week!==44));assert.equal(selectedPowerBI(parsed,{...ctx,shift:2}).length,parsed.records.filter(r=>r.shift===2).length);assert.throws(()=>selectedPowerBI(parsed,{...ctx,stage:'EMPAQUE'}),/otra etapa/);
});
test('consolidación por producción suma últimos avances de asignaciones; ignora división de Mecanizado',()=>{
 const first=assignments[0],rows=[{...first,parte:'LP1',ejecutado:2,sale:2},{...first,parte:'LP2',ejecutado:first.ejecutado-2,sale:first.sale-2},...assignments.slice(1)];
 const before=structuredClone(rows),out=reconcilePowerBI(parsed,{...ctx,orders:rows});assert.equal(out[0].executed,first.ejecutado);assert.equal(out[0].assignments.length,2);assert.equal(out[0].difference,0);assert.deepEqual(rows,before);
});
test('contribuciones de dimensiones distintas se consolidan; duplicado exacto o conflictivo se rechaza',()=>{
 let g=clone();g.rows.splice(2,0,structuredClone(g.rows[1]));assert.throws(()=>normalizePowerBI(g),/duplicada/);
 g=clone();let row=structuredClone(g.rows[1]);row.values[6]++;g.rows.splice(2,0,row);assert.throws(()=>normalizePowerBI(g),/cantidades incompatibles/);
 g=clone();row=structuredClone(g.rows[1]);row.values[3]='QA proyecto distinto';row.values[6]=1;g.rows.splice(2,0,row);g.rows.find(r=>r.values[0]==='Total').values[6]++;const p=normalizePowerBI(g);assert.equal(selectedPowerBI(p,ctx)[0].quantity,groups[0].quantity+1);
});
test('ausencia no equivale a cero, identidad ambigua o producción ajena bloquean',()=>{
 assert.throws(()=>reconcilePowerBI(parsed,{...ctx,orders:[...assignments,{...assignments[0],key:'NEW',parte:'NEW',produccion:'NO INFORMADA'}]}),/Faltan producciones/);
 assert.throws(()=>reconcilePowerBI(parsed,{...ctx,orders:[...assignments,{...assignments[0],key:'OTHER',parte:'OTHER'}]}),/ambigua/);
 assert.throws(()=>reconcilePowerBI(parsed,{...ctx,orders:assignments.slice(1)}),/sin asignación/);
 assert.throws(()=>reconcilePowerBI(parsed,{...ctx,orders:[assignments[0],...assignments]}),/repetida/);
});
test('dato incompleto, subtotal, negativo/anulación, total inconsistente y encabezado alterado se rechazan',()=>{
 for(const change of [g=>g.rows[1].values[6]=-1,g=>g.rows[1].values[6]=1.5,g=>g.rows[1].values[4]='',g=>g.rows[1].values[0]='Subtotal',g=>g.rows.find(r=>r.values[0]==='Total').values[6]++,g=>g.rows[0].values[4]='Orden inventada']){const g=clone();change(g);assert.throws(()=>normalizePowerBI(g));}
 const zero=clone();zero.rows.find(r=>r.values[0]==='Total').values[6]-=zero.rows[1].values[6];zero.rows[1].values[6]=0;assert.equal(normalizePowerBI(zero).records[0].quantity,0);
});
test('archivo corrupto y límites de ZIP se rechazan antes de conciliar',async()=>{
 await assert.rejects(()=>unzipXlsx(new Uint8Array(10)),/inválido/);await assert.rejects(()=>unzipXlsx(new Uint8Array(3*1024*1024)),/mayor/);
 const broken=new Uint8Array(bytes);broken[100]^=0xff;await assert.rejects(()=>parsePowerBI(broken,{DOMParser}));
});

test('XML activo, relaciones externas, filas ocultas y fórmulas se rechazan en ZIP válido',async()=>{
 const {storeZip}=await import('./lp01-powerbi/zip-fixture.mjs');const {XMLSerializer}=await import('@xmldom/xmldom');const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
 const entries=await unzipXlsx(bytes);assert.equal((await parsePowerBI(storeZip(entries),{DOMParser})).records.length,33);
 for(const mode of ['dtd','formula','hidden','external']){
  const changed=new Map(entries),part=mode==='external'?'xl/_rels/workbook.xml.rels':'xl/worksheets/sheet1.xml';let xml=new TextDecoder().decode(changed.get(part));
  if(mode==='dtd')xml=xml.replace('?>','?><!DOCTYPE worksheet [<!ENTITY test "injected">]>');
  else{const doc=new DOMParser().parseFromString(xml,'application/xml');
   if(mode==='external')doc.documentElement.firstChild.setAttribute('TargetMode','External');
   else{const rows=doc.getElementsByTagNameNS(ns,'row');if(mode==='hidden')rows[1].setAttribute('hidden','1');else{const formula=doc.createElementNS(ns,'f');formula.textContent='1+1';rows[1].getElementsByTagNameNS(ns,'c')[6].appendChild(formula);}}
   xml=new XMLSerializer().serializeToString(doc);
  }
  changed.set(part,xml);await assert.rejects(()=>parsePowerBI(storeZip(changed),{DOMParser}));
 }
});

test('CSV del cierre consolidado conserva asignaciones, motivo por producción y diferencias numéricas',async()=>{
 const {reportCSV}=await import('../src/domain/lp01-operation.js');
 const csv=reportCSV({stage:'ENSAMBLE',line:'PANELES_2',date:'2026-10-31',shift:1,version:2,file:{sha256:'sha'},observation:'QA',reasons:{'=K':'Motivo de producción'},rows:[{key:'=K',assignments:[{parte:'LP1'},{parte:'LP2'}],sale:50,ejecutado:40,power_bi:39,diferencia:-1,saldo_oficial:248}]});
 assert.equal(csv.split('\r\n').length,2);assert.ok(csv.includes('LP1, LP2'));assert.ok(csv.includes('Motivo de producción'));assert.ok(csv.includes('"-1"'));assert.ok(csv.includes("'=K"));
});
