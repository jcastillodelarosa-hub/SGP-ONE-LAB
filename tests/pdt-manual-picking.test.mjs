import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {manualOriginsForRole} from '../src/domain/pdt-manual.js';
test('manual create origins are role-scoped; unknown roles fail closed',()=>{
 assert.deepEqual(manualOriginsForRole('PICKING'),['PICKING']);
 for(const role of ['ADMINISTRADOR','COORDINADOR'])assert.deepEqual(manualOriginsForRole(role),['PICKING','ENSAMBLE','EMPAQUE']);
 assert.deepEqual(manualOriginsForRole('LIDER LINEA'),['ENSAMBLE','EMPAQUE']);
 for(const role of ['PATINADOR','RECEPCION','SUPERVISOR DE PICKING','',undefined])assert.deepEqual(manualOriginsForRole(role),[]);
});
test('app passes real session role; picking gets no new validate/close capability',()=>{
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert.match(app,/role:repoRole\(\),onSaved:loadRepoPending/);
 for(const name of ['repoCanValidate','repoCanState','repoCanSolution']){
  const body=app.match(new RegExp('(?:const '+name+'[^\\n]+|function '+name+'[^\\n]+)'))?.[0];
  assert.ok(body,name);assert.doesNotMatch(body,/'PICKING'/);
 }
});
