import test from 'node:test';
import assert from 'node:assert/strict';
import {importFailureMessage} from '../opt-digital/import-panel.js';
test('confirmed Retail rejection has a manual action; uncertainty is preserved',()=>{
 assert.match(importFailureMessage({message:'OPT_RETAIL_TIEMPO_AGOTADO',definitive:true}),/manualmente/);
 assert.match(importFailureMessage({message:'OPT_CONTEXTO_OCUPADO',definitive:true}),/programación/);
 assert.match(importFailureMessage({message:'OPT_RETAIL_TIEMPO_AGOTADO',uncertain:true}),/anterior sigue sin confirmar/);
 assert.equal(importFailureMessage({message:'OPT_IMPORTACION_TRANSPORTE',uncertain:true}),'OPT_IMPORTACION_TRANSPORTE');
});
