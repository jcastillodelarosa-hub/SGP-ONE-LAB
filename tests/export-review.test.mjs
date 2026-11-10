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
 const els=Object.fromEntries(ids.map(id=>[id,{innerHTML:'',disabled:false,addEventListener(){},querySelector(){return null;},querySelectorAll(){return [{dataset:{exportApproval:'chosen'}}]}}]));
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

async function selectionFixture(run){
 const rows=[{id:'quantity',estado:'PENDIENTE',tipo_cambio:['CANTIDAD']},{id:'balance',estado:'PENDIENTE',tipo_cambio:['SALDOS_ARCHIVADA']},{id:'archived',estado:'BLOQUEADA',tipo_cambio:['ARCHIVADA']}];
 const inputs=rows.slice(0,2).map(row=>({checked:false,disabled:false,dataset:{exportApproval:row.id}}));
 const all={disabled:false,dataset:{exportSelect:'all'}},none={disabled:true,dataset:{exportSelect:'none'}},count={textContent:''},events={};
 const ids=['dailyExportFile','dailyExportLine','dailyExportStatus','applyDailyExport','previewDailyExport','dailyExportWeeks','dailyExportMetrics','dailyExportPending','dailyExportAbsent'];
 const els=Object.fromEntries(ids.map(id=>[id,{innerHTML:'',disabled:false,addEventListener(){}}]));
 Object.assign(els.dailyExportWeeks,{addEventListener(type,fn){events[type]=fn;},querySelector(selector){return {'[data-export-select="all"]':all,'[data-export-select="none"]':none,'[data-export-selection-count]':count}[selector]||null;},querySelectorAll(selector){return selector.endsWith(':checked')?inputs.filter(x=>x.checked):inputs.filter(x=>!x.disabled);}});
 els.dailyExportFile.files=[{name:'synthetic.xlsx'}];els.dailyExportLine.value='PANELES_2';
 const calls=[],confirmations=[];let accepted=true,applyResponse={data:{actualizados:0,aprobados:2,pendientes:0}};
 const oldDocument=globalThis.document,oldWindow=globalThis.window;
 globalThis.document={getElementById:id=>els[id]};globalThis.window={confirm:message=>{confirmations.push(message);return accepted;}};
 try{
  const controller=createExportReview({getToken:()=> 'synthetic-session',readWorkbook:async()=>({errors:[],rows:[{id_linea:'PANELES_2'}]}),getClient:async()=>({rpc:async(name,args)=>{calls.push({name,args});return name==='sgp_export_preparar'?{data:{lote_id:'batch',sin_cambios:0,filas:rows}}:applyResponse;}})});
  await controller.preview();
  await run({controller,inputs,all,none,count,calls,confirmations,els,change:()=>events.change(),click:button=>events.click({target:{closest:()=>button}}),cancel:()=>{accepted=false;},respond:response=>{applyResponse=response;}});
 }finally{globalThis.document=oldDocument;globalThis.window=oldWindow;}
}
test('select all and deselect all are explicit, repeatable and exclude blocked rows',()=>selectionFixture(async f=>{
 assert.match(f.els.dailyExportWeeks.innerHTML,/Seleccionar todos/);assert.match(f.els.dailyExportWeeks.innerHTML,/Deseleccionar todos/);
 assert.equal(f.count.textContent,'0 de 2 seleccionados');assert.equal(f.none.disabled,true);assert.equal(f.all.disabled,false);
 f.click(f.all);assert(f.inputs.every(x=>x.checked));assert.equal(f.count.textContent,'2 de 2 seleccionados');assert.equal(f.all.disabled,true);assert.equal(f.calls.length,1);
 f.click(f.all);assert.equal(f.calls.length,1);
 f.inputs[0].checked=false;f.change();assert.equal(f.count.textContent,'1 de 2 seleccionados');assert.equal(f.all.disabled,false);
 f.click(f.none);assert(f.inputs.every(x=>!x.checked));assert.equal(f.count.textContent,'0 de 2 seleccionados');assert.equal(f.none.disabled,true);
 f.click(f.all);await f.controller.apply();assert.deepEqual(f.calls[1].args.p_filas,['quantity','balance']);assert.match(f.confirmations[0],/2 cambios aprobados/);
}));
test('bulk selection does not apply and cancel retains the selection',()=>selectionFixture(async f=>{
 f.click(f.all);f.cancel();await f.controller.apply();assert.equal(f.calls.length,1);assert(f.inputs.every(x=>x.checked));assert.equal(f.els.applyDailyExport.disabled,false);
}));
test('disabled approvals are skipped and an empty eligible set disables both buttons',()=>selectionFixture(async f=>{
 f.inputs[1].disabled=true;f.change();f.click(f.all);assert.equal(f.inputs[0].checked,true);assert.equal(f.inputs[1].checked,false);assert.equal(f.count.textContent,'1 de 1 seleccionados');
 f.inputs[0].disabled=true;f.change();assert.equal(f.all.disabled,true);assert.equal(f.none.disabled,true);assert.equal(f.count.textContent,'0 de 0 seleccionados');
}));
test('bulk controls lock during submission and recover after an application error',()=>selectionFixture(async f=>{
 f.click(f.all);let resolve;f.respond(new Promise(r=>{resolve=r;}));const applying=f.controller.apply();assert.equal(f.all.disabled,true);assert.equal(f.none.disabled,true);f.click(f.none);assert(f.inputs.every(x=>x.checked));
 resolve({error:Error('synthetic error')});await applying;assert.equal(f.none.disabled,false);assert.equal(f.all.disabled,true);assert.match(f.els.dailyExportStatus.textContent,/No se pudo aplicar/);
 f.click(f.none);assert(f.inputs.every(x=>!x.checked));
}));
