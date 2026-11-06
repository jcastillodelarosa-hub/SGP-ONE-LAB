import {affectationSummary} from './lp01-affectation-summary.js';
/** Conservative row adapter: historical and shared reports may describe the same windows. */
export function sharedOrderSummary(nativeSnapshot,sharedSnapshot){
 const original=affectationSummary(nativeSnapshot);
 if(!sharedSnapshot||sharedSnapshot.key!==nativeSnapshot.key||sharedSnapshot.line!==nativeSnapshot.line||sharedSnapshot.stage!==nativeSnapshot.stage)throw Error('SHARED_SUMMARY_SCOPE_MISMATCH');
 const categories={...original.categories};let accessories=null;
 for(const cause of [...Object.keys(categories),'ACCESORIOS']){
  const current=sharedSnapshot.reports.filter(r=>r.cause===cause&&r.quantity>r.confirmed);
  const legacy=sharedSnapshot.legacyReports.filter(r=>r.causa===cause&&r.ventanas>r.confirmadas);
  // A single recorded report supplies a quantity. Overlapping reports require validation.
  const values=[...current.map(r=>r.quantity-r.confirmed),...legacy.map(r=>r.ventanas-r.confirmadas)];
  const value=values.length===1&&Number.isSafeInteger(values[0])&&values[0]>=0?values[0]:null;
  if(cause==='ACCESORIOS')accessories=value;else categories[cause]=value;
 }
 return {...original,categories,accessories,hasReports:sharedSnapshot.reports.length>0||sharedSnapshot.legacyReports.length>0,total:null,available:null};
}
