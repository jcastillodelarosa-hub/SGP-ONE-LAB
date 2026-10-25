"""Private PostgreSQL backup and isolated recovery. No production DDL/DML.
Archives, catalog and data are processed in memory and stored ONLY in private GCS.
No upload-artifact, cache, repository file or public log receives backup contents.
"""
import datetime,hashlib,json,os,pathlib,re,subprocess,sys,tempfile,time,uuid
sys.dont_write_bytecode=True
from gcs_storage import PrivateStorage,SafeFailure,PREFIX,BUCKET
ROOT=pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tests/sql/pdt'))
from catalog_compatibility import compare_catalogs
IMAGE='supabase/postgres:17.11.0.006'
MAX_DB_BYTES=1024*1024*1024

def ident(s):return '"'+s.replace('"','""')+'"'
def literal(s):return "'"+s.replace("'","''")+"'"
def readonly_query(query,snapshot=None):
 header="BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET LOCAL row_security=off;"
 if snapshot:
  if not re.fullmatch(r'[A-Fa-f0-9]+-[A-Fa-f0-9]+-[0-9]+',snapshot):raise SafeFailure('SNAPSHOT_IDENTIFIER_INVALID')
  header+='SET TRANSACTION SNAPSHOT '+literal(snapshot)+';'
 return header+query+'\nROLLBACK;\n'

def catalog_body():
 text=(ROOT/'PDT_PREFLIGHT_SUPABASE.sql').read_text()
 text=text.replace('BEGIN TRANSACTION READ ONLY;','',1)
 return text.rsplit('ROLLBACK;',1)[0]

