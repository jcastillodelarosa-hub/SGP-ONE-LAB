import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync('index.html','utf8');
const js=readFileSync('navigation-preferences.js','utf8');
const css=readFileSync('navigation-preferences.css','utf8');
test('navigation assets are loaded by SGP shell',()=>{
 assert.match(html,/navigation-preferences\.css\?v=4/);
 assert.match(html,/navigation-preferences\.js\?v=4/);
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

test('hamburger pin returns to automatic hover without changing stored menu preference',()=>{
 assert.match(js,/let pinned=false/);
 assert.match(js,/pinned=!pinned/);
 assert.match(js,/setOpen\(pinned\)/);
 assert.doesNotMatch(js,/settings\.menu='toggle';save\(\)/);
 assert.match(js,/settings\.menu==='hover'&&!pinned/);
});
test('wordmark is plain text with cyan underline and hover contrast',()=>{
 assert.match(css,/\.sgp-nav-logo:after/);
 assert.match(css,/\.sgp-nav-logo>span:first-child/);
 assert.match(css,/button:not\(\[hidden\]\):hover/);
});

test('nine themes and light dark modes are selectable and scoped',()=>{
 const themeCss=readFileSync('global-themes.css','utf8');
 assert.match(html,/global-themes\.css\?v=1/);
 for(const id of ['intense','corporate','modern','lilac','orange','emerald','teal','rose','graphite']){
  assert.ok(js.includes("'"+id+"'"),id+' preference missing');
  assert.ok(themeCss.includes('data-sgp-theme="'+id+'"'),id+' stylesheet missing');
 }
 assert.ok(js.includes('data-sgp-setting="mode"'));
 assert.match(js,/shell\.dataset\.sgpThemeMode=settings\.mode/);
 assert.match(themeCss,/data-sgp-theme-mode="dark"/);
 assert.doesNotMatch(themeCss,/\.state-abierta|\.rec-al-supply|\.rec-al-warehouse|\.rec-al-delivered/);
});
