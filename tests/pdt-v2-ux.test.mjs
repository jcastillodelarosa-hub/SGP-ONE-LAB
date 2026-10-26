import test from 'node:test';
import assert from 'node:assert/strict';
import {productionPdtActions,productionPdtControls,productionPdtStatus} from '../src/modules/pdt-production-actions.js';
import {pdtSummary,distributionReadOnly} from '../src/modules/pdt-v2-presentation.js';
const esc=x=>String(x??'').replaceAll('<','&lt;');
const row={id_pendiente:'fixture',contrato_pdt:'V2',tipo_pieza:'PANEL',estado:'PENDIENTE',estado_repo:'PROCESADO',cantidad:9,cantidad_validada:9,avance_neto:0,saldo_mecanizado:9,ncs:[1006163,1006164,1006165].map(referencia=>({referencia,estado:'FINALIZADA'}))};
const caps={contract_version:2,picking_cuantitativo:true};
test('Issue95 REPO OK is independent of PDT state, validation and zero advancement',()=>{
 const copy=structuredClone(row),html=productionPdtStatus(row,'VALIDADO',esc);
 assert.match(html,/PROCESADO/);assert.match(html,/VALIDADO/);assert.match(html,/REPO OK/);
 const summary=pdtSummary(row,esc);assert.match(summary,/Disponible para sacar/);assert.match(summary,/no confirma inventario, entrega física ni avance/);assert.match(summary,/Avance neto<\/span><strong>0/);assert.match(summary,/Saldo<\/span><strong>9/);
 assert.deepEqual(row,copy);
});
test('partial/inactive/unknown NC never claim REPO OK',()=>{
 for(const ncs of [[],[{referencia:1,estado:'PENDIENTE'}],[{referencia:1,estado:'FINALIZADA',activo:false}],[{referencia:1,estado:'FINALIZADA'},{referencia:2,estado:'PENDIENTE'}]])assert.doesNotMatch(productionPdtStatus({...row,ncs},'',esc),/REPO OK/);
});
test('production contextual menu respects role, contract, master type, state and capabilities',()=>{
 assert.ok(productionPdtActions(row,'LIDER MECANIZADO',caps).some(([key])=>key==='advances'));
 for(const role of ['RECEPCION','PATINADOR','PICKING','CONSULTA'])assert.ok(!productionPdtActions(row,role,caps).some(([key])=>key==='advances'));
 for(const changes of [{contrato_pdt:'LEGACY'},{tipo_pieza:'FRAME'},{estado:'RESUELTO'}])assert.equal(productionPdtActions({...row,...changes},'COORDINADOR',caps).length,0);
 assert.equal(productionPdtActions(row,'UNKNOWN',caps).length,0);assert.equal(productionPdtActions(row,'COORDINADOR',null).length,0);
 assert.ok(!productionPdtActions({...row,estado_repo:'PICKING'},'COORDINADOR',caps).some(([key])=>key==='advances'));
 const html=productionPdtControls(row,'COORDINADOR',caps,esc);assert.match(html,/>Abrir</);assert.doesNotMatch(html,/V2 · Abrir PDT v2/);
});

test('empty V2 response never invents a validated quantity of zero',()=>{assert.match(distributionReadOnly([],esc),/no se recibieron detalles/);assert.doesNotMatch(distributionReadOnly([],esc),/Total validado: <b>0/);});
