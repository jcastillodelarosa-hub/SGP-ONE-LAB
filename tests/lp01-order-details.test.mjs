import test from 'node:test';
import assert from 'node:assert/strict';
import {orderDetailsTransport} from '../src/services/lp01-order-details.js';
import {orderNoteEditor} from '../src/domain/lp01-order-note-editor.js';
import {mountOrderNote} from '../src/modules/lp01-order-note.js';
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
test('dirty draft retains r1 after B saves r2 and refresh; explicit discard adopts r2',async()=>{
 let stored={revision:1,observation:'Initial'},sent;
 const editor=orderNoteEditor({isCurrent:()=>true,read:async()=>({...data(),note:{...stored}}),save:async cmd=>{
  sent=cmd;if(cmd.revision!==stored.revision){const e=Error('ORDER_NOTE_REVISION_STALE');e.confirmedRejected=true;throw e;}
  stored={revision:stored.revision+1,observation:cmd.observation};return stored;
 }},{uuid:()=> 'race'});
 await editor.load();editor.edit('Draft A');stored={revision:2,observation:'Saved by B'};await editor.load();
 assert.equal(editor.state.snapshot.note.revision,2);assert.equal(editor.state.draft,'Draft A');assert.equal(editor.state.draftRevision,1);
 await assert.rejects(editor.save(),/REVISION_STALE/);assert.equal(sent.revision,1);assert.equal(stored.observation,'Saved by B');
 await editor.load();assert.equal(editor.state.draftRevision,1);assert.equal(editor.state.draft,'Draft A');
 editor.discardDraft();assert.equal(editor.state.draft,'Saved by B');assert.equal(editor.state.draftRevision,2);
 editor.edit('A after reviewing B');await editor.save();assert.equal(stored.revision,3);
});

// Control-state double only; actual browser geometry remains in browser.py.
function noteControls(withCancel=false){
 const input={value:'',disabled:true},save={disabled:true},refresh={disabled:false},discard={hidden:true},status={},text={},current={hidden:true,querySelector:()=>text};
 const cancel={disabled:false};
 const controls={'textarea':input,'[data-order-note-save]':save,'[data-order-note-refresh]':refresh,'[data-order-note-discard]':discard,'[role=status]':status,'[data-order-note-current]':current};
 if(withCancel)controls['[data-order-note-cancel]']=cancel;
 return {host:{isConnected:true,querySelector:selector=>controls[selector]},input,save,refresh,discard,status,current,text,cancel};
}
const deferredNote=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const noteTick=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};

test('note controls stay locked through post-save reread, then preserve A against B revision',async()=>{
 const ui=noteControls(),reread=deferredNote(),commands=[];let reads=0,stored={revision:0,observation:''};
 const snapshot=()=>({...data(),note:{...stored}});
 const transport={isCurrent:()=>true,read:()=>++reads===2?reread.promise:Promise.resolve(snapshot()),save:async cmd=>{
  commands.push({...cmd});if(cmd.revision!==stored.revision){const error=Error('ORDER_NOTE_REVISION_STALE');error.confirmedRejected=true;throw error;}
  stored={revision:stored.revision+1,observation:cmd.observation};return {...stored};
 }};
 mountOrderNote(ui.host,transport);await noteTick();ui.input.value='Borrador general';ui.input.oninput();
 const saving=ui.save.onclick();await noteTick();assert.equal(reads,2);assert.match(ui.status.textContent,/guardada/);
 assert.equal(ui.input.disabled,true);assert.equal(ui.refresh.disabled,true);assert.equal(ui.save.disabled,true);
 reread.resolve(snapshot());await saving;assert.equal(ui.input.disabled,false);assert.equal(ui.refresh.disabled,false);
 ui.input.value='Edición A';ui.input.oninput();stored={revision:2,observation:'Edición B'};
 const refreshing=ui.refresh.onclick();assert.equal(ui.input.disabled,true);assert.equal(ui.refresh.disabled,true);await refreshing;
 assert.equal(ui.input.value,'Edición A');assert.equal(ui.current.hidden,false);assert.equal(ui.text.textContent,'Edición B');
 await ui.save.onclick();assert.equal(commands.at(-1).revision,1);assert.equal(stored.observation,'Edición B');assert.match(ui.status.textContent,/Otra persona/);
});

