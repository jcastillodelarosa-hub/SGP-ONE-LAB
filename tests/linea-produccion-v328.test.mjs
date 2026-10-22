import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../planner-readonly-v326.js',import.meta.url),'utf8');
test('multi-reserva: primera reserva es principal, sin inferir compartida',()=>{
 assert.match(source,/function explorerReserveLabel\(raw\)/);
 assert.match(source,/MULTI-RESERVA · principal/);
 assert.doesNotMatch(source,/RESERVA COMPARTIDA · principal/);
});
test('selección de producción no depende de selector inexistente',()=>{
 assert.match(source,/sgpExplorerSelection/);
 assert.match(source,/if\(!sel\)\{explorerSelection\.scrollIntoView/);
 assert.match(source,/No se han guardado cambios de programación/);
});
