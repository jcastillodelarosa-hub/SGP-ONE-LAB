import test from 'node:test';
import assert from 'node:assert/strict';
import {createOptSharedCatalog} from '../src/services/opt-shared-catalog.js';
import {createOptSharedCuts} from '../src/services/opt-shared-cuts.js';
const scope={linea:'PANELES_2',anio:2026,semana:45,modo:'BASE'},id=n=>`${n}1234567-89ab-4cde-8fab-0123456789ab`,sha='a'.repeat(64);
const reference=()=>({id_documento:id(0),sha256:sha,referencia:'REF',sistema:'PANEL',fuentes:[{origen:'RETAIL',source_key:'R/OPT-1',consecutivo:'OPT-1',modo_carga:'INDICE'}],piezas:[{id_pieza:id(1),pagina:1,patron:1,barra:1,corte:1,longitud_mm:500}]});
const payload=()=>({contract_version:2,scope:{...scope},grupos:[{reserva:'R',sistema:'PANEL',referencias:[reference()]}],totales:{grupos:1,documentos:1,piezas:1}});
const state=()=>({contract_version:2,scope:{...scope},reserva:'R',habilitado:true,manifiesto_validado:true,puede_registrar:true,referencias:[{...reference(),piezas:reference().piezas.map(p=>({...p,registrable:true,estado:'PENDIENTE',usuario:null,registrado_en:null,id_registro:null,periodo:null}))}],totales:{piezas:1,cortadas:0,pendientes:1}});
test('catalog binds immutable exact identities to a private current session and scope, not copies or flags',async()=>{
 let token='alice',context={...scope},raw=payload();const calls=[];
 const catalog=createOptSharedCatalog({rpc:async(name,args)=>{calls.push({name,args});return {data:raw};}},()=>token,{getContext:()=>context});
 const snapshot=await catalog.load(scope),group=snapshot.groups[0];
 assert.deepEqual(calls,[{name:'sgp_opt_catalogo_v2',args:{p_token:'alice',p_scope:scope}}]);
 assert(catalog.ownsGroup(group));assert.equal(group.canRegister,false);assert.equal(group.origin,'SERVIDOR');assert(Object.isFrozen(group.references[0].piezas[0]));
 assert(!catalog.ownsGroup({...group,canRegister:true}));assert(!catalog.ownsGroup(structuredClone(group)));assert(catalog.matchesReference(group,state().referencias[0]));
 raw.grupos[0].referencias[0].piezas[0].longitud_mm=4;assert.equal(group.references[0].piezas[0].longitud_mm,500);
 for(const change of [{sha256:'b'.repeat(64)},{id_documento:id(9)},{sistema:'OTHER'},{referencia:'OTHER'},{fuentes:[{...reference().fuentes[0],source_key:'OTHER'}]},{piezas:[{...reference().piezas[0],longitud_mm:600}]},{piezas:[{...reference().piezas[0],id_pieza:id(9)}]},{piezas:[]},{piezas:[...reference().piezas,...reference().piezas]}])assert(!catalog.matchesReference(group,{...reference(),...change}));
 context={...scope,semana:46};assert(!catalog.ownsGroup(group));context={...scope};assert(!catalog.ownsGroup(group));token='bob';assert(!catalog.isCurrent(snapshot));assert(!catalog.ownsGroup(group));
 token='alice';catalog.invalidate();assert(!catalog.ownsGroup(group));assert(!catalog.isCurrent(snapshot));
});
test('catalog alone never authorizes a cut and a matching authoritative state remains mandatory',async()=>{
 let mode='valid';const catalog=createOptSharedCatalog({rpc:async()=>({data:payload()})},()=> 'alice');const group=(await catalog.load(scope)).groups[0];
 const cuts=createOptSharedCuts({rpc:async()=>({data:mode==='valid'?state():{...state(),puede_registrar:false}})},()=> 'alice',{catalog});
 assert(!cuts.authorizesGroup(group,state(),[]));const current=await cuts.estado('R',scope);assert(cuts.authorizesGroup(group,current,[]));
 assert(!cuts.authorizesGroup({...group,canRegister:true},current,[]));catalog.invalidate();assert(!cuts.authorizesGroup(group,current,[]));
 const next=(await catalog.load(scope)).groups[0];mode='read';const readonly=await cuts.estado('R',scope);assert(!cuts.authorizesGroup(next,readonly,[]));assert(!cuts.authorizesGroup(next,current,[]));
});
test('strict catalog rejects wrong scope, extra capability fields, duplicate assignments and inconsistent document/source identities',async()=>{
 const changes=[d=>d.contract_version=1,d=>d.puede_registrar=true,d=>d.scope.semana=46,d=>d.scope.linea='FRAMES_2',d=>d.totales.piezas=0,d=>d.grupos[0].canRegister=true,d=>d.grupos[0].referencias[0].fuentes=[],d=>d.grupos[0].referencias[0].sistema='OTHER',d=>d.grupos[0].referencias[0].sha256='bad',d=>d.grupos[0].referencias[0].piezas[0].registrable=true,d=>d.grupos[0].referencias[0].piezas[0].longitud_mm=0,d=>d.grupos[0].referencias[0].piezas[0].corte=1.5,d=>d.grupos.push(structuredClone(d.grupos[0])),d=>d.grupos[0].referencias.push(structuredClone(d.grupos[0].referencias[0])),d=>d.grupos[0].referencias[0].fuentes.push(structuredClone(d.grupos[0].referencias[0].fuentes[0])),d=>d.grupos[0].referencias[0].piezas.push({...d.grupos[0].referencias[0].piezas[0],id_pieza:id(2)}),d=>{const g=structuredClone(d.grupos[0]);g.reserva='OTHER';d.grupos.push(g);d.totales.grupos=2;d.totales.piezas=2;},d=>{const ref=reference();ref.id_documento=id(9);ref.referencia='OTHER';ref.piezas[0].id_pieza=id(2);d.grupos[0].referencias.push(ref);},d=>{const ref=reference();ref.referencia='OTHER';ref.fuentes[0].consecutivo='CHANGED';ref.piezas[0].id_pieza=id(2);ref.piezas[0].corte=2;d.grupos[0].referencias.push(ref);}];
 for(const mutate of changes){const data=payload();mutate(data);const catalog=createOptSharedCatalog({rpc:async()=>({data})},()=> 'alice');await assert.rejects(catalog.load(scope),/OPT_CATALOGO_CONTRATO_INVALIDO/);}
});
test('reload, changed user, changed filters and timeout cannot revive late catalog results',async()=>{
 let token='alice',context=scope;const pending=[];const catalog=createOptSharedCatalog({rpc:()=>new Promise(resolve=>pending.push(resolve))},()=>token,{getContext:()=>context});
 const first=catalog.load(scope);await Promise.resolve();const second=catalog.load(scope);await Promise.resolve();pending[1]({data:payload()});const secondSnapshot=await second;pending[0]({data:payload()});await assert.rejects(first,/OBSOLETO/);assert(catalog.isCurrent(secondSnapshot));
 const userChange=catalog.load(scope);await Promise.resolve();token='bob';pending[2]({data:payload()});await assert.rejects(userChange,/OBSOLETO/);assert(!catalog.isCurrent(secondSnapshot));
 const filtersChange=catalog.load(scope);await Promise.resolve();context={...scope,semana:46};pending[3]({data:payload()});await assert.rejects(filtersChange,/OBSOLETO/);
 let release;const timed=createOptSharedCatalog({rpc:()=>new Promise(resolve=>release=resolve)},()=> 'alice',{timeoutMs:5});await assert.rejects(timed.load(scope),/TIMEOUT/);release({data:payload()});await Promise.resolve();assert(!timed.ownsGroup(secondSnapshot.groups[0]));
});

test('optional persisted warning is validated and cannot disappear between catalog and cut state',async()=>{
 const data=payload(),warning={code:'OPT_PRINTED_ROUNDING_COMPATIBLE'};data.grupos[0].referencias[0].validationWarnings=[warning];
 const catalog=createOptSharedCatalog({rpc:async()=>({data})},()=> 't');const snapshot=await catalog.load(scope),group=snapshot.groups[0];
 assert.deepEqual(group.references[0].validationWarnings,[warning]);assert(!catalog.matchesReference(group,state().referencias[0]));
 const ref={...state().referencias[0],validationWarnings:[warning]};assert(catalog.matchesReference(group,ref));
 for(const value of [null,{},[{code:'OTHER'}],[warning,warning],[{...warning,approved:true}]]){const invalid=payload();invalid.grupos[0].referencias[0].validationWarnings=value;await assert.rejects(createOptSharedCatalog({rpc:async()=>({data:invalid})},()=> 't').load(scope),/CONTRATO/);}
});
