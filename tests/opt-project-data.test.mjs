import test from 'node:test';import assert from 'node:assert/strict';
import {buildOptProjectData,validOptProjectData} from '../src/domain/opt-project-data.js';
const row=(item,length,quantity)=>({sourceId:`project-p1-item${item}`,page:1,ref:'SYNTH-PROFILE',finish:'FINISH A/\nFINISH B',length,reference:'ORDER '+ 'location/line '.repeat(32)+'FINAL-LOCATION',quantity});
test('preserves distinct lengths, full multiline finish, references and original item IDs',()=>{
 const input=[row(6,'132 5/16"',16),row(7,'133 1/16"',14)];const d=buildOptProjectData(input);
 assert.equal(d.rows.length,2);assert.equal(d.totalQuantity,30);assert.deepEqual(d.rows.map(r=>r.item),[6,7]);
 for(let i=0;i<2;i++){assert.equal(d.rows[i].code,input[i].finish);assert.equal(d.rows[i].reference,input[i].reference);assert.equal(d.rows[i].length,input[i].length);}
 assert.match(d.rows[0].reference,/FINAL-LOCATION$/);assert(validOptProjectData(d));
});
test('never merges different profile/code/measure/reference or repeated printed items',()=>{
 const a=row(1,'10"',2),b={...row(2,'10"',3),finish:'OTHER'},c={...row(3,'10"',4),ref:'OTHER'},d={...row(4,'10"',5),reference:'OTHER'};
 const out=buildOptProjectData([a,b,c,d]);assert.equal(out.rows.length,4);assert.equal(out.totalQuantity,14);
});
test('missing metadata stays absent, invalid fields and duplicate provenance fail closed',()=>{
 assert.equal(buildOptProjectData(undefined),null);assert.equal(buildOptProjectData([]),null);
 for(const edit of [r=>r.reference='',r=>r.finish='',r=>r.quantity=0,r=>r.page=2,r=>r.sourceId='unproven',r=>r.length='10.4']){const r=row(1,'10"',1);edit(r);assert.throws(()=>buildOptProjectData([r]));}
 const r=row(1,'10"',1);assert.throws(()=>buildOptProjectData([r,r]));const d=buildOptProjectData([r]);d.totalQuantity++;assert(!validOptProjectData(d));
});
test('fraction validity and original item provenance are checked',()=>{
 for(const length of ['10 1/0"','10 5/4"','0"'])assert.throws(()=>buildOptProjectData([row(1,length,1)]));
 const d=buildOptProjectData([row(1,'10"',1)]);d.rows[0].sourceId='project-p2-item1';assert(!validOptProjectData(d));
 assert.throws(()=>buildOptProjectData([row(1,'10"',1),{...row(1,'10"',1),page:2,sourceId:'project-p2-item1'}]));
});
