import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const start=app.indexOf('async function saveProgramming()');
const end=app.indexOf("document.querySelector('#progRefresh')",start);
const save=app.slice(start,end);

test('programación completa de parte conserva la RPC canónica con producción nula',()=>{
  assert.ok(start>=0&&end>start);
  assert.match(save,/const fullPart=Number\(args\.p_cantidad\)===Number\(progSelection\.maxQty\)/);
  assert.match(save,/if\(fullPart\)\s*\{\s*args\.p_produccion=null/);
  assert.match(save,/c\.rpc\('sgp_mecanizado_programar',args\)/);
});
test('programación parcial sigue exigiendo orden única',()=>{
  assert.match(save,/else if\(eligible\.length===1\)/);
  assert.match(save,/selecciona «Programar esta orden»/);
  assert.match(save,/if\(args\.p_cantidad>progSelection\.maxQty\)/);
});
