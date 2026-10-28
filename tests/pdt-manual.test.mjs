import test from 'node:test';
import assert from 'node:assert/strict';
import {groupPanelSources,manualReportPayload} from '../src/domain/pdt-manual.js';
import {manualCatalog,manualSources,manualNc,saveManualReport} from '../src/services/pdt-manual.js';
const base={id_pieza:'P1',key_produccion:'QA|PANELES_2',reserva:'R',produccion:'QA ORDER',sistema:'ES',acabado:'DS',codigo_sap:'REF',tipo_pieza:'PANEL',id_linea:'PANELES_2',fabricacion:'E17',marca:'A',longitud:100,cantidad_referencia:5};
const context={key_produccion:base.key_produccion,reserva:'R',produccion:base.produccion};
test('PANEL grouping retains every physical source without attributing pending quantity',()=>{
 const rows=[base,{...base,id_pieza:'P2',cantidad_referencia:4},{...base,id_pieza:'P2',cantidad_referencia:4},{...base,id_pieza:'F1',tipo_pieza:'FRAME'}];
 const groups=groupPanelSources(rows);assert.equal(groups.length,1);assert.deepEqual(groups[0].sourceIds,['P1','P2']);assert.equal(groups[0].cantidad_referencia,9);
 const payload=manualReportPayload({context,origin:'PICKING',groups,entries:[{key:groups[0].key,cantidad:2,nc:'',observacion:'Parcial'}],observation:'Reporte'});
 assert.equal(payload.details[0].cantidad,2);assert.equal(payload.details[0].id_pieza,undefined);assert.equal(payload.details[0].nc,'');
});
test('different production, reserve, reference, fabrication, mark and length never merge',()=>{
 const variants=[{...base,id_pieza:'P2',key_produccion:'OTHER'},{...base,id_pieza:'P3',reserva:'SHARED'},{...base,id_pieza:'P4',codigo_sap:'REF2'},{...base,id_pieza:'P5',fabricacion:'E18'},{...base,id_pieza:'P6',marca:'B'},{...base,id_pieza:'P7',longitud:101}];
 assert.equal(groupPanelSources([base,...variants]).length,7);
});
test('multiple references and NC optional, duplicate group and foreign source rejected',()=>{
 const groups=groupPanelSources([base,{...base,id_pieza:'P2',codigo_sap:'REF2',fabricacion:'E18'}]);
 const entry=group=>({key:group.key,cantidad:1,nc:'',observacion:''});
 assert.equal(manualReportPayload({context,origin:'ENSAMBLE',groups,entries:groups.map(entry)}).details.length,2);
 assert.throws(()=>manualReportPayload({context,origin:'PICKING',groups,entries:[entry(groups[0]),entry(groups[0])]}),/repetida/);
 assert.throws(()=>manualReportPayload({context:{...context,reserva:'OTHER'},origin:'PICKING',groups,entries:[entry(groups[0])]}),/ajena/);
});
test('quantities, classification and NC fail closed',()=>{
 const group=groupPanelSources([base])[0];for(const quantity of [0,-1,1.5,6,'no'])assert.throws(()=>manualReportPayload({context,origin:'PICKING',groups:[group],entries:[{key:group.key,cantidad:quantity}]}));
 assert.equal(groupPanelSources([{...base,tipo_pieza:'FRAME'}]).length,0);
 assert.throws(()=>manualReportPayload({context,origin:'PICKING',groups:[group],entries:[{key:group.key,cantidad:1,nc:'bad\nx'}]}),/NC inválida/);
});
test('RPC service uses only new server contracts, no legacy fallback',async()=>{
 const calls=[],client={rpc:async(name,args)=>{calls.push([name,args]);return {data:name==='sgp_pdt_manual_catalogo_v1'?{ok:true,producciones:[]}:name==='sgp_pdt_manual_fuentes_v1'?{ok:true,fuentes:[]}:{ok:true,id_reporte:'R'}};}};
 await manualCatalog(client,'TOKEN');await manualSources(client,'TOKEN',context);await saveManualReport(client,'TOKEN',{origin:'PICKING',context,details:[],observation:''},'KEY');
 assert.deepEqual(calls.map(x=>x[0]),['sgp_pdt_manual_catalogo_v1','sgp_pdt_manual_fuentes_v1','sgp_pdt_manual_registrar_v1']);
 await assert.rejects(()=>manualCatalog({rpc:async()=>({error:{code:'PGRST202'}})},'TOKEN'),/aún no instalada/);
 assert.deepEqual(await manualNc({rpc:async(name)=>{assert.equal(name,'sgp_pdt_manual_nc_consultar_v1');return {data:{ok:true,nc:{numero:'NC-1',estado:'ABIERTA',reserva_solucion:'R'}}};}},'TOKEN','NC-1'),{numero:'NC-1',estado:'ABIERTA',reserva_solucion:'R'});
});
