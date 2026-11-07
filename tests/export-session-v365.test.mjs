import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const source=readFileSync(new URL('../src/modules/export-review.js',import.meta.url),'utf8');
test('export review uses the unified session getter',()=>{assert.match(app,/getToken:getAppToken/);assert.match(source,/const token=getToken\(\)/);assert.doesNotMatch(source,/sessionStorage/);assert.match(source,/sgp_export_preparar/)});
test('export approval preserves confirmation and does not bypass pending changes',()=>{assert.match(source,/window\.confirm/);assert.match(source,/sgp_export_aprobar/);assert.doesNotMatch(source,/sgp_aplicar_export_diario/);});
