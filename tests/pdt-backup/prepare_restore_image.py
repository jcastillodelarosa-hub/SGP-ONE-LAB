"""Prepare/check a local isolated restore image; no production data or credentials.
Source: official supabase/cli apps/cli-go/pkg/config/templates/Dockerfile.
"""
import json,subprocess,sys
IMAGE='supabase/postgres:17.11.0.006'
command=['docker','run','--rm','--network','none','--entrypoint','bash',IMAGE,'-c',
 'set -e; postgres --version; shared=$(pg_config --sharedir); '
 'test -f "$shared/extension/pgcrypto.control"; '
 'test -f "$shared/extension/uuid-ossp.control"; '
 'test -f "$shared/extension/pg_stat_statements.control"; '
 'test -f "$shared/extension/supabase_vault.control"; '
 'echo SUPABASE_RESTORE_EXTENSIONS_PRESENT']
r=subprocess.run(command,capture_output=True,text=True)
if r.returncode:
 print('Restore image prerequisite check failed; no production data accessed')
 sys.exit(1)
if 'PostgreSQL) 17.11' not in r.stdout or 'SUPABASE_RESTORE_EXTENSIONS_PRESENT' not in r.stdout:
 print('Restore image version/extensions unexpected');sys.exit(1)
print(json.dumps({'image':IMAGE,'postgresql':'17.11','extensions_control_files':['pgcrypto','uuid-ossp','pg_stat_statements','supabase_vault'],'network':'none','production_data':False,'restore_verified':False}))
# A tiny independent fixture validates this new engine/container, not PDT contracts.
import time,uuid,hashlib
name='sgp-restore-ready-'+uuid.uuid4().hex[:12]
start="initdb -D /tmp/sgp-restore/db -U postgres --auth=trust >/tmp/sgp-restore/init.log 2>&1 && exec postgres -D /tmp/sgp-restore/db -k /tmp/sgp-restore -c listen_addresses=''"
container=subprocess.run(['docker','run','-d','--name',name,'--network','none','--cpus','2','--memory','1g',
 '--tmpfs','/tmp/sgp-restore:rw,size=536870912,mode=1777','--user','postgres','--entrypoint','bash',IMAGE,'-c',start],capture_output=True,text=True)
if container.returncode:
 print('::error title=Restore readiness::Isolated engine could not start; no production data accessed');sys.exit(1)
try:
 for _ in range(60):
  r=subprocess.run(['docker','exec',name,'pg_isready','-h','/tmp/sgp-restore','-U','postgres'],capture_output=True)
  if r.returncode==0:break
  time.sleep(.25)
 else:raise RuntimeError('ENGINE_NOT_READY')
 def db(database,sql):
  r=subprocess.run(['docker','exec','-i',name,'psql','-X','-qAt','-h','/tmp/sgp-restore','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1'],input=sql,text=True,capture_output=True)
  if r.returncode:raise RuntimeError('SYNTHETIC_SQL_FAILED')
  return r.stdout.strip()
 db('postgres','CREATE DATABASE qa_source; CREATE DATABASE qa_restored;')
 db('qa_source',"CREATE TABLE fixture(id integer PRIMARY KEY,value text); INSERT INTO fixture VALUES(1,'synthetic'),(2,'synthetic-2'); CREATE FUNCTION fixture_count() RETURNS bigint LANGUAGE sql AS 'SELECT count(*) FROM fixture';")
 dump=subprocess.run(['docker','exec',name,'pg_dump','-h','/tmp/sgp-restore','-U','postgres','-d','qa_source','-Fc'],capture_output=True)
 if dump.returncode:raise RuntimeError('SYNTHETIC_DUMP_FAILED')
 restore=subprocess.run(['docker','exec','-i',name,'pg_restore','-h','/tmp/sgp-restore','-U','postgres','-d','qa_restored','--single-transaction','--exit-on-error'],input=dump.stdout,capture_output=True)
 if restore.returncode:raise RuntimeError('SYNTHETIC_RESTORE_FAILED')
 query="SELECT md5(string_agg(row_to_json(t)::text,',' ORDER BY id))||':'||fixture_count()::text FROM fixture t;"
 if db('qa_source',query)!=db('qa_restored',query):raise RuntimeError('SYNTHETIC_INTEGRITY_MISMATCH')
 report={'image':IMAGE,'network':'none','ports_published':False,'synthetic_custom_restore_verified':True,'synthetic_dump_sha256':hashlib.sha256(dump.stdout).hexdigest(),'production_data':False,'production_restore_verified':False,'limitations':['Only a tiny synthetic engine fixture','Extension control files checked, not full production extension/data recovery','Actual backup, roles, Vault keys, Storage and platform recovery remain pending']}
 print(json.dumps(report))
 print('::notice title=Restore readiness::PostgreSQL 17.11 image and synthetic custom-format restoration verified; production backup restoration pending')
except Exception as e:
 code=str(e) if str(e) in ['ENGINE_NOT_READY','SYNTHETIC_SQL_FAILED','SYNTHETIC_DUMP_FAILED','SYNTHETIC_RESTORE_FAILED','SYNTHETIC_INTEGRITY_MISMATCH'] else 'ISOLATED_CHECK_FAILED'
 print('::error title=Restore readiness::'+code+'; no production data accessed')
 sys.exit(1)
finally:
 # Remove only the throwaway synthetic container created by this script.
 subprocess.run(['docker','rm','-f',name],capture_output=True)
