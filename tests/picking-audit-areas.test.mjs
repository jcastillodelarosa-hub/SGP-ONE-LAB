import test from 'node:test';
import assert from 'node:assert/strict';
import {auditAreaDecisions,auditAreaLabel} from '../src/domain/picking-audit.js';
const base={area:'VERTICALES',resultado:'SIN_FALTANTES',rows:[],differences:[]};
test('requires area and explicit outcome',()=>{assert.throws(()=>auditAreaDecisions({...base,area:''}));assert.throws(()=>auditAreaDecisions({...base,resultado:''}));});
test('empty area can explicitly confirm no missing',()=>assert.deepEqual(auditAreaDecisions(base),[]));
test('unclaimed legacy rows never silently accepted',()=>assert.deepEqual(auditAreaDecisions({...base,rows:[{id_faltante:'x',accion:'NO_CORRESPONDE'}]}),[]));
test('missing outcome needs a real missing item',()=>assert.throws(()=>auditAreaDecisions({...base,resultado:'CON_FALTANTES'})));
test('accepted missing requires missing outcome',()=>{const rows=[{id_faltante:'x',accion:'ACEPTAR'}];assert.throws(()=>auditAreaDecisions({...base,rows}));assert.equal(auditAreaDecisions({...base,rows,resultado:'CON_FALTANTES'}).length,1);});
test('new differences cannot accompany no missing',()=>assert.throws(()=>auditAreaDecisions({...base,differences:[{}]})));
test('annulled historical missing requires reason and may yield complete',()=>{assert.throws(()=>auditAreaDecisions({...base,rows:[{accion:'ELIMINAR'}]}));assert.equal(auditAreaDecisions({...base,rows:[{accion:'ELIMINAR',motivo:'No falta'}]}).length,1);});

test('Paneles options use requested display labels without changing identities or other lines',()=>{
 const area={id:'ZOCALERO',nombre:'Zocalero (top y bottom)'};
 assert.equal(auditAreaLabel('PANELES_2',area),'Zócalos');
 assert.equal(auditAreaLabel('PANELES_2',{id:'VERTICALES',nombre:'Verticales'}),'Verticales');
 assert.equal(auditAreaLabel('FRAMES_2',area),'Zocalero (top y bottom)');
 assert.equal(auditAreaLabel('PANELES_2',{id:'OTRA',nombre:'Área personalizada'}),'Área personalizada');
 assert.deepEqual(area,{id:'ZOCALERO',nombre:'Zocalero (top y bottom)'});
});
