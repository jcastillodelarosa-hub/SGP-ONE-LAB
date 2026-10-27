"""Only disposable networkless PostgreSQL17; no Supabase connection or credentials."""
import json,pathlib,subprocess,time,hashlib
root=pathlib.Path(__file__).resolve().parents[2];container='sgp-pdt-qa-91'
meta=json.loads(subprocess.check_output(['docker','inspect',container]))[0]
assert meta['HostConfig']['NetworkMode']=='none' and not meta['HostConfig'].get('PortBindings')
db='sgp_linea_stage1_qa_'+str(time.time_ns());subprocess.run(['docker','exec',container,'createdb','-U','postgres',db],check=True)
def run(q):return subprocess.run(['docker','exec','-i',container,'psql','-X','-qAt','-U','postgres','-d',db,'-v','ON_ERROR_STOP=1'],input=q,text=True,capture_output=True)
def sql(q):
 r=run(q)
 assert r.returncode==0,r.stderr
 return r.stdout.strip()
folder=root/'docs/sql-proposals/linea-etapa1';install=(folder/'01_schema_REVIEW.sql').read_text();undo=(folder/'ROLLBACK_REVIEW.sql').read_text()
r=run(install.replace('COMMIT;','SELECT 1/0;COMMIT;'));assert r.returncode
assert sql("SELECT to_regnamespace('sgp_linea_operativa_v1') IS NULL")=='t'
sql(install)
assert sql("SELECT count(*) FROM pg_tables WHERE schemaname='sgp_linea_operativa_v1' AND rowsecurity")=='7'
assert sql("SELECT has_schema_privilege('anon','sgp_linea_operativa_v1','USAGE') OR has_schema_privilege('authenticated','sgp_linea_operativa_v1','USAGE')")=='f'
for stage in ['ENSAMBLE','EMPAQUE']:
 sql("BEGIN;INSERT INTO sgp_linea_operativa_v1.turnos(etapa,fecha_operativa,turno,estado) VALUES('"+stage+"','2026-10-27',1,'ABIERTO');ROLLBACK;")
insert="INSERT INTO sgp_linea_operativa_v1.turnos(etapa,fecha_operativa,turno,estado) VALUES('ENSAMBLE','2026-10-27',1,'ABIERTO');"
r=run(undo.replace('BEGIN;','BEGIN;'+insert,1));assert r.returncode and 'DATOS_EXISTENTES' in r.stderr
assert sql("SELECT to_regnamespace('sgp_linea_operativa_v1') IS NOT NULL")=='t'
sql(undo);assert sql("SELECT to_regnamespace('sgp_linea_operativa_v1') IS NULL")=='t'
out={'status':'PASS','database':db,'postgres':sql('SHOW server_version'),'network':'none; no published ports','checks':['failed install rolls back entire schema','seven new tables have RLS','no browser schema access','independent stages accepted','rollback with data refused atomically','empty rollback succeeds'],'sha256':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in [folder/'01_schema_REVIEW.sql',folder/'ROLLBACK_REVIEW.sql']},'limitations':['DDL shape only; no RPC implemented or tested','No Supabase installation or concurrency verification']}
(root/'tests/linea-stage1/evidence/schema.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
