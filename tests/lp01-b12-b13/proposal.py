"""Private B12 proposal contract: native LP/PDT chain, synthetic PostgreSQL only."""
from pathlib import Path
import sys,json,uuid
from concurrent.futures import ThreadPoolExecutor
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'tests/lp01-afectaciones-rpc'))
from current_chain import Fixture,lit
x=Fixture();db=x.db;checks=[]
def query(c=None,user='ll'):
 return 'SET ROLE anon;SELECT public.sgp_lp_propuesta_v1('+','.join([lit(user),lit(x.key),lit('PANELES_2'),lit('2026-11-01'),'1','NULL' if c is None else lit(json.dumps(c))+'::jsonb'])+')'
def cmd(n=6,revision=0):return dict(id=str(uuid.uuid4()),quantity=n,revision=revision,observation='QA proposal')
def call(c=None,user='ll'):return json.loads(db.sql(query(c,user)))
def deny(c,code,user='ll'):
 r=db.run(query(c,user));assert r.returncode and code in r.stderr,(code,r.stderr)
try:
 db.sql((ROOT/'docs/sql-proposals/lp01-propuestas/01_propuesta_REVIEW.sql').read_text())
 assert db.run(query()).returncode
 assert db.sql("SELECT count(*) FROM information_schema.routine_privileges WHERE routine_name='sgp_lp_propuesta_v1' AND grantee IN('PUBLIC','anon','authenticated','service_role')")=='0'
 db.sql('GRANT EXECUTE ON FUNCTION public.sgp_lp_propuesta_v1(text,text,text,date,int,jsonb) TO anon') # Isolated test only, never installation.
 assert not call()['canWrite'];deny(cmd(),'PROPUESTA_NO_HABILITADA')
 db.sql('UPDATE sgp_lp_propuestas.config SET enabled=true')
 deny(cmd(),'DISPONIBILIDAD_NO_ACREDITADA');assert call()['available'] is None
 db.sql('UPDATE sgp_lp_afectaciones.config SET writes=true')
 snapshot=x.legacy();assert snapshot["sources"]==[];db.sql(x.reconcile_query(snapshot,[]))
 x.run(x.command('VALIDATE',0,user='COORDINADOR'),user='COORDINADOR')
 before=db.sql('SELECT jsonb_agg(to_jsonb(x)) FROM sgp_lp_operacion.ordenes x')
 export=db.sql('SELECT jsonb_agg(to_jsonb(x)) FROM public.sgp_producciones x')
 c=cmd();first=call(c);assert first['quantity']==6 and first['target']['shift']==2
 assert call(c)['duplicate'];deny({**c,'quantity':7},'IDEMPOTENCIA_REUTILIZADA')
 call(cmd(8,1));assert [h['quantity'] for h in call()['history']]==[8,6]
 deny(cmd(9,1),'CONFLICTO_REVISION_PROPUESTA');deny(cmd(289,2),'DISPONIBILIDAD_NO_ACREDITADA')
 candidates=[cmd(10,2),cmd(11,2)]
 with ThreadPoolExecutor(2) as pool:results=list(pool.map(lambda c:db.run(query(c)),candidates))
 assert sorted(r.returncode==0 for r in results)==[False,True]
 assert db.run(query(user='invalid')).returncode
 assert db.run(query(cmd(1,3),user='sp')).returncode
 assert db.run('SET ROLE anon;SELECT * FROM sgp_lp_propuestas.eventos').returncode
 assert db.run("UPDATE sgp_lp_propuestas.eventos SET usuario='rewrite'").returncode
 assert before==db.sql('SELECT jsonb_agg(to_jsonb(x)) FROM sgp_lp_operacion.ordenes x')
 assert export==db.sql('SELECT jsonb_agg(to_jsonb(x)) FROM public.sgp_producciones x')
 count=db.sql('SELECT count(*) FROM sgp_lp_propuestas.eventos');db.sql('BEGIN;'+query(cmd(12,3))+';ROLLBACK;');assert count==db.sql('SELECT count(*) FROM sgp_lp_propuestas.eventos')
 db.sql("UPDATE public.sgp_producciones SET saldo_ensamble=287 WHERE key_produccion="+lit(x.key));deny(cmd(1,3),'DISPONIBILIDAD_NO_ACREDITADA')
 # Native authorization SHARE locks serialize access revocation during a write.
 import time
 with ThreadPoolExecutor(2) as pool:
  lock=pool.submit(db.run,"BEGIN;SELECT pg_advisory_xact_lock(hashtextextended('ENSAMBLE|PANELES_2',184));SELECT pg_sleep(3);COMMIT")
  for _ in range(100):
   if db.sql("SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND wait_event='PgSleep'")!='0':break
   time.sleep(.02)
  waiting=pool.submit(db.run,query(cmd(1,3)))
  for _ in range(100):
   if db.sql("SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND wait_event='advisory'")!='0':break
   time.sleep(.02)
  else:raise AssertionError('Writer did not wait on native line lock')
  revoke="UPDATE public.sgp_usuario_accesos SET permitido=false WHERE id_usuario=(SELECT id_usuario FROM public.sgp_usuarios WHERE usuario='ll')"
  blocked=db.run("SET lock_timeout='150ms';"+revoke);assert blocked.returncode and 'lock timeout' in blocked.stderr,blocked.stderr
  assert lock.result().returncode==0
  assert waiting.result().returncode # Availability is stale, so no proposal can commit.
 db.sql(revoke)
 rejected=db.run(query(cmd(1,3)));assert rejected.returncode and 'DISPONIBILIDAD_NO_ACREDITADA' not in rejected.stderr,rejected.stderr
 assert count==db.sql('SELECT count(*) FROM sgp_lp_propuestas.eventos')
 checks=['No default EXECUTE/table grants; disabled admission','Unvalidated availability stays unknown and rejects proposal','Native next-turn calendar; order-level proposal with immutable 6→8 history','Idempotency, stale CAS, concurrent writer, invalid session and wrong stage rejected','SALE/Export unchanged; transactional rollback; stale consolidation denied','Native permission revocation serialized during lock wait; subsequent access rejected; no new event']
 (ROOT/'tests/lp01-b12-b13/proposal-result.json').write_text(json.dumps({'status':'PASS','environment':'PostgreSQL isolated native chain, synthetic only','checks':checks},indent=2)+'\n');print(json.dumps(checks))
finally:x.close()
