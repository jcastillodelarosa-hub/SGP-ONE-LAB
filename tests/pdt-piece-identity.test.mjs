import test from 'node:test';
import assert from 'node:assert/strict';
import {masterProductionLine,validatedNoveltySource,exactSharedIdentity} from '../src/domain/pdt-piece-identity.js';
import {saveProductionNovelty} from '../src/services/production-novelty-repository.js';
const panel={id_pieza:'QA:P1',codigo_sap:'SAP',tipo_pieza:'PANEL',destino_productivo:'PANEL',activo:'SI',id_linea:'PANELES_2',key_produccion:'QA|PANELES_2',produccion:'SAME NAME',reserva:'SHARED',reserva_principal:'PRIMARY',acabado:'DS',longitud:100};
const context={perfil:'SAP',reserva:'SHARED',acabado:'DS',produccion:'SAME NAME'};
test('master, never production name, determines PANEL and FRAME lines',()=>{
 assert.equal(masterProductionLine(panel),'PANELES_2');
 assert.equal(masterProductionLine({...panel,tipo_pieza:'FRAME',destino_productivo:'FRAME'}),'FRAMES_2');
 assert.throws(()=>masterProductionLine({...panel,destino_productivo:'FRAME'}));
 for(const record of [null,{...panel,activo:'NO'},{...panel,tipo_pieza:null},{...panel,destino_productivo:null}])assert.throws(()=>masterProductionLine(record));
 assert.equal(masterProductionLine({...panel,tipo_pieza:'COVER',destino_productivo:'FRAME'}),'FRAMES_2');
});
test('source identity, profile, reserve, finish and line must all agree',()=>{
 assert.equal(validatedNoveltySource(panel,context).id_linea,'PANELES_2');
 for(const source of [{...panel,id_pieza:null},{...panel,id_linea:'FRAMES_2'},{...panel,reserva:'OTHER'},{...panel,codigo_sap:'OTHER'},{...panel,produccion:'OTHER'}])assert.throws(()=>validatedNoveltySource(source,context));
 const rows=[{key_produccion:'QA|FRAMES_2',produccion:'SAME NAME'},{key_produccion:'QA|PANELES_2',produccion:'SAME NAME'}];
 assert.equal(exactSharedIdentity(rows,'QA|PANELES_2').key_produccion,'QA|PANELES_2');assert.equal(exactSharedIdentity(rows,'MISSING'),null);
});
test('PDT and novelty use one atomic RPC with source ID; no direct insert fallback',async()=>{
 const calls=[];const client={rpc:async(name,args)=>{calls.push({name,args});return {data:{ok:true}};},from:()=>{throw new Error('Direct insert prohibited');}};
 const payload={perfil:'SAP',produccion:'SAME NAME',cantidad:9,longitud:100};
 await saveProductionNovelty(client,{token:'fixture',payload,source:panel});
 assert.equal(calls.length,1);assert.equal(calls[0].name,'sgp_produccion_novedad_pdt_crear_v3');assert.equal(calls[0].args.p_id_pieza,'QA:P1');assert.equal(calls[0].args.p_key_produccion,'QA|PANELES_2');
 for(const source of [null,{...panel,activo:'NO'},{...panel,id_linea:'FRAMES_2'}])await assert.rejects(()=>saveProductionNovelty(client,{payload,source}));
 assert.equal(calls.length,1);
});
test('ordinary non-material novelty remains compatible; backend rejection never falls back',async()=>{
 let inserts=0;const client={from:()=>({insert:async()=>{inserts++;return {data:null};}}),rpc:async()=>({error:new Error('identity rejected')})};
 await saveProductionNovelty(client,{payload:{perfil:'',origen:'BODEGA'}});assert.equal(inserts,1);
 await assert.rejects(()=>saveProductionNovelty(client,{payload:{perfil:'SAP',produccion:'SAME NAME',cantidad:9,longitud:100},source:panel}));assert.equal(inserts,1);
});
