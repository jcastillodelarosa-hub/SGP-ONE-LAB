#!/usr/bin/env python3
"""Focused multi-session tests in one disposable, no-network PostgreSQL17 container.
No connection string, production credentials, Supabase calls, mounts or published ports.
"""
from pathlib import Path
import concurrent.futures as cf
import contextlib,hashlib,json,os,queue,re,shutil,subprocess,sys,threading,time,uuid
ROOT=Path(__file__).resolve().parents[3]
HERE=Path(__file__).parent
IMAGE='postgres:17.11'
OUT=HERE/'result-postgres17.json'

def lit(value):return "'"+str(value).replace("'","''")+"'"
def cmd(key='QA-A|PANELES_2',**extra):
 return {'op':'INCORPORAR','id':str(uuid.uuid4()),'stage':'ENSAMBLE','line':'PANELES_2','date':'2026-11-07','shift':1,'key':key,'revision':0,'turn_revision':0,'quantity':4,'observation':'QA concurrent incorporation',**extra}
def call(command):return 'SET ROLE anon;SELECT public.sgp_lp_operacion_comando(\'leader\','+lit(json.dumps(command))+'::jsonb);'
def success(result):
 assert result.returncode==0,result.stderr
 rows=[line for line in result.stdout.splitlines() if line.startswith('{')]
 assert rows,result.stdout
 return json.loads(rows[-1])
def denied(result,code):assert result.returncode!=0 and code in result.stderr,(result.returncode,result.stdout,result.stderr,code)

class Session:
 def __init__(self,db,name):
  self.db=db;self.name=name;self.q=queue.Queue();self.errors=[]
  self.p=subprocess.Popen(db.psql(),env=db.parent.env,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,bufsize=1)
  def pump():
   for line in self.p.stdout:self.q.put(line.rstrip('\n'))
   self.q.put(None)
  def errors():
   for line in self.p.stderr:self.errors.append(line)
  threading.Thread(target=pump,daemon=True).start();threading.Thread(target=errors,daemon=True).start()
  self.execute('SET application_name='+lit(name)+";SET statement_timeout='25s';")
 def execute(self,sql,timeout=12):
  marker='QA_MARK_'+uuid.uuid4().hex
  self.p.stdin.write(sql+'\nSELECT '+lit(marker)+';\n');self.p.stdin.flush();rows=[];deadline=time.monotonic()+timeout
  while time.monotonic()<deadline:
   try:line=self.q.get(timeout=max(.01,deadline-time.monotonic()))
   except queue.Empty:raise AssertionError('Session did not reach checkpoint: '+self.name)
   if line is None:raise AssertionError('Session exited: '+self.name+' '+''.join(self.errors))
   if line==marker:return '\n'.join(rows).strip()
   rows.append(line)
  raise AssertionError('Checkpoint timeout: '+self.name)
 def close(self):
  if self.p.poll() is None:
   try:self.p.stdin.write('ROLLBACK;\n\\q\n');self.p.stdin.flush();self.p.stdin.close();self.p.wait(timeout=5)
   except (BrokenPipeError,subprocess.TimeoutExpired):self.p.kill();self.p.wait(timeout=5)
 def __enter__(self):return self
 def __exit__(self,*unused):self.close()

