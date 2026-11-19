import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html=read('index.html');
const app=read('app.js');
const nav=read('navigation-preferences.js');

test('Apariencia y navegación is a separate, initially hidden panel in the existing tab row',()=>{
 const tabs=html.match(/<div class="config-tabs">([\s\S]*?)<\/div>/)[1];
 assert.match(tabs,/data-config-tab="alertas"[\s\S]*data-config-tab="apariencia" aria-controls="configAppearance">Apariencia y navegación/);
 assert.equal([...html.matchAll(/id="configAppearance"/g)].length,1);
 assert.match(html,/<div id="configAppearance" class="config-panel" data-config-panel="apariencia" hidden><\/div>/);
 const panel={children:[],querySelector:()=>null,append(block){this.children.push(block);}};
 const block={querySelectorAll:()=>[],querySelector:()=>({addEventListener(){}})};
 const document={querySelector:selector=>{assert.equal(selector,'#configAppearance');return panel;},createElement:()=>block};
 const mount=nav.slice(nav.indexOf('function mountConfig(){'),nav.indexOf('mountConfig();apply();'));
 vm.runInNewContext(mount+'mountConfig();',{document,inputs:null,syncInputs(){},settings:{},DEFAULT:{}});
 assert.deepEqual(panel.children,[block]);
 assert.equal(block.id,'sgpNavigationPreferences');
 assert.match(block.innerHTML,/data-sgp-setting="theme"/);
 assert.match(block.innerHTML,/data-sgp-reset/);
});

test('Coordinador can switch between alerts and local appearance without exposing privileged tabs',()=>{
 const keys=['sgp','usuarios','roles','alertas','apariencia','diseno'];
 const tabs=keys.map(configTab=>({dataset:{configTab},active:false,classList:{toggle(_name,on){tabs.find(t=>t.dataset.configTab===configTab).active=on;}}}));
 const panels=keys.map(configPanel=>({dataset:{configPanel},hidden:true}));
 const calls=[];
 let role='COORDINADOR';
 const ctx=vm.createContext({
   document:{querySelectorAll:s=>s==='[data-config-tab]'?tabs:panels},
   repoRole:()=>role,loadUserAdmin:()=>calls.push('usuarios'),loadRoleAccess:()=>calls.push('roles'),loadAccessoryAlertConfig:()=>calls.push('alertas'),
   els:{views:[],nav:[]}
 });
 function section(start,end){const i=app.indexOf(start),j=app.indexOf(end,i);assert.ok(i>=0&&j>i);return app.slice(i,j);}
 vm.runInContext(section('function coordinatorConfigTab','document.querySelectorAll(\'[data-config-tab]\').forEach(b=>b.addEventListener')+section('function openView(viewName)','function refreshWeeklyRelations'),ctx);
 const visible=()=>panels.filter(p=>!p.hidden).map(p=>p.dataset.configPanel);
 ctx.openView('configuracion');
 assert.deepEqual(tabs.filter(t=>!t.hidden).map(t=>t.dataset.configTab),['alertas','apariencia']);
 assert.deepEqual(visible(),['alertas']);
 assert.deepEqual(tabs.filter(t=>t.active).map(t=>t.dataset.configTab),['alertas']);
 ctx.activateConfigTab('apariencia');
 assert.deepEqual(visible(),['apariencia']);
 assert.deepEqual(calls,['alertas']);
 ctx.activateConfigTab('roles');
 assert.deepEqual(visible(),['apariencia']);
 ctx.activateConfigTab('alertas');
 assert.deepEqual(visible(),['alertas']);
 role='ADMINISTRADOR';
 ctx.openView('configuracion');
 assert.ok(tabs.every(t=>!t.hidden));
 ctx.activateConfigTab('apariencia');
 assert.deepEqual(visible(),['apariencia']);
 ctx.activateConfigTab('usuarios');
 assert.deepEqual(visible(),['usuarios']);
 assert.deepEqual(calls,['alertas','alertas','usuarios']);
});
