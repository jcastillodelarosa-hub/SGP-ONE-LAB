import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync('index.html','utf8');
const js=readFileSync('navigation-preferences.js','utf8');
const css=readFileSync('navigation-preferences.css','utf8');
test('navigation assets are loaded by SGP shell',()=>{
 assert.match(html,/navigation-preferences\.css\?v=2/);
 assert.match(html,/navigation-preferences\.js\?v=2/);
});
test('navigation preferences are isolated from business and auth layers',()=>{
 assert.match(js,/localStorage\.setItem\(KEY/);
 assert.doesNotMatch(js,/supabase\.|\.rpc\(|service_role|authLogin|authLogout/);
});
test('navigation preserves hidden role-restricted buttons',()=>{
 assert.match(css,/\.nav button\[hidden\]\s*\{display:none!important\}/);
 assert.match(js,/button\[data-view\]/);
});
test('navigation provides responsive modes and reduced-motion support',()=>{
 assert.match(css,/@media\(min-width:761px\)/);
 assert.match(css,/@media\(max-width:760px\)/);
 assert.match(css,/prefers-reduced-motion:no-preference/);
 assert.match(js,/settings\.menu==='floating'/);
});

test('appearance exposes selectable palettes and collapsed edge fade',()=>{
 assert.match(js,/theme:\s*'intense'/);
 assert.match(js,/edge:\s*'fade'/);
 assert.ok(js.includes('data-sgp-setting="theme"'));
 assert.ok(js.includes('data-sgp-setting="edge"'));
 assert.match(css,/data-sgp-nav-theme="corporate"/);
 assert.match(css,/data-sgp-nav-theme="modern"/);
 assert.match(css,/data-sgp-nav-edge="solid"/);
});
