import {affectationsTransport} from './lp01-affectations.js';
import {sharedOrderTransport} from './lp01-shared-order.js';
import {sharedOrderSummary} from '../domain/lp01-shared-order-summary.js';
import {affectationSummary} from '../domain/lp01-affectation-summary.js';
/** Read-only composition; shared contract ownership remains with Seguimiento. */
export async function readOperationSummary({client,getToken,key,line,stage}){
 const nativeSnapshot=await affectationsTransport({client,getToken,contractVersion:2,context:{key,line,stage}}).read();
 try{
  const sharedSnapshot=await sharedOrderTransport({client,getToken,key,line,stage}).read();
  return sharedOrderSummary(nativeSnapshot,sharedSnapshot);
 }catch(error){
  if(error.message!=='SHARED_ORDER_UNAVAILABLE')throw error;
  return {...affectationSummary(nativeSnapshot),sharedUnavailable:true,total:null,available:null};
 }
}
