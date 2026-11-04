import test from 'node:test';
import assert from 'node:assert/strict';
import {globalTrackingData,trackingIdentity} from '../src/domain/lp01-tracking-global.js';
import {trackingRows} from '../src/domain/lp01-tracking.js';
const ctx={line:'PANELES_2',stage:'ENSAMBLE'};
const production=(key,balance)=>({key:key+'|PANELES_2',line:ctx.line,stage:ctx.stage,classification:balance===null||balance===0?'PENDIENTE_CONCILIACION':'ABIERTA',assignments:[],operations:[],oficial:{key_produccion:key+'|PANELES_2',id_linea:ctx.line,produccion:'Homónima',saldos_inicializados:true,presente_ultimo_export:balance!==null,saldo_ensamble:balance,saldo_empaque:7}});
const payload=()=>({contract:'LP-SEGUIMIENTO-1',role:'COORDINADOR',line:ctx.line,stage:ctx.stage,productions:[production('A',0),production('B',null),production('C',5)]});
test('Export cero/desconocido y pendientes no crean saldo, SALE, avance ni asignación',()=>{
 const raw=payload(),before=structuredClone(raw),data=globalTrackingData(raw,ctx),rows=trackingRows(data,ctx);
 assert.equal(rows.length,3);assert.equal(rows[0].key,'C|PANELES_2');assert.equal(rows.filter(r=>r.classification==='PENDIENTE_CONCILIACION').length,2);
 for(const r of rows){assert.equal(r.parte,null);assert.equal(r.sale,null);assert.equal(r.ejecutado,null);assert.deepEqual(r.operationTargets,[]);assert.equal(r.assignmentLabel,'Sin asignación');}
 assert.equal(new Set(rows.map(trackingIdentity)).size,3);assert.deepEqual(raw,before);
});
test('Deniega roles/ámbitos/identidad/clasificación cruzados y duplicados',()=>{
 for(const mutate of [p=>p.role='LIDER LINEA',p=>p.line='FRAMES_2',p=>p.stage='EMPAQUE',p=>p.productions.push(p.productions[0]),p=>p.productions[0].oficial.key_produccion='OTRA',p=>p.productions[0].classification='ABIERTA',p=>p.productions[0].assignments.push({key_produccion:'OTRA'})]){const p=payload();mutate(p);assert.throws(()=>globalTrackingData(p,ctx));}
});
test('Conserva contexto real multisemana y no agrega snapshots de ejecución',()=>{
 const p=payload(),r=p.productions[2];r.assignments=[{id:'real',key_produccion:r.key}];r.operations=[{key:r.key,parte:'real',linea:ctx.line,etapa:ctx.stage,fecha:'2025-01-01',turno:1,sale:8,ejecutado:2},{key:r.key,parte:'real',linea:ctx.line,etapa:ctx.stage,fecha:'2025-01-02',turno:2,sale:6,ejecutado:1}];
 const row=globalTrackingData(p,ctx).orders[2];assert.equal(row.operationTargets.length,2);assert.equal(row.ejecutado,null);assert.notEqual(row.operationTargets[0].selectionId,row.operationTargets[1].selectionId);
 r.operations.push(r.operations[0]);assert.throws(()=>globalTrackingData(p,ctx));
});
