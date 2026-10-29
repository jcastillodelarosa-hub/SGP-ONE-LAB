import test from 'node:test';
import assert from 'node:assert/strict';
import {groupPanelSources} from '../src/domain/pdt-manual.js';
import {manualDistributionState,renderManualDistribution} from '../src/modules/pdt-source-distribution.js';

const source=(id,fabricacion='E17',longitud=100,cantidad_referencia=3)=>({id_pieza:id,key_produccion:'QA|PANELES_2',reserva:'R',produccion:'QA',codigo_sap:'REF',tipo_pieza:'PANEL',id_linea:'PANELES_2',fabricacion,marca:'A',longitud,acabado:'DS',cantidad_referencia});
const original={fabricacion:'E17',marca:'A',longitud:100,acabado:'DS',cantidad:2};

test('manual validation groups equivalent PANEL sources without attributing quantity to a piece',()=>{
 const groups=groupPanelSources([source('p1'),source('p2'),source('f1','E17',100,9),{...source('f2'),tipo_pieza:'FRAME'}]);
 assert.equal(groups.length,1);
 assert.deepEqual(groups[0].sourceIds,['p1','p2','f1']);
 const state=manualDistributionState(groups,[{...groups[0],cantidad:2}],original);
 assert.equal(state.valid,true);
 assert.deepEqual(state.details,[{fabricacion:'E17',marca:'A',longitud:100,acabado:'DS',cantidad:2}]);
 assert.equal('id_pieza' in state.details[0],false);
});

test('fabrication, length and quantity corrections require an observation',()=>{
 const groups=groupPanelSources([source('p1'),source('p2','E17-1',101,4)]);
 for(const row of [{...groups[1],cantidad:2},{...groups[0],cantidad:3}]){
  assert.equal(manualDistributionState(groups,[row],original).valid,false);
  assert.equal(manualDistributionState(groups,[row],original,'Corrección verificada').valid,true);
 }
 assert.equal(manualDistributionState(groups,[{...groups[0],cantidad:99}],original,'x').valid,false);
 assert.equal(manualDistributionState(groups,[{...groups[0],cantidad:1},{...groups[0],cantidad:1}],original,'x').valid,false);
 assert.equal(manualDistributionState(groups,[{...groups[0],cantidad:1},{...groups[1],cantidad:1}],original,'x').valid,true);
});

test('manual distribution displays the immutable original and verified combinations',()=>{
 const html=renderManualDistribution(groupPanelSources([source('p1')]),original,null,x=>String(x));
 assert.match(html,/Reporte original inmutable/);
 assert.match(html,/Confirmar distribución/);
 assert.match(html,/Cant\. referencia/);
});
