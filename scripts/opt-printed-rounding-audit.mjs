// Read-only diagnostic. Interval compatibility is NOT permission to import.
import fs from 'node:fs';
import {inchesToThirtySeconds as q} from '../src/domain/opt-summary-reconciliation.js';
export function roundingIntervalAudit(extraction){
 return extraction.sourceProfileSummaries.map(s=>{
  const plans=extraction.plans.filter(p=>p.ref===s.ref&&p.finish===s.finish);
  const bars=plans.reduce((n,p)=>n+p.barqty,0),cuts=plans.reduce((n,p)=>n+p.cuts.length,0);
  const stock=plans.reduce((n,p)=>n+q(p.length)*p.barqty,0),cut=plans.reduce((n,p)=>n+p.cuts.reduce((a,c)=>a+q(c.length),0),0);
  const ds=stock-q(s.stockLength),dc=cut-q(s.cutLength),db=q(s.stockLength)-q(s.cutLength)-q(s.reusedLength)-q(s.wasteLength);
  return {profile:s.ref,finish:s.finish,bars,cuts,stockDelta32:ds,cutDelta32:dc,summaryBalanceDelta32:db,
   // If every operand and total independently round to nearest 1/32 inch,
   // n operands permit |sum(printed)-printed(sum)| <= (n+1)/64 inch.
   stockCompatibleWithNearest32:2*Math.abs(ds)<=bars+1,
   cutsCompatibleWithNearest32:2*Math.abs(dc)<=cuts+1,
   summaryCompatibleWithNearest32:Math.abs(db)<=2,
   certified:false};
 });
}
if(process.argv[1]?.endsWith('opt-printed-rounding-audit.mjs'))for(const path of process.argv.slice(2)){
 const data=JSON.parse(fs.readFileSync(path));const profiles=roundingIntervalAudit(data);
 console.log(JSON.stringify({file:path,issues:data.issues.length,profiles,compatible:profiles.every(p=>p.stockCompatibleWithNearest32&&p.cutsCompatibleWithNearest32&&p.summaryCompatibleWithNearest32),certified:false}));
}
