"""Empty-schema rollback + persistent containment only in isolated QA databases."""
import pathlib,json,subprocess,time
R=pathlib.Path(__file__).resolve().parents[2];E=R/'tests/linea-stage2c/evidence';container='sgp-pdt-qa-91'
meta=json.loads(subprocess.check_output(['docker','inspect',container]))[0];assert meta['HostConfig']['NetworkMode']=='none' and not meta['HostConfig'].get('PortBindings')
db=(E/'database.txt').read_text().strip();assert db.startswith('sgp_linea_b2_qa_') and db.removeprefix('sgp_linea_b2_qa_').isdigit()
empty='sgp_linea_c2_empty_'+str(time.time_ns());subprocess.run(['docker','exec',container,'createdb','-U','postgres',empty],check=True)
def sql(q,target=db):
 r=subprocess.run(['docker','exec','-i',container,'psql','-XqAt','-U','postgres','-d',target,'-v','ON_ERROR_STOP=1'],input=q,text=True,capture_output=True);assert r.returncode==0,r.stderr;return r.stdout.strip()
# Structural empty rollback: auth is the same captured function; never invoked.
sql("CREATE SCHEMA extensions;CREATE EXTENSION pgcrypto WITH SCHEMA extensions;CREATE TABLE sgp_producciones(key_produccion text PRIMARY KEY);CREATE TABLE sgp_usuarios(id_usuario uuid PRIMARY KEY,usuario text,nombre text,rol text,activo boolean);CREATE TABLE sgp_sesiones_app(id_usuario uuid,token_hash text,revocado_en timestamptz,expira_en timestamptz);",empty)
f=next(f for f in json.loads((R/'scripts/pdt-compatibility/evidence/PDT_COMPLEMENTO_REAL.json').read_text())['funciones_faltantes'] if f['firma'].startswith('sgp_sesion_actual('));sql(f['definicion'],empty)
sql((R/'docs/sql-proposals/linea-etapa2b/01_motor_REVIEW.sql').read_text(),empty)
base=sql("SELECT md5(prosrc) FROM pg_proc WHERE oid='public.sgp_linea_motor_b2(text,jsonb)'::regprocedure",empty)
sql((R/'docs/sql-proposals/linea-etapa2c/01_bridges_REVIEW.sql').read_text(),empty)
sql((R/'docs/sql-proposals/linea-etapa2c/ROLLBACK_REVIEW.sql').read_text(),empty)
assert sql("SELECT to_regnamespace('sgp_linea_c2') IS NULL",empty)=='t'
assert sql("SELECT md5(prosrc) FROM pg_proc WHERE oid='public.sgp_linea_motor_b2(text,jsonb)'::regprocedure",empty)==base
assert sql("SELECT count(*) FROM pg_trigger WHERE tgname='c2_vigencia'",empty)=='0'
# Containment preserves historical evidence and remains in force across retries.
before=sql('SELECT count(*) FROM sgp_linea_b2.eventos')
sql((R/'docs/sql-proposals/linea-etapa2c/CONTENER_REVIEW.sql').read_text())
for _ in range(2):
 r=json.loads(sql("SELECT sgp_linea_c2.reconciliar('C2-CUT')"));assert r['status']=='SIN_CONCILIAR' and r['reason']=='CONTENCION_MANUAL'
assert sql('SELECT count(*) FROM sgp_linea_b2.eventos')==before
assert sql('SELECT count(*) FROM sgp_linea_c2.historial')!='0'
assert sql("SELECT bool_and(contenido) FROM sgp_linea_c2.estado")=='t'
# Existing closed report unrelated to C2 is preserved/readable; no legacy change.
assert sql("SELECT count(*)>0 FROM sgp_linea_b2.cierres WHERE snapshot IS NOT NULL")=='t'
out={'status':'PASS','empty_database':empty,'contained_database':db,'checks':['Empty C2 rollback removes only its new objects; B2 function fingerprint unchanged','Persistent C2 containment survives reconciliation/retry and preserves events, source history and old reports'],'limitations':['Isolated QA only; not a productive restore or a backup verification']}
(E/'recovery.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
