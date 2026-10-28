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

test('shared-reservation history is untouched, regex agrees with original, update refreshes identity',()=>{
 const pattern=original.match(/regexp_split_to_array\(coalesce\(sp\.reserva_al,''\),('(?:\\\\s\*,\\\\s\*)')\)/)?.[1];
 assert.ok(pattern,'original reservation separator must be found');
 const patterns=[...proposal.matchAll(/regexp_split_to_array\(coalesce\(sp\.reserva_al,''\),('[^']+')\)/g)].map(x=>x[1]);
 assert.ok(patterns.length>=8);assert.ok(patterns.every(x=>x===pattern));
 assert.ok(!proposal.includes('es_reserva_compartida='));
 assert.ok(proposal.includes('BEFORE INSERT OR UPDATE OF reserva,produccion,key_produccion'));
 assert.ok(proposal.includes('NEW.reserva_principal:=coalesce(rel.reserva_principal,NEW.reserva)'));
});
test('isolated equality compares complete ordered arrays',()=>{
 const sql=readFileSync('tests/pdt-enriched/equality-isolated.sql','utf8');
 assert.ok(sql.includes('before_all IS DISTINCT FROM after_all'));
 assert.ok(sql.includes('before_open IS DISTINCT FROM after_open'));
});
