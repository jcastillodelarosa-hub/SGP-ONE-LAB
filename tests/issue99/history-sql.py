"""Targeted hotfix regression, fresh synthetic DB in existing networkless PG17. Never production."""
import hashlib,json,pathlib,subprocess,sys,time
ROOT=pathlib.Path(__file__).resolve().parents[2];C='sgp-pdt-qa-91';sys.dont_write_bytecode=True
sys.path.insert(0,str(ROOT/'tests/sql/pdt'));from installation_plan import PHASE_A,PHASE_B
meta=json.loads(subprocess.check_output(['docker','inspect',C]))[0];assert meta['HostConfig']['NetworkMode']=='none' and not meta['HostConfig'].get('PortBindings')
db='sgp_pdt_qa_91_issue99_'+str(time.time_ns());subprocess.run(['docker','exec',C,'createdb','-U','postgres',db],check=True)
def call(q):return subprocess.run(['docker','exec','-i',C,'psql','-X','-qAt','-U','postgres','-d',db,'-v','ON_ERROR_STOP=1'],input=q,text=True,capture_output=True)
def sql(q):
 r=call(q)
 if r.returncode:raise RuntimeError(r.stderr)
 return r.stdout.strip()
checks=[]
def verify(label,condition):
 if not condition:raise AssertionError(label)
 checks.append(label)
def reject(q,fragment):
 r=call('BEGIN;'+q+';ROLLBACK;');return r.returncode!=0 and fragment in r.stderr
sql((ROOT/'tests/sql/pdt/bootstrap.sql').read_text());sql('DROP FUNCTION public.sgp_validar_sesion_rol(text,text[]);DROP FUNCTION public.sgp_sesion_actual(text);')
sql('CREATE SCHEMA extensions;CREATE EXTENSION pgcrypto WITH SCHEMA extensions;CREATE TABLE public.sgp_usuarios(id_usuario uuid PRIMARY KEY DEFAULT gen_random_uuid(),usuario text,nombre text,rol text,activo boolean DEFAULT true);CREATE TABLE public.sgp_sesiones_app(id_usuario uuid,token_hash text,revocado_en timestamptz,expira_en timestamptz);')
for file,key in [('PDT_FUNCIONES_REALES.json','funciones'),('PDT_COMPLEMENTO_REAL.json','funciones_faltantes')]:
 for f in json.loads((ROOT/'scripts/pdt-compatibility/evidence'/file).read_text())[key]:
  if f['firma'].startswith(('sgp_validar_sesion_rol(','sgp_sesion_actual(')):sql(f['definicion'].replace('\r\n','\n')+';')
