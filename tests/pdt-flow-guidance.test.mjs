import test from 'node:test';
import assert from 'node:assert/strict';
import {pendingFlowGuidance} from '../src/modules/pdt-flow-guidance.js';
import {stampRelease,releaseLabel} from '../scripts/build-release-info.mjs';
const caps={contract_version:2};
const row={contrato_pdt:'LEGACY',estado:'PENDIENTE',estado_repo:'PENDIENTE',validacion_estado:'POR_VALIDAR'};
test('LEGACY preparation is an explicit role-scoped entry, without changing the row',()=>{
 const before=structuredClone(row);
 for(const role of ['ADMINISTRADOR','COORDINADOR','RECEPCION','LIDER LINEA','SUPERVISOR DE PICKING'])assert.equal(pendingFlowGuidance(row,role,caps).action,'v2');
 for(const role of ['CONSULTA','LIDER MECANIZADO','PATINADOR','PICKING',''])assert.equal(pendingFlowGuidance(row,role,caps).action,null);
 assert.equal(pendingFlowGuidance({...row,validacion_estado:'VALIDADO'},'ADMINISTRADOR',caps).action,null);
 assert.deepEqual(row,before);
});
test('V2 entry remains visible for authorized read roles only, with backend capability',()=>{
 for(const role of ['RECEPCION','COORDINADOR','PICKING','LIDER MECANIZADO','CONSULTA'])assert.equal(pendingFlowGuidance({...row,contrato_pdt:'V2'},role,caps).label,'Abrir PDT v2');
 assert.equal(pendingFlowGuidance({...row,contrato_pdt:'V2'},'UNKNOWN',caps).action,null);
 assert.equal(pendingFlowGuidance(row,'COORDINADOR',null).action,null);
 assert.equal(pendingFlowGuidance({...row,estado:'RESUELTO'},'COORDINADOR',caps).action,null);
});
test('release build stamps the exact commit; source preview never claims publication',()=>{
 const html='<span class="status" id="releaseVersion" data-release-state="preview">Vista previa</span>';
 const result=stampRelease(html,'a'.repeat(40),'2026-10-26T00:00:00Z');
 assert.equal(result.match(/>([^<]+)<\/span>/)[1],releaseLabel);assert.match(result,/data-release-commit="a{40}"/);assert.doesNotMatch(result,/preview/);
 assert.throws(()=>stampRelease(html,'short'));assert.throws(()=>stampRelease('', 'a'.repeat(40)));
});

test('master-classified FRAME never advertises PANEL V2 operations',()=>{
 for(const role of ['ADMINISTRADOR','COORDINADOR','RECEPCION','LIDER']){
  const flow=pendingFlowGuidance({...row,tipo_pieza:'FRAME'},role,caps);
  assert.equal(flow.action,null);assert.match(flow.explanation,/FRAME/);
 }
});
