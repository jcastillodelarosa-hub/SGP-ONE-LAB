"""Fresh synthetic database with captured identity/auth contracts. NO production access.
Uses supplied real auth/complete-delivery/duplicate-trigger definitions.
PANEL list is a scoped fixture because its underlying installed RPC is not exported.
"""
import json,pathlib,subprocess,time
ROOT=pathlib.Path(__file__).resolve().parents[2];C='sgp-pdt-qa-91';D=ROOT/'docs/sql-proposals/pdt/multiorigin'
info=json.loads(subprocess.check_output(['docker','inspect',C]))[0]
assert info['HostConfig']['NetworkMode']=='none' and not info['HostConfig'].get('PortBindings')
def psql(db,q):return subprocess.run(['docker','exec','-i',C,'psql','-X','-qAt','-U','postgres','-d',db,'-v','ON_ERROR_STOP=1'],input=q,text=True,capture_output=True)
db='sgp_multiorigin_qa_'+str(time.time_ns())
subprocess.run(['docker','exec',C,'createdb','-U','postgres',db],check=True)
def sql(q):
 r=psql(db,q)
 if r.returncode:raise RuntimeError(r.stderr)
 return r.stdout.strip()
from fixture import prepare
prepare(ROOT,sql)
sql("""ALTER TABLE sgp_mecanizado_programacion ADD COLUMN estado text DEFAULT 'PROCESADO';
ALTER TABLE sgp_picking_entregas ALTER COLUMN id_entrega SET DEFAULT gen_random_uuid(),ADD COLUMN observacion text,ADD COLUMN usuario_entrega text,ADD COLUMN fecha_entrega timestamptz,ADD COLUMN fecha_operativa date,ADD COLUMN turno_entrega text;
CREATE TABLE sgp_picking_faltantes(id_faltante uuid PRIMARY KEY DEFAULT gen_random_uuid(),id_entrega uuid REFERENCES sgp_picking_entregas,id_pieza text,produccion text,perfil text,marca text,fabricacion text,longitud numeric,cantidad numeric,observacion text,nc text,reserva_pendiente text,acabado_pendiente text);
CREATE SCHEMA sgp_pdt_compat_91;
CREATE FUNCTION public.sgp_picking_piezas_panel(p_token text,p_id_programacion uuid,p_produccion text) RETURNS jsonb LANGUAGE sql AS $$ SELECT coalesce(jsonb_agg(to_jsonb(a)),'[]') FROM public.sgp_aluminio a JOIN public.sgp_maestro_piezas m ON m.codigo_sap=a.codigo_sap AND m.tipo_pieza='PANEL' AND m.activo='SI' JOIN public.sgp_mecanizado_programacion p ON p.id_programacion=p_id_programacion WHERE a.produccion=p_produccion AND a.sistema=p.sistema AND a.acabado=p.acabado $$;
""")
functions=json.loads((ROOT/'scripts/pdt-compatibility/evidence/PDT_FUNCIONES_REALES.json').read_text())['funciones']
for f in functions:
 if f['firma']=='sgp_picking_entrega_orden(text,uuid,text,boolean,text,jsonb,date,text)':sql(f['definicion'].replace('public.sgp_picking_entrega_orden(', 'sgp_pdt_compat_91.sgp_picking_entrega_orden('))
 if 'rechazar_entrega_completa' in f['firma']:sql(f['definicion'])
