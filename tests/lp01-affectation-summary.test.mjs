import test from 'node:test';import assert from 'node:assert/strict';
import {affectationSummary} from '../src/domain/lp01-affectation-summary.js';
import {pendingCompact} from '../src/modules/lp01-pending-compact.js';
const report=(id,cause,quantity,confirmed=0)=>({id,cause,quantity,confirmed,solved:quantity,originStage:'ENSAMBLE'});
const fixture=()=>({stage:'ENSAMBLE',revision:4,reports:[report('a','NC_AL',10),report('v','NC_V',8)],aluminumPending:{status:'AVAILABLE',rows:[]},consolidated:{quantity:12,balance:20,revision:4},available:8});
test('category reports are not summed into distinct union; source solution does not release windows',()=>{
 const s=affectationSummary(fixture());assert.equal(s.categories.NC_AL,10);assert.equal(s.categories.NC_V,8);assert.equal(s.total,12);assert.equal(s.available,8);assert.equal(s.accessories,null);
});
test('physical confirmation changes cause; unvalidated, stale and unavailable counts remain unknown',()=>{
 const d=fixture();d.reports[0].confirmed=3;d.consolidated=null;assert.equal(affectationSummary(d).categories.NC_AL,7);assert.equal(affectationSummary(d).available,null);
 d.consolidated={quantity:12,balance:20,revision:3};assert.equal(affectationSummary(d).total,null);
 assert.equal(affectationSummary({...fixture(),reports:[]}).categories.NOVEDAD,null);
});
test('unlinked LEGACY pieces cannot become windows or known availability',()=>{
 const d=fixture();d.aluminumPending.rows=[{id:'legacy',pieceQuantity:19,state:'PENDIENTE',origin:'PRODUCCION'}];const s=affectationSummary(d);assert.equal(s.categories.NC_AL,10);assert.equal(s.aluminumUnknown,true);assert.equal(s.total,null);assert.equal(s.available,null);
});
test('duplicate IDs, wrong stage and impossible physical totals are rejected',()=>{
 for(const reports of [[report('a','NC_AL',1),report('a','NC_V',1)],[{...report('a','NC_AL',1),originStage:'EMPAQUE'}],[report('a','NC_AL',1,2)]])assert.throws(()=>affectationSummary({...fixture(),reports}),/INVALIDO/);
});
test('compact PDT summary keeps UUID and long evidence inside expandable details',()=>{
 const html=pendingCompact([{id:'private-detail-id',reference:'REF',pieceQuantity:19,nc:'NC1',origin:'PRODUCCION',contract:'LEGACY'}]);const summary=html.match(/<summary>([\s\S]*?)<\/summary>/)[1];assert.match(summary,/REF/);assert.match(summary,/19 piezas/);assert.match(summary,/Estado NC/);assert.match(summary,/PRODUCCION/);assert.ok(!summary.includes('private-detail-id'));assert.ok(html.includes('private-detail-id'));
});
test('Picking-only reader cannot prove all-origin coverage or availability',()=>{
 const d=fixture();delete d.aluminumPending;d.pickingPending={status:'AVAILABLE',rows:[]};const s=affectationSummary(d);assert.equal(s.total,null);assert.equal(s.available,null);assert.equal(s.aluminumUnknown,true);
});
