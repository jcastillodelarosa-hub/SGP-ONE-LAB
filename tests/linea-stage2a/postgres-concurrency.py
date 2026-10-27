"""Lock/CAS/idempotency mechanism with REAL isolated PG sessions.
NOT the production resolver, role/RLS test or Supabase compatibility evidence.
"""
import json,pathlib,subprocess,time,threading
from concurrent.futures import ThreadPoolExecutor
ROOT=pathlib.Path(__file__).resolve().parents[2];C='sgp-pdt-qa-91'
meta=json.loads(subprocess.check_output(['docker','inspect',C]))[0]
assert meta['HostConfig']['NetworkMode']=='none' and not meta['HostConfig'].get('PortBindings')
db='sgp_linea_2a_qa_'+str(time.time_ns());subprocess.run(['docker','exec',C,'createdb','-U','postgres',db],check=True)
def run(q):return subprocess.run(['docker','exec','-i',C,'psql','-X','-qAt','-U','postgres','-d',db,'-v','ON_ERROR_STOP=1'],input=q,text=True,capture_output=True)
def sql(q):
 r=run(q);assert r.returncode==0,r.stderr
 return r.stdout.strip()
sql((ROOT/'tests/linea-stage2a/lock-harness.sql').read_text())
sql("INSERT INTO qa_2a.sources VALUES('QA-TURNS',10,0,0),('QA-RETRY',10,0,0),('QA-CORRECTION',10,0,0);")
def concurrent(queries):
 barrier=threading.Barrier(2)
 def worker(q):
  barrier.wait();return run("BEGIN;SET LOCAL lock_timeout='3s';"+q+";SELECT pg_sleep(0.15);COMMIT;")
 with ThreadPoolExecutor(2) as pool:return list(pool.map(worker,queries))
queries=["SELECT qa_2a.consume('00000000-0000-0000-0000-000000000001','QA-TURNS',6,0,1)","SELECT qa_2a.consume('00000000-0000-0000-0000-000000000002','QA-TURNS',6,0,2)"]
a=concurrent(queries);assert sum(x.returncode==0 for x in a)==1
assert any('REVISION_CONFLICT' in x.stderr for x in a)
assert sql("SELECT packed FROM qa_2a.sources WHERE production='QA-TURNS'")=='6'
r=run("SELECT qa_2a.consume('00000000-0000-0000-0000-000000000003','QA-TURNS',6,1,2)");assert r.returncode and 'INSUFFICIENT' in r.stderr
q="SELECT qa_2a.consume('00000000-0000-0000-0000-000000000004','QA-RETRY',3,0,1)"
a=concurrent([q,q]);assert all(x.returncode==0 for x in a)
assert sum('"duplicate": true' in x.stdout for x in a)==1
assert sql("SELECT packed FROM qa_2a.sources WHERE production='QA-RETRY'")=='3'
r=run(q.replace(',3,0,1)',',4,0,1)'));assert r.returncode and 'IDEMPOTENCY_REUSED' in r.stderr
q1="SELECT qa_2a.consume('00000000-0000-0000-0000-000000000005','QA-CORRECTION',6,0,1)"
q2="SELECT qa_2a.correct_assembly('QA-CORRECTION',5,0)"
a=concurrent([q1,q2]);assert sum(x.returncode==0 for x in a)==1
assert any('REVISION_CONFLICT' in x.stderr for x in a)
assert sql("SELECT assembled>=packed FROM qa_2a.sources WHERE production='QA-CORRECTION'")=='t'
r=run("SELECT qa_2a.correct_assembly('QA-TURNS',5,1)");assert r.returncode and 'UNBACKED' in r.stderr
assert sql("SELECT assembled||'|'||packed||'|'||revision FROM qa_2a.sources WHERE production='QA-TURNS'")=='10|6|1'
out={'status':'PASS','database':db,'postgres':sql('SHOW server_version'),'network':'none; no published ports','actual_pg_sessions':True,'scenarios':['two different turns share production lock; one stale revision rejected','concurrent identical retry commits exactly once','assembly downward correction races consumption without unbacked packing'],'additional_checks':['insufficient availability rejected after fresh revision','same UUID changed payload rejected','unsafe assembly correction rolls back without writes'],'limitations':['Mechanism harness ONLY; not full resolver SQL or production RPC','Role/scope, Export/PDT mappings and real source locks still need Etapa2B','No Supabase changes or deployment']}
(ROOT/'tests/linea-stage2a/evidence').mkdir(exist_ok=True)
(ROOT/'tests/linea-stage2a/evidence/postgres.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
