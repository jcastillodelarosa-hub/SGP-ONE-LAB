import test from 'node:test';import assert from 'node:assert/strict';
import {affectationsTransport} from '../src/services/lp01-affectations.js';
const context={key:'QA|PANELES_2',line:'PANELES_2',stage:'ENSAMBLE',date:'2026-11-01',shift:1};
const base={contract:'LP-AFFECTATIONS-1',key:context.key,line:context.line,stage:context.stage,revision:0,reports:[],events:[],capabilities:['READ'],available:null,progress:{}};
test('transport rejects wrong scope and a session changed while awaiting response',async()=>{
 const transport=affectationsTransport({context,getToken:()=> 'token',client:{rpc:async()=>({data:{...base,key:'other'}})}});
 await assert.rejects(transport.read(),/INVALIDO/);
 let finish,token='old';const pending=affectationsTransport({context,getToken:()=>token,client:{rpc:()=>new Promise(r=>finish=r)}}).read();token='new';finish({data:base});await assert.rejects(pending,/NO_AUTORIZADO/);
});
test('transport does not accept an invented opening without complete evidence',async()=>{
 const data={...base,progress:{ENSAMBLE:{events:[],coverage:'UNKNOWN',opening:{eventId:'fake',date:'2026-11-01',shift:1}}}};
 await assert.rejects(affectationsTransport({context,getToken:()=> 'token',client:{rpc:async()=>({data})}}).read(),/APERTURA_NO_ACREDITADA/);
});
test('unconfirmed command result must not be treated as saved',async()=>{
 await assert.rejects(affectationsTransport({context,getToken:()=> 'token',client:{rpc:async()=>({data:{contract:'LP-AFFECTATIONS-COMMAND-1',id:'wrong',revision:1}})}}).command({id:'expected'}),/RESPUESTA_NO_CONFIRMADA/);
});
test('Picking source scope is checked and original association never calls PDT register',async()=>{
 const bad={...base,contract:'LP-AFFECTATIONS-2',pickingPending:{rows:[{key:'OTHER',origin:'PICKING'}]}};
 await assert.rejects(affectationsTransport({context,contractVersion:2,getToken:()=> 'token',client:{rpc:async()=>({data:bad})}}).read(),/PICKING_AMBITO/);
 let name,args;const transport=affectationsTransport({context,getToken:()=> 'token',client:{rpc:async(n,a)=>{name=n;args=a;return {data:{contract:'LP-AFFECTATIONS-COMMAND-1',id:'request',revision:1}};}}});
 await transport.command({id:'request',action:'CREATE',cause:'NC_AL',quantity:5,sourcePicking:'source'});
 assert.equal(name,'sgp_lp_afectaciones_desde_picking_v1');assert.equal(args.p_source,'source');assert.equal(args.p_cmd.quantity,5);assert.ok(!('sourcePicking' in args.p_cmd));
 await assert.rejects(transport.command({id:'request',sourcePicking:'source',pieces:[]}),/AMBIGUO/);
});
test('all-origin metadata stays order-scoped and cannot become a Picking association',async()=>{
 const row={id:'legacy',key:context.key,origin:'PRODUCCION',contract:'LEGACY',pieceQuantity:19,affectedWindows:null,readOnly:true};
 const response=rows=>({...base,aluminumPending:{status:'AVAILABLE',rows},pickingPending:{rows:[]}});
 const transport=data=>affectationsTransport({context,getToken:()=> 'token',client:{rpc:async()=>({data})}});
 const data=await transport(response([row])).read();assert.equal(data.aluminumPending.rows[0].origin,'PRODUCCION');assert.deepEqual(data.pickingPending.rows,[]);
 for(const changed of [{key:'OTHER'},{readOnly:false},{id:null}])await assert.rejects(transport(response([{...row,...changed}])).read(),/ALUMINIO_AMBITO_INVALIDO/);
});
