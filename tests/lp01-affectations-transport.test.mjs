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