sql('CREATE TRIGGER trg_sgp_picking_no_duplicar_completa BEFORE INSERT ON sgp_picking_entregas FOR EACH ROW EXECUTE FUNCTION sgp_picking_rechazar_entrega_completa_duplicada();')
# Reproduce the erroneous name-only selection deterministically: FRAME week wins.
sql("UPDATE sgp_sesiones_app SET expira_en=now()+interval '1 day';")
sql("UPDATE qa_reservas SET semana_produccion=45 WHERE key_produccion='QA|FRAMES_2';")
old="SELECT sgp_pdt_compat_91.sgp_picking_entrega_orden('PATINADOR','00000000-0000-0000-0000-000000000001','QA ORDER',false,NULL,'[{\"id_pieza\":\"P1\",\"perfil\":\"PANEL-REF\",\"fabricacion\":\"E17\",\"longitud\":100,\"cantidad\":1,\"reserva\":\"R\",\"acabado\":\"DS\"}]','2026-10-26','TURNO 1');"
r=psql(db,'BEGIN;'+old+'ROLLBACK;');assert r.returncode and 'PDT_CLAVE_NO_CORRESPONDE_A_MAESTRO' in r.stderr,r.stderr
import importlib.util
spec=importlib.util.spec_from_file_location('legacy_matrix',ROOT/'tests/pdt-multiorigin/legacy-regression.py');legacy=importlib.util.module_from_spec(spec);spec.loader.exec_module(legacy)
legacy_ids=legacy.seed(ROOT,sql,functions)
before_legacy=legacy.results(sql,legacy_ids)
legacy.unchanged(sql)
baseline=sql('SELECT count(*) FROM sgp_aluminio_pendientes');assert sql('SELECT count(*) FROM sgp_picking_entregas')=='0'
install=(D/'01_multiorigin_REVIEW.sql').read_text()
r=psql(db,install.replace('COMMIT;','SELECT 1/0;COMMIT;'));assert r.returncode
assert sql("SELECT to_regnamespace('sgp_pdt_multiorigen') IS NULL")=='t'
sql(install)
cycle=(D/'02_canonical_lifecycle_REVIEW.sql').read_text()
# Incompatible real/body/config must stop installation, never be overwritten.
changed=cycle.replace('BEGIN;',"BEGIN;ALTER FUNCTION public.sgp_aluminio_pendiente_validar_detalles_v1(text,uuid,jsonb,text,text) SECURITY INVOKER;",1)
r=psql(db,changed);assert r.returncode and 'PDT_CICLO_SEGURIDAD_DISTINTA' in r.stderr
changed=cycle.replace('BEGIN;',"BEGIN;DO $change$ DECLARE f text;BEGIN SELECT pg_get_functiondef('public.sgp_aluminio_pendiente_validar_detalles_v1(text,uuid,jsonb,text,text)'::regprocedure) INTO f;EXECUTE replace(f,'DECLARE',E'DECLARE -- QA different real body\\n');END $change$;",1)
r=psql(db,changed);assert r.returncode and 'PDT_CICLO_DEFINICION_CAMBIADA' in r.stderr
r=psql(db,cycle.replace('COMMIT;','SELECT 1/0;COMMIT;'));assert r.returncode
assert sql('SELECT count(*) FROM sgp_pdt_multiorigen.funciones_previas')=='0'
sql(cycle)
after_legacy=legacy.results(sql,legacy_ids)
assert before_legacy==after_legacy,'LEGACY lifecycle changed'
legacy.unchanged(sql)
(ROOT/'tests/pdt-multiorigin/evidence/legacy.json').write_text(json.dumps({'status':'PASS','states':list(after_legacy),'operations_per_state':8,'before_equals_after':True,'rows_and_history_unchanged':True,'actual_production_validator_available':False,'matrix':after_legacy},indent=2)+'\n')
rollback=(D/'ROLLBACK_REVIEW.sql').read_text()
sql(rollback.replace('COMMIT;','ROLLBACK;'))
report=['Old name/week-only delivery reproduces PDT_CLAVE_NO_CORRESPONDE_A_MAESTRO and rolls back','Installation failure rolls back all new objects','LEGACY open/validated/with movements/closed: 32 operations identical before/after; rows and history unchanged','Different validator body or SECURITY INVOKER rejected before any lifecycle replacement']
ctx={'id_programacion':'00000000-0000-0000-0000-000000000001','produccion':'QA ORDER','completa':False,'fecha_entrega':'2026-10-26','turno':'TURNO 1','key_produccion':'QA|PANELES_2','reserva':'SHARED'}
source={'id_pieza':'P1','key_produccion':'QA|PANELES_2','reserva':'SHARED','reserva_principal':'R','perfil':'PANEL-REF','fabricacion':'E17','longitud':100,'acabado':'DS','cantidad':1,'nc':''}
def lit(x):return "'"+json.dumps(x).replace("'","''")+"'::jsonb"
def call(origin='PICKING',role='PATINADOR',context=None,pieces=None,key=None):
 return "public.sgp_pdt_registrar_v4('"+role+"','"+origin+"',"+lit(context or ctx)+','+lit([source] if pieces is None else pieces)+",'"+(key or '10000000-0000-0000-0000-000000000001')+"')"
def check(name,body):
 sql('BEGIN;DO $case$ DECLARE r jsonb; id uuid; n int; BEGIN '+body+' END $case$;ROLLBACK;');report.append(name)
