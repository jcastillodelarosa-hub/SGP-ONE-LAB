import {affectationSummary} from './lp01-affectation-summary.js';
/** Conservative row adapter: historical and shared reports may describe the same windows. */
export function sharedOrderSummary(nativeSnapshot,sharedSnapshot){
 const original=affectationSummary(nativeSnapshot);
 if(!sharedSnapshot||sharedSnapshot.key!==nativeSnapshot.key||sharedSnapshot.line!==nativeSnapshot.line||sharedSnapshot.stage!==nativeSnapshot.stage)throw Error('SHARED_SUMMARY_SCOPE_MISMATCH');
 const categories={...original.categories},reportedQuantities={};let accessories=null;
 for(const cause of [...Object.keys(categories),'ACCESORIOS']){
  const current=sharedSnapshot.reports.filter(r=>r.cause===cause&&r.quantity>r.confirmed);
  const legacy=sharedSnapshot.legacyReports.filter(r=>r.causa===cause&&r.ventanas>r.confirmadas);
  // A single recorded report supplies a quantity. Overlapping reports require validation.
  const values=[...current.map(r=>r.quantity-r.confirmed),...legacy.map(r=>r.ventanas-r.confirmadas)];
  reportedQuantities[cause]=values;
  const value=values.length===1&&Number.isSafeInteger(values[0])&&values[0]>=0?values[0]:null;
  if(cause==='ACCESORIOS')accessories=value;else categories[cause]=value;
 }
 const pending=nativeSnapshot.aluminumPending??nativeSnapshot.pickingPending;
 const active=(pending?.status==='AVAILABLE'?pending.rows:[]).filter(p=>p.state==='PENDIENTE');
 const linked=new Set(sharedSnapshot.reports.filter(r=>r.cause==='NC_AL'&&r.source_ref).map(r=>r.source_ref));
 for(const r of nativeSnapshot.reports||[])for(const s of r.sources||[])linked.add(s.id);
 const unlinked=active.filter(p=>!linked.has(p.id));
 const estimates=unlinked.map(p=>({reference:p.reference,quantity:p.pieceQuantity??p.pieces??p.quantity})).filter(p=>Number.isSafeInteger(p.quantity)&&p.quantity>0);
 const ncReferences=new Set([...sharedSnapshot.reports.filter(r=>r.cause==='NC_V'&&r.quantity>r.confirmed).map(r=>r.nc_reference),...sharedSnapshot.legacyReports.filter(r=>r.causa==='NC_V'&&r.ventanas>r.confirmadas).map(r=>r.ncReference)].filter(Boolean));
 return {...original,stageBalance:sharedSnapshot.stageBalance??null,sharedRevision:sharedSnapshot.revision,reportedQuantities,estimates,ncEstimate:ncReferences.size||null,aluminumNeedsIndicator:unlinked.length>0,aluminumReported:reportedQuantities.NC_AL.length>0,categories,accessories,hasReports:sharedSnapshot.reports.length>0||sharedSnapshot.legacyReports.length>0,total:null,available:null};
}
