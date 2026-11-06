"""Directed official persistence test. Native PG17, captured auth, synthetic data only."""
from pathlib import Path
import sys,json,subprocess,uuid,hashlib,tempfile
from concurrent.futures import ThreadPoolExecutor
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tests/lp01-operacion'))
from postgres import Database,lit
HERE=Path(__file__).parent
sql_path=ROOT/'docs/sql-proposals/lp01-official-close/01_storage_REVIEW.sql'
db=Database()
checks=[]
try:
 db.sql('ALTER TABLE public.sgp_producciones ADD COLUMN proyecto text;')
 db.sql(sql_path.read_text())
 assert db.sql('SELECT enabled FROM sgp_lp_official.config')=='f'
 for signature in ['sgp_lp_official_context_v1(text,jsonb,uuid,text)','sgp_lp_official_commit_v1(text,jsonb,uuid,text,text,bigint,jsonb,jsonb,jsonb)']:
  assert db.sql('SELECT has_function_privilege(\'anon\','+lit(signature)+",'EXECUTE')")=='f'
  assert db.sql('SELECT has_function_privilege(\'authenticated\','+lit(signature)+",'EXECUTE')")=='f'
 checks.append('Definition is disabled; no API grants; all four private tables have RLS')
 assert db.sql("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='sgp_lp_official' AND c.relkind='r' AND c.relrowsecurity")=='4'
 # Old anonymized source fixture, not the unavailable 03/11 original.
 source=ROOT/'tests/lp01-powerbi/fixtures/ensamble.xlsx'
 model=json.loads(subprocess.check_output(['node',str(ROOT/'tests/lp01-powerbi/parse-fixture.mjs'),str(source)],cwd=ROOT,text=True))
 records=[r for r in model['records'] if r['shift']==1]
 for i,r in enumerate(records):
  key=f'QA-{i}|PANELES_2';db.seed(key,parts=(10,),date='2026-10-31')
  db.sql('UPDATE public.sgp_producciones SET produccion='+lit(r['production'])+',proyecto='+lit(r['project'])+',sistema='+lit(r['system'])+' WHERE key_produccion='+lit(key))
 db.execute(db.cmd('ABRIR',date='2026-10-31',revision=0))
 official=db.sql('SELECT jsonb_agg(to_jsonb(p) ORDER BY key_produccion) FROM public.sgp_producciones p')
 manual=db.sql('SELECT jsonb_agg(to_jsonb(p) ORDER BY key,parte) FROM sgp_lp_operacion.ordenes p')
 command={'id':str(uuid.uuid4()),'action':'IMPORT','stage':'ENSAMBLE','line':'PANELES_2','date':'2026-10-31','shift':1,'revision':0}
 def run(command,token='LIDER',file=source,expect=None):
  req={'token':token,'command':command,'filename':'qa.xlsx','observation':'QA oficial'}
  proc=subprocess.run(['node',str(HERE/'service-runner.mjs')],input=json.dumps({'container':db.container,'file':str(file) if file else None,'request':req}),cwd=ROOT,text=True,capture_output=True)
  result=json.loads(proc.stdout)
  if expect:assert proc.returncode and expect in result['error'],result
  else:assert proc.returncode==0,result
  return result
 run(command,expect='OFFICIAL_NOT_ENABLED')
 db.sql('UPDATE sgp_lp_official.config SET enabled=true WHERE id;')
 first=run(command)
 assert first['revision']==1 and len(first['result']['changes'])==len(records)
 assert run(command)==first
 checks.append('Actual server parser → native RPC → committed ledger; exact retry returns original receipt')
 again=run({**command,'id':str(uuid.uuid4()),'revision':1})
 assert all(r['delta']==0 for r in again['result']['changes'])
 assert db.sql('SELECT count(*) FROM sgp_lp_official.files')=='2'
 assert db.sql('SELECT encode(sha256(bytes),\'hex\')=sha256 FROM sgp_lp_official.files LIMIT 1')=='t'
 close={**command,'id':str(uuid.uuid4()),'action':'CLOSE','revision':2}
 db.sql("UPDATE public.sgp_linea_plan_asignaciones SET cantidad=15 WHERE key_produccion='QA-0|PANELES_2';")
 closed=run(close,file=None)
 assert closed['result']['type']=='CLOSE'
 assert next(r for r in closed['result']['rows'] if r['key']=='QA-0|PANELES_2')['planned']==15
 assert run(close,file=None)==closed
 checks.append('New upload same quantities has delta zero; durable closure snapshots current plan and preserves original XLSX')
 with tempfile.TemporaryDirectory(prefix='official-close-') as tmp:
  partial=Path(tmp)/'partial.xlsx'
  subprocess.run(['node',str(HERE/'build-partial.mjs'),str(partial),'8'],cwd=ROOT,check=True)
  before=json.loads(db.sql('SELECT state FROM sgp_lp_official.ledger'))
  corrected=run({**command,'id':str(uuid.uuid4()),'revision':3},file=partial)
  assert len(corrected['result']['changes'])==1
  assert corrected['result']['changes'][0]['delta']==8-records[0]['quantity']
  after=json.loads(db.sql('SELECT state FROM sgp_lp_official.ledger'))
  assert after['entries'][1:]==before['entries'][1:]
  assert after['closures']==before['closures']
  assert run({**command,'id':str(uuid.uuid4()),'revision':4},file=partial)['result']['changes'][0]['delta']==0
 checks.append('Partial correction persists replacement delta, preserves absent orders/closed snapshots, and identical partial reload is zero')
 def concurrent_import(_):
  req={'token':'LIDER','command':{**command,'id':str(uuid.uuid4()),'revision':5},'filename':'qa.xlsx'}
  proc=subprocess.run(['node',str(HERE/'service-runner.mjs')],input=json.dumps({'container':db.container,'file':str(source),'request':req}),cwd=ROOT,text=True,capture_output=True)
  return json.loads(proc.stdout)
 with ThreadPoolExecutor(max_workers=2) as pool: concurrent=list(pool.map(concurrent_import,range(2)))
 assert sum('error' not in r for r in concurrent)==1,concurrent
 assert all('error' not in r or 'CONFLICTO_REVISION' in r['error'] for r in concurrent),concurrent
 assert db.sql('SELECT revision FROM sgp_lp_official.ledger')=='6'
 checks.append('Two real concurrent server imports at one revision commit once; loser must re-read')
 run({**command,'id':str(uuid.uuid4()),'revision':0},expect='CONFLICTO_REVISION')
 run({**command,'id':str(uuid.uuid4()),'revision':5},token='CONSULTA',expect='OFFICIAL_WRITE_ROLE_REQUIRED')
 run({**command,'id':str(uuid.uuid4()),'revision':5},token='invalid',expect='SESION_NO_AUTORIZADA')
 db.sql("DELETE FROM sgp_lp_operacion.permisos WHERE usuario='LIDER' AND etapa='ENSAMBLE' AND key='QA-0|PANELES_2';")
 run(command,expect='AMBITO_DENEGADO')
 checks.append('Stale revision, read-only role, invalid session and revoked scope (including retry) rejected')
 assert official==db.sql('SELECT jsonb_agg(to_jsonb(p) ORDER BY key_produccion) FROM public.sgp_producciones p')
 assert manual==db.sql('SELECT jsonb_agg(to_jsonb(p) ORDER BY key,parte) FROM sgp_lp_operacion.ordenes p')
 checks.append('Weekly Export and manual execution untouched; native turn state not promoted by this storage proposal')
 out={'status':'PASS','postgres':db.sql('SHOW server_version'),'sql_sha256':hashlib.sha256(sql_path.read_bytes()).hexdigest(),'checks':checks,'limits':'Isolated storage/service only; not production installation, shared UI, native automatic turn closure or new source files'}
 (HERE/'postgres-result.json').write_text(json.dumps(out,indent=2)+'\n')
 print(json.dumps(out,indent=2))
finally:db.close()
