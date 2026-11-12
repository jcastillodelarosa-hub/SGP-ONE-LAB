import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const names=['repoIsActive','repoIsValidated','repoDashboardGroups','repoValidationBadgeHtml','repoStateControlHtml'];
const context=vm.createContext({escapeHtml:String});
vm.runInContext(names.map(n=>app.split('\n').find(l=>l.startsWith('function '+n+'('))).join('\n'),context);
const row=(id,extra={})=>({id_pendiente:id,estado:'PENDIENTE',estado_repo:'PENDIENTE',validacion_estado:'POR_VALIDAR',...extra});
test('dashboard uses validation independently of machining state and contract',()=>{
 for(const contrato_pdt of ['LEGACY','V2']){
 const groups=context.repoDashboardGroups([row('pending',{contrato_pdt}),row('ready',{contrato_pdt,estado_repo:'REPO_OK'}),row('progress',{contrato_pdt,validacion_estado:'VALIDADO',estado_repo:'MECANIZADO'}),row('processed',{contrato_pdt,validacion_estado:'VALIDADO',estado_repo:'PROCESADO',cantidad_entregada:2}),row('delivered',{contrato_pdt,validacion_estado:'VALIDADO',estado:'RESUELTO',estado_repo:'PICKING'})]);
 assert.deepEqual(Array.from(groups.pending,r=>r.id_pendiente),['pending','ready']);
 assert.deepEqual(Array.from(groups.progress,r=>r.id_pendiente),['progress']);
 assert.deepEqual(Array.from(groups.processed,r=>r.id_pendiente),['processed']);
 assert.deepEqual(Array.from(groups.delivered,r=>r.id_pendiente),['delivered']);
 }
});
test('historical closure with unchanged physical/validation state is never pending or validated',()=>{
 const rows=[row('historical45',{estado:'RESUELTO',semana:45}),row('historical44',{estado:'RESUELTO',semana:44}),row('old-picking',{estado_repo:'PICKING'}),row('missing-validation',{estado:'RESUELTO',validacion_estado:null})];
 const groups=context.repoDashboardGroups(rows);
 assert.equal(groups.historical.length,4);
 for(const key of ['pending','progress','processed','delivered'])assert.equal(groups[key].length,0);
 for(const r of rows)assert.match(context.repoValidationBadgeHtml(r,true),/HISTÓRICO/);
});
test('server-confirmed validation moves the row without mutating its identity or quantities',()=>{
 const before=row('same',{cantidad:9,contrato_pdt:'V2'}),saved=structuredClone(before);
 assert.equal(context.repoDashboardGroups([before]).pending.length,1);
 assert.deepEqual(before,saved);
 const after={...before,validacion_estado:'VALIDADO'};
 assert.equal(context.repoDashboardGroups([after]).pending.length,0);
 assert.equal(context.repoDashboardGroups([after]).progress[0],after);
 assert.match(app,/repoCloseWorkModal\(\);await loadRepoPending\(\)/);
 assert.match(app,/pdtReportCsv\(repoVisibleRows\)/);
 assert.match(app,/#repoDeliveredBody \[data-repo-action="v2"\]/);
});

test('historical resolved legacy retains its actual physical state without editable controls',()=>{
 const html=context.repoStateControlHtml(row('historical',{estado:'RESUELTO'}),true);
 assert.match(html,/PENDIENTE · HISTÓRICO/);
 assert.doesNotMatch(html,/<select|PICKING/);
});
