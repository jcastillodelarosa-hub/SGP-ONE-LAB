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

def role_error_code(error):
 text=error.decode(errors='replace').lower()
 if re.search(r'role [^\n]+ already exists',text):return 'ROLE_ALREADY_EXISTS'
 if 'unrecognized configuration parameter' in text:return 'ROLE_CONFIGURATION_NOT_AVAILABLE'
 if 'permission denied' in text or 'must be superuser' in text:return 'ROLE_PRIVILEGE_ERROR'
 if 'syntax error' in text:return 'GLOBAL_SQL_SYNTAX_ERROR'
 if 'tablespace' in text:return 'TABLESPACE_CONFIGURATION_REQUIRED'
 return 'GLOBAL_ROLES_RESTORE_FAILED'

def safe_role_diagnostic(error):
 text=error.decode(errors='replace')
 matches=re.findall(r'ERROR:\s*([^\r\n]+)',text)
 if not matches:return 'ROLE_ERROR_DETAILS_UNAVAILABLE'
 message=matches[0]
 if not any(x in message.lower() for x in ['permission denied','must be superuser','only superuser','reserved role']):return role_error_code(error)
 message=re.sub(r'"(?:[^"\n]|"")*"', '[identifier]',message)
 message=re.sub(r"'(?:[^'\n]|'')*'", '[identifier]',message)
 message=re.sub(r'https?://\S+','[URL]',message)
 return message[:240]

def idempotent_role_creation(data):
 text=data.decode();tag='$sgp_role_'+uuid.uuid4().hex+'$'
 pattern=r'^CREATE ROLE ((?:"(?:[^"\n]|"")*"|[a-zA-Z_][a-zA-Z_0-9$]*));$'
 return re.sub(pattern,lambda m:'DO '+tag+' BEGIN CREATE ROLE '+m.group(1)+'; EXCEPTION WHEN duplicate_object THEN NULL; END '+tag+';',text,flags=re.M).encode()

def canonical_default_acl_query(entries):
 # Decode the archived textual ACL with PG17 itself, using restored role names.
 # Compare privileges/grantors semantically, not the unstable aclitem[] order.
 if not entries:return "SELECT '[]'::jsonb;"
 rows=','.join('('+','.join('NULL' if e.get(k) is None else literal(e[k]) for k in ('owner','schema','tipo','acl'))+')' for e in entries)
 return "WITH defaults(owner,schema,tipo,acl) AS (VALUES "+rows+") SELECT jsonb_agg(jsonb_build_object('owner',owner,'schema',schema,'tipo',tipo,'acl_efectiva',(SELECT coalesce(jsonb_agg(jsonb_build_object('grantor',pg_get_userbyid(a.grantor),'grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,'privilegio',a.privilege_type,'grantable',a.is_grantable) ORDER BY a.grantor,a.grantee,a.privilege_type,a.is_grantable),'[]'::jsonb) FROM aclexplode(acl::aclitem[]) a))) FROM defaults;"

