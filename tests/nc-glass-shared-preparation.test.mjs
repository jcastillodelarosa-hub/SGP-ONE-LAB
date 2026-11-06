import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/modules/lp01-shared-affectations-panel.js',import.meta.url),'utf8');
const start=source.indexOf('onPrepare:async({reference,stage})=>{')+'onPrepare:async({reference,stage})=>'.length;
const end=source.indexOf('\n   }});',start)+5;
const body=source.slice(start,end);
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function setup({canReport=true,read=async()=>({reports:[]})}={}){
 const wait=deferred(),old={state:{draft:null,busy:false,uncertain:false}},next={shared:{},read};
 const nextEditor={state:{snapshot:{canReport,reports:[],legacyReports:[]}},refresh:()=>wait.promise};let shown=0;const locks=[];
 const c=vm.createContext({alive:()=>true,ncReview:{isCurrent:()=>true,getTransport:()=>next},sequence:0,editor:old,transport:null,native:null,prefillNc:null,preparing:false,form:{isConnected:true},sharedOrderEditor:()=>nextEditor,show:()=>shown++,update:()=>locks.push(c.preparing)});
 vm.runInContext('globalThis.prepare=async({reference,stage})=>'+body,c);
 return {c,old,next,nextEditor,wait,locks,shown:()=>shown};
}
test('preparing locks the old form before reading and refuses a newly dirty editor',async()=>{
 const x=setup(),p=x.c.prepare({reference:'NC-1',stage:'EMPAQUE'});assert.equal(x.c.preparing,true);assert.equal(x.locks[0],true);
 x.old.state.draft={observation:'Changed during read'};x.wait.resolve();await assert.rejects(p,/formulario cambió/);
 assert.equal(x.c.editor,x.old);assert.equal(x.shown(),0);assert.equal(x.c.preparing,false);assert.equal(x.old.state.draft.observation,'Changed during read');
});
test('read failure or denied stage releases controls without replacing the old editor',async()=>{
 const failed=setup(),p=failed.c.prepare({reference:'NC-1',stage:'EMPAQUE'});failed.wait.reject(Error('read failed'));await assert.rejects(p,/read failed/);assert.equal(failed.c.preparing,false);assert.equal(failed.c.editor,failed.old);
 const denied=setup({canReport:false}),q=denied.c.prepare({reference:'NC-1',stage:'EMPAQUE'});denied.wait.resolve();await assert.rejects(q,/no puede registrar/);assert.equal(denied.c.editor,denied.old);assert.equal(denied.shown(),0);
});
test('explicit stage prepares only the reference; no command or link is executed',async()=>{
 const x=setup(),p=x.c.prepare({reference:'NC-1',stage:'EMPAQUE'});x.wait.resolve();await p;assert.equal(x.c.editor,x.nextEditor);assert.equal(x.c.prefillNc,'NC-1');assert.equal(x.c.preparing,false);assert.equal(x.shown(),1);
 assert.doesNotMatch(body,/\.command\(|LINK_NC|quantity\s*=/);
 assert.match(source,/form\.elements\.quantity\.value='';quantityEdited=true/);assert.match(source,/const locked=preparing\|\|editor\.state\.busy/);
});
test('an existing draft prevents even starting a stage read',async()=>{
 const x=setup();x.old.state.draft={quantity:1};await assert.rejects(x.c.prepare({reference:'NC-1',stage:'EMPAQUE'}),/Guarda o descarta/);assert.equal(x.c.preparing,false);assert.equal(x.locks.length,0);
});
