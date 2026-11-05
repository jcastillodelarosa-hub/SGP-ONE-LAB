"""Real isolated locks: temporal expiry regression and serialized session revocation."""
import importlib.util,json,subprocess,time,uuid,sys,hashlib
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
HERE=Path(__file__).parent
spec=importlib.util.spec_from_file_location('atomic_fixture',HERE/'atomic.py');a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
def wait_for(db,query,timeout=10):
 end=time.monotonic()+timeout
 while time.monotonic()<end:
  if db.sql(query)=='t':return
  time.sleep(.04)
 raise AssertionError('Expected database condition not observed')
def holder(db,lock):
 p=subprocess.Popen(db.docker+['exec','-i',db.container,'psql','-d',getattr(db,'database','postgres'),'-X','-qAt','-U','postgres','-v','ON_ERROR_STOP=1'],env=db.env,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,bufsize=1)
 p.stdin.write('BEGIN;'+lock+";SELECT 'HELD';\n");p.stdin.flush()
 while p.stdout.readline().strip()!='HELD':
  if p.poll() is not None:raise AssertionError(p.stderr.read())
 return p
def release(p):
 p.stdin.write('COMMIT;\\q\n');p.stdin.flush();p.wait(timeout=10);assert p.returncode==0

def run(x,vulnerable=False):
 db=x.db;db.sql('UPDATE sgp_lp_afectaciones.config SET writes=true');snapshot=x.legacy();checks=[]
 for point in ['stage','receipt','reader']:
  # No production rows or modified dependency bodies; actual supported temporal mode.
  db.sql('UPDATE sgp_lp_operacion.perfil_roles SET habilitado=true')
  rid=str(uuid.uuid4());q=x.reconcile_query(snapshot,[],uid=rid)
  if point=='receipt':db.sql(q)
  if point=='reader':q="SET ROLE anon;SELECT public.sgp_lp_afectaciones_legado_v1('COORDINADOR',"+a.lit(x.key)+",'ENSAMBLE')"
  db.sql('UPDATE sgp_lp_operacion.perfil_roles SET habilitado=false;DELETE FROM sgp_lp_operacion.permisos;INSERT INTO sgp_lp_operacion.permisos(usuario,etapa,key,valid_from,valid_until,duty) VALUES(\'COORDINADOR\',\'ENSAMBLE\','+a.lit(x.key)+",clock_timestamp()-interval '1 day',clock_timestamp()+interval '3 seconds','PRIMARY')")
  before=db.sql('SELECT count(*) FROM sgp_lp_afectaciones.conciliaciones_audit')
  lock="SELECT pg_advisory_xact_lock(hashtextextended('ENSAMBLE|PANELES_2',184))" if point=='stage' else 'SELECT pg_advisory_xact_lock(hashtextextended('+a.lit(rid)+',383))'
  if point=='reader':lock="SELECT 1 FROM public.sgp_producciones WHERE key_produccion="+a.lit(x.key)+" FOR UPDATE"
  held=holder(db,lock)
  try:
   with ThreadPoolExecutor(1) as pool:
    task=pool.submit(db.run,"SET application_name='qa_conciliation_wait';SET statement_timeout='15s';"+q)
    wait_for(db,"SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='qa_conciliation_wait' AND wait_event IN('advisory','transactionid'))")
    wait_for(db,"SELECT bool_and(valid_until<clock_timestamp()) FROM sgp_lp_operacion.permisos")
    release(held);held=None;result=task.result(timeout=10)
   if vulnerable:
    assert result.returncode==0,result.stderr
    if point=='stage':assert int(db.sql('SELECT count(*) FROM sgp_lp_afectaciones.conciliaciones_audit'))==int(before)+1
    elif point=='receipt':assert json.loads(result.stdout)['duplicate']
    else:assert json.loads(result.stdout)['contract']=='LP-AFFECTATIONS-LEGACY-1'
   else:
    assert result.returncode and 'AMBITO_DENEGADO' in result.stderr,result.stderr
    assert db.sql('SELECT count(*) FROM sgp_lp_afectaciones.conciliaciones_audit')==before
   checks.append({'wait':point,'expiredPermission':True,'outcome':'baseline accepted expired scope' if vulnerable else 'denied with no audit write or receipt disclosure'})
  finally:
   if held:release(held)
 # Actual session revocation is serialized by existing SHARE locks, even before fix.
 db.sql('UPDATE sgp_lp_operacion.perfil_roles SET habilitado=true')
 q=x.reconcile_query(snapshot,[]);held=holder(db,"SELECT pg_advisory_xact_lock(hashtextextended('ENSAMBLE|PANELES_2',184))")
 try:
  with ThreadPoolExecutor(1) as pool:
   task=pool.submit(db.run,"SET application_name='qa_revoke_wait';SET statement_timeout='15s';"+q)
   wait_for(db,"SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='qa_revoke_wait' AND wait_event='advisory')")
   revoke="UPDATE public.sgp_sesiones_app SET revocado_en=clock_timestamp() WHERE token_hash=encode(extensions.digest('COORDINADOR','sha256'),'hex')"
   attempt=db.run("SET lock_timeout='150ms';"+revoke);assert attempt.returncode and 'lock timeout' in attempt.stderr
   release(held);held=None;result=task.result(timeout=10);assert result.returncode==0,result.stderr
  db.sql(revoke);assert db.run(q).returncode
  checks.append({'revocation':'serialized during wait; committed afterward; retry denied'})
 finally:
  if held:release(held)
 return checks
if __name__=='__main__':
 vulnerable='--expect-vulnerable' in sys.argv
 baseline='77f3f8c'
 source='docs/sql-proposals/lp01-afectaciones/04_conciliacion_REVIEW.sql'
 sql=subprocess.check_output(['git','show',baseline+':'+source],cwd=a.ROOT,text=True) if vulnerable else (a.ROOT/source).read_text()
 x=a.Fixture(reconciliation_sql=sql)
 try:
  out={'status':'BASELINE_REPRODUCED' if vulnerable else 'PASS','environment':'PostgreSQL17.11 network none synthetic only','baselineCommit':baseline if vulnerable else None,'sqlSha256':hashlib.sha256(sql.encode()).hexdigest(),'checks':run(x,vulnerable)}
  (HERE/('revocation-baseline.json' if vulnerable else 'revocation-result.json')).write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out))
 finally:x.close()
