import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {changeLabel,pendingRows,renderChangeRows} from '../src/modules/export-review.js';
test('labels changes together without selecting approval automatically',()=>{
 const row={id:'one',key_produccion:'123|PANELES_2',produccion:'Peppertree',tipo_cambio:['CANTIDAD','SEMANA'],anterior:{cantidad:8,semana_actual:46},propuesto:{cantidad:64,semana_actual:47}};
 assert.equal(changeLabel(row),'Cantidad · Semana');const html=renderChangeRows([row]);assert.match(html,/8 ventanas/);assert.match(html,/64 ventanas/);assert.doesNotMatch(html,/ checked/);
});
test('pending only; applied and superseded are not approvable',()=>assert.equal(pendingRows({filas:[{estado:'PENDIENTE',tipo_cambio:['CANTIDAD']},{estado:'PENDIENTE',tipo_cambio:[]},{estado:'APLICADA'},{estado:'SUPERADA'}]}).length,1));
test('escapes order and ids from imported data',()=>assert.doesNotMatch(renderChangeRows([{id:'"><img>',produccion:'<script>',tipo_cambio:['NUEVA']}]),/<script>|<img>/));
test('application uses approval RPC only, not legacy writer',()=>{
 const source=readFileSync(new URL('../src/modules/export-review.js',import.meta.url),'utf8');
 assert.match(source,/sgp_export_aprobar/);assert.doesNotMatch(source,/sgp_aplicar_export_diario/);
 assert.match(source,/sgp_export_ausentes_listar/);assert.match(source,/sgp_export_revisiones_listar/);
});
import {createExportReview} from '../src/modules/export-review.js';
test('preparation is separate and apply submits only explicitly selected IDs',async()=>{
 const ids=['dailyExportFile','dailyExportLine','dailyExportStatus','applyDailyExport','previewDailyExport','dailyExportWeeks','dailyExportMetrics','dailyExportPending','dailyExportAbsent'];
 const els=Object.fromEntries(ids.map(id=>[id,{innerHTML:'',disabled:false,addEventListener(){},querySelectorAll(){return [{dataset:{exportApproval:'chosen'}}]}}]));
 els.dailyExportFile.files=[{name:'export.xlsx'}];els.dailyExportLine.value='PANELES_2';
 const calls=[];const oldDocument=globalThis.document,oldWindow=globalThis.window;
 globalThis.document={getElementById:id=>els[id]};globalThis.window={confirm:()=>true};
 try{
 const controller=createExportReview({getToken:()=> 'session',readWorkbook:async()=>({errors:[],rows:[{id_linea:'PANELES_2'}]}),getClient:async()=>({rpc:async(name,args)=>{calls.push({name,args});return {data:name==='sgp_export_preparar'?{lote_id:'batch',sin_cambios:1,filas:[{id:'chosen',estado:'PENDIENTE',tipo_cambio:['CANTIDAD']},{id:'left',estado:'PENDIENTE',tipo_cambio:['AUSENTE']}]}:{actualizados:2,aprobados:1,pendientes:1}}}})});
 await controller.preview();assert.equal(calls.length,1);assert.equal(calls[0].name,'sgp_export_preparar');
 await controller.apply();assert.deepEqual(calls[1].args,{p_token:'session',p_lote_id:'batch',p_filas:['chosen']});assert.match(els.dailyExportStatus.textContent,/1 pendientes/);
 }finally{globalThis.document=oldDocument;globalThis.window=oldWindow;}
});
test('archived order is visible but has no approval control',()=>{
 const html=renderChangeRows([{id:'archived',estado:'BLOQUEADA',tipo_cambio:['ARCHIVADA'],produccion:'Historical'}]);assert.match(html,/Revisar archivo/);assert.doesNotMatch(html,/data-export-approval/);
});

test('archived balance approval explains no reactivation and shows saldo comparison',()=>{
 const row={id:'arch',produccion:'PROD14',estado:'PENDIENTE',tipo_cambio:['SALDOS_ARCHIVADA'],anterior:{cantidad:6,semana_actual:44,saldo_ensamble:2,saldo_empaque:0},propuesto:{cantidad:6,semana_actual:44,saldo_ensamble:0,saldo_empaque:0}};
 assert.equal(changeLabel(row),'Actualizar saldos sin reactivar');
 const html=renderChangeRows([row]);
 assert.match(html,/data-export-approval/);
 assert.match(html,/Saldo ensamble: 2/);
 assert.match(html,/Saldo ensamble: 0/);
});
