"""Build ONLY synthetic dependencies. Reuse captured contracts and reviewed SQL.
No production connection, credentials, backup or 69-row repair required.
"""
import json,re,sys

def prepare(root,sql):
 evidence=json.loads((root/'tests/pdt-identity/installed-contracts.json').read_text())
 sql('CREATE SCHEMA extensions;CREATE EXTENSION pgcrypto WITH SCHEMA extensions;')
 sql("DO $$ BEGIN CREATE ROLE anon;EXCEPTION WHEN duplicate_object THEN NULL;END $$;DO $$ BEGIN CREATE ROLE authenticated;EXCEPTION WHEN duplicate_object THEN NULL;END $$;")
 for table,primary in [('sgp_aluminio_pendientes','id_pendiente'),('sgp_maestro_piezas','codigo_sap')]:
  cols=[c for c in evidence['columns'] if c['table']==table]
  parts=['"'+c['column']+'" '+c['type']+(' DEFAULT '+c['default'] if c['default'] else '')+(' NOT NULL' if c['notnull'] else '') for c in cols]
  sql('CREATE TABLE public.'+table+'('+','.join(parts)+',PRIMARY KEY('+primary+'));')
 base=(root/'tests/sql/pdt/bootstrap.sql').read_text()
 for table in ['sgp_producciones','sgp_aluminio','sgp_aluminio_pendientes_historial','qa_reservas','sgp_nc_aluminio','sgp_mecanizado_programacion','sgp_picking_entregas']:
  sql(re.search(r'CREATE TABLE (?:public\.)?'+table+r'\([^;]+;',base).group())
 sql('ALTER TABLE sgp_producciones ADD COLUMN id text,ADD COLUMN id_linea text;ALTER TABLE qa_reservas ADD COLUMN produccion text,ADD COLUMN reserva_principal text,ADD COLUMN es_reserva_compartida boolean DEFAULT false,ADD COLUMN semana_produccion integer;CREATE VIEW sgp_produccion_reservas_v AS SELECT * FROM qa_reservas;')
 sql('CREATE TABLE sgp_usuarios(id_usuario uuid PRIMARY KEY DEFAULT gen_random_uuid(),usuario text,nombre text,rol text,activo boolean DEFAULT true);CREATE TABLE sgp_sesiones_app(id_usuario uuid,token_hash text,revocado_en timestamptz,expira_en timestamptz);')
 functions=json.loads((root/'scripts/pdt-compatibility/evidence/PDT_FUNCIONES_REALES.json').read_text())['funciones']
 complement=json.loads((root/'scripts/pdt-compatibility/evidence/PDT_COMPLEMENTO_REAL.json').read_text())['funciones_faltantes']
 for f in functions+complement:
  if f['firma'].startswith(('sgp_validar_sesion_rol(','sgp_sesion_actual(')):sql(f['definicion'].replace('\r\n','\n')+';')
 sql("INSERT INTO sgp_usuarios(usuario,nombre,rol) SELECT x,'QA synthetic',x FROM unnest(ARRAY['ADMINISTRADOR','COORDINADOR','LIDER','LIDER MECANIZADO','LIDER LINEA','RECEPCION','CONSULTA','PATINADOR','PICKING','SUPERVISOR DE PICKING'])x;INSERT INTO sgp_sesiones_app SELECT id_usuario,encode(extensions.digest(usuario,'sha256'),'hex'),NULL,now()+interval '1 day' FROM sgp_usuarios;")
 sys.path.insert(0,str(root/'tests/sql/pdt'));from installation_plan import PHASE_A,PHASE_B
 for name in PHASE_A[1:]+PHASE_B:sql((root/'docs/sql-proposals/pdt'/name).read_text())
 for f in evidence['functions']:
  if f['signature'].startswith('sgp_aluminio_pendiente_crear('):sql(f['definition']+';')
 for t in evidence['triggers']:sql(t['function_definition']+';')
 for name,path in [('sgp_pdt_fuentes_v2','20261025_pdt_capacidades_REVIEW.sql'),('sgp_aluminio_pendiente_validar_detalles_v1','20261024_pdt_rpc_contracts_REVIEW.sql')]:
  text=(root/'docs/sql-proposals/pdt'/path).read_text();a=text.index('CREATE OR REPLACE FUNCTION public.'+name);b=text.index('END $fn$;',a)+len('END $fn$;');sql(text[a:b])
 sql((root/'docs/sql-proposals/pdt/identity/01_creation_and_source_identity_REVIEW.sql').read_text())
 sql((root/'docs/sql-proposals/pdt/identity/02_panel_v2_identity_REVIEW.sql').read_text())
 sql("""INSERT INTO sgp_producciones(key_produccion,id,id_linea,produccion,sistema) VALUES('QA|FRAMES_2','QA','FRAMES_2','QA ORDER','ES'),('QA|PANELES_2','QA','PANELES_2','QA ORDER','ES');
 INSERT INTO qa_reservas VALUES('QA|FRAMES_2','R','DS','QA ORDER','R',true,44),('QA|PANELES_2','R','DS','QA ORDER','R',true,44),('QA|FRAMES_2','SHARED','DS','QA ORDER','R',true,44),('QA|PANELES_2','SHARED','DS','QA ORDER','R',true,44);
 INSERT INTO sgp_maestro_piezas(codigo_sap,tipo_pieza,destino_productivo,activo) VALUES('PANEL-REF','PANEL','PANEL','SI'),('FRAME-REF','FRAME','FRAME','SI');
 INSERT INTO sgp_aluminio(id_pieza,id_carga,fila_origen,key_produccion,produccion,codigo_sap,sistema,activo,tipo_pieza,fabricacion,longitud,acabado,cantidad) VALUES('P1','QA',1,'QA|PANELES_2','QA ORDER','PANEL-REF','ES','SI','PANEL','E17',100,'DS',5),('P2','QA',2,'QA|PANELES_2','QA ORDER','PANEL-REF','ES','SI','PANEL','E17-1',100,'DS',4),('F1','QA',3,'QA|PANELES_2','QA ORDER','FRAME-REF','ES','SI','FRAME','F1',100,'DS',9);
 INSERT INTO sgp_mecanizado_programacion(id_programacion,reserva,sistema,acabado) VALUES('00000000-0000-0000-0000-000000000001','R','ES','DS');
 """)
