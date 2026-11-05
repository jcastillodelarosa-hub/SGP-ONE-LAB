"""Full captured PDT/view/partial schema plus LP roles; synthetic rows, network none."""
from pathlib import Path
import importlib.util,json,subprocess,uuid
HERE=Path(__file__).parent;ROOT=HERE.parents[1]
spec=importlib.util.spec_from_file_location('atomic_chain',HERE/'atomic.py');a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
lit=a.lit
class Fixture(a.ContractMethods):
 def __init__(self,install_affectations=True,reconciliation_sql=None):
  self.db=a.lp.f.Database();db=self.db;db.database='current_chain'
  subprocess.run(db.docker+['exec',db.container,'createdb','-U','postgres','current_chain'],env=db.env,check=True,capture_output=True)
  db.sql('CREATE ROLE service_role')
  db.run=lambda q:subprocess.run(db.docker+['exec','-i',db.container,'psql','-d','current_chain','-X','-qAt','-U','postgres','-v','ON_ERROR_STOP=1'],env=db.env,input=q,text=True,capture_output=True)
  db.sql(subprocess.check_output(['python',str(ROOT/'tests/mecanizado-parcial/setup.py')],text=True))
  db.sql(next((ROOT/'supabase/migrations').glob('*_mecanizado_programacion_parcial.sql')).read_text())
  # Current captured definitions, no stub or contract relaxation.
  for name in ['legacy','wrappers','sources','helpers','nc-link']:
   for row in json.loads((HERE/'production-readonly'/f'{name}.json').read_text()):db.sql(row['definition'])
  db.sql("CREATE TABLE public.sgp_linea_plan_asignaciones(id uuid PRIMARY KEY,key_produccion text REFERENCES public.sgp_producciones,fecha date,turno int,cantidad int,prioridad int,estado text,origen_id uuid);CREATE TABLE public.sgp_configuracion_general(clave text PRIMARY KEY,valor jsonb);INSERT INTO public.sgp_configuracion_general VALUES('HORARIOS_TURNOS','{\"lunes_sabado\":{\"turno1\":{\"inicio\":\"07:00\",\"fin\":\"19:00\"},\"turno2\":{\"inicio\":\"19:00\",\"fin\":\"07:00\"}},\"domingo\":{\"turno1\":{\"inicio\":\"07:00\",\"fin\":\"18:00\"},\"turno2\":{\"inicio\":\"18:00\",\"fin\":\"05:00\"}}}');")
  db.sql((ROOT/'docs/sql-proposals/lp01-operacion/01_operacion_REVIEW.sql').read_text())
  db.sql("CREATE TABLE public.sgp_rol_accesos(rol text,ventana text,permitido boolean,actualizado_en timestamptz DEFAULT now(),PRIMARY KEY(rol,ventana));CREATE TABLE public.sgp_usuario_accesos(id_usuario uuid REFERENCES public.sgp_usuarios,ventana text,permitido boolean,actualizado_en timestamptz DEFAULT now(),PRIMARY KEY(id_usuario,ventana));ALTER TABLE public.sgp_rol_accesos ENABLE ROW LEVEL SECURITY;ALTER TABLE public.sgp_usuario_accesos ENABLE ROW LEVEL SECURITY;")
  for f in json.loads((ROOT/'tests/lp01-roles/catalog-readonly.json').read_text())['functions']:
   if f['name']!='sgp_sesion_actual':db.sql(f['definition'])
  db.sql(json.loads((ROOT/'tests/lp01-roles/admin-session-readonly.json').read_text())['definition'])
  db.sql("INSERT INTO public.sgp_usuarios(usuario,nombre,rol,password_hash) VALUES('qaadmin','QA','ADMINISTRADOR','fixture'),('COORDINADOR','QA','COORDINADOR','fixture')")
  a.lp.f.token=lambda db,user,token=None:db.sql("INSERT INTO public.sgp_sesiones_app(id_usuario,token_hash,revocado_en,expira_en) SELECT id_usuario,encode(extensions.digest("+lit(token or user)+",'sha256'),'hex'),NULL,now()+interval '1 day' FROM public.sgp_usuarios WHERE usuario="+lit(user))
  a.lp.f.token(db,'qaadmin','QAADMIN');a.lp.f.token(db,'COORDINADOR')
  for file in ['06_powerbi_xlsx_REVIEW.sql','08_ambitos_temporales_REVIEW.sql']:db.sql((ROOT/'docs/sql-proposals/lp01-operacion'/file).read_text())
  a.lp.f.install_profile(db)
  db.sql('CREATE OR REPLACE VIEW public.sgp_produccion_reservas_v AS '+json.loads((HERE/'production-readonly/reserve-view.json').read_text())[0]['definition'])
  self.key='QA|PANELES_2';self.parts=[str(uuid.uuid4()) for _ in range(4)]
  db.sql("INSERT INTO public.sgp_producciones(key_produccion,id,id_linea,produccion,sistema,reserva_al,saldos_inicializados,presente_ultimo_export,saldo_ensamble,saldo_empaque,ensamblado,empacado) VALUES('QA|PANELES_2','QA','PANELES_2','QA ORDER','ES','R',true,true,288,288,0,0)")
  for i,n in enumerate([90,90,90,18]):db.sql('INSERT INTO public.sgp_linea_plan_asignaciones VALUES('+','.join([lit(self.parts[i]),lit(self.key),lit('2026-11-01'),'1',str(n),str(i+1),lit('PROGRAMADA'),'NULL'])+')')
  db.sql("UPDATE public.sgp_producciones SET id='QA',produccion='QA ORDER',sistema='ES',acabado='DS',reserva_al='R,SHARED' WHERE key_produccion='QA|PANELES_2';INSERT INTO public.sgp_producciones(key_produccion,id,id_linea,produccion,sistema,acabado,reserva_al) VALUES('OTHER|PANELES_2','OTHER','PANELES_2','QA ORDER','ES','DS','R');INSERT INTO public.sgp_maestro_piezas(codigo_sap,tipo_pieza,destino_productivo) VALUES('PANEL-REF','PANEL','PANEL'),('FRAME-REF','FRAME','FRAME');INSERT INTO public.sgp_aluminio(id_pieza,id_carga,fila_origen,key_produccion,produccion,codigo_sap,sistema,tipo_pieza,fabricacion,longitud,acabado,cantidad) VALUES('P1','QA',1,'QA|PANELES_2','QA ORDER','PANEL-REF','ES','PANEL','E17',100,'DS',5),('P2','QA',2,'QA|PANELES_2','QA ORDER','PANEL-REF','ES','PANEL','E18',120,'BLACK',4),('F1','QA',3,'QA|PANELES_2','QA ORDER','FRAME-REF','ES','FRAME','F1',100,'DS',9);INSERT INTO public.sgp_prioridades(anio,semana,id_linea,reserva,key_produccion,prioridad,usuario) VALUES(2026,44,'PANELES_2','R','QA|PANELES_2','1.1','COORDINADOR');INSERT INTO public.sgp_mecanizado_programacion(id_programacion,reserva,sistema,acabado,produccion,estado,fecha_programacion,turno,cantidad_programada,usuario_programa,prioridad_semanal) VALUES('00000000-0000-0000-0000-000000000001','R','ES','DS','QA ORDER','PROCESADO','2026-11-01','TURNO 1',288,'COORDINADOR','1.1');")
  db.sql((ROOT/'docs/sql-proposals/lp01-seguimiento/INSTALL_REVIEW.sql').read_text())
  for file in ['01_storage_DRAFT.sql','02_rpc_REVIEW.sql']:db.sql((ROOT/'docs/sql-proposals/lp01-afectaciones'/file).read_text())
  db.sql('GRANT EXECUTE ON FUNCTION public.sgp_lp_afectaciones_consultar_v1(text,text,text),public.sgp_lp_afectaciones_comando_v1(text,text,text,date,int,jsonb) TO anon')
  for stage in ['ENSAMBLE','EMPAQUE']:db.execute(db.cmd('ABRIR',stage=stage))
  if install_affectations:
   for file in ['03_pdt_atomico_REVIEW.sql','04_conciliacion_REVIEW.sql','05_picking_original_REVIEW.sql','06_nc_opcional_REVIEW.sql']:db.sql(reconciliation_sql if file=='04_conciliacion_REVIEW.sql' and reconciliation_sql is not None else (ROOT/'docs/sql-proposals/lp01-afectaciones'/file).read_text())
   db.sql('GRANT EXECUTE ON FUNCTION public.sgp_lp_afectaciones_aluminio_v1(text,text,text,date,int,jsonb,jsonb),public.sgp_lp_afectaciones_consultar_v2(text,text,text),public.sgp_lp_afectaciones_legado_v1(text,text,text),public.sgp_lp_afectaciones_conciliar_v1(text,text,text,uuid,text,bigint,jsonb,text),public.sgp_lp_afectaciones_desde_picking_v1(text,text,text,date,int,jsonb,uuid) TO anon')
