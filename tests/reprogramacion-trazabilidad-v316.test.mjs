import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const migration=readFileSync(new URL('../supabase/migrations/20261021_lab_v316_reprogramacion_detalle_canonico.sql',import.meta.url),'utf8');
const rollback=readFileSync(new URL('../supabase/rollbacks/20261021_lab_v316_reprogramacion_detalle_canonico_rollback.sql',import.meta.url),'utf8');
const repair=readFileSync(new URL('../supabase/manual/20261021_lab_v316_reparar_3_reprogramaciones.sql',import.meta.url),'utf8');
const repairRollback=readFileSync(new URL('../supabase/manual/20261021_lab_v316_reparar_3_reprogramaciones_rollback.sql',import.meta.url),'utf8');
test('RPC preserva firma, roles y seguridad de sesión',()=>{
 for(const x of [migration,rollback]){
  assert.match(x,/sgp_mecanizado_reprogramar_orden\(p_token text, p_id_programacion uuid, p_produccion text, p_fecha date, p_turno text, p_prioridad integer, p_motivo text\)/);
  assert.match(x,/SECURITY DEFINER/);
  assert.match(x,/SET search_path TO ''/);
  assert.match(x,/sgp_validar_sesion_rol\(p_token,array\['ADMINISTRADOR','COORDINADOR'\]\)/);
  assert.match(x,/v_estado in \('PROCESADO','REPROGRAMADO'\)/);
  assert.match(x,/sgp_mecanizado_guardar_estado_orden/);
 }
});
test('RPC rechaza destino sin composición canónica exacta antes de crearlo',()=>{
 assert.match(migration,/d\.produccion_snapshot=p_produccion/);
 assert.match(migration,/d\.reserva_snapshot=v_origen\.reserva/);
 assert.match(migration,/v_detalle_count=0 or v_detalle_cantidad<>v_cantidad/);
 assert.ok(migration.indexOf('v_detalle_count=0')<migration.indexOf('insert into public.sgp_mecanizado_programacion(reserva'));
});
test('RPC copia claves, snapshots y origen en la misma transacción',()=>{
 for(const x of ['key_produccion','cantidad_snapshot','reserva_snapshot','prioridad_semanal_snapshot','produccion_snapshot'])assert.match(migration,new RegExp('d\\.'+x));
 assert.match(migration,/REPROGRAMACION/);
 assert.match(migration,/get diagnostics v_inserted=row_count/);
 assert.match(migration,/v_inserted<>v_detalle_count/);
 assert.ok(migration.indexOf('insert into public.sgp_mecanizado_programacion_detalle')<migration.indexOf('insert into public.sgp_mecanizado_reprogramaciones'));
 assert.doesNotMatch(rollback,/v_detalle_count/);
});
test('reparación histórica está separada y restringida a tres destinos verificados',()=>{
 for(const id of ['169ce156-5726-4965-8c03-98c2ac4204fb','63a5685f-46e6-4052-9ab7-5796a8791b04','c432eff2-873f-4979-ac3f-76d1ee094974']){
  assert.ok(repair.includes(id));assert.ok(repairRollback.includes(id));
 }
 assert.match(repair,/v_validos<>3/);
 assert.match(repair,/n_keys=1 AND total=cantidad/);
 assert.match(repair,/NOT EXISTS\(SELECT 1 FROM public\.sgp_mecanizado_programacion_detalle/);
 assert.match(repair,/REPARACION_REPROGRAMACION/);
 assert.match(repairRollback,/origen='REPARACION_REPROGRAMACION'/);
 assert.doesNotMatch(repairRollback,/DELETE FROM public\.sgp_mecanizado_programacion\s/);
});

test('identidad y cantidad se resuelven por key_produccion, no por nombre con LIMIT 1',()=>{
 assert.match(migration,/join public\.sgp_producciones sp on sp\.key_produccion=d\.key_produccion/);
 assert.match(migration,/sp\.reserva_al=v_origen\.reserva and sp\.id_linea='PANELES_2'/);
 assert.match(migration,/d\.produccion_snapshot=p_produccion/);
 assert.match(migration,/round\(sum\(d\.cantidad_snapshot\)\)::int/);
 assert.doesNotMatch(migration,/limit 1;/i);
});
test('una reserva con varios registros de composición se suma, no toma una fila arbitraria',()=>{
 assert.match(migration,/select min\(d\.prioridad_semanal_snapshot\),round\(sum\(d\.cantidad_snapshot\)\)::int/);
 assert.match(migration,/v_detalle_count=0 or v_detalle_cantidad<>v_cantidad/);
 assert.match(migration,/v_inserted<>v_detalle_count/);
});

test('SQL migración y rollback terminan en sentencia completa y no duplican prioridades',()=>{
 for(const script of [migration,rollback])assert.match(script,/end \\$function\\$;\\s*$/);
 assert.doesNotMatch(migration,/join public\\.sgp_prioridades pr on pr\\.key_produccion=d\\.key_produccion/);
});