def main(validation=None):
 if os.environ.get('GITHUB_ACTIONS')!='true':raise SafeFailure('PROTECTED_RUNNER_REQUIRED')
 resume=os.environ.get('SGP_RESTORE_EXISTING')=='true'
 install=os.environ.get('SGP_INSTALL_PRODUCTION')=='PDT91_AUTHORIZED_NOW'
 if validation is not None:
  if not resume or os.environ.get('SGP_INSTALL_PRODUCTION') or os.environ.get('SUPABASE_DB_PASSWORD'):
   raise SafeFailure('ISOLATED_VALIDATION_ENVIRONMENT_REJECTED')
  install=False
 if install and resume:raise SafeFailure('FRESH_RECOVERY_REQUIRED_BEFORE_INSTALL')
 if install:
  from production_install import FREEZE_SQL,batch_body,acceptance_sql,safe_ddl_error,manifest as sql_manifest
 if not resume and not os.environ.get('SUPABASE_DB_PASSWORD'):raise SafeFailure('DATABASE_SECRET_UNAVAILABLE')
 storage=validation.storage if validation is not None else PrivateStorage();storage.verify_boundary()
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
 clients=[];keeper=None;sandbox=None;phase='SETUP';admin='supabase_admin'
 environment=os.environ.copy();environment['PGPASSWORD']=os.environ.get('SUPABASE_DB_PASSWORD','')
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
   r=subprocess.run(['docker','exec','-i',sandbox,'psql','-X','-qAt','-h','/tmp/sgp-restore','-U',admin,'-d',database,'-v','ON_ERROR_STOP=1'],input=(header+query+'\nROLLBACK;\n').encode(),capture_output=True,timeout=180)
   if r.returncode:raise SafeFailure('ISOLATED_METADATA_READ_FAILED')
   return json.loads(r.stdout)
  try:
   if resume:
    phase='LOAD_EXISTING_PRIVATE_BACKUP'
    manifest=validation.manifest if validation is not None else storage.latest_backup_manifest();base=manifest['prefix']
    data=json.loads(storage.get(manifest['objects']['catalog_and_counts']))
    source_catalog=data['catalog'];source_counts=data['counts']
    tables=data.get('tables') or [{'schema':n.split('.',1)[0],'name':n.split('.',1)[1]} for n in source_counts]
    count_parts=["SELECT "+literal(t['schema']+'.'+t['name'])+" AS name,count(*)::bigint AS count FROM "+ident(t['schema'])+'.'+ident(t['name']) for t in tables]
    counts_query="SELECT jsonb_object_agg(name,count) FROM ("+' UNION ALL '.join(count_parts)+") AS table_counts;"
    record=manifest['objects']['database']
   else:
    phase='SOURCE_SNAPSHOT'
    # The session pooler on 5432 preserves this transaction until pg_dump finishes.
    keeper_error=tempfile.TemporaryFile()
    keeper=subprocess.Popen(client('psql',['-X','-qAt','--no-password','-v','ON_ERROR_STOP=1']),env=environment,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=keeper_error)
    keeper.stdin.write(FREEZE_SQL.encode() if install else b'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SELECT pg_export_snapshot();\n');keeper.stdin.flush()
    snapshot=keeper.stdout.readline().decode().strip()
    if not re.fullmatch(r'[A-Fa-f0-9]+-[A-Fa-f0-9]+-[0-9]+',snapshot):raise SafeFailure('WRITES_CONTROL_OR_SNAPSHOT_NOT_AVAILABLE')
    if install:print('::notice title=PDT production::Affected public tables write-locked transactionally; automatic writers cannot bypass table locks; fresh consistent backup starting.')
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
    if not install:
     keeper.stdin.write(b'ROLLBACK;\n\\q\n');keeper.stdin.flush();keeper.stdin.close();keeper.wait(timeout=30)
     keeper=None;keeper_error.close()
    private_metadata=json.dumps({'catalog':source_catalog,'counts':source_counts,'tables':tables},ensure_ascii=False).encode()
    manifest['objects']['catalog_and_counts']=storage.put(base+'catalog-and-counts.json',private_metadata)
    private_metadata=None
    manifest['status']='BACKUP_STORED_RESTORE_PENDING'
    storage.put(base+'backup-record.json',json.dumps(manifest,ensure_ascii=False).encode())
   phase='ISOLATED_ENGINE'
   sandbox='sgp-production-restore-'+uuid.uuid4().hex[:14]
   start="initdb -D /tmp/sgp-restore/db -U "+admin+" --auth=trust >/tmp/sgp-restore/init.log 2>&1 && exec postgres -D /tmp/sgp-restore/db -k /tmp/sgp-restore -c listen_addresses=''"
   r=subprocess.run(['docker','run','-d','--name',sandbox,'--log-driver=none','--network','none','--cpus','2','--memory','3g','--cap-drop','ALL','--security-opt','no-new-privileges',
    '--tmpfs','/tmp/sgp-restore:rw,size=2147483648,mode=1777','--user','postgres','--entrypoint','bash',IMAGE,'-c',start],capture_output=True,timeout=90)
   if r.returncode:raise SafeFailure('ISOLATED_ENGINE_START_FAILED')
   for _ in range(80):
    r=subprocess.run(['docker','exec',sandbox,'pg_isready','-h','/tmp/sgp-restore','-U',admin],capture_output=True)
    if r.returncode==0:break
    time.sleep(.25)
   else:raise SafeFailure('ISOLATED_ENGINE_NOT_READY')
   pg=['docker','exec','-i',sandbox,'psql','-X','-qAt','-h','/tmp/sgp-restore','-U',admin,'-d','postgres','-v','ON_ERROR_STOP=1']
   phase='RESTORE_GLOBALS'
   # Recovery material is downloaded from the private object generation, SHA256 checked.
   global_bytes=storage.get(manifest['objects']['globals'])
   # Supabase's bootstrap role must retain PostgreSQL bootstrap OID 10.
   # PG17 GRANTED BY distinguishes that role from a newly created namesake.
   # Preserve all original role attributes and grantor clauses; only tolerate
   # CREATE of the already-initialized bootstrap role in this disposable copy.
   r=subprocess.run(pg,input=idempotent_role_creation(global_bytes),capture_output=True,timeout=120)
   global_bytes=None
   if r.returncode:raise SafeFailure(role_error_code(r.stderr)+': '+safe_role_diagnostic(r.stderr))
   # Drop only the empty initdb database inside this newly-owned, networkless sandbox.
   # --create restores original database ownership, ACL and database settings.
   maintenance_pg=pg.copy();maintenance_pg[maintenance_pg.index('-d')+1]='template1'
   r=subprocess.run(maintenance_pg,input=b'DROP DATABASE postgres;\n',capture_output=True,timeout=30)
   if r.returncode:raise SafeFailure('ISOLATED_DATABASE_CREATE_FAILED')
   phase='RESTORE_DATABASE'
   archive=storage.get(record)
   r=subprocess.run(['docker','exec','-i',sandbox,'pg_restore','-h','/tmp/sgp-restore','-U',admin,'-d','template1','--create','--exit-on-error'],input=archive,capture_output=True,timeout=900)
   archive=None
   if r.returncode:raise SafeFailure('DATABASE_RESTORE_FAILED')
   phase='RESTORE_INTEGRITY'
   restored_counts=isolated('postgres',counts_query) if count_parts else {}
   if restored_counts!=source_counts:raise SafeFailure('RESTORED_TABLE_COUNTS_DIFFER')
   restored_catalog=isolated('postgres',catalog_body(),True)
   # Preserve the private archived metadata; canonicalize only comparison copies.
   source_catalog=dict(source_catalog);restored_catalog=dict(restored_catalog)
   for catalog in (source_catalog,restored_catalog):
    catalog['grants_por_defecto']=isolated('postgres',canonical_default_acl_query(catalog['grants_por_defecto']))
   differences=compare_catalogs(source_catalog,restored_catalog)
   if differences:raise SafeFailure('RESTORED_CATALOG_DIFFER_'+','.join(differences))
   if validation is not None:
    # The sole validation hook runs only after verified recovery, before all GCS
    # writes and the legacy installation route. pg addresses the networkless clone.
    phase='PDT_UNIFIED_VALIDATION'
    return validation.run(pg,manifest)
   manifest['status']='POSTGRES_BACKUP_RESTORED_VERIFIED'
   manifest['verification']={'tables_compared':len(tables),'table_counts_equal':True,'catalog_sections_equal':True,
    'archive_sha256_checked_on_download':True,'restore_network':'none','source_writes':False,
    'postgres_scope_only':True,'pdt_sql_not_applied':True,'later_writes_replay_verified':False}
   storage.put(base+'recovery-verified.json',json.dumps(manifest,ensure_ascii=False).encode())
   print('::notice title=Supabase recovery::PostgreSQL backup stored privately in GCS and restored with SHA256, table counts and catalog verification. No production writes; no migrations; no GitHub backup artifacts.')
   print('::notice title=Supabase recovery record::'+base+'recovery-verified.json')
   if install:
    phase='ISOLATED_REAL_SCHEMA_INSTALL'
    # Execute the reviewed batch as the real source owner on the recovered copy.
    # Roll back the clone trial; do not rerun PDT fixtures or touch operational data.
    trial="SET ROLE postgres; BEGIN;"+batch_body()+acceptance_sql(source_catalog)+"ROLLBACK;"
    result=subprocess.run(pg,input=trial.encode(),capture_output=True,timeout=300)
    if result.returncode:raise SafeFailure('REAL_SCHEMA_INSTALL_REJECTED: '+safe_ddl_error(result.stderr))
    phase='PRODUCTION_ATOMIC_INSTALL'
    if keeper.poll() is not None:raise SafeFailure('WRITE_CONTROL_SESSION_LOST_NO_INSTALL')
    sql=batch_body()+acceptance_sql(source_catalog)+"NOTIFY pgrst, 'reload schema'; COMMIT; SELECT 'PDT91_COMMITTED';\n"
    keeper.stdin.write(sql.encode());keeper.stdin.flush()
    committed=False
    for line in keeper.stdout:
     if line.strip()==b'PDT91_COMMITTED':committed=True;break
    if not committed:
     keeper.wait(timeout=15);keeper_error.seek(0)
     raise SafeFailure('INSTALL_NOT_CONFIRMED: '+safe_ddl_error(keeper_error.read()))
    keeper.stdin.write(b'\\q\n');keeper.stdin.flush();keeper.stdin.close();keeper.wait(timeout=30)
    keeper=None;keeper_error.close()
    manifest['installation']={'status':'PRODUCTION_COMMITTED','sql_sha256':sql_manifest('AB'),
     'transactional_write_control':True,'isolated_real_schema_install_rollback_passed':True,
     'rpc_permissions_guards_acceptance_passed':True,'frontend_published':False}
    storage.put(base+'production-install-committed.json',json.dumps(manifest,ensure_ascii=False).encode())
    print('::notice title=PDT production::PDT91_PRODUCTION_COMMITTED: fresh backup restored, real-schema installation rollback passed, RPC/permissions/guards acceptance passed. Locks released by atomic commit; frontend not yet published.')

   return 0
  except SafeFailure as e:
   manifest['status']='NOT_RECOVERY_VERIFIED';manifest['failed_phase']=phase;manifest['safe_error']=str(e)
   if validation is None:
    try:storage.put(base+'failure-record-'+uuid.uuid4().hex+'.json',json.dumps(manifest,ensure_ascii=False).encode())
    except Exception:pass
   code=validation.record_failure(phase,e) if validation is not None else str(e)
   print('::error title=Supabase recovery::'+phase+': '+code+'; no production writes')
   return 1
  except Exception as e:
   if validation is not None:validation.record_failure(phase,e)
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
