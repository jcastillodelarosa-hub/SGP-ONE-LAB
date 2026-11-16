import test from 'node:test';
import assert from 'node:assert/strict';
import {accessoryAlertsMarkup} from '../src/modules/accessory-alerts.js';
import {readWithAccessoryAlerts,markAlertsUnavailable} from '../src/services/accessory-alerts.js';
test('accessory notices accumulate by exact code, escape HTML and deduplicate',()=>{
 const html=accessoryAlertsMarkup({oficial:{accessory_alerts:[{codigo:'G05',mensaje:'<script>x</script>'},{codigo:'G05',mensaje:'duplicate'},{codigo:'G050',mensaje:'Second'}]}});
 assert.equal((html.match(/class="sgp-accessory-alert"/g)||[]).length,2);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>|duplicate/);assert.match(html,/G050/);
});
test('unavailable never means no alerts',()=>{assert.equal(accessoryAlertsMarkup({accessory_alerts:[]}), '');assert.match(accessoryAlertsMarkup({accessory_alerts:null}),/no disponibles/);assert.match(accessoryAlertsMarkup({oficial:{accessory_alerts:null}}),/no disponibles/);});
test('fixed reader facade passes only token and source parameters',async()=>{const calls=[];const client={rpc:(...a)=>{calls.push(a);return Promise.resolve({data:{filas:[]}})}};await readWithAccessoryAlerts(client,'sgp_consultar_ensamble',{p_token:'fixture',p_semana:47,p_linea:'PANELES_2'});assert.deepEqual(calls,[['sgp_alertas_accesorio_consultar',{p_token:'fixture',p_fuente:'sgp_consultar_ensamble',p_parametros:{p_semana:47,p_linea:'PANELES_2'}}]]);});
test('permission failures do not fallback to another reader',async()=>{let calls=0;const client={rpc:()=>{calls++;return {error:{code:'42501'}}}};assert.equal((await readWithAccessoryAlerts(client,'sgp_lp_operacion_consultar',{})).error.code,'42501');assert.equal(calls,1);});
test('missing migration retains original view with explicit unavailable notices',async()=>{let calls=0;const client={rpc:()=>++calls===1?{error:{code:'PGRST202'}}:{data:{catalog:{productions:[{key:'a',oficial:{key_produccion:'a'}}]}}}};const r=await readWithAccessoryAlerts(client,'sgp_lp_operacion_consultar',{});assert.equal(r.data.catalog.productions[0].oficial.accessory_alerts,null);assert.equal(calls,2);});
test('write operations and unrelated readers are not intercepted',async()=>{let called;const client={rpc:(name,args)=>{called=[name,args];return {data:true}}};await readWithAccessoryAlerts(client,'sgp_linea_plan_programar',{p_key:'x'});assert.deepEqual(called,['sgp_linea_plan_programar',{p_key:'x'}]);});
test('unavailable conversion does not mutate source data',()=>{const original={filas:[{key_produccion:'a',accessory_alerts:[{codigo:'X',mensaje:'Old'}]}]};assert.equal(markAlertsUnavailable(original).filas[0].accessory_alerts,null);assert.equal(original.filas[0].accessory_alerts.length,1);});
