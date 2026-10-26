import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const saveSource=app.slice(app.indexOf('async function saveProgramming()'),app.indexOf("document.querySelector('#progRefresh')"));
function programming({produccion=null,orders=[{produccion:'PANEL-A',cantidad:8},{produccion:'PANEL-B',cantidad:57}],coverage=[]}={}){
 const calls=[],alerts=[],reloads=[];let closed=0;
 const values={'#progQty':8,'#progDate':'2026-10-26','#progShift':'TURNO 1','#progPriority':1,'#progObs':'QA','#progOrderObs':''};
 const deps={progSelection:{reserva:'8707142',produccion,maxQty:65,part:{prioridad:1,ordenes:orders}},progOrderCoverage:coverage,getAppToken:()=> 'SYNTHETIC',document:{querySelector:s=>({value:values[s]}),querySelectorAll:()=>[]},alert:m=>alerts.push(m),getSupabaseClient:async()=>({rpc:async(name,args)=>{calls.push({name,args});return {error:null};}}),closeProgModal:()=>closed++,loadProgramming:async args=>reloads.push(args)};
 const save=new Function(...Object.keys(deps),saveSource+';return saveProgramming;')(...Object.values(deps));
 return {save,calls,alerts,reloads,closed:()=>closed};
}
test('PR101 preserved: shared reservation schedules only the unique production matching its quantity',async()=>{
 const h=programming();await h.save();assert.equal(h.calls.length,1);assert.equal(h.calls[0].name,'sgp_mecanizado_programar');assert.equal(h.calls[0].args.p_reserva,'8707142');assert.equal(h.calls[0].args.p_produccion,'PANEL-A');assert.equal(h.calls[0].args.p_cantidad,8);assert.deepEqual(h.alerts,[]);assert.equal(h.closed(),1);assert.deepEqual(h.reloads,[{invalidateCarry:true}]);
});
test('PR101 preserved: ambiguous or already-programmed part is rejected before any write',async()=>{
 for(const options of [{orders:[{produccion:'A',cantidad:8},{produccion:'B',cantidad:8}]},{coverage:[{reserva:'8707142',prioridad_semanal:1,produccion:'PANEL-A',estado_orden:'PROGRAMADA'}]}]){
  const h=programming(options);await h.save();assert.equal(h.calls.length,0);assert.equal(h.closed(),0);assert.equal(h.reloads.length,0);assert.match(h.alerts[0],/Programar esta orden/);
 }
});
test('PR101 preserved: explicitly selected production keeps the original RPC contract',async()=>{
 const h=programming({produccion:'EXPLICIT-PANEL'});await h.save();assert.equal(h.calls[0].args.p_produccion,'EXPLICIT-PANEL');assert.equal(h.calls[0].args.p_prioridad_semanal,'1');assert.equal(h.calls[0].args.p_turno,'TURNO 1');assert.equal(h.calls[0].args.p_fecha,'2026-10-26');
});
test('PR101 preserved: missing material aggregates weeks/finishes without inventing a unique finish',async()=>{
 const nodes=new Map(),calls=[];const node=s=>{if(!nodes.has(s))nodes.set(s,{textContent:'',innerHTML:''});return nodes.get(s);};
 const metadata=[{reserva:'8707142',semana_prog:44,acabado:'DS'},{reserva:'8707142',semana_prog:45,acabado:'BL'},{reserva:'8707142',semana_prog:44,acabado:'DS'}];
 const missing=[{id_faltante:'QA',reserva:'8707142',perfil:'PANEL',cantidad:8,estado:'PENDIENTE',dias:1}];
 const deps={getAppToken:()=> 'SYNTHETIC',getSupabaseClient:async()=>({rpc:async(name,args)=>{calls.push({name,args});return {data:name==='sgp_recepcion_listar'?metadata:missing,error:null};}}),document:{querySelector:node,querySelectorAll:()=>[]},escapeHtml:x=>String(x??''),missingTraffic:d=>d>=3?'red':d>=2?'amber':'green',trafficLabel:()=> 'EN TIEMPO',missingDate:x=>x||'—',openMissingReceive:()=>{throw Error('Read must not receive material');}};
 const source=app.slice(app.indexOf('async function loadMissing()'),app.indexOf('function openMissingReceive('));
 await new Function(...Object.keys(deps),'let missingReportRows=[];'+source+';return loadMissing;')(...Object.values(deps))();
 assert.deepEqual(calls.map(x=>x.name),['sgp_recepcion_faltantes_listar','sgp_recepcion_listar']);assert.equal(calls[1].args.p_semana,null);assert.match(node('#missingBody').innerHTML,/<td>8707142<\/td><td>44 \/ 45<\/td><td>BL \/ DS<\/td><td>PANEL<\/td>/);assert.equal(node('#missOpen').textContent,1);
});
