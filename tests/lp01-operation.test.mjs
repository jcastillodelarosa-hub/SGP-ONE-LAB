import test from 'node:test';import assert from 'node:assert/strict';
import {operationalRows,officialBalance,validateAffectations,previewBI,BI_HEADER,reportCSV,quantity} from '../src/domain/lp01-operation.js';
const row=(part,extra={})=>({key:'K',parte:part,etapa:'ENSAMBLE',fecha:'2026-11-01',turno:1,prioridad:1,sale:20,ejecutado:10,oficial:{id_linea:'PANELES_2',saldos_inicializados:true,presente_ultimo_export:true,saldo_ensamble:288,saldo_empaque:288},...extra});
test('abiertas SALE positivo, abiertas cero y nuevas; prioridad no mueve turno',()=>{
 const input=[row('new'),row('zero',{abierta:true,sale:0}),row('positive',{abierta:true,sale:8})];const copy=structuredClone(input);
 assert.deepEqual(operationalRows({contract:'LP-OPERACION-1',orders:input}).map(r=>r.parte),['positive','zero','new']);assert.deepEqual(input,copy);
});
test('contrato, identidad y cantidades estrictas',()=>{
 assert.throws(()=>operationalRows({orders:[]}),/incompatible/);assert.throws(()=>operationalRows({contract:'LP-OPERACION-1',orders:[row('1'),row('1')]}),/duplicada/);
 for(const v of ['',-1,1.1,'1e2','0.5',null])assert.throws(()=>quantity(v));assert.equal(quantity('90'),90);
});
test('Export conserva 288 después de ejecutar y valores desconocidos no equivalen a cero',()=>{
 assert.equal(officialBalance(row('1',{ejecutado:90}),'ENSAMBLE'),288);
 assert.equal(officialBalance(row('1',{oficial:{}}),'ENSAMBLE'),null);
});
test('consolidado agregado sin identidad individual ni suma automática',()=>{
 const af={NC_AL:12,NC_V:8,TECNO:3,NOVEDAD:0};assert.equal(validateAffectations(af),null);assert.equal(validateAffectations(af,15),15);assert.throws(()=>validateAffectations(af,11));assert.throws(()=>validateAffectations(af,24));
});
test('CSV QA valida período, identidad completa, duplicados y compara último acumulado',()=>{
 const orders=[row('P1'),row('P2')],ctx={stage:'ENSAMBLE',date:'2026-11-01',shift:1,orders};const csv=BI_HEADER+'\nENSAMBLE;2026-11-01;1;K;P1;9\nENSAMBLE;2026-11-01;1;K;P2;10';
 assert.deepEqual(previewBI(csv,ctx).map(r=>r.difference),[-1,0]);assert.throws(()=>previewBI(csv.replaceAll(';1;',';2;'),ctx),/turno/);assert.throws(()=>previewBI(csv+'\nENSAMBLE;2026-11-01;1;K;P1;9',ctx),/repetida/);assert.throws(()=>previewBI(csv.split('\n').slice(0,2).join('\n'),ctx),/Faltan/);
});
test('reporte exporta versión y evidencia inmutables con escape de fórmulas CSV',()=>{
 const text=reportCSV({stage:'ENSAMBLE',date:'2026-11-01',shift:1,version:3,file:{sha256:'abc'},rows:[{key:'=ATTACK',parte:'P1',sale:90,ejecutado:40,power_bi:39,diferencia:-1,saldo_oficial:288}],reasons:{'=ATTACK/P1':'QA'},observation:'cierre'});
 assert.ok(text.includes("'=ATTACK"));assert.ok(text.includes('abc'));assert.ok(text.includes('288'));
});
