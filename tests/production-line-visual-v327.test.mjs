import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../production-line-visual-v327.css',import.meta.url),'utf8');
test('v327: estilos de línea aislados por vista y conectados a index',()=>{
 assert.match(html,/production-line-visual-v327\.css\?v=1/);
 assert.match(css,/\[data-view-panel="ensamble"\]/);
 assert.match(css,/#sgpPlannerExplorer/);
 assert.match(css,/\.production-line-tabs/);
 assert.match(css,/\.assembly-table-wrap/);
 assert.match(css,/\.packing-preview-scroll/);
});
test('v327: estilos responsivos y accesibles sin modificar estados funcionales',()=>{
 assert.match(css,/@media\(max-width:1000px\)/);
 assert.match(css,/@media\(max-width:780px\)/);
 assert.match(css,/:focus-visible/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.doesNotMatch(css,/service_role|supabase|rpc\(/);
});