sql("INSERT INTO sgp_usuarios(usuario,nombre,rol) SELECT r,'QA',r FROM unnest(ARRAY['COORDINADOR','LIDER MECANIZADO','RECEPCION','PICKING','PATINADOR','CONSULTA']) r;INSERT INTO sgp_sesiones_app SELECT id_usuario,encode(extensions.digest(usuario,'sha256'),'hex'),NULL,now()+interval '1 day' FROM sgp_usuarios;")
for file in PHASE_A[1:]+PHASE_B:sql((ROOT/'docs/sql-proposals/pdt'/file).read_text())
sql("ALTER TABLE sgp_aluminio_pendientes_historial ADD COLUMN estado_anterior text,ADD COLUMN estado_nuevo text;INSERT INTO sgp_producciones VALUES('qa|PANELES_2','QA','QA-SYSTEM');INSERT INTO qa_reservas VALUES('qa|PANELES_2','QA-RES','DS');INSERT INTO sgp_aluminio VALUES('qa1','load',1,'qa|PANELES_2','QA','REF','QA-SYSTEM','SI','PANEL','E17',100,'DS',4,'M','U'),('qa2','load',2,'qa|PANELES_2','QA','REF','QA-SYSTEM','SI','PANEL','E17-1',100,'DS',5,'M','U');INSERT INTO sgp_aluminio_pendientes(id_pendiente,key_produccion,produccion,perfil,cantidad,reserva,acabado_pendiente) VALUES('00000000-0000-0000-0000-000000000099','qa|PANELES_2','QA','REF',9,'QA-RES','DS');")
id='00000000-0000-0000-0000-000000000099'
sql("SELECT sgp_aluminio_pendiente_validar_detalles_v1('RECEPCION','"+id+"','[{\"id_pieza\":\"qa1\",\"fabricacion\":\"E17\",\"longitud\":100,\"acabado\":\"DS\",\"cantidad\":4},{\"id_pieza\":\"qa2\",\"fabricacion\":\"E17-1\",\"longitud\":100,\"acabado\":\"DS\",\"cantidad\":5}]');UPDATE sgp_aluminio_pendientes_historial SET estado_anterior='PENDIENTE',estado_nuevo='PENDIENTE';ALTER TABLE sgp_aluminio_pendientes_historial ALTER COLUMN estado_nuevo SET NOT NULL;")
d1=sql("SELECT id_detalle FROM sgp_aluminio_pendiente_detalles WHERE fabricacion='E17'");d2=sql("SELECT id_detalle FROM sgp_aluminio_pendiente_detalles WHERE fabricacion='E17-1'")
def advance(d,q,key,role='LIDER MECANIZADO'):return "SELECT sgp_aluminio_pendiente_registrar_avance_v1('"+role+"','"+id+"','"+d+"',"+str(q)+",'T1','2026-10-26','"+key+"')"
def reverse(move,key,role='LIDER MECANIZADO'):return "SELECT sgp_aluminio_pendiente_revertir_avance_v1('"+role+"','"+id+"','"+move+"','"+key+"','QA motivo')"
def stage(value,role='COORDINADOR'):return "SELECT sgp_pdt_estado_v2('"+role+"','"+id+"','"+value+"')"
def key(n):return '10000000-0000-0000-0000-'+str(n).zfill(12)
verify('baseline reproduces estado_nuevo NOT NULL failure',reject(advance(d1,2,key(1)),'estado_nuevo'))
verify('failed insert rolls back movement',sql('SELECT count(*) FROM sgp_aluminio_pendiente_movimientos')=='0')
file=ROOT/'docs/sql-applied/20261026_pdt_v2_historial_estado_nuevo_fix_APPLIED.sql';patch=file.read_text()
fp="SELECT jsonb_agg(jsonb_build_array(oid,md5(prosrc),proargtypes::text,prorettype,proacl,proowner,prosecdef,proconfig) ORDER BY proname) FROM pg_proc WHERE proname IN('sgp_aluminio_pendiente_registrar_avance_v1','sgp_aluminio_pendiente_revertir_avance_v1','sgp_pdt_estado_v2')"
meta_fp="SELECT jsonb_agg(jsonb_build_array(oid,proargtypes::text,prorettype,proacl,proowner,prosecdef,proconfig) ORDER BY proname) FROM pg_proc WHERE proname IN('sgp_aluminio_pendiente_registrar_avance_v1','sgp_aluminio_pendiente_revertir_avance_v1','sgp_pdt_estado_v2')"
before=sql(fp);before_meta=sql(meta_fp);rolehash=sql("SELECT md5(prosrc) FROM pg_proc WHERE oid='public.sgp_pdt_validar_rol_real(text,text[])'::regprocedure")
sql(patch.replace('COMMIT;','ROLLBACK;'));verify('installation rollback restores all three bodies',sql(fp)==before)
sql(patch);verify('signatures grants owner definer and search_path unchanged',sql(meta_fp)==before_meta)
fixed=sql(fp);sql(patch);verify('already-fixed functions are not rewritten',sql(fp)==fixed)
sql(advance(d1,2,key(1)));sql(advance(d1,2,key(1)))
verify('advance retry has one movement and one history',sql("SELECT (SELECT count(*) FROM sgp_aluminio_pendiente_movimientos)=1 AND (SELECT count(*) FROM sgp_aluminio_pendientes_historial WHERE tipo_evento='AVANCE_PDT')=1")=='t')
verify('E17 2/4 -> avance2/saldo2',sql("SELECT cantidad_validada-(SELECT sum(cantidad) FROM sgp_aluminio_pendiente_movimientos WHERE id_detalle='"+d1+"') FROM sgp_aluminio_pendiente_detalles WHERE id_detalle='"+d1+"'")=='2')
verify('AVANCE_PDT current state recorded',sql("SELECT bool_and(estado_anterior='PENDIENTE' AND estado_nuevo='PENDIENTE') FROM sgp_aluminio_pendientes_historial WHERE tipo_evento='AVANCE_PDT'")=='t')
verify('quantity above saldo rejected',reject(advance(d1,3,key(2)),'supera saldo'))
for role in ['RECEPCION','PATINADOR','CONSULTA']:
 verify(role+' cannot advance',reject(advance(d1,1,key(10),role),'PDT_ROL_REAL_NO_AUTORIZADO'))
 verify(role+' cannot change stage',reject(stage('CORTE',role),'PDT_ROL_REAL_NO_AUTORIZADO'))
