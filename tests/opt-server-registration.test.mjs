import test from 'node:test';
import assert from 'node:assert/strict';
import {createOptSharedCuts} from '../src/services/opt-shared-cuts.js';
const scope={linea:'PANELES_2',anio:2026,semana:46,modo:'BASE'},sha='a'.repeat(64);
const group={scope,canRegister:false,reservation:'R',origin:'RETAIL',system:'PANEL',opts:['OPT-1']},documents=[{format:'pdf',key:sha}];
const state=()=>({contract_version:2,scope:{...scope},habilitado:true,reserva:'R',manifiesto_validado:true,puede_registrar:true,totales:{piezas:1,cortadas:0,pendientes:1},referencias:[{id_documento:'01234567-89ab-4cde-8fab-0123456789ab',sha256:sha,fuentes:[{source_key:'RETAIL',origen:'RETAIL',consecutivo:'OPT-1',modo_carga:'INDICE'}],sistema:'PANEL',referencia:'REF',piezas:[{id_pieza:'11234567-89ab-4cde-8fab-0123456789ab',registrable:true,pagina:1,patron:1,barra:1,corte:1,longitud_mm:500,estado:'PENDIENTE',usuario:null,registrado_en:null,id_registro:null,periodo:null}]}]});
test('documentary false is preserved; exact server evidence supplies a distinct capability',async()=>{
 const api=createOptSharedCuts({rpc:async()=>({data:state()})},()=> 'session');
 assert.equal(api.authorizesGroup(group,state(),documents),false);
 const data=await api.estado('R',scope);
 assert.equal(api.authorizesGroup(group,data,documents),true);
 assert.equal(group.canRegister,false);
 assert.equal(api.authorizesGroup(group,structuredClone(data),documents),false);
 assert.throws(()=>{data.puede_registrar=false;},TypeError);
 assert.throws(()=>{data.referencias[0].piezas[0].longitud_mm=1;},TypeError);
});
test('other PDF, origin, reserve, system, week and individual document do not acquire capability',async()=>{
 const api=createOptSharedCuts({rpc:async()=>({data:state()})},()=> 'session'),data=await api.estado('R',scope);
 for(const change of [{reservation:'OTHER'},{system:'OTHER'},{scope:{...scope,semana:45}},{origin:'PROYECTO'},{opts:['OPT-10']},{origin:'INDIVIDUAL',documentHashes:['b'.repeat(64)]}])assert.equal(api.authorizesGroup({...group,...change},data,documents),false);
 for(const files of [[],[{format:'pdf',name:'OPT-1.pdf',key:'b'.repeat(64)}],[{format:'json',key:sha}]])assert.equal(api.authorizesGroup(group,data,files),false);
 assert.equal(api.authorizesGroup({...group,origin:'INDIVIDUAL',documentHashes:[sha]},data,documents),true);
});
test('read-only server and unbound piece remain blocked',async()=>{
 const data=state();data.puede_registrar=false;
 const api=createOptSharedCuts({rpc:async()=>({data})},()=> 'session');
 assert.equal(api.authorizesGroup(group,await api.estado('R',scope),documents),false);
});
test('a changed session invalidates a previously checked capability',async()=>{
 let token='alice';const api=createOptSharedCuts({rpc:async()=>({data:state()})},()=>token),data=await api.estado('R',scope);
 token='bob';assert.equal(api.authorizesGroup(group,data,documents),false);
});
test('new request invalidates previous state immediately, including transport failure',async()=>{
 let fail=false;const api=createOptSharedCuts({rpc:async()=>{if(fail)throw Error('offline');return {data:state()};}},()=> 'session');
 const data=await api.estado('R',scope);fail=true;await assert.rejects(api.estado('R',scope),/offline/);
 assert.equal(api.authorizesGroup(group,data,documents),false);
});
test('stale read cannot displace the latest response',async()=>{
 let resolve,calls=0;const api=createOptSharedCuts({rpc:()=>++calls===1?new Promise(r=>resolve=r):Promise.resolve({data:state()})},()=> 'session');
 const first=api.estado('R',scope),current=await api.estado('R',scope);resolve({data:state()});const old=await first;
 assert.equal(api.authorizesGroup(group,current,documents),true);assert.equal(api.authorizesGroup(group,old,documents),false);
});
