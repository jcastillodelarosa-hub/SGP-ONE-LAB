"""Explicitly authorized PDT91 installation helpers. No network or secret handling."""
import re,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'sql/pdt'))
from installation_plan import render,transaction_body,manifest

# SHARE ROW EXCLUSIVE conflicts with every ordinary table writer, including cron,
# service_role and replication, while pg_dump's ACCESS SHARE remains possible.
# NOWAIT fails before the backup/install if a writer already holds a conflict.
FREEZE_SQL="""BEGIN ISOLATION LEVEL REPEATABLE READ READ WRITE;
SET LOCAL lock_timeout='3s'; SET LOCAL idle_in_transaction_session_timeout='15min';
DO $lock$ BEGIN PERFORM pg_advisory_xact_lock(hashtextextended('sgp_pdt91_production_install',0)); END $lock$;
DO $freeze$ DECLARE t record; BEGIN
 FOR t IN SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind IN ('r','p') ORDER BY c.oid LOOP
 EXECUTE format('LOCK TABLE %I.%I IN SHARE ROW EXCLUSIVE MODE NOWAIT',t.nspname,t.relname);
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_locks WHERE pid=pg_backend_pid() AND mode='ShareRowExclusiveLock' AND granted)
 THEN RAISE EXCEPTION 'PDT91_WRITES_NOT_CONTROLLED'; END IF;
END $freeze$;
SELECT pg_export_snapshot();
"""

def batch_body():return transaction_body(render('AB'))

def safe_ddl_error(data):
 text=data.decode(errors='replace')
 m=re.search(r'ERROR:\s*([^\r\n]+)',text)
 if not m:return 'DDL_FAILED_NO_PUBLIC_DETAILS'
 s=re.sub(r"'(?:[^'\n]|'')*'",'[literal]',m.group(1))
 # Do not forward row DETAIL, contexts, tokens or arbitrary subprocess output.
 return s[:240]

def acceptance_sql(catalog):
 checks=[]
 for f in catalog['funciones']:
  signature=f['firma'].removeprefix('public.')
  if signature in ('sgp_validar_sesion_rol(text,text[])','sgp_sesion_actual(text)','sgp_picking_entrega_orden(text,uuid,text,boolean,text,jsonb)','sgp_picking_validar_recepcion(text,uuid,boolean,text)'):
   checks.append("IF md5(pg_get_functiondef('public."+signature+"'::regprocedure))<> '"+f['md5_definicion']+"' THEN RAISE EXCEPTION 'PDT91_LEGACY_AUTH_OR_DELIVERY_CHANGED'; END IF;")
 return """DO $accept$ DECLARE s text; t text; BEGIN
 """+'\n'.join(checks)+"""
 IF EXISTS(SELECT 1 FROM public.sgp_aluminio_pendientes WHERE contrato_pdt<>'LEGACY') THEN RAISE EXCEPTION 'PDT91_UNEXPECTED_AUTOMATIC_CONVERSION'; END IF;
 FOREACH s IN ARRAY ARRAY['sgp_pdt_capacidades_v2(text)','sgp_pdt_estado_v2(text,uuid,text)',
 'sgp_pdt_entrega_registrar_v2(text,uuid,uuid,integer,uuid)','sgp_pdt_entrega_validar_v2(text,uuid)',
 'sgp_pdt_asignar_v2(text,uuid,uuid)','sgp_pdt_entrega_anular_v2(text,uuid,text)','sgp_pdt_cerrar_v2(text,uuid,uuid)'] LOOP
 IF to_regprocedure('public.'||s) IS NULL OR NOT has_function_privilege('anon','public.'||s,'EXECUTE')
 OR NOT has_function_privilege('authenticated','public.'||s,'EXECUTE') THEN RAISE EXCEPTION 'PDT91_RPC_EXECUTE_MISSING'; END IF;
 END LOOP;
 IF has_function_privilege('anon','public.sgp_pdt_validar_rol_real(text,text[])','EXECUTE')
 OR has_function_privilege('authenticated','public.sgp_pdt_validar_rol_real(text,text[])','EXECUTE')
 THEN RAISE EXCEPTION 'PDT91_INTERNAL_HELPER_EXPOSED'; END IF;
 FOREACH t IN ARRAY ARRAY['sgp_pdt_fuentes','sgp_pdt_entrega_lineas','sgp_pdt_asignaciones','sgp_pdt_cierres',
 'sgp_aluminio_pendiente_detalles','sgp_aluminio_pendiente_movimientos'] LOOP
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=('public.'||t)::regclass)
 OR has_table_privilege('anon','public.'||t,'INSERT,UPDATE,DELETE')
 OR has_table_privilege('authenticated','public.'||t,'INSERT,UPDATE,DELETE')
 THEN RAISE EXCEPTION 'PDT91_DIRECT_TABLE_WRITE_EXPOSED'; END IF;
 END LOOP;
 IF position('picking_cuantitativo' IN pg_get_functiondef('public.sgp_pdt_capacidades_v2(text)'::regprocedure))=0
 OR position('PDT_V2_USAR_RPC_DEDICADA' IN pg_get_functiondef('public.sgp_aluminio_pendiente_resolver(text,uuid)'::regprocedure))=0
 OR position('PDT_V2_USAR_RPC_DEDICADA' IN pg_get_functiondef('public.sgp_aluminio_pendiente_estado(text,uuid,text,text)'::regprocedure))=0
 THEN RAISE EXCEPTION 'PDT91_GUARD_OR_CAPABILITIES_MISSING'; END IF;
 BEGIN
 PERFORM public.sgp_pdt_estado_v2(NULL,NULL,'CORTE');
 RAISE EXCEPTION 'PDT91_UNAUTHENTICATED_OPERATION_ALLOWED';
 EXCEPTION WHEN OTHERS THEN
 IF SQLERRM NOT IN ('PDT_SESION_NO_VALIDA','PDT_ROL_REAL_NO_AUTORIZADO','PERMISO_DENEGADO') THEN RAISE; END IF;
 END;
END $accept$;
"""
