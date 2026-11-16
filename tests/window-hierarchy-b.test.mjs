import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const css=fs.readFileSync(new URL('../styles.css',import.meta.url),'utf8').split('/* Approved B:')[1];
const ui=fs.readFileSync(new URL('../src/modules/picking-audit.js',import.meta.url),'utf8');
function l(hex){const c=hex.match(/\w\w/g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2];}
function ratio(a,b){return (Math.max(l(a),l(b))+.05)/(Math.min(l(a),l(b))+.05);}
test('B semantic colors remain readable against intended surfaces',()=>{
 for(const [a,b] of [['173458','ffffff'],['20344c','ffffff'],['52657c','f3f6f9'],['52657c','edf3fb']])assert.ok(ratio(a,b)>=4.5,`${a} on ${b}`);
});
test('B presents real order context and two sections without removing controls',()=>{
 assert.match(ui,/class="sgp-window-context"/);assert.match(ui,/1\. Revisión por sección/);assert.match(ui,/2\. Recepción y faltantes/);
 for(const x of ['data-area','data-result','data-date','data-shift','data-observation','data-rows','data-new','data-error'])assert.ok(ui.includes(x),x);
});
test('B does not replace modal layout mechanics or semantic business colors',()=>{
 assert.ok(css);assert.doesNotMatch(css, /display\s*:\s*none|position\s*:|overflow\s*:\s*hidden|max-height\s*:/);
 assert.doesNotMatch(css,/data-state|\.primary\s*\{|\.success\s*\{|\.warning\s*\{/);
 assert.match(css,/#pickAuditModal \.modal-header/);
});
