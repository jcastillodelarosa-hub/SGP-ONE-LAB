import {officialBalance} from '../domain/lp01-operation.js';
import {sharedOrderSummary} from '../domain/lp01-shared-order-summary.js';
import {affectationsTransport} from '../services/lp01-affectations.js';
import {sharedOrderTransport} from '../services/lp01-shared-order.js';
import {mountAffectationTabs} from './lp01-affectation-tabs.js';
import {orderDetailsTransport} from '../services/lp01-order-details.js';
import {mountOrderNote} from './lp01-order-note.js';
/** Shared order entry, usable by Seguimiento or either leader; target is optional legacy context. */
export async function mountTrackingAffectations({host,row,target,cause,scope,client,getToken,isCurrent,onSummary=()=>{}}){
 const token=getToken();let orderDetails=null,tabs;
 const alive=()=>host.isConnected&&getToken()===token&&isCurrent();
 host.innerHTML='<section data-order-affectations></section><section class=lp-order-note data-order-note-section></section>';
 const transport=affectationsTransport({client,getToken:()=>alive()?getToken():null,contractVersion:2,context:{key:row.key,line:scope.line,stage:scope.stage,production:row.produccion}});
 transport.shared=sharedOrderTransport({client,getToken:()=>alive()?getToken():null,key:row.key,line:scope.line,stage:scope.stage});
 // Reuse the original reader for pending sources/history; never fallback to its turn writer.
 const read=transport.read;let nativeRead=null;transport.read=()=>nativeRead||(nativeRead=read().catch(e=>{nativeRead=null;throw e;}));
 const sharedRead=transport.shared.read;transport.shared.read=async()=>{const snapshot=await sharedRead();try{const native=await transport.read();if(alive())onSummary(sharedOrderSummary(native,snapshot));}catch(e){if(e.message==='NO_AUTORIZADO')throw e;}return {...snapshot,stageBalance:Object.hasOwn(snapshot,'stageBalance')?snapshot.stageBalance:officialBalance(row,scope.stage)};};
 tabs=mountAffectationTabs(host.querySelector('[data-order-affectations]'),{transport,cause:cause==='REGISTER'||cause==='ALUMINIO'?'NC_AL':cause,details:()=>orderDetails});
 mountOrderNote(host.querySelector('[data-order-note-section]'),orderDetailsTransport({client,getToken:()=>alive()?getToken():null,key:row.key,line:scope.line,stage:scope.stage}),{onRead:d=>{orderDetails=d;tabs?.refreshGlass();}});
 return ()=>tabs.dispose();
}
