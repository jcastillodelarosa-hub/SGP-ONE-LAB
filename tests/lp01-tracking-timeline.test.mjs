import test from 'node:test';import assert from 'node:assert/strict';
import {trackingTimeline} from '../src/domain/lp01-tracking-timeline.js';
const row=()=>({key:'QA|PANELES_2',linea:'PANELES_2',etapa:'ENSAMBLE',operationTargets:[]});
const op=(r,extra={})=>({key:r.key,linea:r.linea,etapa:r.etapa,fecha:'2026-11-02',turno:1,parte:'P1',ejecutado:4,...extra});
test('preserva último total por asignación/día/turno, sin sumar ni mutar',()=>{const r=row();r.operationTargets=[op(r,{turno:2,ejecutado:3}),op(r,{parte:'P2',ejecutado:2}),op(r)];const before=structuredClone(r);assert.deepEqual(trackingTimeline(r).map(x=>[x.shift,x.assignment,x.quantity]),[[1,'P1',4],[1,'P2',2],[2,'P1',3]]);assert.deepEqual(r,before);});
test('cero y desconocido distintos; sin registro no fabrica historial ni fecha inicial',()=>{const r=row();assert.deepEqual(trackingTimeline(r),[]);r.operationTargets=[op(r,{ejecutado:0}),op(r,{turno:2,ejecutado:null})];assert.deepEqual(trackingTimeline(r).map(x=>x.quantity),[0,null]);assert.equal(trackingTimeline(r)[0].openedAt,undefined);});
test('rechaza ámbitos cruzados y contexto duplicado',()=>{for(const extra of [{key:'OTRA'},{etapa:'EMPAQUE'},{linea:'FRAMES_2'},{turno:3},{ejecutado:-1}]){const r=row();r.operationTargets=[op(r,extra)];assert.throws(()=>trackingTimeline(r));}const r=row();r.operationTargets=[op(r),op(r)];assert.throws(()=>trackingTimeline(r));});
