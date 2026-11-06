import {officialBalance} from '../domain/lp01-operation.js';
import {sharedOrderSummary} from '../domain/lp01-shared-order-summary.js';
import {withExportGlassSummary} from '../domain/lp01-export-glass-summary.js';
import {affectationsTransport} from '../services/lp01-affectations.js';
import {sharedOrderTransport} from '../services/lp01-shared-order.js';
import {mountAffectationTabs} from './lp01-affectation-tabs.js';
import {orderDetailsTransport} from '../services/lp01-order-details.js';
import {mountOrderNote} from './lp01-order-note.js';
/** Order-scoped reads and writes; selecting an NC never performs a write or verified link. */
export async function mountTrackingAffectations({host,row,target,cause,scope,client,getToken,isCurrent,onSummary=()=>{},ncHints=null,initialDetails=null,getLatestDetails=()=>undefined,getDetailsGeneration=()=>0,onDetails=()=>{}}){
 const token=getToken();let orderDetails=initialDetails,tabs,latestSummary=null,disposed=false,originTransport=null;
 const alive=()=>!disposed&&host.isConnected&&getToken()===token&&isCurrent();
 const currentDetails=()=>{const latest=getLatestDetails();return latest===undefined?orderDetails:latest;};
 const publish=()=>{if(alive()&&latestSummary)onSummary(withExportGlassSummary(latestSummary,currentDetails(),{key:row.key,line:scope.line,stage:scope.stage}));};
 host.innerHTML='<section data-order-affectations></section><section class=lp-order-note data-order-note-section></section>';
 function makeTransport(stage){
  if(!['ENSAMBLE','EMPAQUE'].includes(stage))throw Error('Selecciona una etapa válida.');
  const transport=affectationsTransport({client,getToken:()=>alive()?getToken():null,contractVersion:2,context:{key:row.key,line:scope.line,stage,production:row.produccion}});
  transport.scope={key:row.key,line:scope.line,stage};
  transport.shared=sharedOrderTransport({client,getToken:()=>alive()?getToken():null,key:row.key,line:scope.line,stage});
  const read=transport.read;let nativeRead=null;transport.read=()=>nativeRead||(nativeRead=read().catch(e=>{nativeRead=null;throw e;}));
  const sharedRead=transport.shared.read;transport.shared.read=async()=>{const snapshot=await sharedRead();try{const native=await transport.read();if(alive()&&stage===scope.stage){latestSummary=sharedOrderSummary(native,snapshot);publish();}else if(alive()&&originTransport){await originTransport.shared.read();}}catch(e){if(e.message==='NO_AUTORIZADO')throw e;}return {...snapshot,stageBalance:Object.hasOwn(snapshot,'stageBalance')?snapshot.stageBalance:officialBalance(row,stage)};};
  return transport;
 }
 const transport=makeTransport(scope.stage);originTransport=transport;
 const ncReview=ncHints?{row,scope,isCurrent:alive,getTransport:makeTransport,readCandidates:async({force=false,savedReferences=[]}={})=>{if(!alive())return {status:'UNAUTHORIZED',count:null,candidates:[]};await ncHints.read({force});if(!alive())return {status:'UNAUTHORIZED',count:null,candidates:[]};return ncHints.candidatesFor(row,savedReferences);}}:null;
 tabs=mountAffectationTabs(host.querySelector('[data-order-affectations]'),{transport,ncReview,cause:cause==='REGISTER'||cause==='ALUMINIO'?'NC_AL':cause,details:()=>currentDetails()});
 const noteTransport=orderDetailsTransport({client,getToken:()=>alive()?getToken():null,key:row.key,line:scope.line,stage:scope.stage});
 const noteRead=noteTransport.read;let initial=initialDetails;
 noteTransport.read=async()=>{if(initial&&alive()&&(getLatestDetails()===undefined||getLatestDetails()===initial)){const value=initial;initial=null;return Promise.resolve(value);}const generation=getDetailsGeneration(),value=await noteRead();if(generation!==getDetailsGeneration())throw Error('ORDER_DETAILS_UNAVAILABLE');return value;};
 mountOrderNote(host.querySelector('[data-order-note-section]'),noteTransport,{onRead:d=>{orderDetails=d;onDetails(d);orderDetails=currentDetails();tabs?.refreshGlass();publish();}});
 return ()=>{disposed=true;tabs.dispose();};
}
