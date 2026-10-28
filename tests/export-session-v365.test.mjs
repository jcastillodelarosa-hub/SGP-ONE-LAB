import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
function block(start,end){const i=source.indexOf(start);const j=source.indexOf(end,i+start.length);assert.ok(i>=0&&j>i);return source.slice(i,j)}
test('export preview uses the unified session getter',()=>{const s=block('async function previewDailyExport()','async function applyDailyExport()');assert.match(s,/const token=getAppToken\(\)/);assert.doesNotMatch(s,/sessionStorage\.getItem\(APP_SESSION_KEY\)/);assert.match(s,/sgp_previsualizar_export_diario/)});
test('export apply uses the same token and preserves confirmation',()=>{const s=block('async function applyDailyExport()','async function ');assert.match(s,/const token=getAppToken\(\)/);assert.match(s,/window\.confirm/);assert.match(s,/sgp_aplicar_export_diario/);});
