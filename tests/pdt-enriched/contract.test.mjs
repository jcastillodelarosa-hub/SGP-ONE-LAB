import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const original=readFileSync('supabase/migrations/20261018_pdt_validation_workflow.sql','utf8').split('CREATE OR REPLACE FUNCTION public.sgp_aluminio_pendientes_listar(')[1].split('CREATE OR REPLACE FUNCTION public.sgp_consultar_ensamble(')[0];
const proposal=readFileSync('docs/sql-proposals/pdt/enriched-listing/01_enriched_listing_REVIEW.sql','utf8');
const optimized=proposal.split('CREATE OR REPLACE FUNCTION public.sgp_aluminio_pendientes_listar(')[1].split('end $function$')[0];
function keys(body){const block=body.split('jsonb_build_object(')[1].split(') order by case')[0];return [...block.matchAll(/'([^']+)',/g)].map(x=>x[1])}
test('output keys, ordering, roles and filter preserved',()=>{
 assert.deepEqual(keys(optimized),keys(original));
 for(const part of ["array['ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO','LIDER','LIDER LINEA','SUPERVISOR DE PICKING','PATINADOR','CONSULTA']","p.estado='PENDIENTE'","p.estado_repo='PICKING'","p.fecha_reporte"])assert.ok(optimized.includes(part));
});
test('NC assignment/change/unlink remain live',()=>{
 const nc=original.match(/ left join lateral\(\n   select n\.consecutivo[\s\S]*?\)n on true/)[0];
 assert.ok(optimized.includes(nc));
 for(const field of ['estado_nc','nc_enlazada','nc_produccion','nc_reserva','nc_referencia','reserva_solucion_nc'])assert.ok(optimized.includes(`'${field}'`));
});
test('no repeated reservation/production lookups in listing, original non-null identity preserved',()=>{
 assert.ok(!optimized.includes('sgp_produccion_reservas_v'));
 assert.ok(!optimized.includes('sgp_producciones'));
 assert.ok(optimized.includes('p.key_produccion')&&optimized.includes('p.semana_pdt'));
 assert.ok(proposal.includes('coalesce(p.key_produccion,r.key_produccion)'));
 assert.ok(proposal.includes('PDT_LISTAR_DEFINITION_CHANGED'));
});
