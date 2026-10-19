import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const css=fs.readFileSync(new URL('../styles.css',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('v285 Programming modal keeps body scroll despite global modal overflow',()=>{
 assert.match(css,/#progModal \.modal-card\.prog-card\{[\s\S]*display:flex!important;[\s\S]*overflow:hidden!important/);
 assert.match(css,/#progModal \.rec-form\{[\s\S]*min-height:0!important;[\s\S]*overflow-y:auto!important/);
 assert.match(css,/#progModal \.modal-actions\{[\s\S]*flex:0 0 auto!important/);
});
test('release visible is LAB v285',()=>{
 assert.match(html,/styles\.css\?v=285/);
 assert.match(html,/app\.js\?v=285/);
 assert.match(html,/LAB v285/);
});
