import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
test('programación individual identifica la producción canónica antes de RPC',()=>{
 assert.match(app,/eligible\.length===1\)args\.p_produccion=eligible\[0\]\.produccion/);
 assert.match(app,/const fullPartQty=pendingOrders/);
 assert.match(app,/args\.p_cantidad!==fullPartQty/);
 assert.match(app,/args\.p_produccion=null/);
 assert.match(app,/p_produccion:progSelection\.produccion/);
});
test('pendientes muestran semana y acabado con fuente de recepción',()=>{
 assert.match(app,/metadataResponse=await client\.rpc\('sgp_recepcion_listar'/);
 assert.match(app,/metaText\(x\.reserva,'weeks'\)/);
 assert.match(app,/metaText\(x\.reserva,'finishes'\)/);
 assert.match(index,/<th>Reserva<\/th><th>Semana<\/th><th>Acabado<\/th><th>Perfil<\/th>/);
});
