import test from 'node:test';
import assert from 'node:assert/strict';
import {orderDetailsTransport} from '../src/services/lp01-order-details.js';
import {orderNoteEditor} from '../src/domain/lp01-order-note-editor.js';
const key='QA|PANELES_2',line='PANELES_2',stage='ENSAMBLE';
const data=()=>({contract:'LP-ORDER-DETAILS-1',key,line,stage,note:{revision:0,observation:''},history:[],capabilities:['READ','NOTE'],export:{quantity:'3',percentage:'50',present:true}});
const transport=response=>orderDetailsTransport({key,line,stage,getToken:()=> 'qa',client:{rpc:async()=>response}});
test('new details contract returns exact estimate and rejects foreign identity or malformed note history',async()=>{
 assert.equal((await transport({data:data()}).read()).glass.exact,'1.5');
 for(const override of [{key:'OTHER|PANELES_2'},{line:'FRAMES_2'},{stage:'EMPAQUE'},{history:[{}]},{capabilities:['NOTE']},{note:{revision:0,observation:null}},{export:{quantity:3,percentage:'50',present:true}}])await assert.rejects(transport({data:{...data(),...override}}).read());
});
test('missing backend cannot advertise persistence; invalid save acknowledgement is uncertain',async()=>{
 await assert.rejects(transport({error:{code:'PGRST202',message:'function missing'}}).read(),/ORDER_DETAILS_UNAVAILABLE/);
 await assert.rejects(transport({data:{contract:'wrong'}}).save({id:'a',revision:0,observation:'x'}),/RESPONSE_UNCERTAIN/);
});
test('session switch rejects late response',async()=>{
 let token='first';const t=orderDetailsTransport({key,line,stage,getToken:()=>token,client:{rpc:async()=>{token='second';return {data:data()};}}});
 await assert.rejects(t.read(),/NO_AUTORIZADO/);
});
test('editor keeps dirty draft on refresh, conflicts require reload, uncertain retry uses same command',async()=>{
 const sent=[];let fail='uncertain';const t={isCurrent:()=>true,read:async()=>data(),save:async c=>{sent.push(c);if(fail){const e=Error(fail);e.confirmedRejected=fail==='conflict';throw e;}return {revision:1,observation:c.observation};}};
 const editor=orderNoteEditor(t,{uuid:()=> 'stable'});
 await assert.rejects(editor.save(),/DISABLED/);await editor.load();editor.edit('Draft');await editor.load();assert.equal(editor.state.draft,'Draft');
 await assert.rejects(editor.save(),/uncertain/);assert.equal(editor.state.status,'UNCERTAIN');assert.throws(()=>editor.edit('other'),/PENDING/);await assert.rejects(editor.load(),/PENDING/);
 fail=null;await editor.save();assert.equal(sent[0],sent[1]);assert.equal(editor.state.status,'SAVED');assert.equal(editor.state.snapshot.note.observation,'Draft');
 await editor.load();editor.edit('Second');fail='conflict';await assert.rejects(editor.save(),/conflict/);assert.equal(editor.state.draft,'Second');assert.equal(editor.state.status,'RELOAD_REQUIRED');await assert.rejects(editor.save(),/DISABLED/);
});
test('revocation clears draft and pending token-bound write',async()=>{
 let current=true;const editor=orderNoteEditor({isCurrent:()=>current,read:async()=>data(),save:async()=>{throw Error('unknown');}},{uuid:()=> 'a'});
 await editor.load();editor.edit('private');await assert.rejects(editor.save());current=false;await assert.rejects(editor.save(),/NO_AUTORIZADO/);assert.equal(editor.state.draft,'');assert.equal(editor.state.pending,null);
});
test('server-side read revocation clears an already loaded private draft',async()=>{
 let denied=false;const editor=orderNoteEditor({isCurrent:()=>true,read:async()=>{if(denied)throw Error('NO_AUTORIZADO');return data();}});
 await editor.load();editor.edit('private');denied=true;await assert.rejects(editor.load(),/NO_AUTORIZADO/);assert.equal(editor.state.snapshot,null);assert.equal(editor.state.draft,'');
});