sql("CREATE FUNCTION qa_reject(q text,expected text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN BEGIN EXECUTE q;RAISE EXCEPTION 'EXPECTED_REJECTION_MISSING';EXCEPTION WHEN OTHERS THEN IF position(expected IN SQLERRM)=0 THEN RAISE EXCEPTION 'Unexpected: %',SQLERRM;END IF;END;END $$;")
def reject(q,error):return 'PERFORM qa_reject($q$SELECT '+q+'$q$,\''+error+"');"
check('PATINADOR: valid shared PANEL -> V2, no NC, real source/key/principal preserved',"r:="+call()+";id:=(r->'ids_pendientes'->>0)::uuid;IF NOT EXISTS(SELECT 1 FROM sgp_aluminio_pendientes WHERE id_pendiente=id AND contrato_pdt='V2' AND validacion_estado='POR_VALIDAR' AND origen='PICKING' AND nc IS NULL AND key_produccion='QA|PANELES_2' AND reserva='SHARED' AND reserva_principal='R') THEN RAISE EXCEPTION 'BAD_RECORD';END IF;")
for origin in ['ENSAMBLE','EMPAQUE']:
 for nc in ['', '   ']:check(origin+' rejects blank NC',reject(call(origin,'LIDER LINEA',pieces=[{**source,'nc':nc}]),'PDT_NC_OBLIGATORIA'))
 check(origin+' saves required NC independently',"r:="+call(origin,'LIDER LINEA',pieces=[{**source,'nc':'NC synthetic'}])+";IF (SELECT nc FROM sgp_aluminio_pendientes WHERE id_pendiente=(r->'ids_pendientes'->>0)::uuid)<>'NC synthetic' THEN RAISE EXCEPTION 'NC_LOST';END IF;")
