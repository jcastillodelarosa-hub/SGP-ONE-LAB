import {inchesToThirtySeconds} from './opt-summary-reconciliation.js';
// Pure diagnostic, not an import authorization. A closed ±1/64 inch envelope
// models independently rounded 1/32 displays, including unspecified tie rules.
// Passing means there EXISTS a consistent value in these envelopes, not that
// the original lengths or rounding behavior are known. Never changes lengths.
const interval=(q,r=1n)=>({lo:2n*q-r,hi:2n*q+r});
const intersect=(a,b)=>({lo:a.lo>b.lo?a.lo:b.lo,hi:a.hi<b.hi?a.hi:b.hi});
const sum=xs=>xs.reduce((a,b)=>({lo:a.lo+b.lo,hi:a.hi+b.hi}),{lo:0n,hi:0n});
const nonnegative=a=>({...a,lo:a.lo<0n?0n:a.lo});
const valid=a=>a.lo<=a.hi;
const exact=q=>{const n=inchesToThirtySeconds(q);if(!Number.isSafeInteger(n)||n<0||n>100000000)throw Error('INVALID_LENGTH');return BigInt(n);};
const quantity=n=>{if(!Number.isSafeInteger(n)||n<1||n>100000)throw Error('INVALID_QUANTITY');return BigInt(n);};
const output=a=>({lower64:a.lo.toString(),upper64:a.hi.toString()});
export function profileRoundingCompatibility({stockTerms,cutTerms,summary}){
 const result={schema:'sgp.opt.rounding-diagnostic.v1',model:'INDEPENDENT_NEAREST_1_32_CLOSED_ENVELOPE',
  originalPrecisionVerified:false,exactEquality:false,authorizesImport:false,physicalCompletionVerified:false};
 try{
  if(!Array.isArray(stockTerms)||!stockTerms.length||!Array.isArray(cutTerms)||!cutTerms.length||stockTerms.length>100000||cutTerms.length>100000)throw Error('INVALID_TERMS');
  const aggregate=terms=>{let count=0n,total=0n;for(const t of terms){const n=quantity(t.quantity),q=exact(t.length);count+=n;total+=n*q;if(count>100000n)throw Error('QUANTITY_LIMIT');}return {q:total,envelope:nonnegative(interval(total,count))};};
  const stocks=aggregate(stockTerms),cuts=aggregate(cutTerms);
  const sq=exact(summary.stockLength),cq=exact(summary.cutLength),rq=exact(summary.reusedLength),wq=exact(summary.wasteLength);
  const s=intersect(stocks.envelope,nonnegative(interval(sq))),c=intersect(cuts.envelope,nonnegative(interval(cq))),r=nonnegative(interval(rq)),w=nonnegative(interval(wq));
  const conservation=intersect(s,sum([c,r,w]));
  const compatible=valid(s)&&valid(c)&&valid(conservation);
  const equality=stocks.q===sq&&cuts.q===cq&&sq===cq+rq+wq;
  return {...result,status:compatible?(equality?'PRINTED_EQUALITY':'ROUNDING_COMPATIBLE'):'INCOMPATIBLE',exactEquality:equality,
   uncertaintyUnit:'1/64 inch',intervals:{stock:output(s),cuts:output(c),reused:output(r),waste:output(w),balancedStock:output(conservation)},
   printedDelta32:{stock:(stocks.q-sq).toString(),cuts:(cuts.q-cq).toString(),balance:(sq-cq-rq-wq).toString()},
   reasons:[...(!valid(s)?['STOCK_INTERVAL_DISJOINT']:[]),...(!valid(c)?['CUT_INTERVAL_DISJOINT']:[]),...(!valid(conservation)?['CONSERVATION_INTERVAL_DISJOINT']:[])]};
 }catch(error){return {...result,status:'UNSUPPORTED',reasons:[error.message]};}
}
