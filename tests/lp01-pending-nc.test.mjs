import test from 'node:test';
import assert from 'node:assert/strict';
import {hydratePendingNc} from '../src/modules/lp01-pending-compact.js';
const section=refs=>({isConnected:true,entries:refs.map(ref=>({dataset:{pdtNc:ref},isConnected:true,textContent:'Consultando…'})),querySelectorAll(){return this.entries;}});
test('NC status deduplicates and limits lookup concurrency without altering quantities',async()=>{
 const s=section(['A','A','B','C','D']);let active=0,max=0;const calls=[];
 await hydratePendingNc(s,{lookupNc:async ref=>{calls.push(ref);active++;max=Math.max(max,active);await new Promise(resolve=>setTimeout(resolve,1));active--;return 'SOLUCIONADA';}},{alive:()=>true,denied:()=>false});
 assert.equal(new Set(calls).size,4);assert.equal(calls.length,4);assert.ok(max<=3);assert.ok(s.entries.every(e=>e.textContent==='SOLUCIONADA'));
});
test('late lookup cannot update a disposed panel',async()=>{
 const s=section(['A']);let live=true,release;const pending=hydratePendingNc(s,{lookupNc:()=>new Promise(r=>release=r)},{alive:()=>live,denied:()=>false});
 await Promise.resolve();live=false;release('SOLUCIONADA');await pending;assert.equal(s.entries[0].textContent,'Consultando…');
});
test('revocation stops remaining lookups and preserves the revoked result',async()=>{
 const s=section(['A','B','C','D','E']);let live=true,calls=0,revoked=false;
 await hydratePendingNc(s,{lookupNc:async()=>{calls++;throw Error('NO_AUTORIZADO');}},{alive:()=>live,denied:e=>{assert.equal(e.message,'NO_AUTORIZADO');live=false;revoked=true;return true;}});
 assert.ok(revoked);assert.ok(calls<=3);assert.ok(s.entries.every(e=>e.textContent==='Consultando…'));
});
