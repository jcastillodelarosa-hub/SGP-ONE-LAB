import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const start=app.indexOf('let currentAuth=null,currentAuthToken=null');
const source=app.slice(start,app.indexOf('async function applyUserAccess',start));
function harness(){
 const events={},calls=[],state={token:'',hidden:false,pickingVisible:false};let options,interval;
 const node={addEventListener:(name,fn)=>events['node:'+name]=fn,click:()=>calls.push('click')};
 const doc={querySelector:selector=>selector==='[data-view-panel="picking"]'?{hidden:!state.pickingVisible}:node,addEventListener:(name,fn)=>events[name]=fn,get hidden(){return state.hidden}};
 const win={addEventListener:(name,fn)=>events[name]=fn};
 const result=Function('mountPickingPdtFlow','document','window','setInterval','getAppToken','getSupabaseClient','openView','loadPicking','loadPickingReception','loadAluminumPending',source+';return {refreshPickingPdtFlow,auth:(auth,token,access=false)=>{currentAuth=auth;currentAuthToken=token;currentPickingPdtAccess=access;}};')(
  opts=>(options=opts,{refresh:()=>calls.push('refresh'),refreshNotices:()=>calls.push('notices'),reset:()=>calls.push('reset')}),doc,win,(fn,ms)=>{interval={fn,ms}},()=>state.token,async()=>({rpc:async(name,args)=>({name,args})}),view=>calls.push(view),async()=>calls.push('ordersDelivery'),async()=>calls.push('ordersReception'),async()=>calls.push('machining'));
 return {...result,options,state,calls,events,get interval(){return interval}};
}
test('Picking PDT polling gates session, role and effective access; global poll is notices only',()=>{
 const h=harness();assert.equal(h.interval.ms,30000);h.interval.fn();assert.deepEqual(h.calls,['reset']);
 h.state.token='T';h.auth({valida:true,usuario:'synthetic',rol:'PICKING'},'old',true);h.interval.fn();assert.equal(h.calls.at(-1),'reset');
 h.auth({valida:true,usuario:'synthetic',rol:'PICKING'},'T',false);h.interval.fn();assert.equal(h.calls.at(-1),'reset');
 h.auth({valida:true,usuario:'synthetic',rol:'LIDER MECANIZADO'},'T',true);h.interval.fn();assert.equal(h.calls.at(-1),'reset');
 h.auth({valida:true,usuario:'synthetic',rol:'PICKING'},'T',true);h.interval.fn();assert.equal(h.calls.at(-1),'notices');
 h.state.pickingVisible=true;h.interval.fn();assert.equal(h.calls.at(-1),'notices','timer never reloads queue or loaded pages');h.refreshPickingPdtFlow();assert.equal(h.calls.at(-1),'refresh');
 h.state.hidden=true;const count=h.calls.length;h.interval.fn();assert.equal(h.calls.length,count);
 h.state.hidden=false;h.state.pickingVisible=false;h.events.visibilitychange();assert.equal(h.calls.at(-1),'notices');
 h.state.token='new';h.events.storage();assert.equal(h.calls.at(-1),'reset');
});
test('mutation completion reloads prior order and machining readers without replacing their writers',async()=>{const h=harness();await h.options.onChanged();assert.deepEqual(h.calls,['ordersDelivery','ordersReception','machining']);h.options.onNavigate('entrega');assert.deepEqual(h.calls.slice(-2),['picking','click']);assert.equal(h.options.getActor(),null);});
test('new UI and stylesheet are included in release validation and no new production config is introduced',()=>{const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),verify=readFileSync(new URL('../scripts/verify-release.mjs',import.meta.url),'utf8');assert.match(html,/id="pickingPdtNotifications"/);assert.match(html,/picking-pdt-flow\.css\?v=\d+/);assert.match(verify,/src\/ui\/picking-pdt-flow\.js/);assert.match(verify,/picking-pdt-flow\.css/);assert.match(app,/currentAuth=auth\|\|null;currentPickingPdtAccess=false/);assert.match(app,/currentPickingPdtAccess=access\.some/);});
