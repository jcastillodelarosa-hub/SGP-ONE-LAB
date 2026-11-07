import test from 'node:test';
import assert from 'node:assert/strict';
import {canIncorporateAssembly,incorporationInput} from '../src/modules/lp01-assembly-incorporate.js';
const context={line:'PANELES_2',stage:'ENSAMBLE'};
const data=()=>({contract:'LP-OPERACION-1',writeContract:'LP-OPERACION-CAS-2',writes:true,turn:{estado:'ABIERTO',revision:2},incorporation:{contract:'LP-INCORPORAR-1',enabled:true,canIncorporate:true,...context}});
const row={key:'QA|PANELES_2',state:'OTRAS',balance:6,oficial:{activa:'SI'}};
test('incorporation requires exact server capability and open writable pilot context',()=>{
 assert.equal(canIncorporateAssembly(data(),context),true);
 for(const mutate of [d=>delete d.incorporation,d=>d.incorporation.enabled=false,d=>d.incorporation.canIncorporate=false,d=>d.incorporation.contract='other',d=>d.incorporation.stage='EMPAQUE',d=>d.incorporation.line='FRAMES_2',d=>d.turn.estado='CERRADO',d=>d.turn.revision=null,d=>d.turn.revision=-1,d=>d.writes=false,d=>d.writeContract='old']){const d=data();mutate(d);assert.equal(canIncorporateAssembly(d,context),false);}
 assert.equal(canIncorporateAssembly({...data(),role:'ADMINISTRADOR',incorporation:null},context),false);
 assert.equal(canIncorporateAssembly(data(),{...context,stage:'EMPAQUE'}),false);
});
test('explicit quantity and reason, active other order, never inferred from manual execution',()=>{
 assert.deepEqual(incorporationInput(row,'3',' Cambio acordado '),{key:row.key,quantity:3,observation:'Cambio acordado'});
 for(const value of ['',null,0,-1,'1.5','07',7,Infinity])assert.throws(()=>incorporationInput(row,value,'motivo'));
 for(const patch of [{key:'QA|FRAMES_2'},{key:'|PANELES_2'},{key:null},{state:'ABIERTAS'},{state:'PROGRAMADAS'},{balance:null},{balance:0},{oficial:{activa:'NO'}}])assert.throws(()=>incorporationInput({...row,...patch},1,'motivo'));
 for(const reason of ['','   ','x'.repeat(2001)])assert.throws(()=>incorporationInput(row,1,reason));
});
