// New Retail-only serializer against the observed OPT-DOCUMENT-PLANS-1 receiver.
// This is NOT the recovered v6 implementation and must never replace v6.
import {inchesToThirtySeconds} from '../domain/opt-summary-reconciliation.js';
export function retailDocumentPlans(extraction,manifest,extractorSha256){
 const fail=()=>{throw Object.assign(Error('OPT_RETAIL_PLANS_INVALID'),{code:'OPT_RETAIL_PLANS_INVALID',status:422});};
 if(!/^[a-f0-9]{64}$/.test(extractorSha256)||!Array.isArray(extraction?.plans)||!Array.isArray(manifest?.units))fail();
 const key=(plan,cut)=>JSON.stringify([plan.id,cut.sourcePage,cut.sourceColumn,cut.sourceSlot,cut.profileInstance,cut.unitInstance]);
 const units=new Map();
 for(const unit of manifest.units){const k=JSON.stringify([unit.provenance.patternId,unit.provenance.sourcePage,unit.provenance.sourceColumn,unit.provenance.sourceSlot,unit.position.barra,unit.provenance.unitInstance]);if(units.has(k))fail();units.set(k,unit);}
 const seen=new Set();
 const plans=extraction.plans.map(plan=>{
  if(!Number.isSafeInteger(plan.barqty)||plan.barqty<1||!Array.isArray(plan.cuts)||plan.issues?.length||plan.unresolvedCells?.length)fail();
  const bars=Array.from({length:plan.barqty},(_,i)=>({barra:i+1,cuts:[]}));
  for(const cut of plan.cuts){
   const k=key(plan,cut),unit=units.get(k);if(!unit||inchesToThirtySeconds(cut.length)!==unit.length32||Number(unit.millimetersExact)!==unit.length32*127/160||seen.has(k)||unit.profile!==plan.ref||unit.position.pagina!==plan.page||unit.position.patron!==plan.sourceRow||cut.uncertain!==false||cut.qty!==1||!bars[cut.profileInstance-1])fail();
   seen.add(k);bars[cut.profileInstance-1].cuts.push({...structuredClone(cut),corte:unit.position.corte,longitud_mm:Number(unit.millimetersExact)});
  }
  for(const bar of bars){bar.cuts.sort((a,b)=>a.corte-b.corte);if(!bar.cuts.length||bar.cuts.some((c,i)=>c.corte!==i+1))fail();}
  return {...structuredClone(plan),bars};
 });
 if(seen.size!==manifest.units.length)fail();
 return {documentary_plans:{contract:'OPT-DOCUMENT-PLANS-1',scope:'DOCUMENTO',plans},extractor_sha256:extractorSha256};
}
