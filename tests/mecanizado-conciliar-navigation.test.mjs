import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const source=app.slice(app.indexOf('window.SGPWeeklyPhysicalCanReview='),app.indexOf('window.SGPWeeklyPhysicalCanEdit='));
test('navigation rechecks session and configured window, uses real tab/date/search only',()=>{
 const clicks=[];
 const els={'#recSearch':{},'#recWeek':{value:'47'},'#prodDate':{},'#prodShift':{},
  '[data-mach-tab="recepcion"]':{hidden:false,click:()=>clicks.push('recepcion')},
  '[data-mach-tab="proceso"]':{hidden:false,click:()=>clicks.push('proceso')}};
 const auth={window:{},document:{querySelector:x=>els[x]},getAppToken:()=>'active',currentAuthToken:'active',currentAuth:{valida:true},currentMachWindowAccess:new Set(),repoRole:()=>'LIDER'};
 vm.runInNewContext(source,auth);
 const {SGPWeeklyPhysicalReview:go}=auth.window;
 assert.equal(go({progressReview:'recepcion',reserve:'R102'}),false);
 auth.currentMachWindowAccess.add('mecanizado.recepcion');
 assert.equal(go({progressReview:'recepcion',reserve:'R102'}),true);assert.equal(els['#recSearch'].value,'R102');assert.equal(els['#recWeek'].value,'');
 assert.equal(go({progressReview:'proceso',date:'2026-11-19',shift:'TURNO 2'}),false);
 auth.currentMachWindowAccess.add('mecanizado.produccion');
 assert.equal(go({progressReview:'proceso',date:'2026-11-19',shift:'TURNO 2'}),true);
 assert.equal(els['#prodDate'].value,'2026-11-19');assert.equal(els['#prodShift'].value,'TURNO 2');
 auth.currentAuthToken='stale';
 assert.equal(go({progressReview:'proceso',date:'2026-11-19'}),false);
 assert.deepEqual(clicks,['recepcion','proceso']);
 assert.match(app,/if\(b\.dataset\.machTab==='proceso'\)loadProductionBoard\(\)/);
});
