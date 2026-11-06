import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const start=app.indexOf('async function loadNcGlassOperational()');
const body=app.slice(start,app.indexOf('document.querySelector("#loadNcGlassView")',start));
function fixture(){let resolve,token='A',renders=0;const nodes=new Map();const node=key=>{if(!nodes.has(key))nodes.set(key,{textContent:'',innerHTML:'',value:''});return nodes.get(key);};const context=vm.createContext({ncGlassLoadSequence:0,ncGlassViewSession:null,ncGlassViewRows:[],getAppToken:()=>token,renderNcGlassView:()=>++renders,getSupabaseClient:async()=>({rpc:()=>new Promise(r=>resolve=r)}),document:{querySelector:node}});vm.runInContext(body+';globalThis.load=loadNcGlassOperational;',context);return {context,node,resolve:value=>resolve(value),change:()=>token='B',renders:()=>renders};}
test('late NC source response from prior session cannot replace rows or enable navigation',async()=>{const x=fixture(),p=x.context.load();await new Promise(setImmediate);x.change();x.resolve({data:{rows:[{consecutivo:'old'}],semanas_abiertas:[45]}});await p;assert.equal(x.context.ncGlassViewSession,null);assert.equal(x.context.ncGlassViewRows.length,0);});
test('fresh source is tied to the exact session and load failure clears its action',async()=>{const x=fixture(),p=x.context.load();await new Promise(setImmediate);x.resolve({data:{rows:[{consecutivo:'17'}],semanas_abiertas:[45]}});await p;assert.equal(x.context.ncGlassViewSession,'A');assert.equal(x.context.ncGlassViewRows[0].consecutivo,'17');const next=x.context.load();await new Promise(setImmediate);assert.equal(x.context.ncGlassViewSession,null);x.resolve({error:Error('denied')});await next;assert.equal(x.context.ncGlassViewRows.length,0);assert.match(x.node('#ncGlassViewStatus').textContent,/denied/);});
test('source reload generation rejects an older response',async()=>{const x=fixture(),first=x.context.load();await new Promise(setImmediate);
// The controller guard is exercised by changing the generation while the first read is pending.
x.context.ncGlassLoadSequence++;x.resolve({data:{rows:[{consecutivo:'old'}],semanas_abiertas:[]}});await first;assert.equal(x.context.ncGlassViewRows.length,0);assert.equal(x.context.ncGlassViewSession,null);});
