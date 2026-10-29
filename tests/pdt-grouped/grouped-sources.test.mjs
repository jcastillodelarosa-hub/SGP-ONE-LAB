import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {groupPdtSources,distributionState,sourceUsable} from '../../src/modules/pdt-source-distribution.js';
import {validateFabricationDistribution} from '../../src/domain/aluminum-pending-balances.js';
const one=id=>({id_pieza:id,fabricacion:'E17',longitud:1200,acabado:'BLANCO',cantidad:4});
test('one or several originals form one detail without arbitrary piece identity',()=>{
 for(const sources of [[one('a')],[one('a'),one('b')]]){
  const groups=groupPdtSources(sources);assert.equal(groups.length,1);assert.equal(groups[0].source_ids.length,sources.length);
  assert.equal(groups[0].id_pieza,'');assert.ok(sourceUsable(groups[0],groups));
  const state=distributionState(groups,[{...groups[0],cantidad:2}],2);
  assert.equal(state.valid,true);assert.equal(state.details[0].id_pieza,'');assert.equal(state.details[0].cantidad,2);
 }
});
test('duplicate group and invalid quantity fail without inventing a source',()=>{
 const groups=groupPdtSources([one('a'),one('b')]);
 assert.throws(()=>validateFabricationDistribution([{...groups[0],cantidad:1},{...groups[0],cantidad:1}]),/duplicada/);
 assert.equal(distributionState(groups,[{...groups[0],cantidad:3}],2).valid,false);
 assert.equal(groupPdtSources([{...one('a'),longitud:null}]).length,0);
});
test('SQL retains existing advance, assignment and close writers',()=>{
 const sql=readFileSync('docs/sql-proposals/pdt/grouped-source/01_grouped_sources_REVIEW.sql','utf8');
 for(const name of ['sgp_aluminio_pendiente_registrar_avance_v1','sgp_pdt_asignar_v2','sgp_pdt_cerrar_v2'])assert.ok(!sql.includes('CREATE OR REPLACE FUNCTION public.'+name));
 assert.equal((sql.match(/IF v_source<1/g)||[]).length,2);
 assert.equal((sql.match(/VALUES\(p_entrega,p_detalle,'',p_cantidad,p_clave,u\)/g)||[]).length,2);
 assert.ok(sql.includes('sgp_pdt_linea_grouped_activa'));
 assert.ok(sql.includes('AND EXISTS(SELECT 1 FROM public.sgp_pdt_fuentes f WHERE f.id_detalle=a.id_detalle'));
});