sql(stage('CORTE'));sql(stage('MECANIZADO'))
verify('PROCESADO with saldo rejected',reject(stage('PROCESADO'),'PDT_MECANIZADO_CON_SALDO'))
sql(advance(d1,2,key(3)));sql(advance(d2,5,key(4)));sql(stage('PROCESADO'))
verify('ETAPA_V2 before/after states correct',sql("SELECT bool_and(estado_anterior=datos_anteriores->>'estado' AND estado_nuevo=datos_nuevos->>'estado') AND count(*)=3 FROM sgp_aluminio_pendientes_historial WHERE tipo_evento='ETAPA_V2'")=='t')
move=sql("SELECT id_movimiento FROM sgp_aluminio_pendiente_movimientos WHERE idempotency_key='"+key(3)+"'")
sql(reverse(move,key(5)));sql(reverse(move,key(5)))
verify('PROCESADO reverse returns MECANIZADO',sql("SELECT estado_repo='MECANIZADO' FROM sgp_aluminio_pendientes WHERE id_pendiente='"+id+"'")=='t')
verify('REVERSO_AVANCE_PDT old/new and idempotence correct',sql("SELECT count(*)=1 AND bool_and(estado_anterior='PROCESADO' AND estado_nuevo='MECANIZADO') FROM sgp_aluminio_pendientes_historial WHERE tipo_evento='REVERSO_AVANCE_PDT'")=='t')
sql("INSERT INTO sgp_mecanizado_programacion VALUES('00000000-0000-0000-0000-000000000001','QA-RES','QA-SYSTEM','DS');INSERT INTO sgp_picking_entregas VALUES('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','QA',false,'VALIDADA');SELECT sgp_pdt_entrega_registrar_v2('PICKING','"+d2+"','00000000-0000-0000-0000-000000000002',2,'"+key(6)+"');")
move=sql("SELECT id_movimiento FROM sgp_aluminio_pendiente_movimientos WHERE idempotency_key='"+key(4)+"'")
verify('reverse with committed Picking rejected',reject(reverse(move,key(7)),'Reverso afecta entrega Picking'))
verify('Reception cannot reverse',reject(reverse(move,key(8),'RECEPCION'),'PDT_ROL_REAL_NO_AUTORIZADO'))
verify('all new history states nonnull',sql('SELECT bool_and(estado_nuevo IS NOT NULL) FROM sgp_aluminio_pendientes_historial')=='t')
verify('real role guard unchanged',sql("SELECT md5(prosrc) FROM pg_proc WHERE oid='public.sgp_pdt_validar_rol_real(text,text[])'::regprocedure")==rolehash)
report={'status':'PASS','database':db,'network':'none','postgres':sql('SELECT version()'),'assertions':len(checks),'results':checks,'sql_sha256':hashlib.sha256(patch.encode()).hexdigest(),'production_application':'not executed; reported already applied by ChatGPT in Issue99','limits':'Synthetic tables/data, supplied real auth helper definitions, versioned baseline PDT A/B contracts. Not full production clone.'}
(ROOT/'tests/issue99/evidence/history-sql.json').write_text(json.dumps(report,indent=2));print(json.dumps({'status':'PASS','assertions':len(checks),'database':db}))
