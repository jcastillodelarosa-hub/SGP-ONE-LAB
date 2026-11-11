import test from 'node:test';
import assert from 'node:assert/strict';
import {paintedRules,projectCell} from '../opt-digital/pdf-grid.js';
import {extractCoordinatePlans} from '../opt-digital/geometric-extraction.js';
import {OPS} from 'pdfjs-dist/legacy/build/pdf.mjs';
const list=(...rows)=>({fnArray:rows.map(r=>r[0]),argsArray:rows.map(r=>r[1])});
const path=[OPS.constructPath,[[OPS.moveTo,OPS.lineTo],[0,0,100,0]]];
test('only painted strokes count, never clipping and unpainted paths',()=>{
 assert.deepEqual(paintedRules(list(path,[OPS.eoClip],[OPS.endPath]),OPS),[]);
 assert.equal(paintedRules(list(path,[OPS.stroke]),OPS).length,1);
});
test('rules follow transform stack and reject angled lines',()=>{
 const r=paintedRules(list([OPS.save],[OPS.transform,[2,0,0,2,10,20]],path,[OPS.stroke],[OPS.restore],path,[OPS.stroke]),OPS);
 assert.deepEqual(r,[{x1:10,y1:20,x2:210,y2:20},{x1:0,y1:0,x2:100,y2:0}]);
 assert.deepEqual(paintedRules(list([OPS.transform,[1,1,0,1,0,0]],path,[OPS.stroke]),OPS),[]);
});
test('rectangle strokes supply edges and curves do not fabricate straight segments',()=>{
 assert.equal(paintedRules(list([OPS.constructPath,[[OPS.rectangle],[0,0,100,20]]],[OPS.stroke]),OPS).length,4);
 assert.deepEqual(paintedRules(list([OPS.constructPath,[[OPS.moveTo,OPS.curveTo],[0,0,20,0,40,0,100,0]]],[OPS.stroke]),OPS),[]);
});
const centers=[25,100,200,300,520,740];
const rules=[560,530,500].map(y=>({x1:10,y1:y,x2:760,y2:y})).concat([320,720].map(x=>({x1:x,y1:500,x2:x,y2:560})));
const item=(str,x,y)=>({str,width:0,transform:[1,0,0,1,x,y]});
const header=['Item','Pipe','Code','Length','Reference','Qty'].map((v,i)=>item(v,centers[i],575));
const anchor=(id,y)=>[item(id,25,y),item('ES-TEST-001',100,y),item('FINISH',200,y),item('10"',300,y),item('1',740,y)];
test('project cell requires enclosing rules and reference column boundaries',()=>{
 assert.deepEqual(projectCell(rules,centers,545),{top:560,bottom:530,left:320,right:720});
 assert.equal(projectCell(rules.slice(0,3),centers,545),null);
 assert.equal(projectCell(rules,centers,490),null);
});
test('multiline reference above centered numeric row belongs to printed cell',()=>{
 const items=[...header,...anchor('1',545),item('123456 - Synthetic',330,552),item('(Line 1) A',330,538),...anchor('2',515),item('654321 - Other',330,515)];
 const result=extractCoordinatePlans([{page:1,width:842,height:595,items,rules}]);
 assert.deepEqual(result.sourceProjectRows.map(r=>r.reference),['123456 - Synthetic (Line 1) A','654321 - Other']);
 assert(result.sourceProjectRows.every(r=>r.grouping==='PRINTED_CELL'));
});
test('missing borders cannot append text; merged cells with two anchors are ambiguous',()=>{
 const items=[...header,...anchor('1',545),item('123456 - Synthetic',330,552),item('(Line 1) A',330,538),...anchor('2',515)];
 const noRules=extractCoordinatePlans([{page:1,width:842,height:595,items}]);
 assert(noRules.sourceProjectRows.every(r=>!r.reference));assert(noRules.issues.some(i=>i.code==='UNASSIGNED_PROJECT_TEXT'));
 const merged=extractCoordinatePlans([{page:1,width:842,height:595,items,rules:rules.filter(r=>r.y1!==530)}]);
 assert(merged.sourceProjectRows.every(r=>!r.reference));assert(merged.issues.some(i=>i.code==='AMBIGUOUS_PROJECT_CELL'));
});
