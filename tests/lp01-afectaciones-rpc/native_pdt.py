"""Compose existing native PDT contracts with LP's captured auth in synthetic QA only."""
from pathlib import Path
import importlib.util,json
ROOT=Path(__file__).resolve().parents[2]
def prepare(db):
 spec=importlib.util.spec_from_file_location('native_pdt_fixture',ROOT/'tests/pdt-multiorigin/fixture.py');f=importlib.util.module_from_spec(spec);spec.loader.exec_module(f)
 def compatible(q):
  if q.startswith(('CREATE SCHEMA extensions;','CREATE TABLE sgp_usuarios(','INSERT INTO sgp_usuarios(','CREATE TABLE sgp_producciones(','CREATE TABLE public.sgp_producciones(')):return ''
  if 'FUNCTION public.sgp_sesion_actual(' in q:return '' # retain captured current LP auth
  q=q.replace('ADD COLUMN id text,ADD COLUMN id_linea text','ADD COLUMN id text')
  if q.startswith('INSERT INTO sgp_producciones('):q=q[q.index(';')+1:]
  if q.lstrip().startswith('INSERT INTO sgp_producciones('):q=q[q.index(';')+1:]
  return db.sql(q)
 f.prepare(ROOT,compatible)
 db.sql('ALTER TABLE public.sgp_aluminio_pendientes_historial ADD COLUMN estado_anterior text,ADD COLUMN estado_nuevo text NOT NULL')
 db.sql("UPDATE public.sgp_producciones SET id='QA',produccion='QA ORDER',sistema='ES' WHERE key_produccion LIKE 'QA|%';ALTER TABLE sgp_mecanizado_programacion ADD COLUMN estado text DEFAULT 'PROCESADO';ALTER TABLE sgp_picking_entregas ALTER COLUMN id_entrega SET DEFAULT gen_random_uuid(),ADD COLUMN observacion text,ADD COLUMN usuario_entrega text,ADD COLUMN fecha_entrega timestamptz,ADD COLUMN fecha_operativa date,ADD COLUMN turno_entrega text;CREATE TABLE sgp_picking_faltantes(id_faltante uuid PRIMARY KEY DEFAULT gen_random_uuid(),id_entrega uuid REFERENCES sgp_picking_entregas,id_pieza text,produccion text,perfil text,marca text,fabricacion text,longitud numeric,cantidad numeric,observacion text,nc text,reserva_pendiente text,acabado_pendiente text);CREATE SCHEMA sgp_pdt_compat_91;")
 # Existing Picking list is a documented fixture; all V4 source identity/writer functions below are native reviewed bodies.
 db.sql("CREATE FUNCTION public.sgp_picking_piezas_panel(p_token text,p_id_programacion uuid,p_produccion text) RETURNS jsonb LANGUAGE sql AS $$ SELECT coalesce(jsonb_agg(to_jsonb(a)),'[]') FROM public.sgp_aluminio a JOIN public.sgp_maestro_piezas m ON m.codigo_sap=a.codigo_sap AND m.tipo_pieza='PANEL' AND m.activo='SI' JOIN public.sgp_mecanizado_programacion p ON p.id_programacion=p_id_programacion WHERE a.produccion=p_produccion AND a.sistema=p.sistema AND a.acabado=p.acabado $$")
 for fun in json.loads((ROOT/'scripts/pdt-compatibility/evidence/PDT_FUNCIONES_REALES.json').read_text())['funciones']:
  if fun['firma']=='sgp_picking_entrega_orden(text,uuid,text,boolean,text,jsonb,date,text)':db.sql(fun['definicion'].replace('public.sgp_picking_entrega_orden(', 'sgp_pdt_compat_91.sgp_picking_entrega_orden('))
  if 'rechazar_entrega_completa' in fun['firma']:db.sql(fun['definicion'])
 db.sql('CREATE TRIGGER trg_sgp_picking_no_duplicar_completa BEFORE INSERT ON sgp_picking_entregas FOR EACH ROW EXECUTE FUNCTION sgp_picking_rechazar_entrega_completa_duplicada()')
 db.sql((ROOT/'docs/sql-proposals/pdt/multiorigin/01_multiorigin_REVIEW.sql').read_text())
 # Latest registrar body, extracted exactly, without unrelated lifecycle installer modifications.
 text=(ROOT/'docs/sql-proposals/pdt/multiorigin/04_deferred_multi_nc_REVIEW.sql').read_text();a=text.index('CREATE OR REPLACE FUNCTION sgp_pdt_multiorigen.registrar');b=text.index('END $fn$;',a)+len('END $fn$;');db.sql(text[a:b])
 return db.sql("SELECT md5(prosrc) FROM pg_proc WHERE oid='public.sgp_pdt_registrar_v4(text,text,jsonb,jsonb,uuid)'::regprocedure")
if __name__=='__main__':
 spec=importlib.util.spec_from_file_location('lp_affect_fixture',ROOT/'tests/lp01-afectaciones-rpc/postgres.py');lp=importlib.util.module_from_spec(spec);spec.loader.exec_module(lp)
 x=lp.Fixture()
 try:print('native registrar hash',prepare(x.db))
 finally:x.close()
