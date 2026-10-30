import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const html=read('index.html'),shell=read('src/modules/lp-rebuild-shell.js'),css=read('src/modules/lp-rebuild-shell.css'),app=read('app.js');
test('LP: six approved sections in one navigation shell',()=>{
 for(let i=1;i<=6;i++)assert.match(shell,new RegExp("\\['LP-0"+i+"'"));
 assert.match(html,/src\/modules\/lp-rebuild-shell\.js/);
 assert.match(html,/src\/modules\/lp-rebuild-shell\.css/);
 assert.doesNotMatch(html,/<script[^>]+src="production-line-tabs\.js/);
});
test('LP: preserve original locations report and graph selectors',()=>{
 for(const id of ['assemblyLocationReportPanel','assemblyLocationReportTab','glassEfficiencyWeek','glassExploreButton','glassExplorerModal','glassExplorerGraph','locationByReservation','locationMixedRacks'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(shell,/panel\.append\(report\)/);
 assert.match(shell,/reportTrigger\.click\(\)/);
 assert.match(app,/async function loadLocationReport\(/);
});
test('LP: preserve permission gate and hidden legacy views',()=>{
 assert.match(shell,/!reportTrigger\.hidden/);
 assert.match(shell,/MutationObserver/);
 assert.match(css,/#productionAssemblyPanel\[hidden\]/);
 assert.match(css,/@media\(max-width:700px\)/);
});
