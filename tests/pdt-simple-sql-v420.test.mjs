import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const sql=readFileSync(new URL('../docs/sql-proposals/pdt/simple/20261109_proceso_simple_v1.sql',import.meta.url),'utf8');
test('atomic workflow retains existing authorized guards and movement writer',()=>{
 assert.match(sql,/sgp_pdt_validar_rol_real/);
 assert.match(sql,/FOR UPDATE/);
 assert.match(sql,/pg_advisory_xact_lock/);
 assert.match(sql,/PERFORM public.sgp_aluminio_pendiente_registrar_avance_v1/);
 assert.match(sql,/historial\(id_pendiente,estado_nuevo,/);
 assert.ok(sql.indexOf("RETURN (old->'resultado')")<sql.indexOf("IF p.contrato_pdt<>"));
 assert.doesNotMatch(sql,/DISABLE TRIGGER|DROP TABLE|UPDATE public\.sgp_aluminio_pendientes SET/);
});
test('completion is gated by every detail balance, capabilities preserved and replay indexed',()=>{
 assert.match(sql,/IF NOT EXISTS\(SELECT 1 FROM public.sgp_aluminio_pendiente_detalles/);
 assert.match(sql,/CREATE UNIQUE INDEX IF NOT EXISTS sgp_pdt_simple_idempotency_idx/);
 assert.match(sql,/EXECUTE replace\(definition/);
 assert.match(sql,/REVOKE ALL ON FUNCTION/);
});
const reconcile=(validated,done,started=0,baseline=done)=>Math.min(Math.max(0,validated-done),Math.max(0,started-Math.max(0,done-baseline)));
test('in-process snapshot subtracts subsequent legacy processing and stays bounded',()=>{
 assert.equal(reconcile(10,0),0);
 assert.equal(reconcile(10,2,5,2),5);
 assert.equal(reconcile(10,5,5,2),2);
 assert.equal(reconcile(10,10,5,2),0);
 assert.equal(reconcile(10,8,5,8),2);
 assert.equal(reconcile(10,1,5,2),5);
});