class Database:
 def __init__(self,parent,name):
  assert re.fullmatch(r'qa_[a-z0-9_]+',name)
  self.parent=parent;self.name=name
 def psql(self):return self.parent.docker+['exec','-i',self.parent.container,'psql','-X','-qAt','-U','postgres','-d',self.name,'-P','pager=off','-v','ON_ERROR_STOP=1']
 def run(self,sql,timeout=35):return subprocess.run(self.psql(),env=self.parent.env,input=sql,text=True,capture_output=True,timeout=timeout)
 def sql(self,sql):
  result=self.run(sql);assert result.returncode==0,result.stderr;return result.stdout.strip()
 def value(self,sql):return json.loads(self.sql(sql))
 def state(self):
  return self.value("SELECT jsonb_build_object("+','.join(lit(t)+",(SELECT md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text)::text,'[]')) FROM "+table+" x)" for t,table in [('source','public.sgp_producciones'),('plan','public.sgp_linea_plan_asignaciones'),('orders','sgp_lp_operacion.ordenes'),('audit','sgp_lp_operacion.auditoria'),('turn','sgp_lp_operacion.turnos')])+');')
 def counts(self):return self.value("SELECT jsonb_build_object('orders',(SELECT count(*) FROM sgp_lp_operacion.ordenes),'audit',(SELECT count(*) FROM sgp_lp_operacion.auditoria),'plan',(SELECT count(*) FROM public.sgp_linea_plan_asignaciones),'revision',(SELECT revision FROM sgp_lp_operacion.turnos WHERE etapa='ENSAMBLE' AND linea='PANELES_2' AND fecha='2026-11-07' AND turno=1));")
 def worker(self,pool,name,sql):return pool.submit(self.run,'SET application_name='+lit(name)+";SET statement_timeout='25s';"+sql)
 def wait_blocked(self,name,blocker=None):
  deadline=time.monotonic()+10
  while time.monotonic()<deadline:
   rows=self.value("SELECT coalesce(jsonb_agg(jsonb_build_object('pid',pid,'type',wait_event_type,'event',wait_event,'blocking',pg_blocking_pids(pid))),'[]') FROM pg_stat_activity WHERE datname=current_database() AND application_name="+lit(name)+';')
   if rows and rows[0]['blocking']:
    if blocker is None:return rows[0]
    pids=self.value('SELECT coalesce(jsonb_agg(pid),\'[]\') FROM pg_stat_activity WHERE datname=current_database() AND application_name='+lit(blocker)+';')
    if any(pid in rows[0]['blocking'] for pid in pids):return rows[0]
   time.sleep(.05)
  raise AssertionError('No verified lock wait: '+name)

class Container:
 def __init__(self):
  self.env=os.environ.copy()
  for key in list(self.env):
   if key.startswith('PG') or key in ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']:self.env.pop(key,None)
  self.docker=['docker','--host=unix:///var/run/docker.sock'];self.container='qa-incorporar-'+uuid.uuid4().hex[:12]
  self.started=False
 def __enter__(self):
  # __exit__ is not called if setup raises. Mark the uniquely named container
  # for cleanup before docker run, which can fail after creating it.
  self.started=True
  try:
   subprocess.run(self.docker+['run','-d','--rm','--network','none','--name',self.container,'-e','POSTGRES_HOST_AUTH_METHOD=trust',IMAGE],env=self.env,check=True,capture_output=True,text=True)
   deadline=time.monotonic()+35
   while time.monotonic()<deadline:
    ready=subprocess.run(self.docker+['exec',self.container,'pg_isready','-U','postgres'],env=self.env,capture_output=True)
    logs=subprocess.run(self.docker+['logs',self.container],env=self.env,capture_output=True,text=True)
    if ready.returncode==0 and 'PostgreSQL init process complete' in logs.stdout:break
    time.sleep(.1)
   else:raise RuntimeError('Ephemeral PostgreSQL did not start')
   result=subprocess.run(self.docker+['exec','-i',self.container,'psql','-X','-qAt','-U','postgres','-v','ON_ERROR_STOP=1'],env=self.env,input='SHOW server_version_num;CREATE DATABASE qa_template;',text=True,capture_output=True,check=True)
   assert 170000<=int(result.stdout.splitlines()[0])<180000,result.stdout
   db=Database(self,'qa_template');fixture=(HERE/'fixture.sql').read_text();manifest=json.loads((HERE/'fixture-manifest.json').read_text())
   assert hashlib.sha256(fixture.encode()).hexdigest()==manifest['fixture_sha256']
   db.sql(fixture);db.sql((ROOT/'docs/sql-proposals/lp01-incorporar/01_incorporar_REVIEW.sql').read_text())
   assert db.sql('SELECT incorporar_ensamble FROM sgp_lp_operacion.config WHERE id')=='f'
   # Explicitly synthetic feature activation. The proposed installer remains false.
   db.sql('UPDATE sgp_lp_operacion.config SET incorporar_ensamble=true WHERE id')
   self.version=db.sql('SELECT version()');return self
  except BaseException as error:
   try:self.close()
   except Exception as cleanup_error:error.add_note('Container cleanup failed: '+str(cleanup_error))
   raise
 def case(self,name):
  db=Database(self,'qa_'+name)
  subprocess.run(self.docker+['exec','-i',self.container,'psql','-X','-qAt','-U','postgres','-v','ON_ERROR_STOP=1'],env=self.env,input='CREATE DATABASE '+db.name+' TEMPLATE qa_template;',text=True,capture_output=True,check=True)
  return db
 def close(self):
  if not self.started:return
  subprocess.run(self.docker+['rm','-f',self.container],env=self.env,capture_output=True,text=True,timeout=15,check=True)
  self.started=False
 def __exit__(self,exc_type,error,traceback):
  try:self.close()
  except Exception as cleanup_error:
   if error is None:raise
   error.add_note('Container cleanup failed: '+str(cleanup_error))
  return False

