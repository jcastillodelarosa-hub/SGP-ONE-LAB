import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
test('Reception pieces map reference quantities without replacing zero',async()=>{
 const code=app.slice(app.indexOf('async function openPickingAuditPieces('),app.indexOf('async function openPickingAudit(id)'));
 const sources=[{cantidad_referencia:8},{cantidad_referencia:0,cantidad:9},{cantidad:4}];
 let captured;
 const open=new Function('pickingReceptionRows','getSupabaseClient','getAppToken','els','capture',`let currentPieceRows,currentPieceContext,currentPieceView;const renderPieceModal=()=>capture(currentPieceRows);${code};return openPickingAuditPieces`)([{id_entrega:'qa'}],async()=>({rpc:async()=>({data:{fuentes:sources}})}),()=>'',{pieceModalTitle:{},pieceModalMeta:{},pieceModal:{}},rows=>captured=rows);
 await open('qa');assert.deepEqual(captured.map(p=>p.cantidad),[8,0,4]);assert.equal(sources[0].cantidad,undefined);
});
