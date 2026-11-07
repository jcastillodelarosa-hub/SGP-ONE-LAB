import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const controller=readFileSync(new URL('../src/modules/lp01-operation.js',import.meta.url),'utf8');
const detail=readFileSync(new URL('../src/modules/lp01-tracking-affectations.js',import.meta.url),'utf8');
const old={export:{at:'2026-11-06T10:00:00Z',percentage:'20'}},fresh={export:{at:'2026-11-06T11:00:00Z',percentage:'40'}};
test('an older Export response cannot replace a newer central snapshot',()=>{
 const body=controller.slice(controller.indexOf(' function rememberDetails('),controller.indexOf(' function summaryFor('));const orderDetails=new Map([['key',fresh]]),c=vm.createContext({orderDetails,detailsAt:new Map(),Date,Number,Math});vm.runInContext(body,c);
 assert.equal(c.rememberDetails('key',old),fresh);assert.equal(orderDetails.get('key'),fresh);
 c.rememberDetails('key',fresh);orderDetails.set('key',null);assert.equal(c.rememberDetails('key',old),null);assert.equal(orderDetails.get('key'),null);
});
test('details publish the latest central Export and respect an explicit failed-read null',()=>{
 const declaration=detail.match(/const currentDetails=\(\)=>\{[^\n]+/)[0];let current=fresh;const c=vm.createContext({getLatestDetails:()=>current,orderDetails:old});vm.runInContext(declaration+';globalThis.get=currentDetails;',c);
 assert.equal(c.get(),fresh);current=null;assert.equal(c.get(),null);current=undefined;assert.equal(c.get(),old);
 assert.match(detail,/withExportGlassSummary\(latestSummary,currentDetails\(\)/);assert.match(controller,/orderDetails\.set\(key,null\);summary=withExportGlassSummary\(summary,null/);
});
test('initial cache reuse is conditional, and fresh note reads update the shared cache first',()=>{
 assert.match(detail,/getLatestDetails\(\)===undefined\|\|getLatestDetails\(\)===initial/);
 assert.match(detail,/onRead:d=>\{orderDetails=d;onDetails\(d\);orderDetails=currentDetails\(\);tabs\?\.refreshGlass\(\);publish\(\);\}/);
});
test('a note read started before invalidation cannot publish after a failed polling read',()=>{
 assert.match(detail,/const generation=getDetailsGeneration\(\),value=await noteRead\(\);if\(generation!==getDetailsGeneration\(\)\)throw Error\('ORDER_DETAILS_UNAVAILABLE'\)/);
 assert.match(controller,/detailsGenerations\.set\(key,\(detailsGenerations\.get\(key\)\|\|0\)\+1\);orderDetails\.set\(key,null\)/);
});