GATE="BEGIN;SELECT pg_advisory_xact_lock(hashtextextended('ENSAMBLE|PANELES_2',184));"
def run_cases(container):
 checks=[]
 with cf.ThreadPoolExecutor(max_workers=5) as pool:
  db=container.case('cas');before=db.counts()
  with Session(db,'qa_gate') as gate:
   gate.execute(GATE);a=db.worker(pool,'qa_a',call(cmd()));b=db.worker(pool,'qa_b',call(cmd('QA-B|PANELES_2')))
   db.wait_blocked('qa_a','qa_gate');db.wait_blocked('qa_b','qa_gate');gate.execute('COMMIT;')
   outcomes=[a.result(timeout=30),b.result(timeout=30)];assert sum(x.returncode==0 for x in outcomes)==1
   success(next(x for x in outcomes if x.returncode==0));denied(next(x for x in outcomes if x.returncode!=0),'CONFLICTO_REVISION_TURNO')
  assert db.counts()==dict(before,orders=1,audit=1,plan=before['plan']+1,revision=1)
  checks.append('Two admitted concurrent INCORPORAR requests on different keys/same CAS: exactly one commits, other conflicts; no partial loser effects')
  db=container.case('same_request');request=cmd()
  with Session(db,'qa_gate') as gate:
   gate.execute(GATE);a=db.worker(pool,'qa_a',call(request));db.wait_blocked('qa_a','qa_gate');b=db.worker(pool,'qa_b',call(request));db.wait_blocked('qa_b','qa_a');gate.execute('COMMIT;')
   first=success(a.result(timeout=30));second=success(b.result(timeout=30));assert second.get('duplicate') is True and first['part']==second['part']
  assert db.counts()['orders']==db.counts()['audit']==1
  checks.append('Concurrent identical request is serialized by request mutex and returns one durable result, not two assignments')
  for kind,query in [('programar',"SELECT public.sgp_linea_plan_programar('coordinator','OTHER|PANELES_2','2026-11-07',1,1,5);"),('mover',"SELECT public.sgp_linea_plan_mover('coordinator','00000000-0000-0000-0000-000000000001','2026-11-08',1,3,4);")]:
   db=container.case(kind);before=db.state();request=cmd()
   with Session(db,'qa_planner') as planner:
    planner.execute('BEGIN;SET ROLE anon;'+query)
    rejected=db.worker(pool,'qa_enroll',call(request)).result(timeout=8);denied(rejected,'PROGRAMACION_EN_ACTUALIZACION_RECONSULTAR');assert db.state()==before
    planner.execute('ROLLBACK;')
   assert db.state()==before;success(db.run(call(request)))
   checks.append('Real captured '+kind+' holds source write lock: NOWAIT rejection has zero effects; retry after source rollback succeeds')
  # Revocation committed before admission must be seen after the blocked read resumes.
  db=container.case('revoke_before');before=db.state()
  with Session(db,'qa_revoker') as revoker:
   revoker.execute("BEGIN;UPDATE public.sgp_usuario_accesos SET permitido=false WHERE id_usuario=(SELECT id_usuario FROM public.sgp_usuarios WHERE usuario='leader');")
   pending=db.worker(pool,'qa_enroll',call(cmd()));db.wait_blocked('qa_enroll','qa_revoker');revoker.execute('COMMIT;');denied(pending.result(timeout=30),'AMBITO')
  assert db.state()==before;checks.append('Request waiting behind native access revocation resumes denied after revocation commits, with no business effects')
  # An admitted request holds authorization locks until commit; revocation waits it out.
  db=container.case('revoke_admitted')
  with Session(db,'qa_gate') as gate:
   gate.execute(GATE);pending=db.worker(pool,'qa_enroll',call(cmd()));db.wait_blocked('qa_enroll','qa_gate')
   revoke=db.worker(pool,'qa_revoker',"UPDATE public.sgp_usuario_accesos SET permitido=false WHERE id_usuario=(SELECT id_usuario FROM public.sgp_usuarios WHERE usuario='leader');")
   db.wait_blocked('qa_revoker','qa_enroll');gate.execute('COMMIT;');success(pending.result(timeout=30));assert revoke.result(timeout=30).returncode==0
  denied(db.run(call(cmd('QA-B|PANELES_2',revision=1,turn_revision=1))),'AMBITO');assert db.counts()['audit']==1
  checks.append('Revocation after admission waits existing authorization locks; admitted request may commit, subsequent request is denied (no claim of cancelling inflight work)')
  db=container.case('flag_before');before=db.state()
  with Session(db,'qa_container') as holder:
   holder.execute('BEGIN;UPDATE sgp_lp_operacion.config SET incorporar_ensamble=false WHERE id;')
   pending=db.worker(pool,'qa_enroll',call(cmd()));db.wait_blocked('qa_enroll','qa_container');holder.execute('COMMIT;');denied(pending.result(timeout=30),'INCORPORAR_NO_HABILITADO')
  assert db.state()==before;checks.append('Feature flag committed false while request waits for admission prevents enrollment without partial effects')
  db=container.case('flag_admitted');request=cmd()
  with Session(db,'qa_gate') as gate:
   gate.execute(GATE);pending=db.worker(pool,'qa_enroll',call(request));db.wait_blocked('qa_enroll','qa_gate')
   contain=db.worker(pool,'qa_container','UPDATE sgp_lp_operacion.config SET incorporar_ensamble=false WHERE id;');db.wait_blocked('qa_container','qa_enroll')
   gate.execute('COMMIT;');success(pending.result(timeout=30));assert contain.result(timeout=30).returncode==0
  denied(db.run(call(cmd('QA-B|PANELES_2',revision=1,turn_revision=1))),'INCORPORAR_NO_HABILITADO')
  receipt=db.value('SELECT public.sgp_lp_operacion_resultado(\'leader\','+lit(request['id'])+');');assert receipt['committed'] is True and db.counts()['audit']==1
  checks.append('Containment drains already admitted request, blocks later enrollment and preserves its authorized receipt')
  db=container.case('atomic_failure');before=db.state()
  db.sql("CREATE FUNCTION public.qa_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'QA_FORCED_AUDIT_FAILURE';END $$;CREATE TRIGGER qa_failure BEFORE INSERT ON sgp_lp_operacion.auditoria FOR EACH ROW EXECUTE FUNCTION public.qa_fail_audit();")
  denied(db.run(call(cmd())),'QA_FORCED_AUDIT_FAILURE');assert db.state()==before
  checks.append('Injected final audit failure rolls back inserted planner root, LP row and turn revision together')
 return checks

def main():
 report={'status':'NOT_RUN','engine':IMAGE,'results':[],'safety':'Local disposable Docker container; --network none; no ports/mounts; no DB URL or production credentials accepted.'}
 code=2
 if not shutil.which('docker'):report['reason']='docker executable unavailable; PostgreSQL17 concurrency cases were not run'
 else:
  container=Container()
  try:
   with container:
    results=run_cases(container);report.update(status='PASS',engine=container.version,groups=len(results),results=results);code=0
  except Exception as error:
   report.update(status='FAILED',reason=str(error),cleanupNotes=getattr(error,'__notes__',[]));code=1
 OUT.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2));return code
if __name__=='__main__':sys.exit(main())
