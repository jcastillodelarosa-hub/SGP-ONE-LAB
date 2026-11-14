"""Two active PostgreSQL sessions, disposable container, synthetic data only.
Prerequisite: export synthetic handler request via OPT_RETAIL_SYNTHETIC_REQUEST_PATH.
The observer psql only synchronizes on pg_stat_activity; it never mutates tested state.
"""
import json,re,subprocess,sys,time
from pathlib import Path
container=sys.argv[1]; payload=json.loads(Path(sys.argv[2]).read_text());root=Path(__file__).resolve().parents[2]
def sql(q,db='postgres'):
 return subprocess.run(['docker','exec','-i',container,'psql','-X','-U','postgres','-d',db,'-At','-v','ON_ERROR_STOP=1'],input=q,text=True,capture_output=True)
def require(r):
 assert r.returncode==0,r.stderr
 return r.stdout
require(sql('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;'))
text=(root/'tests/opt-digital/import-retail-sql.mjs').read_text()
seed=re.search(r'await db.exec\(`(.*?)`\);',text,re.S).group(1).replace('${program}','00000000-0000-0000-0000-000000000001')
seed=seed.replace('CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;','')
alter=re.search(r'await db.exec\("(ALTER TABLE.*?)"\);',text).group(1)
def lit(v):return "'"+v.replace("'","''")+"'"
args=[lit(payload['p_token']),lit(payload['p_pdf'])+'::bytea']+[lit(json.dumps(payload[k]))+'::jsonb' for k in ['p_manifest','p_sources','p_evidence']]
call='SELECT public.sgp_opt_importar_retail_validado_v3('+','.join(args)+');'
results=[]
for mode,target in [(m,t) for m in ['baseline','hardened'] for t in ['production','program','unrelated_program']]:
 db='retail_'+mode+'_'+target;require(sql('CREATE DATABASE '+db));require(sql(seed+alter,db))
 for name in ['install_REVIEW.sql','import_context_retail_v3_REVIEW.sql','import_channel_retail_v3_REVIEW.sql']:
  path='docs/sql-proposals/opt-shared/'+name
  source=subprocess.check_output(['git','show','a0c9a6e:'+path],cwd=root,text=True) if mode=='baseline' and name.startswith('import_channel') else (root/path).read_text()
  require(sql(source,db))
 require(sql("CREATE TABLE sgp_opt_shared.document_plans(id_documento uuid PRIMARY KEY,sha256 text,id_aprobacion uuid,manifest_sha256 text,evidence_sha256 text,extractor_sha256 text,geometry jsonb);",db))
 require(sql((root/'tests/opt-digital/fixtures/persist-document-plans-receiver.sql').read_text(),db))
 require(sql("UPDATE sgp_opt_shared.config SET enabled=true,access_window='mecanizado',read_roles=ARRAY['LIDER MECANIZADO'],write_roles=ARRAY['LIDER MECANIZADO'];",db))
 # Session A has completed the whole writer, including final context reread,
 # and remains in the same transaction before COMMIT. Session B inserts then.
 a=subprocess.Popen(['docker','exec','-i',container,'psql','-X','-U','postgres','-d',db,'-At','-v','ON_ERROR_STOP=1'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
 a.stdin.write("SET application_name='retail_session_a'; BEGIN; "+call+" SELECT pg_sleep(2); COMMIT;\n");a.stdin.close()
 ready=False
 for _ in range(80):
  r=sql("SELECT count(*) FROM pg_stat_activity WHERE application_name='retail_session_a' AND wait_event='PgSleep';",db)
  if r.stdout.strip()=='1':ready=True;break
  time.sleep(.025)
 assert ready,'Writer did not reach controlled post-reread point: '+a.stderr.read() if a.poll() is not None else 'writer not ready'
 assert require(sql("BEGIN; SELECT pg_try_advisory_xact_lock(hashtextextended('OPT2099-46-5-TEST-3',440)); ROLLBACK;",db)).splitlines()[1]=='f'
 insert="INSERT INTO public.sgp_producciones SELECT 'competing',id,id_linea,reserva_al,sistema,anio,semana_base,activa,excluida_export,produccion FROM public.sgp_producciones WHERE id_linea='PANELES_2';" if target=='production' else "INSERT INTO public.sgp_mecanizado_programacion VALUES('00000000-0000-0000-0000-000000000002','9000001','SIN INICIAR'); INSERT INTO public.sgp_mecanizado_programacion_detalle VALUES('00000000-0000-0000-0000-000000000002','123456|PANELES_2','9000001',1);"
 if target=='unrelated_program':
  insert="INSERT INTO public.sgp_mecanizado_programacion VALUES('00000000-0000-0000-0000-000000000099','9999999','SIN INICIAR');"
 b=sql("BEGIN; SET lock_timeout='300ms'; "+insert+" COMMIT;",db)
 a.wait(timeout=8);assert a.returncode==0,a.stderr.read()
 if mode=='baseline':assert b.returncode==0,b.stderr
 else:assert b.returncode!=0 and 'lock timeout' in b.stderr,b.stderr
 counts=require(sql("SELECT (SELECT count(*) FROM sgp_opt_shared.documents),(SELECT count(*) FROM public.sgp_producciones WHERE key_produccion='competing'),(SELECT count(*) FROM sgp_opt_shared.cuts);",db)).strip()
 results.append({'mode':mode,'target':target,'sharedConsecutiveLock':True,'insertAfterFinalRead':'committed' if b.returncode==0 else 'blocked_until_import_commit','counts_document_competitor_cuts':counts})
 if mode=='hardened' and target=='production':
  # New insertion is permitted after import commits. It cannot rewrite immutable units.
  require(sql("INSERT INTO public.sgp_producciones SELECT 'after_commit',id,id_linea,reserva_al,sistema,anio,semana_base,activa,excluida_export,produccion FROM public.sgp_producciones WHERE id_linea='PANELES_2';",db))
  stale=sql(call,db);assert 'OPT_CONTEXTO_CAMBIO_REINTENTAR' in stale.stderr,stale.stderr
  assert require(sql('SELECT count(*) FROM sgp_opt_shared.documents;',db)).strip()=='1'
  results[-1]['stale_retry']='rejected_after_postcommit_insert'
# Active context DML lock is rejected immediately instead of waiting or persisting.
held=subprocess.Popen(['docker','exec','-i',container,'psql','-X','-U','postgres','-d','retail_hardened_production','-At','-v','ON_ERROR_STOP=1'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
held.stdin.write("SET application_name='retail_program_writer'; BEGIN; LOCK TABLE public.sgp_mecanizado_programacion IN ROW EXCLUSIVE MODE; SELECT pg_sleep(2); COMMIT;\n");held.stdin.close()
for _ in range(80):
 if sql("SELECT count(*) FROM pg_stat_activity WHERE application_name='retail_program_writer' AND wait_event='PgSleep';",'retail_hardened_production').stdout.strip()=='1':break
 time.sleep(.025)
busy=sql(call,'retail_hardened_production');assert 'OPT_CONTEXTO_OCUPADO' in busy.stderr,busy.stderr
held.wait(timeout=8);assert held.returncode==0,held.stderr.read()
results.append({'activeContextWriter':'OPT_CONTEXTO_OCUPADO','waitPolicy':'NOWAIT','newDocuments':0})
print(json.dumps({'engine' :'PostgreSQL17.11','synthetic':True,'productionWrites':0,'results':results},indent=2))