def main():
 if os.environ.get('GITHUB_ACTIONS')!='true':raise SafeFailure('PROTECTED_RUNNER_REQUIRED')
 if not os.environ.get('SUPABASE_DB_PASSWORD'):raise SafeFailure('DATABASE_SECRET_UNAVAILABLE')
 storage=PrivateStorage();storage.verify_boundary()
 created=datetime.datetime.now(datetime.timezone.utc)
 base=PREFIX+created.strftime('%Y%m%dT%H%M%SZ')+'-'+uuid.uuid4().hex+'/'
 manifest={'created_utc':created.isoformat(),'project_ref':'ocvxbwzqxbrfndkvjmfx',
  'bucket':BUCKET,'prefix':base,'status':'BACKUP_STARTED_NOT_VERIFIED','objects':{},
  'production_writes':False,'source_consistent_snapshot':True,'archive_format':'custom',
  'limitations':['PostgreSQL scope; not external Storage object bytes or platform secrets',
    'Global roles exclude password hashes; recovery requires protected credential reconfiguration',
    'Supabase-managed Vault keys are not recoverable from pg_dump alone',
    'No PITR or automatic replay of later production writes demonstrated',
    'Whole bucket IAM inspection unavailable; enforced public access prevention and prefix-downscoped token verified']}
 clients=[];keeper=None;sandbox=None;phase='SETUP'
 environment=os.environ.copy();environment['PGPASSWORD']=os.environ['SUPABASE_DB_PASSWORD']
 with tempfile.TemporaryDirectory(prefix='sgp-backup-public-ca-') as temp:
  # Only public CA certificates touch disk. Production data stays in memory/tmpfs.
  ca=pathlib.Path(temp)/'ca.crt';certs=pathlib.Path(__file__).with_name('certs')
  ca.write_bytes(pathlib.Path('/etc/ssl/certs/ca-certificates.crt').read_bytes()+b'\n'+
   (certs/'prod-ca-2021.crt').read_bytes()+b'\n'+(certs/'prod-ca-2025.crt').read_bytes())
  def client(tool,args):
   name='sgp-backup-client-'+uuid.uuid4().hex[:14];clients.append(name)
   return ['docker','run','--rm','-i','--name',name,'--log-driver=none',
    '--env','PGPASSWORD','--env','PGHOST=aws-0-us-east-2.pooler.supabase.com',
    '--env','PGPORT=5432','--env','PGDATABASE=postgres','--env','PGUSER=postgres.ocvxbwzqxbrfndkvjmfx',
    '--env','PGSSLMODE=verify-full','--env','PGSSLROOTCERT=/etc/sgp-ca.crt',
    '--env','PGCONNECT_TIMEOUT=20','--env','PGTZ=UTC',
    '--env','PGOPTIONS=-c default_transaction_read_only=on -c statement_timeout=120000',
    '--mount','type=bind,source='+str(ca)+',target=/etc/sgp-ca.crt,readonly',
    '--entrypoint',tool,IMAGE]+args
  def production(query,snapshot=None):
   r=subprocess.run(client('psql',['-X','-qAt','--no-password','-v','ON_ERROR_STOP=1']),env=environment,
    input=readonly_query(query,snapshot).encode(),capture_output=True,timeout=180)
   if r.returncode:
    if b'password authentication failed' in r.stderr:raise SafeFailure('POSTGRES_AUTHENTICATION_FAILED')
    raise SafeFailure('PRODUCTION_READ_FAILED')
   return json.loads(r.stdout)
  def isolated(database,query,as_source=False):
   header='BEGIN READ ONLY; SET LOCAL timezone=\'UTC\';'
   if as_source:header+=' SET LOCAL ROLE postgres;'
   r=subprocess.run(['docker','exec','-i',sandbox,'psql','-X','-qAt','-h','/tmp/sgp-restore','-U','sgp_restore_admin','-d',database,'-v','ON_ERROR_STOP=1'],input=(header+query+'\nROLLBACK;\n').encode(),capture_output=True,timeout=180)
   if r.returncode:raise SafeFailure('ISOLATED_METADATA_READ_FAILED')
   return json.loads(r.stdout)
  try:
   phase='SOURCE_SNAPSHOT'
   # The session pooler on 5432 preserves this transaction until pg_dump finishes.
   keeper_error=tempfile.TemporaryFile()
   keeper=subprocess.Popen(client('psql',['-X','-qAt','--no-password','-v','ON_ERROR_STOP=1']),env=environment,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=keeper_error)
   keeper.stdin.write(b'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SELECT pg_export_snapshot();\n');keeper.stdin.flush()
   snapshot=keeper.stdout.readline().decode().strip()
   if not re.fullmatch(r'[A-Fa-f0-9]+-[A-Fa-f0-9]+-[0-9]+',snapshot):raise SafeFailure('CONSISTENT_SNAPSHOT_NOT_AVAILABLE')
   size=production("SELECT pg_database_size(current_database())::bigint;",snapshot)
   if size>MAX_DB_BYTES:raise SafeFailure('SOURCE_EXCEEDS_APPROVED_IN_MEMORY_RESTORE_CAPACITY')
   manifest['source_database_bytes']=size
   phase='SOURCE_CATALOG'
   source_catalog=production(catalog_body(),snapshot)
   tables=production("SELECT coalesce(json_agg(json_build_object('schema',n.nspname,'name',c.relname) ORDER BY n.nspname,c.relname),'[]') FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN ('r','p') AND n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%' AND c.relpersistence<>'t';",snapshot)
   count_parts=["SELECT "+literal(t['schema']+'.'+t['name'])+" AS name,count(*)::bigint AS count FROM "+ident(t['schema'])+'.'+ident(t['name']) for t in tables]
   counts_query="SELECT jsonb_object_agg(name,count) FROM ("+' UNION ALL '.join(count_parts)+") AS table_counts;"
   source_counts=production(counts_query,snapshot) if count_parts else {}
   phase='GLOBAL_ROLES_DUMP'
   globals_result=subprocess.run(client('pg_dumpall',['--globals-only','--no-role-passwords','--no-password']),env=environment,capture_output=True,timeout=180)
   if globals_result.returncode:raise SafeFailure('GLOBAL_ROLES_BACKUP_FAILED')
   globals_record=storage.put(base+'globals.sql',globals_result.stdout)
   manifest['objects']['globals']=globals_record
   globals_result=None
   phase='DATABASE_DUMP'
   dump=subprocess.run(client('pg_dump',['--format=custom','--no-password','--snapshot='+snapshot,'--lock-wait-timeout=5s']),env=environment,capture_output=True,timeout=900)
   if dump.returncode:raise SafeFailure('PG_DUMP_FAILED')
   record=storage.put(base+'database.dump',dump.stdout)
   manifest['objects']['database']=record;dump=None
   keeper.stdin.write(b'ROLLBACK;\n\\q\n');keeper.stdin.flush();keeper.stdin.close();keeper.wait(timeout=30)
   keeper=None;keeper_error.close()
   private_metadata=json.dumps({'catalog':source_catalog,'counts':source_counts},ensure_ascii=False).encode()
   manifest['objects']['catalog_and_counts']=storage.put(base+'catalog-and-counts.json',private_metadata)
   private_metadata=None
   manifest['status']='BACKUP_STORED_RESTORE_PENDING'
   storage.put(base+'backup-record.json',json.dumps(manifest,ensure_ascii=False).encode())
   phase='ISOLATED_ENGINE'
   sandbox='sgp-production-restore-'+uuid.uuid4().hex[:14]
   start="initdb -D /tmp/sgp-restore/db -U sgp_restore_admin --auth=trust >/tmp/sgp-restore/init.log 2>&1 && exec postgres -D /tmp/sgp-restore/db -k /tmp/sgp-restore -c listen_addresses=''"
   r=subprocess.run(['docker','run','-d','--name',sandbox,'--network','none','--cpus','2','--memory','3g','--cap-drop','ALL','--security-opt','no-new-privileges',
    '--tmpfs','/tmp/sgp-restore:rw,size=2147483648,mode=1777','--user','postgres','--entrypoint','bash',IMAGE,'-c',start],capture_output=True,timeout=90)
   if r.returncode:raise SafeFailure('ISOLATED_ENGINE_START_FAILED')
   for _ in range(80):
    r=subprocess.run(['docker','exec',sandbox,'pg_isready','-h','/tmp/sgp-restore','-U','sgp_restore_admin'],capture_output=True)
    if r.returncode==0:break
    time.sleep(.25)
   else:raise SafeFailure('ISOLATED_ENGINE_NOT_READY')
   pg=['docker','exec','-i',sandbox,'psql','-X','-qAt','-h','/tmp/sgp-restore','-U','sgp_restore_admin','-d','postgres','-v','ON_ERROR_STOP=1']
   phase='RESTORE_GLOBALS'
   # Recovery material is downloaded from the private object generation, SHA256 checked.
   global_bytes=storage.get(manifest['objects']['globals'])
   r=subprocess.run(pg,input=global_bytes,capture_output=True,timeout=120);global_bytes=None
   if r.returncode:raise SafeFailure('GLOBAL_ROLES_RESTORE_FAILED')
   r=subprocess.run(pg,input=b'CREATE DATABASE sgp_recovered;\n',capture_output=True,timeout=30)
   if r.returncode:raise SafeFailure('ISOLATED_DATABASE_CREATE_FAILED')
   phase='RESTORE_DATABASE'
   archive=storage.get(record)
   r=subprocess.run(['docker','exec','-i',sandbox,'pg_restore','-h','/tmp/sgp-restore','-U','sgp_restore_admin','-d','sgp_recovered','--single-transaction','--exit-on-error'],input=archive,capture_output=True,timeout=900)
   archive=None
   if r.returncode:raise SafeFailure('DATABASE_RESTORE_FAILED')
   phase='RESTORE_INTEGRITY'
   restored_counts=isolated('sgp_recovered',counts_query) if count_parts else {}
   if restored_counts!=source_counts:raise SafeFailure('RESTORED_TABLE_COUNTS_DIFFER')
   restored_catalog=isolated('sgp_recovered',catalog_body(),True)
   differences=compare_catalogs(source_catalog,restored_catalog)
   if differences:raise SafeFailure('RESTORED_CATALOG_DIFFER_'+','.join(differences))
   manifest['status']='POSTGRES_BACKUP_RESTORED_VERIFIED'
   manifest['verification']={'tables_compared':len(tables),'table_counts_equal':True,'catalog_sections_equal':True,
    'archive_sha256_checked_on_download':True,'restore_network':'none','source_writes':False,
    'postgres_scope_only':True,'pdt_sql_not_applied':True,'later_writes_replay_verified':False}
   storage.put(base+'recovery-verified.json',json.dumps(manifest,ensure_ascii=False).encode())
   print('::notice title=Supabase recovery::PostgreSQL backup stored privately in GCS and restored with SHA256, table counts and catalog verification. No production writes; no migrations; no GitHub backup artifacts.')
   print('::notice title=Supabase recovery record::'+base+'recovery-verified.json')
   return 0
  except SafeFailure as e:
   manifest['status']='NOT_RECOVERY_VERIFIED';manifest['failed_phase']=phase;manifest['safe_error']=str(e)
   try:storage.put(base+'failure-record-'+uuid.uuid4().hex+'.json',json.dumps(manifest,ensure_ascii=False).encode())
   except Exception:pass
   print('::error title=Supabase recovery::'+phase+': '+str(e)+'; recovery not verified; no production writes')
   return 1
  except Exception:
   print('::error title=Supabase recovery::'+phase+': BACKUP_OR_RECOVERY_NOT_VERIFIED; no production writes')
   return 1
  finally:
   if keeper:
    try:keeper.stdin.write(b'ROLLBACK;\n\\q\n');keeper.stdin.flush();keeper.stdin.close();keeper.wait(timeout=10)
    except Exception:pass
   for name in clients:
    subprocess.run(['docker','rm','-f',name],capture_output=True)
   if sandbox:subprocess.run(['docker','rm','-f',sandbox],capture_output=True)

if __name__=='__main__':
 try:sys.exit(main())
 except SafeFailure as e:print('::error title=Supabase recovery::'+str(e));sys.exit(1)
 except Exception:print('::error title=Supabase recovery::BACKUP_NOT_STARTED_OR_NOT_VERIFIED');sys.exit(1)