if __name__=='__main__':
 x=Fixture.__new__(Fixture)
 try:
  x.__init__(install_affectations=False)
  print('full chain constructed')
  pieces=x.pieces();assert pieces[0]['fabricacion']=='E17'
  for stage in ['ENSAMBLE','EMPAQUE']:
   cmd='SET ROLE anon;SELECT public.sgp_pdt_registrar_v4('+','.join([lit('ll'),lit(stage),lit(json.dumps({'key_produccion':x.key,'produccion':'QA ORDER'}))+'::jsonb',lit(json.dumps(pieces))+'::jsonb',lit(str(uuid.uuid4()))])+')'
   result=json.loads(x.db.sql(cmd));assert result['ok'] and result['contract_version']==4
  (HERE/'chain-native-result.json').write_text(json.dumps({'status':'PASS','publicWrapperOrigins':['ENSAMBLE','EMPAQUE'],'environment':'Full captured catalog, PostgreSQL17.11 network none synthetic only'},indent=2)+'\n')
  print('native public wrapper both stages PASS')
  subprocess.run(['python',str(ROOT/'tests/mecanizado-parcial/integration.py'),x.db.container],check=True)
  result=json.loads((ROOT/'tests/mecanizado-parcial/integration-results.json').read_text())
  (HERE/'partial-chain-result.json').write_text(json.dumps(result,indent=2)+'\n')

 finally:
  if hasattr(x,'db'):x.close()
