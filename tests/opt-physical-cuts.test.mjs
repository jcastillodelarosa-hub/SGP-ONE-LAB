import test from 'node:test';
import assert from 'node:assert/strict';
import { expandPhysicalCuts, summarizePhysicalCuts } from '../src/domain/opt-physical-cuts.js';

test('page 22 pattern quantities produce individual cuts', () => {
 const common={opt:'OPT2026-44-5-PLI-132',page:22,profile:'ES-SGD2020-024',finish:'2604 BERMUDA BRONZE',code:'10203537',stockLength:'177 5/32'};
 const patterns=[
  {...common,perf:1,rest:'0 1/32',cuts:[{length:'34 13/16',quantity:2,reference:'1158220'},{length:'34 1/4',quantity:2,reference:'1033380'},{length:'33 1/4',quantity:1,reference:'1158220'}]},
  {...common,perf:1,rest:'0 5/32',cuts:[{length:'34 1/4',quantity:5,reference:'1033380'}]},
  {...common,perf:1,rest:'0 17/32',cuts:[{length:'46 1/4',quantity:2,reference:'908711'},{length:'39 5/16',quantity:2,reference:'1033380'}]},
  {...common,perf:1,rest:'0 21/32',cuts:[{length:'45 7/16',quantity:1,reference:'1154831'},{length:'45 1/4',quantity:1,reference:'1154831'},{length:'45 3/16',quantity:1,reference:'1151472'},{length:'35 1/8',quantity:1,reference:'1141728'}]}
 ];
 const bars=expandPhysicalCuts(patterns);
 assert.deepEqual(bars.map(bar=>bar.cuts.length),[5,5,4,4]);
 assert.deepEqual(summarizePhysicalCuts(bars),{bars:4,cuts:18,completed:0});
 assert.equal(new Set(bars.flatMap(bar=>bar.cuts.map(c=>c.id))).size,18);
});
test('repeats every pattern on #perf physical bars',()=>{
 const bars=expandPhysicalCuts([{opt:'X',page:1,profile:'P',code:'C',perf:3,cuts:[{length:'10',quantity:2,reference:'R'}]}]);
 assert.deepEqual(summarizePhysicalCuts(bars),{bars:3,cuts:6,completed:0});
});
test('rejects missing or fractional Cant. and #perf',()=>{
 assert.throws(()=>expandPhysicalCuts([{perf:1,cuts:[{quantity:0}]}]),/Cant/);
 assert.throws(()=>expandPhysicalCuts([{perf:1.5,cuts:[{quantity:2}]}]),/#perf/);
});
