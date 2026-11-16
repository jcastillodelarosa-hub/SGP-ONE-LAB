import test from 'node:test';import assert from 'node:assert/strict';
import {sharedOrderTransport} from '../src/services/lp01-shared-order.js';
import {sharedOrderSummary} from '../src/domain/lp01-shared-order-summary.js';
import {compactSummaryMarkup} from '../src/modules/lp01-affectation-summary.js';
const scope={key:'K|PANELES_2',line:'PANELES_2',stage:'ENSAMBLE'};
const report={id:'r1',key:scope.key,cause:'NC_V',origin_stage:'ENSAMBLE',nc_reference:'12922461',quantity:1,solved:0,confirmed:0};
const data={contract:'LP-SHARED-ORDER-1',...scope,revision:1,canReport:true,reports:[report],history:[{revision:1,reportId:'r1'}],legacyReports:[],accessories:[]};
const state={contract:'NCV-ORDER-STATE-1',...scope,rows:[{reference:'12922461',state:'CERRADA',active:true}]};
function setup(response={data:state}){let token='A';const calls=[];const transport=sharedOrderTransport({...scope,getToken:()=>token,client:{rpc:async(name,args)=>{calls.push({name,args});if(name==='sgp_lp_shared_order_read_v1')return {data};return typeof response==='function'?response(()=>{token='B'}):response;}}});return {transport,calls};}
test('Seguimiento and Ensamble consume the same scoped state/summary without global NC lookup',async()=>{
 const x=setup();const d=await x.transport.read();assert.equal(d.reports[0].sourceNotice.state,'CERRADA');assert.equal(d.reports[0].confirmed,0);assert.equal(d.reports[0].solved,0);
 const native={...scope,reports:[],aluminumPending:{status:'AVAILABLE',rows:[]}};
 const summary=sharedOrderSummary(native,d);assert.match(compactSummaryMarkup(summary),/NCV finalizada · 12922461/);assert.equal(summary.categories.NC_V,1);
 assert.deepEqual(x.calls.map(c=>c.name),['sgp_lp_shared_order_read_v1','sgp_lp_shared_nc_states_v1']);assert.deepEqual(x.calls[1].args,{p_token:'A',p_key:scope.key,p_stage:'ENSAMBLE'});
});
test('ambiguous, unknown, inactive, reopened and wrong-scope state never turns green',async()=>{
 for(const value of [{...state,rows:[...state.rows,...state.rows]},{...state,rows:[{...state.rows[0],active:false}]},{...state,rows:[{...state.rows[0],state:'ABIERTA'}]},{...state,rows:[{...state.rows[0],state:'UNKNOWN'}]},{...state,key:'OTHER|PANELES_2'},{...state,rows:[{...state.rows[0],reference:'OTHER'}]}]){
 const d=await setup({data:value}).transport.read();assert.ok(!d.reports[0].sourceNotice);assert.equal(d.reports[0].quantity,1);
 }
});
test('missing optional state reader retains reports, while revocation or late-session data is rejected',async()=>{
 const d=await setup({error:{code:'42883',message:'missing'}}).transport.read();assert.equal(d.reports[0].nc_reference,'12922461');assert.ok(!d.reports[0].sourceNotice);
 await assert.rejects(setup({error:{code:'42501',message:'NO_AUTORIZADO'}}).transport.read(),/NO_AUTORIZADO/);
 await assert.rejects(setup(change=>{change();return {data:state};}).transport.read(),/NO_AUTORIZADO/);
});
