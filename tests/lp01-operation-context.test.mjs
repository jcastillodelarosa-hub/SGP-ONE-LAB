import test from 'node:test';
import assert from 'node:assert/strict';
import {mountOperationOrderContext} from '../src/modules/lp01-operation-context.js';

for(const stage of ['ENSAMBLE','EMPAQUE'])test(`${stage} delegates notes and affectations to the canonical shared order without a synthetic target`,async()=>{
 let args,token='leader',current=true;const client={},host={isConnected:true},row={key:'123|PANELES_2'};
 const scope={stage,line:'PANELES_2',date:'2026-11-06',shift:1};
 assert.equal(await mountOperationOrderContext({host,row,scope,bridge:{getToken:()=>token,getClient:async()=>client},isCurrent:()=>current,mount:async a=>{args=a;}}),true);
 assert.equal(args.row,row);assert.equal(args.client,client);assert.equal(args.target,null);assert.equal(args.scope.stage,stage);assert.equal(args.getToken(),'leader');
 current=false;assert.equal(args.isCurrent(),false);assert.equal(args.getToken(),null);
 current=true;token='new-session';assert.equal(args.getToken(),null);
});
test('pending client lookup cannot mount into a changed order/session or detached detail',async()=>{
 for(const change of ['selection','session','host']){
  let resolve,called=false,token='leader',current=true;const host={isConnected:true};
  const work=mountOperationOrderContext({host,row:{key:'123|PANELES_2'},scope:{stage:'EMPAQUE',line:'PANELES_2'},bridge:{getToken:()=>token,getClient:()=>new Promise(r=>resolve=r)},isCurrent:()=>current,mount:async()=>{called=true;}});
  if(change==='selection')current=false;if(change==='session')token='other';if(change==='host')host.isConnected=false;
  resolve({});assert.equal(await work,false);assert.equal(called,false);
 }
});
