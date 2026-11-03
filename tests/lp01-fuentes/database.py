"""Actual captured read RPC/dependencies + existing LP engine in disposable PG only."""
from pathlib import Path
import sys,json
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1]
sys.path.insert(0,str(ROOT/'tests/lp01-operacion'))
from postgres import Database,lit
class SourcesDatabase(Database):
 def __init__(self):
  super().__init__()
  self.sql('''ALTER TABLE public.sgp_producciones ADD COLUMN anio integer DEFAULT 2026,ADD COLUMN semana_actual integer DEFAULT 44,ADD COLUMN semana_base integer DEFAULT 44,ADD COLUMN id text,ADD COLUMN activa text DEFAULT 'SI',ADD COLUMN cantidad numeric DEFAULT 288;
CREATE TABLE public.sgp_prioridades(anio int,semana int,id_linea text,key_produccion text,prioridad int,reserva text,fecha_actualizacion timestamptz);
CREATE TABLE public.sgp_vidrio(key_produccion text,datos_origen jsonb,activo text);
CREATE TABLE public.sgp_ubicacion_vidrio_actual(key_produccion text,posicion text,estado_orden text,disponible numeric,activo boolean);
CREATE TABLE public.sgp_mecanizado_ejecucion_orden(id_programacion uuid,produccion text,estado text,observacion text,actualizado_en timestamptz);
CREATE TABLE public.sgp_mecanizado_programacion(id_programacion uuid,produccion text,estado text);
CREATE SCHEMA sgp_mecanizado_parcial;
CREATE TABLE sgp_mecanizado_parcial.partes(id_programacion uuid,key_produccion text,numero int,cantidad numeric);
CREATE TABLE public.sgp_aluminio_pendientes(key_produccion text,produccion text,estado_repo text,estado text,cantidad numeric,perfil text,nc text,fecha_reporte timestamptz,validacion_estado text);
CREATE TABLE public.qa_reservas(key_produccion text,reserva text,tipo_relacion text,acabado_reserva text,semana_reserva int,es_principal_compartida boolean);
CREATE VIEW public.sgp_produccion_reservas_v AS SELECT * FROM public.qa_reservas;''')
  definitions=json.loads((HERE/'catalog-readonly.json').read_text())['definitions']
  for prefix in ['sgp_validar_sesion_rol','sgp_reserva_es_principal','sgp_es_reserva_compartida','sgp_reservas_por_produccion_json','sgp_consultar_ensamble']:
   self.sql(next(d['definition'] for d in definitions if d['signature'].startswith(prefix+'(')))
 def rpc(self,name,args):
  if name=='sgp_consultar_ensamble':return json.loads(self.sql('SET ROLE anon;SELECT public.sgp_consultar_ensamble('+lit(args['p_token'])+',NULL,'+lit(args['p_linea'])+');'))
  return super().rpc(name,args)
 def fixture(self):
  self.key='QA|PANELES_2';self.parts=self.seed(self.key,parts=(90,90,90,18))
  self.seed('QA-FUTURE|PANELES_2',parts=(1,),date='2026-11-04')
  self.sql("UPDATE public.sgp_producciones SET produccion='QA FUTURE' WHERE key_produccion='QA-FUTURE|PANELES_2'")
  # Names intentionally collide. Actual historical RPC aggregates PDT by name,
  # which the consumer labels explicitly rather than accrediting a release.
  self.seed('QA-OTHER|FRAMES_2',parts=(1,));self.sql("UPDATE public.sgp_producciones SET id_linea='FRAMES_2' WHERE key_produccion='QA-OTHER|FRAMES_2'")
  self.sql("INSERT INTO public.sgp_aluminio_pendientes VALUES('QA-OTHER|FRAMES_2','TORRE NORTE','PENDIENTE','PENDIENTE',3,'REF','QA-NC',now(),'POR_VALIDAR');UPDATE public.sgp_producciones SET saldo_ensamble=NULL WHERE key_produccion='QA|PANELES_2';")
  for stage in ['ENSAMBLE','EMPAQUE']:self.execute(self.cmd('ABRIR',stage=stage,revision=0))
 def unchanged(self):
  return {t:self.sql('SELECT coalesce(jsonb_agg(to_jsonb(x)),\'[]\'::jsonb) FROM '+t+' x') for t in ['public.sgp_producciones','public.sgp_linea_plan_asignaciones','public.sgp_aluminio_pendientes','sgp_lp_operacion.ordenes','sgp_lp_operacion.auditoria']}