test('note refresh disables controls until a denied read clears the private draft',async()=>{
 const ui=noteControls(),wait=deferredNote();let reads=0;
 mountOrderNote(ui.host,{isCurrent:()=>true,read:()=>++reads===1?Promise.resolve(data()):wait.promise});await noteTick();
 ui.input.value='private draft';ui.input.oninput();const reading=ui.refresh.onclick();
 assert.equal(ui.input.disabled,true);assert.equal(ui.refresh.disabled,true);assert.equal(ui.save.disabled,true);
 wait.reject(Error('NO_AUTORIZADO'));await reading;
 assert.equal(ui.input.value,'');assert.equal(ui.input.disabled,true);assert.equal(ui.current.hidden,true);assert.match(ui.status.textContent,/Acceso revocado/);
});

test('failed post-save reread retains acknowledged note and revision for later edits',async()=>{
 const ui=noteControls(),wait=deferredNote(),commands=[];let reads=0,stored={revision:0,observation:''};
 mountOrderNote(ui.host,{isCurrent:()=>true,read:()=>++reads===2?wait.promise:Promise.resolve({...data(),note:{...stored}}),save:async cmd=>{
  commands.push({...cmd});stored={revision:cmd.revision+1,observation:cmd.observation};return {...stored};
 }});await noteTick();ui.input.value='Confirmed note';ui.input.oninput();const saving=ui.save.onclick();await noteTick();
 assert.equal(ui.input.disabled,true);wait.reject(Error('ORDER_DETAILS_UNAVAILABLE'));await saving;
 assert.match(ui.status.textContent,/Observación guardada\. No se pudo actualizar/);assert.equal(ui.input.value,'Confirmed note');
 assert.equal(commands.length,1);assert.equal(ui.refresh.disabled,false);assert.equal(ui.save.disabled,true);
 await ui.refresh.onclick();ui.input.value='Next edit';ui.input.oninput();await ui.save.onclick();
 assert.equal(commands[1].revision,1);assert.equal(stored.observation,'Next edit');
});


test('compact cancel cannot abandon a busy or uncertain save; confirmed save publishes preview before reread',async()=>{
 const ui=noteControls(true),read=deferredNote(),commands=[],published=[];let reads=0,cancelled=0,lost=true,stored={revision:0,observation:''};
 mountOrderNote(ui.host,{isCurrent:()=>true,read:()=>++reads===2?read.promise:Promise.resolve({...data(),note:{...stored}}),save:async cmd=>{
  commands.push({...cmd});stored={revision:1,observation:cmd.observation};if(lost){lost=false;throw Error('uncertain');}return {...stored};
 }},{onSaved:d=>published.push(d.note),onCancel:()=>cancelled++});
 assert.equal(ui.cancel.disabled,true);ui.cancel.onclick();assert.equal(cancelled,0);await noteTick();
 ui.input.value='Desde compacta';ui.input.oninput();assert.equal(ui.cancel.textContent,'Cancelar');
 await ui.save.onclick();assert.equal(ui.cancel.disabled,true);ui.cancel.onclick();assert.equal(cancelled,0);
 const retry=ui.save.onclick();await noteTick();assert.deepEqual(commands[0],commands[1]);
 assert.deepEqual(published,[{revision:1,observation:'Desde compacta'}]);assert.equal(ui.cancel.disabled,true);
 read.resolve({...data(),note:{...stored}});await retry;assert.equal(ui.cancel.disabled,false);assert.equal(ui.cancel.textContent,'Cerrar');
 ui.cancel.onclick();assert.equal(cancelled,1);
});

test('compact cancel makes no write; read-only capability never enables note save',async()=>{
 const ui=noteControls(true);let cancelled=0,writes=0;
 mountOrderNote(ui.host,{isCurrent:()=>true,read:async()=>({...data(),capabilities:['READ'],note:{revision:1,observation:'Compartida'}}),save:async()=>{writes++;}},{onCancel:()=>cancelled++});
 await noteTick();assert.equal(ui.input.value,'Compartida');assert.equal(ui.input.disabled,true);assert.equal(ui.save.disabled,true);
 ui.cancel.onclick();assert.equal(cancelled,1);assert.equal(writes,0);
});
