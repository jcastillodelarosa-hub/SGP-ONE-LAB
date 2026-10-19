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
test('release visible preserves v285 scroll fix on later releases',()=>{
 assert.match(html,/styles\.css\?v=28[5-9]|styles\.css\?v=2[9-9][0-9]|styles\.css\?v=[3-9][0-9]{2,}/);
 assert.match(html,/app\.js\?v=28[5-9]|app\.js\?v=2[9-9][0-9]|app\.js\?v=[3-9][0-9]{2,}/);
 assert.match(html,/LAB v28[5-9]|LAB v2[9-9][0-9]|LAB v[3-9][0-9]{2,}/);
});
