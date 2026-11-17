import test from 'node:test';import assert from 'node:assert/strict';import {auditDecisions,auditAreaDecisions} from '../src/domain/picking-audit.js';
const options={requireAcceptedImpact:true};
test('new backend contract rejects accepting missing impact',()=>{for(const value of [null,undefined,'',0,-1,1.5])assert.throws(()=>auditDecisions([{accion:'ACEPTAR',ventanas_afectadas:value}],options),/ventanas afectadas/);});
test('explicit accepted impact survives without rewriting action',()=>{const row={accion:'ACEPTAR',id_faltante:'synthetic',ventanas_afectadas:2};assert.deepEqual(auditDecisions([row],options),[row]);});
test('old contracts and other lines preserve accepting semantics',()=>assert.equal(auditDecisions([{accion:'ACEPTAR'}])[0].accion,'ACEPTAR'));
test('unclaimed rows do not require impact and elimination remains reasoned',()=>{assert.deepEqual(auditAreaDecisions({area:'GENERAL',resultado:'SIN_FALTANTES',rows:[{accion:'NO_CORRESPONDE'}],differences:[],...options}),[]);assert.throws(()=>auditDecisions([{accion:'ELIMINAR'}],options),/motivo/);});
test('modify retains existing piece and window validation',()=>{assert.throws(()=>auditDecisions([{accion:'MODIFICAR',motivo:'test',id_pieza:'p',reserva:'r',acabado:'a',cantidad:1,ventanas_afectadas:null}],options),/cantidades/);});

test('existing impact including legacy zero is not revalidated as missing',()=>{assert.equal(auditDecisions([{id_faltante:'known',accion:'ACEPTAR',ventanas_afectadas:0}],{requireAcceptedImpact:true,acceptedImpactIds:new Set(['missing'])})[0].ventanas_afectadas,0);});
