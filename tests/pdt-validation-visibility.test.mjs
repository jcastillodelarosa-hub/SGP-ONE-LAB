import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {distributionState} from '../src/modules/pdt-source-distribution.js';

const controller=readFileSync(new URL('../src/modules/pdt-v2-controller.js',import.meta.url),'utf8');
const sources=[
 {id_pieza:'h:1',fabricacion:'E10-3',longitud:116.4375,acabado:'DS',cantidad:5},
 {id_pieza:'h:2',fabricacion:'E10-4',longitud:116.4375,acabado:'DS',cantidad:5}
];

test('unvalidated PDT is not hidden by absent, null or populated details',()=>{
 assert.match(controller,/const needsValidation=row\.validacion_estado!=='VALIDADO';/);
 assert.match(controller,/if\(needsValidation && editable && validator\)form\+=renderSourceDistribution/);
 assert.match(controller,/if\(needsValidation && editable && validator\)\{/);
 assert.match(controller,/row\.validacion_estado==='VALIDADO' && Array\.isArray\(row\.detalles\) && row\.detalles\.length>0/);
});
test('PDT source query and validation use the selected physical identity',()=>{
 assert.match(controller,/client\.rpc\('sgp_pdt_fuentes_v2'/);
 assert.match(controller,/distributionState\(sources,selectedSources\(\),row\.cantidad/);
 assert.match(controller,/sgp_aluminio_pendiente_validar_detalles_v1/);
});
test('two fabrications distribute exactly and correction requires justification',()=>{
 const chosen=[{...sources[0],cantidad:3},{...sources[1],cantidad:2}];
 const state=distributionState(sources,chosen,5);
 assert.equal(state.valid,true);
 assert.deepEqual(state.details.map(x=>x.id_pieza),['h:1','h:2']);
 assert.equal(distributionState(sources,chosen,6).valid,false);
 assert.equal(distributionState(sources,chosen,6,'Cantidad corregida').valid,true);
});
test('reject forged source and duplicate identity',()=>{
 assert.equal(distributionState(sources,[{...sources[0],id_pieza:'other:1',cantidad:5}],5).valid,false);
 assert.equal(distributionState(sources,[{...sources[0],cantidad:2},{...sources[0],cantidad:3}],5).valid,false);
});
