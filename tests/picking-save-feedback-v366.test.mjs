import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const form=readFileSync(new URL('../src/modules/pdt-registration-form.js',import.meta.url),'utf8');
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
test('incomplete Picking delivery remains protected by verified physical piece identity',()=>{
 assert.match(form,/Pieza '\+\(index\+1\)\+': selecciona la fabricación, longitud, acabado y reserva\.'/);
 assert.match(form,/status\.dataset\.ready=String\(valid\)/);
 assert.match(form,/onChange\(valid\)/);
 assert.match(app,/save\.disabled=!valid\|\|pickPdtSaving/);
});
test('Picking can save after complete valid entry and keeps backend save',()=>{
 assert.match(form,/Datos completos\. Ya puedes guardar la entrega\./);
 assert.match(form,/try\{value\(\);valid=true/);
 assert.match(app,/await saveRegistration\(client,getAppToken\(\)/);
 assert.match(app,/if\(!pieces\)throw new Error/);
});
