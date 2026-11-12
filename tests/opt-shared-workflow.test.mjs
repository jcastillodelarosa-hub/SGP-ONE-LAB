import test from 'node:test';import assert from 'node:assert/strict';
import {approvedReferences,createCutJournal} from '../opt-digital/shared-cuts.js';
const uuid='01234567-89ab-4cde-8fab-0123456789ab';
const command={version:1,reserva:'R',piezas:[uuid],idempotencyKey:uuid};
class MemoryStorage {items=new Map();get length(){return this.items.size;}key(i){return [...this.items.keys()][i]??null;}getItem(k){return this.items.get(k)??null;}setItem(k,v){this.items.set(k,v);}removeItem(k){this.items.delete(k);}}
const scope={linea:'PANELES_2',anio:2026,semana:46,modo:'BASE'};
test('shared view requires exact server scope; filename alone never enables a cut',()=>{
 const group={scope,canRegister:true,reservation:'R',origin:'RETAIL',system:'PANEL',opts:['OPT-1']},ref={fuentes:[{origen:'RETAIL',source_key:'source',consecutivo:'OPT-1',modo_carga:'INDICE'}],sistema:'PANEL',sha256:'hash'};
 const state={scope,reserva:'R',habilitado:true,manifiesto_validado:true,referencias:[ref,{...ref,sistema:'FRAME'},{...ref,fuentes:[{...ref.fuentes[0],origen:'PROYECTO'}]},{...ref,fuentes:[{...ref.fuentes[0],consecutivo:'OPT-10'}]}]};
 assert.equal(approvedReferences(state,group).length,1);assert.equal(approvedReferences(state,group,[{name:'OPT-1.pdf',format:'pdf',key:'different'}])[0].localPdf,undefined);
 assert.equal(approvedReferences(state,group,[{name:'original.pdf',format:'pdf',key:'hash'}])[0].localPdf.key,'hash');
 for(const changed of [{reserva:'other'},{habilitado:false},{manifiesto_validado:false},{scope:{...scope,semana:45}},{scope:null}])assert.deepEqual(approvedReferences({...state,...changed},group),[]);
 const individual={...group,origin:'INDIVIDUAL',documentHashes:['hash']};assert.equal(approvedReferences({...state,referencias:[ref]},individual).length,1);
 assert.equal(approvedReferences({...state,referencias:[ref]},{...individual,documentHashes:['other']}).length,0);
});
test('pending journal persists exact command across reload and separates users',()=>{
 const storage=new MemoryStorage(),j=createCutJournal(storage,'alice');j.save(command);assert.deepEqual(createCutJournal(storage,'alice').read(),command);assert.equal(createCutJournal(storage,'bob').read(),null);
 assert.throws(()=>j.save({...command,idempotencyKey:'11234567-89ab-4cde-8fab-0123456789ab'}),/pendiente/);j.clear(command);j.clear(command);assert.equal(j.read(),null);
});
test('one key per command retains independently prepared concurrent operations',()=>{
 const storage=new MemoryStorage(),j=createCutJournal(storage,'alice');j.save(command);const other={...command,idempotencyKey:'11234567-89ab-4cde-8fab-0123456789ab'};storage.setItem('sgp-opt-pending-v1:alice:'+other.idempotencyKey,JSON.stringify(other));j.clear(command);assert.deepEqual(j.read(),other);
});
test('invalid or changed journals fail closed rather than erase history',()=>{
 const storage=new MemoryStorage(),j=createCutJournal(storage,'alice');assert.throws(()=>j.save({...command,piezas:['local-review-mark']}),/inválido/);j.save(command);assert.throws(()=>j.clear({...command,reserva:'other'}),/cambió/);storage.setItem('sgp-opt-pending-v1:alice:'+uuid,'invalid');assert.throws(()=>j.read());assert.equal(storage.length,1);
});
test('storage readback failure blocks submission',()=>{
 const storage=new MemoryStorage();storage.setItem=()=>{};assert.throws(()=>createCutJournal(storage,'alice').save(command),/conservar/);
});

test('v2 journal persists exact scope without promoting legacy operations',()=>{
 const storage=new MemoryStorage(),journal=createCutJournal(storage,'alice'),v2={...command,version:2,scope};journal.save(v2);assert.deepEqual(journal.read(),v2);assert.equal('periodo' in journal.read(),false);assert.equal('usuario' in journal.read(),false);
 assert.throws(()=>journal.clear({...v2,scope:{...scope,semana:45}}),/cambió/);assert.deepEqual(journal.read(),v2);journal.clear(v2);
 for(const bad of [null,{...scope,modo:'ACTUAL'}])assert.throws(()=>journal.save({...v2,scope:bad}),/inválido/);
 journal.save(command);assert.equal(journal.read().version,1);assert.equal(journal.read().scope,undefined);
});