check('Roles: RECEPCION cannot act via legacy equivalence; PATINADOR cannot register assembly damage',reject(call(role='RECEPCION'),'PDT_ROL_REAL_NO_AUTORIZADO')+reject(call('ENSAMBLE',pieces=[{**source,'nc':'NC'}]),'PDT_ROL_REAL_NO_AUTORIZADO'))
check('Invalid source/key/reserve/finish do not weaken strict identity or leave delivery behind', ''.join(reject(call(pieces=[{**source,**change}]),'PDT_PIEZA_NO_CORRESPONDE_AL_CONTEXTO') for change in [{'id_pieza':'F1'},{'key_produccion':'QA|FRAMES_2'},{'reserva':'UNRELATED'},{'acabado':'OTHER'}])+"IF (SELECT count(*) FROM sgp_picking_entregas)<>0 THEN RAISE EXCEPTION 'PARTIAL_DELIVERY';END IF;")
check('Multiple PDTs + missing lines + delivery atomic; failed second row rolls back ALL',reject(call(pieces=[source,{**source,'id_pieza':'BAD'}]),'PDT_PIEZA_NO_CORRESPONDE_AL_CONTEXTO')+"IF (SELECT count(*) FROM sgp_picking_entregas)<>0 OR (SELECT count(*) FROM sgp_aluminio_pendientes)<>"+baseline+" THEN RAISE EXCEPTION 'PARTIAL_WRITES';END IF;r:="+call(pieces=[source,{**source,'id_pieza':'P2','fabricacion':'E17-1'}])+";IF jsonb_array_length(r->'ids_pendientes')<>2 OR (SELECT count(*) FROM sgp_picking_faltantes)<>2 THEN RAISE EXCEPTION 'MISSING_ROWS';END IF;")
check('Idempotent retry returns same event; changed payload with same UUID rejects',"r:="+call()+";IF "+call()+"->>'duplicado'<>'true' THEN RAISE EXCEPTION 'DUPLICATE';END IF;"+reject(call(pieces=[{**source,'cantidad':2}]),'PDT_IDEMPOTENCIA_REUTILIZADA')+"IF (SELECT count(*) FROM sgp_picking_entregas)<>1 THEN RAISE EXCEPTION 'DUPLICATE_DELIVERY';END IF;")
check('Invalid quantity and duplicate physical piece reject the whole delivery',reject(call(pieces=[{**source,'cantidad':6}]),'PDT_CANTIDAD_INVALIDA')+reject(call(pieces=[source,source]),'PDT_PIEZA_REPETIDA_EN_EVENTO')+"IF (SELECT count(*) FROM sgp_picking_entregas)<>0 THEN RAISE EXCEPTION 'PARTIAL_DELIVERY';END IF;")
check('Same piece in independent origins remains independent',"PERFORM "+call()+";PERFORM "+call('ENSAMBLE','LIDER LINEA',pieces=[{**source,'nc':'NC assembly'}],key='10000000-0000-0000-0000-000000000002')+";PERFORM "+call('EMPAQUE','LIDER LINEA',pieces=[{**source,'nc':'NC pack'}],key='10000000-0000-0000-0000-000000000003')+";IF (SELECT count(DISTINCT origen) FROM sgp_aluminio_pendientes WHERE id_pendiente IN (SELECT id_pendiente FROM sgp_pdt_multiorigen.detalles))<>3 THEN RAISE EXCEPTION 'EVENTS_MERGED';END IF;")
check('Complete deliveries preserve existing RPC/duplicate trigger and have no PDT',"r:="+call(context={**ctx,'completa':True},pieces=[])+";"+reject(call(context={**ctx,'completa':True},pieces=[],key='10000000-0000-0000-0000-000000000002'),'ENTREGA_COMPLETA_YA_REGISTRADA')+"IF (SELECT count(*) FROM sgp_aluminio_pendientes)<>"+baseline+" THEN RAISE EXCEPTION 'FAKE_PDT';END IF;")
check('Existing NC can be linked later using unchanged RPC',"INSERT INTO sgp_nc_aluminio(consecutivo,cod_nc,activo) VALUES('QA-NC','ALIAS',true);r:="+call()+";id:=(r->'ids_pendientes'->>0)::uuid;PERFORM sgp_aluminio_pendiente_nc_vincular_v1('PATINADOR',id,ARRAY['ALIAS']);IF NOT EXISTS(SELECT 1 FROM sgp_aluminio_pendiente_ncs WHERE id_pendiente=id AND consecutivo='QA-NC') THEN RAISE EXCEPTION 'LINK_FAILED';END IF;")
check('LEGACY creation and historical annotation stay unchanged',"id:=sgp_aluminio_pendiente_crear('COORDINADOR','R','QA ORDER','PANEL-REF',1,100,'PRODUCCION','QA','QA','QA|PANELES_2','R','DS');UPDATE sgp_aluminio_pendientes SET observacion='QA unchanged legacy path' WHERE id_pendiente=id;IF (SELECT contrato_pdt FROM sgp_aluminio_pendientes WHERE id_pendiente=id)<>'LEGACY' THEN RAISE EXCEPTION 'LEGACY_MIGRATED';END IF;")
check('New V2 remains compatible with existing distribution and guards',"r:="+call()+";id:=(r->'ids_pendientes'->>0)::uuid;PERFORM sgp_aluminio_pendiente_validar_detalles_v1('COORDINADOR',id,'[{\"id_pieza\":\"P1\",\"fabricacion\":\"E17\",\"longitud\":100,\"acabado\":\"DS\",\"cantidad\":1}]','SHARED',NULL);IF (SELECT validacion_estado FROM sgp_aluminio_pendientes WHERE id_pendiente=id)<>'VALIDADO' THEN RAISE EXCEPTION 'VALIDATION_FAILED';END IF;")
check('Same reference/fabrication in another production is never a global collision',"INSERT INTO sgp_producciones(key_produccion,id,id_linea,produccion,sistema) VALUES('OTHER|PANELES_2','OTHER','PANELES_2','OTHER ORDER','ES');INSERT INTO qa_reservas VALUES('OTHER|PANELES_2','SHARED','DS','OTHER ORDER','R',true,44);INSERT INTO sgp_aluminio SELECT 'OTHER-P1',id_carga,fila_origen,'OTHER|PANELES_2','OTHER ORDER',codigo_sap,sistema,activo,tipo_pieza,fabricacion,longitud,acabado,cantidad,marca,uso FROM sgp_aluminio WHERE id_pieza='P1';r:="+call()+";"+reject(call(pieces=[{**source,'id_pieza':'OTHER-P1'}],key='10000000-0000-0000-0000-000000000002'),'PDT_PIEZA_NO_CORRESPONDE_AL_CONTEXTO'))
check('Canonical remapped PANEL can validate/process/assign/close within a partially delivered order',"""UPDATE sgp_aluminio SET key_produccion='QA|FRAMES_2' WHERE id_pieza='P1';
 r:="""+call()+""";id:=(r->'ids_pendientes'->>0)::uuid;
 IF jsonb_array_length(sgp_pdt_fuentes_v2('COORDINADOR',id))<>2 THEN RAISE EXCEPTION 'SOURCES_UNAVAILABLE';END IF;
 PERFORM sgp_aluminio_pendiente_validar_detalles_v1('COORDINADOR',id,'[{"id_pieza":"P1","fabricacion":"E17","longitud":100,"acabado":"DS","cantidad":1}]','SHARED',NULL);
 PERFORM sgp_pdt_estado_v2('LIDER',id,'CORTE');PERFORM sgp_pdt_estado_v2('LIDER',id,'MECANIZADO');
 PERFORM sgp_aluminio_pendiente_registrar_avance_v1('LIDER',id,(SELECT id_detalle FROM sgp_aluminio_pendiente_detalles WHERE id_pendiente=id),1,'T1',current_date,gen_random_uuid(),NULL);
 PERFORM sgp_pdt_estado_v2('LIDER',id,'PROCESADO');
 UPDATE sgp_picking_entregas SET estado='VALIDADA' WHERE id_entrega=(r->>'id_entrega')::uuid;
 r:=sgp_pdt_entrega_registrar_v2('COORDINADOR',(SELECT id_detalle FROM sgp_aluminio_pendiente_detalles WHERE id_pendiente=id),(r->>'id_entrega')::uuid,1,gen_random_uuid());
 PERFORM sgp_pdt_entrega_validar_v2('COORDINADOR',(r->>'id_linea')::uuid);PERFORM sgp_pdt_asignar_v2('COORDINADOR',(r->>'id_linea')::uuid,gen_random_uuid());PERFORM sgp_pdt_cerrar_v2('COORDINADOR',id,gen_random_uuid());
 IF (SELECT estado_repo FROM sgp_aluminio_pendientes WHERE id_pendiente=id)<>'PICKING' THEN RAISE EXCEPTION 'NOT_CLOSED';END IF;
""")
assert sql('SELECT count(*) FROM sgp_aluminio_pendientes')==baseline
assert sql('SELECT count(*) FROM sgp_picking_entregas')=='0'
# Actual browser transport role can execute public RPC but not private event rows/functions.
sql('GRANT USAGE ON SCHEMA public TO anon;')
check('No direct grants or private helper execution to anon',"IF has_schema_privilege('anon','sgp_pdt_multiorigen','USAGE') OR has_table_privilege('anon','sgp_pdt_multiorigen.eventos','SELECT') OR has_function_privilege('anon','sgp_pdt_multiorigen.actor(text,text)','EXECUTE') OR NOT has_function_privilege('anon','sgp_pdt_registrar_v4(text,text,jsonb,jsonb,uuid)','EXECUTE') THEN RAISE EXCEPTION 'PRIVILEGES_BAD';END IF;")
sql('BEGIN;SET LOCAL ROLE anon;SELECT '+call()+';ROLLBACK;')
report.append('Actual anon transport executes the secured RPC with SGP PATINADOR; no private grants')
# Same UUID, concurrent real PostgreSQL sessions: one event/delivery/PDT.
from concurrent.futures import ThreadPoolExecutor
with ThreadPoolExecutor(2) as pool:results=list(pool.map(lambda _:psql(db,'SELECT '+call()),range(2)))
assert all(r.returncode==0 for r in results),[r.stderr for r in results]
assert sql('SELECT count(*) FROM sgp_pdt_multiorigen.eventos')=='1'
assert sql('SELECT count(*) FROM sgp_picking_entregas')=='1'
report.append('Two concurrent retries yield exactly one delivery and PDT')
rollback=(D/'ROLLBACK_REVIEW.sql').read_text()
r=psql(db,rollback);assert r.returncode and 'PDT_ROLLBACK_REQUIERE_CONCILIAR_EVENTOS' in r.stderr
sql((D/'CONTENER_REGISTRO_REVIEW.sql').read_text())
assert sql('SELECT count(*) FROM sgp_pdt_multiorigen.eventos')=='1'
assert sql('SELECT count(*) FROM sgp_picking_entregas')=='1'
assert sql("SELECT has_function_privilege('anon','sgp_pdt_registrar_v4(text,text,jsonb,jsonb,uuid)','EXECUTE')")=='f'
report.append('Code rollback proven before events; later rollback rejects downgrade, containment blocks new registration preserving events/PDTs/deliveries')
output={'status':'PASS','postgres':sql('SHOW server_version'),'database':db,'network':'none; no exposed ports','checks':report,'limitations':['PANEL underlying listing is a fixture, not a live Supabase call','Captured source/auth definitions reused in fresh synthetic schema; current productive fingerprints pending review','No production data or migration executed']}
(ROOT/'tests/pdt-multiorigin/evidence/sql.json').write_text(json.dumps(output,indent=2)+'\n');print(json.dumps(output,indent=2))
