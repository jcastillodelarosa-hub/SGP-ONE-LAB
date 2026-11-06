import {affectationsTransport} from '../services/lp01-affectations.js';
import {sharedOrderTransport} from '../services/lp01-shared-order.js';
import {mountAffectationTabs} from './lp01-affectation-tabs.js';
import {orderDetailsTransport} from '../services/lp01-order-details.js';
import {mountOrderNote} from './lp01-order-note.js';
/** Shared order entry, usable by Seguimiento or either leader; target is optional legacy context. */
export async function mountTrackingAffectations({host,row,target,cause,scope,client,getToken,isCurrent}){
 const token=getToken();let orderDetails=null,tabs;
 const alive=()=>host.isConnected&&getToken()===token&&isCurrent();
 host.innerHTML='<section data-order-affectations></section><section class=lp-order-note data-order-note-section></section>';
 const transport=affectationsTransport({client,getToken:()=>alive()?getToken():null,contractVersion:2,context:{key:row.key,line:scope.line,stage:scope.stage,production:row.produccion}});
 transport.shared=sharedOrderTransport({client,getToken:()=>alive()?getToken():null,key:row.key,line:scope.line,stage:scope.stage});
 // Reuse the original reader for pending sources/history; never fallback to its turn writer.
 const read=transport.read;let nativeRead=null;transport.read=()=>nativeRead||(nativeRead=read().catch(e=>{nativeRead=null;throw e;}));
 tabs=mountAffectationTabs(host.querySelector('[data-order-affectations]'),{transport,cause:cause==='REGISTER'||cause==='ALUMINIO'?'NC_AL':cause,details:()=>orderDetails});
 mountOrderNote(host.querySelector('[data-order-note-section]'),orderDetailsTransport({client,getToken:()=>alive()?getToken():null,key:row.key,line:scope.line,stage:scope.stage}),{onRead:d=>{orderDetails=d;tabs?.refreshGlass();}});
 return ()=>tabs.dispose();
}
