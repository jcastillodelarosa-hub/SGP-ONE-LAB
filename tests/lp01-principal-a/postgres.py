"""Alternative A design only: actual local PG logins, shared ABRIR, synthetic data.
No password/TLS/pooler or productive Supabase authentication is certified here.
"""
from pathlib import Path
import importlib.util, json, uuid, subprocess, threading, hashlib
from concurrent.futures import ThreadPoolExecutor
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1]
spec=importlib.util.spec_from_file_location('opening_helpers',ROOT/'tests/lp01-apertura/postgres.py')
h=importlib.util.module_from_spec(spec);spec.loader.exec_module(h)
lit=h.lit;OUT=HERE/'evidence'
class Database(h.Database):
 # Historic Sunday/Monday keep due-time tests independent of today's early shift.
 def cmd(self,op,**kw):return super().cmd(op,**{'date':'2026-10-25',**kw})
 def seed(self,key,**kw):return super().seed(key,**{'date':'2026-10-25',**kw})
 def snapshot(self,stage='ENSAMBLE',date='2026-10-25',shift=1,**kw):return super().snapshot(stage,date,shift,**kw)
WORKER='qa_lp_a_worker';OTHER='qa_lp_a_other'
def uid():return str(uuid.uuid4())
def role_run(db,q,user=WORKER):
 return subprocess.run(db.docker+['exec','-i',db.container,'psql','-X','-qAt','-U',user,'-d','postgres','-v','ON_ERROR_STOP=1'],env=db.env,input=q,text=True,capture_output=True)
def role_sql(db,q,user=WORKER):
 r=role_run(db,q,user);assert r.returncode==0,r.stderr;return r.stdout.strip()
def denied(db,q,code,user=WORKER):
 r=role_run(db,q,user);assert r.returncode!=0 and code in r.stderr,(code,r.stdout,r.stderr)
def call(req,attempt=None):return 'SELECT lp_a_api.open('+lit(json.dumps(req))+'::jsonb,'+lit(attempt or uid())+'::uuid);'
def execute(db,req,attempt=None):return json.loads(role_sql(db,call(req,attempt)))
def blocked(db,req,code):
 r=execute(db,req);assert not r['ok'] and r['status']=='BLOCKED' and r['code']==code,r;return r

def verify_projection():
 src=(ROOT/'docs/sql-proposals/lp01-operacion/01_operacion_REVIEW.sql').read_text()
 branch=src[src.index('   -- Whole-turn incorporation'):src.index("  ELSIF op='REABRIR'")]
 for key in ['a.key_produccion','a.key']:
  branch=branch.replace('NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.permisos q WHERE q.usuario=u AND q.etapa=et AND q.key='+key+')','NOT lp_a_review.scope_ok(actor,et,'+key+',line_id)')
 ref=(ROOT/'docs/linea-produccion/principal-a/shared-reference.sql').read_text()
 actual=ref.split('-- BEGIN EXISTING ABRIR BRANCH (only permission predicates projected to actor-aware checks)\n')[1].split('-- END EXISTING ABRIR BRANCH')[0]
 assert actual==branch,'Shared source branch drifted: review required'
 return hashlib.sha256(branch.encode()).hexdigest()

def setup(db):
 ref=(ROOT/'docs/linea-produccion/principal-a/shared-reference.sql').read_text()
 # Guard refusal is tested before any marker or local role exists.
 r=db.run(ref);assert r.returncode and 'ISOLATED_DESIGN_ONLY' in r.stderr
 assert db.sql("SELECT to_regnamespace('lp_a_api') IS NULL")=='t'
 db.sql("CREATE TABLE public.qa_lp_a_synthetic_marker(id boolean);REVOKE TEMP ON DATABASE postgres FROM PUBLIC;REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;")
 # Passwordless local trust is confined to this --network none throwaway container.
 # These DDL/GRANTs are FIXTURES, NEVER a productive installation script.
 for role in [WORKER,OTHER]:
  db.sql('CREATE ROLE '+role+' LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION CONNECTION LIMIT 4;')
 db.sql("SET sgp.lp_a_design='synthetic-only';"+ref)
 db.sql('GRANT USAGE ON SCHEMA lp_a_api TO '+WORKER+','+OTHER+",anon,authenticated;GRANT EXECUTE ON FUNCTION lp_a_api.plan(text,text),lp_a_api.open(jsonb,uuid),lp_a_api.receipt(uuid) TO "+WORKER+','+OTHER+';GRANT EXECUTE ON FUNCTION lp_a_api.human_open(text,jsonb) TO anon,authenticated;')
 db.sql("INSERT INTO lp_a_review.principals SELECT oid,rolname,true,true,now()+interval '1 day' FROM pg_roles WHERE rolname="+lit(WORKER))

def scope(db,key,stage=None):
 stages=[stage] if stage else ['ENSAMBLE','EMPAQUE']
 for st in stages:db.sql('INSERT INTO lp_a_review.scopes SELECT r.oid,'+lit(st)+',p.id_linea,p.key_produccion,true FROM pg_roles r CROSS JOIN public.sgp_producciones p WHERE r.rolname='+lit(WORKER)+' AND p.key_produccion='+lit(key))
def human_open(db,**ctx):
 cmd=db.cmd('ABRIR',**ctx)
 return json.loads(db.sql('SET ROLE anon;SELECT lp_a_api.human_open(\'COORDINADOR\','+lit(json.dumps(cmd))+'::jsonb);'))
def intent(db,stage='ENSAMBLE',line='PANELES_2'):
 plan=json.loads(role_sql(db,'SELECT lp_a_api.plan('+lit(line)+','+lit(stage)+');'))
 # Existing deterministic preparer remains read-only. Binding occurs ONLY in this test.
 i=h.prepare(plan)['intents'][0]
 assert not i['canExecute'] and i['mode']=='PREPARATION_ONLY'
 return {**i['command'],'expected':{k:i['reference'][k] for k in ['previousClose','previousVersion','start','end']}}
def manual_request(db,stage='ENSAMBLE',line='PANELES_2',date='2026-10-25',shift=2):
 return dict(id=uid(),op='ABRIR',stage=stage,line=line,date=date,shift=shift,revision=0,expected={})
def race(db,commands):
 gate=threading.Barrier(len(commands))
 def one(c):gate.wait();return execute(db,c)
 with ThreadPoolExecutor(len(commands)) as pool:return list(pool.map(one,commands))
def worker_session(db):
 return subprocess.Popen(db.docker+['exec','-i',db.container,'psql','-X','-qAt','-U',WORKER,'-d','postgres','-v','ON_ERROR_STOP=1'],env=db.env,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,bufsize=1)

def tests(db):
 checks=[];projection=verify_projection();setup(db)
 key='QA-FUTURE|PANELES_2';db.seed(key,parts=(1,),date='2026-11-20');scope(db,key)
 assert role_sql(db,'SELECT session_user,current_user')==WORKER+'|'+WORKER
 assert db.sql("SELECT NOT(rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication OR rolinherit) AND rolcanlogin FROM pg_roles WHERE rolname="+lit(WORKER))=='t'
 assert db.sql('SELECT lp_a_review.perimeter_ok('+lit(WORKER)+'::regrole::oid)')=='t'
 db.sql('GRANT EXECUTE ON FUNCTION lp_a_api.human_open(text,jsonb) TO '+WORKER)
 denied(db,"SELECT lp_a_api.plan('PANELES_2','ENSAMBLE')",'PUBLIC_PRIVILEGE_PERIMETER_UNSAFE')
 denied(db,"SELECT lp_a_api.human_open('COORDINADOR',"+lit(json.dumps(db.cmd('ABRIR',revision=0)))+"::jsonb)",'HUMAN_FACADE_DENIES_TECHNICAL_SESSION')
 db.sql('REVOKE EXECUTE ON FUNCTION lp_a_api.human_open(text,jsonb) FROM '+WORKER)
 for q in ["SELECT * FROM public.sgp_producciones","SELECT * FROM lp_a_review.events","SELECT lp_a_review.core_open('{}','{}')","SELECT lp_a_api.human_open('COORDINADOR','{}')","SELECT public.sgp_lp_operacion_comando('COORDINADOR','{}')","SET ROLE postgres","SET ROLE anon","SET SESSION AUTHORIZATION postgres","CREATE SCHEMA qa_forbidden","CREATE TEMP TABLE qa_forbidden(id int)"]:denied(db,q,'permission denied')
 denied(db,"SELECT lp_a_api.plan('PANELES_2','ENSAMBLE')",'TECHNICAL_SESSION_DENIED',OTHER)
 db.sql('ALTER ROLE '+WORKER+' INHERIT')
 denied(db,"SELECT lp_a_api.plan('PANELES_2','ENSAMBLE')",'TECHNICAL_SESSION_DENIED')
 db.sql('ALTER ROLE '+WORKER+' NOINHERIT;GRANT anon TO '+WORKER)
 denied(db,"SELECT lp_a_api.plan('PANELES_2','ENSAMBLE')",'TECHNICAL_SESSION_DENIED')
 db.sql('REVOKE anon FROM '+WORKER)
 r=db.run("SET ROLE "+WORKER+";SELECT lp_a_api.plan('PANELES_2','ENSAMBLE')");assert r.returncode and 'TECHNICAL_SESSION_DENIED' in r.stderr
 spoof="SET request.jwt.claims='{"+'"role":"COORDINADOR"'+"}';SET sgp.actor='COORDINADOR';SELECT lp_a_api.plan('FRAMES_2','ENSAMBLE');"
 denied(db,spoof,'TECHNICAL_SCOPE_DENIED')
 for op in ['CERRAR','REABRIR','SALE','EJECUTAR','IMPORTAR_BI','AFECTAR','VALIDAR','LIBERAR']:
  denied(db,call({**manual_request(db),'op':op}),'ONLY_ABRIR_REQUEST_ALLOWED')
 for extra in [{'token':'COORDINADOR'},{'actor':{'kind':'HUMAN'}},{'capacity':288},{'role':'COORDINADOR'}]:denied(db,call({**manual_request(db),**extra}),'ONLY_ABRIR_REQUEST_ALLOWED')
 r=db.run("SET ROLE anon;SELECT lp_a_api.human_open('LIDER',"+lit(json.dumps(db.cmd('ABRIR')))+"::jsonb)");assert r.returncode and 'REQUIERE_COORDINADOR' in r.stderr
 blocked(db,manual_request(db),'MANUAL_BOOTSTRAP_REQUIRED')
 checks.append('Actual dedicated session_user login, restricted attributes and separate human SGP authorization; table/core/human RPC/SET ROLE and all non-ABRIR commands denied; forged JSON/GUC do not confer authority')

 human_open(db,revision=0)
 blocked(db,manual_request(db),'TURNO_ORIGEN_REQUIERE_CIERRE')
 h.close_empty(db)
 req=intent(db);attempt=uid();first=execute(db,req,attempt);assert first['ok'] and first['status']=='OPENED' and first['actorKind']=='TECHNICAL',first
 assert execute(db,req,attempt)['duplicateAttempt']
 assert execute(db,req)['duplicate']
 denied(db,call({**req,'revision':1}),'IDEMPOTENCIA_REUTILIZADA')
 denied(db,call({**req,'id':uid()},attempt),'ATTEMPT_REUSED')
 assert db.sql('SELECT count(*) FROM sgp_lp_operacion.auditoria WHERE id='+lit(req['id']))=='1'
 assert db.sql('SELECT usuario LIKE \'TECH_DB:%\' AND respuesta->>\'actorKind\'=\'TECHNICAL\' FROM sgp_lp_operacion.auditoria WHERE id='+lit(req['id']))=='t'
 assert json.loads(role_sql(db,'SELECT lp_a_api.receipt('+lit(req['id'])+');'))['response']['duplicate']
 checks.append('Valid SIN ACTIVIDAD predecessor and existing deterministic intent open exactly once; request/attempt binding, immutable actorKind/OID audit and own receipt recover retries without coordinator impersonation')

 # New next-turn intent; race different requests for the same turn.
 h.close_empty(db,shift=2);req=intent(db)
 results=race(db,[req,{**req,'id':uid()}]);assert sorted(x['status'] for x in results)==['EXISTING_REQUIRES_RECONCILIATION','OPENED'],results
 assert db.sql("SELECT count(*) FROM sgp_lp_operacion.turnos WHERE etapa='ENSAMBLE' AND linea='PANELES_2' AND fecha='2026-10-26' AND turno=1")=='1'
 h.close_empty(db,date='2026-10-26');req=intent(db)
 results=race(db,[req,req]);assert all(x['status']=='OPENED' for x in results) and sum(x['duplicate'] for x in results)==1
 checks.append('Real concurrent distinct/identical request sessions serialize on the existing line/stage mutex: one opening, no reinclusion on an existing turn, repeat returns committed result')

 # New scope/stage, four existing LP roots. Existing closure uses QA CSV for evidence,
 # actual versioned close/ABRIR functions; this is not an XLSX parser test.
 parts=db.seed('QA-CARRY|PANELES_2');scope(db,'QA-CARRY|PANELES_2')
 source=db.sql('SELECT jsonb_agg(to_jsonb(p) ORDER BY key_produccion) FROM public.sgp_producciones p')
 plan=db.sql('SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM public.sgp_linea_plan_asignaciones p')
 human_open(db,stage='EMPAQUE',revision=0,capacity=288)
 for part,n in zip(parts,[90,90,90,18]):db.execute(db.cmd('SALE',stage='EMPAQUE',key='QA-CARRY|PANELES_2',part=part,quantity=n,observation='QA decisión explícita coordinador'))
 db.execute(db.cmd('EJECUTAR',stage='EMPAQUE',key='QA-CARRY|PANELES_2',part=parts[0],quantity=20,observation='QA avance original'),'LIDER')
 db.execute(db.cmd('AFECTAR',stage='EMPAQUE',key='QA-CARRY|PANELES_2',part=parts[1],affectations={'NC_AL':3,'NC_V':2,'TECNO':0,'NOVEDAD':0},observation='QA conservar afectaciones'),'LIDER')
 h.h.h.close_turn(db,stage='EMPAQUE',date='2026-10-25')
 original=db.snapshot('EMPAQUE')['orders'];req=intent(db,stage='EMPAQUE');res=execute(db,req);assert res['status']=='OPENED',res
 carried=db.snapshot('EMPAQUE',shift=2)['orders'];assert len(carried)==4 and {x['parte'] for x in carried}==set(parts)
 for row in carried:
  old=next(x for x in original if x['parte']==row['parte'])
  assert row['ejecutado']==0 and row['antiguedad_fecha']==old['antiguedad_fecha'] and row['antiguedad_turno']==old['antiguedad_turno']
  assert row['afectaciones']==old['afectaciones'] and row['contexto_origen']['ejecutado']==old['ejecutado']
 assert all(x['sale'] is None and x['sale_estado']=='REPARTO_COORDINADOR_REQUERIDO' for x in carried)
 assert db.snapshot('EMPAQUE')['orders']==original
 assert source==db.sql('SELECT jsonb_agg(to_jsonb(p) ORDER BY key_produccion) FROM public.sgp_producciones p')
 assert plan==db.sql('SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM public.sgp_linea_plan_asignaciones p')
 checks.append('Same ABRIR/SALE source branch carries 288=90+90+90+18 roots/age/affectations and prior context without duplicating 20 executed; Empaque needs coordinator capacity rather than invented repartition; plan and Export sources unchanged')

 # Invalid close and explicit recovery in a separate physical line.
 fk='QA-FRAME|FRAMES_2';db.seed(fk,parts=(1,),date='2026-11-20');db.sql("UPDATE public.sgp_producciones SET id_linea='FRAMES_2' WHERE key_produccion="+lit(fk));scope(db,fk)
 human_open(db,stage='EMPAQUE',line='FRAMES_2',revision=0)
 db.sql("UPDATE sgp_lp_operacion.turnos SET estado='CERRADO' WHERE etapa='EMPAQUE' AND linea='FRAMES_2'") # Intentionally corrupt synthetic setup.
 bad=manual_request(db,stage='EMPAQUE',line='FRAMES_2');blocked(db,bad,'CIERRE_ORIGEN_NO_ACREDITADO')
 db.execute(db.cmd('REABRIR',stage='EMPAQUE',line='FRAMES_2',observation='QA recuperación manual de estado sintético'));h.close_empty(db,stage='EMPAQUE',line='FRAMES_2')
 good=intent(db,stage='EMPAQUE',line='FRAMES_2');blocked(db,{**good,'id':uid(),'expected':{**good['expected'],'previousVersion':-1}},'STALE_OPENING_INTENT')
 db.execute(db.cmd('REABRIR',stage='EMPAQUE',line='FRAMES_2',observation='QA invalida intención preparada'))
 blocked(db,good,'TURNO_ORIGEN_REQUIERE_CIERRE');h.close_empty(db,stage='EMPAQUE',line='FRAMES_2')
 blocked(db,good,'STALE_OPENING_INTENT');good=intent(db,stage='EMPAQUE',line='FRAMES_2')
 # Explicit abort after a successful engine result: neither effects nor intent/event survive.
 result=role_run(db,'BEGIN;'+call(good)+"SELECT 1/0;COMMIT;");assert result.returncode
 assert db.sql('SELECT count(*) FROM lp_a_review.intents WHERE id='+lit(good['id']))=='0'
 assert db.sql("SELECT count(*) FROM sgp_lp_operacion.turnos WHERE etapa='EMPAQUE' AND linea='FRAMES_2' AND turno=2")=='0'
 assert execute(db,good)['status']=='OPENED'
 receipt=json.loads(role_sql(db,'SELECT lp_a_api.receipt('+lit(good['id'])+');'));assert receipt['found'] and receipt['response']['status']=='OPENED'
 assert db.sql('SELECT count(*) FROM lp_a_review.events WHERE request='+lit(bad['id']))=='1'
 assert db.sql('SELECT bool_and(role_name='+lit(WORKER)+') FROM lp_a_review.events')=='t'
 checks.append('Closed flag alone, reopened predecessor and stale version fail inside transaction with durable BLOCKED events; valid manual recovery creates a new intent; transaction abort leaves no intent/opening/event and committed lost response recovers by receipt')

 # Coordinator reopening and technical opening share the exact existing stage mutex.
 h.close_empty(db,stage='EMPAQUE',line='FRAMES_2',shift=2)
 stale=intent(db,stage='EMPAQUE',line='FRAMES_2')
 reopen=db.cmd('REABRIR',stage='EMPAQUE',line='FRAMES_2',shift=2,observation='QA carrera de reapertura autorizada')
 owner=h.h.h.session(db);h.h.h.send(owner,'BEGIN;SET LOCAL ROLE anon;'+db.call('COORDINADOR',reopen)+"SELECT 'REOPENED';");h.h.h.marker(owner,'REOPENED')
 with ThreadPoolExecutor(1) as pool:
  pending=pool.submit(role_run,db,"SET application_name='qa-a-reopening';"+call(stale))
  h.h.h.wait_lock(db,'qa-a-reopening');h.h.h.finish(owner);r=pending.result(timeout=10)
 assert r.returncode==0 and json.loads(r.stdout)['code']=='TURNO_ORIGEN_REQUIERE_CIERRE',r.stderr
 h.close_empty(db,stage='EMPAQUE',line='FRAMES_2',shift=2)
 assert execute(db,intent(db,stage='EMPAQUE',line='FRAMES_2'))['status']=='OPENED'
 checks.append('Actual coordinator REABRIR first holds the shared stage mutex; waiting technical open sees committed EN_REVISION and records a block; reclose/new deterministic intent safely recovers')

 # Full production scope is mandatory; partial scope never silently drops a root.
 # Current ENSAMBLE successor will carry QA-CARRY only after incorporating it manually.
 db.sql('INSERT INTO public.sgp_linea_plan_asignaciones VALUES('+lit(uid())+",'QA-CARRY|PANELES_2','2026-10-26',2,1,1,'PROGRAMADA',"+lit(parts[0])+');')
 db.execute(db.cmd('ABRIR',date='2026-10-26',shift=2))
 db.execute(db.cmd('SALE',date='2026-10-26',shift=2,key='QA-CARRY|PANELES_2',part=parts[0],quantity=90,observation='QA validación explícita antes del cierre'))
 h.h.h.close_turn(db,date='2026-10-26',shift=2)
 denied_req=intent(db)
 db.sql("UPDATE lp_a_review.scopes SET active=false WHERE key='QA-CARRY|PANELES_2' AND stage='ENSAMBLE'")
 blocked(db,denied_req,'INCORPORACION_FUERA_DE_AMBITO')
 db.sql("UPDATE lp_a_review.scopes SET active=true WHERE key='QA-CARRY|PANELES_2' AND stage='ENSAMBLE'")
 # Hold a real successful technical transaction and prove emergency admission drains it.
 owner=worker_session(db);h.h.h.send(owner,'BEGIN;'+call(denied_req)+"SELECT 'ADMITTED';");h.h.h.marker(owner,'ADMITTED')
 with ThreadPoolExecutor(1) as pool:
  pending=pool.submit(db.run,"SET application_name='qa-a-stop';UPDATE lp_a_review.principals SET allow_open=false WHERE role_name='"+WORKER+"';")
  h.h.h.wait_lock(db,'qa-a-stop');h.h.h.finish(owner);assert pending.result(timeout=10).returncode==0
 denied(db,call(denied_req),'TECHNICAL_ADMISSION_DISABLED')
 assert json.loads(role_sql(db,'SELECT lp_a_api.receipt('+lit(denied_req['id'])+');'))['found']
 db.sql("UPDATE lp_a_review.principals SET allow_open=true WHERE role_name='"+WORKER+"'")
 db.sql("UPDATE lp_a_review.scopes SET active=false WHERE key='QA-CARRY|PANELES_2' AND stage='ENSAMBLE'")
 denied(db,'SELECT lp_a_api.receipt('+lit(denied_req['id'])+');','TECHNICAL_SCOPE_DENIED')
 denied(db,call(denied_req),'TECHNICAL_SCOPE_DENIED')
 db.sql("UPDATE lp_a_review.scopes SET active=true WHERE key='QA-CARRY|PANELES_2' AND stage='ENSAMBLE'")
 db.sql("UPDATE lp_a_review.principals SET expires_at=now()-interval '1 minute' WHERE role_name='"+WORKER+"'")
 denied(db,call(denied_req),'TECHNICAL_ADMISSION_DISABLED');db.sql("UPDATE lp_a_review.principals SET expires_at=now()+interval '1 day' WHERE role_name='"+WORKER+"'")
 db.sql('UPDATE sgp_lp_operacion.config SET escrituras=false WHERE id')
 n=db.sql('SELECT count(*) FROM lp_a_review.events');denied(db,call(denied_req),'ESCRITURA_NO_HABILITADA');assert n==db.sql('SELECT count(*) FROM lp_a_review.events')
 assert json.loads(role_sql(db,'SELECT lp_a_api.receipt('+lit(denied_req['id'])+');'))['found']
 db.sql('UPDATE sgp_lp_operacion.config SET escrituras=true WHERE id')
 checks.append('All productions required, partial scope rejected; registered principal expiry and scope revocation enforced on retries/receipts; admission revocation waits in-flight transaction, blocks new writes after commit and preserves authorized receipts; global containment causes zero event writes')

 # Perimeter counterexample: implicit PUBLIC privilege survives NOINHERIT and direct REVOKE.
 # Synthetic harmless function only; never execute a real SGP data function.
 db.sql("CREATE FUNCTION public.sgp_qa_public_probe() RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$SELECT 'QA_ONLY'::text$$;REVOKE EXECUTE ON FUNCTION public.sgp_qa_public_probe() FROM "+WORKER)
 assert role_sql(db,'SELECT public.sgp_qa_public_probe()')=='QA_ONLY'
 denied(db,"SELECT lp_a_api.plan('PANELES_2','ENSAMBLE')",'PUBLIC_PRIVILEGE_PERIMETER_UNSAFE')
 db.sql('REVOKE EXECUTE ON FUNCTION public.sgp_qa_public_probe() FROM PUBLIC')
 db.sql('GRANT TEMP ON DATABASE postgres TO PUBLIC;REVOKE TEMP ON DATABASE postgres FROM '+WORKER)
 assert role_sql(db,"SELECT has_database_privilege(session_user,current_database(),'TEMP')")=='t'
 denied(db,"SELECT lp_a_api.plan('PANELES_2','ENSAMBLE')",'PUBLIC_PRIVILEGE_PERIMETER_UNSAFE')
 db.sql('REVOKE TEMP ON DATABASE postgres FROM PUBLIC')
 assert db.sql('SELECT lp_a_review.perimeter_ok('+lit(WORKER)+'::regrole::oid)')=='t'
 assert db.run("UPDATE lp_a_review.events SET result='{}' WHERE request="+lit(good['id'])).returncode
 assert db.run('DELETE FROM lp_a_review.intents WHERE id='+lit(good['id'])).returncode
 assert db.sql("SELECT bool_and(relrowsecurity) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='lp_a_review' AND c.relkind='r'")=='t'
 checks.append('Actual NOINHERIT/PUBLIC counterexample: direct role REVOKE cannot deny inherited callable SECURITY DEFINER or TEMP; new gate fails closed on drift; events/intents immutable and RLS enabled')

 # Configured future shift is never opened early by a forged observedAt or client clock.
 human_open(db,line='FRAMES_2',date='2099-11-01',shift=1,revision=0)
 h.close_empty(db,line='FRAMES_2',date='2099-11-01')
 p=json.loads(role_sql(db,"SELECT lp_a_api.plan('FRAMES_2','ENSAMBLE')"))
 closed=p['anchor']['close'];future=manual_request(db,line='FRAMES_2',date=p['target']['date'],shift=p['target']['shift'])
 future['expected']={'previousClose':closed['id'],'previousVersion':closed['version'],'start':p['target']['start'],'end':p['target']['end']}
 blocked(db,future,'OPENING_NOT_DUE')
 # No technical scope on another stage is inferred from a valid line scope.
 db.sql("UPDATE lp_a_review.scopes SET active=false WHERE key="+lit(fk)+" AND stage='EMPAQUE'")
 denied(db,"SELECT lp_a_api.plan('FRAMES_2','EMPAQUE')",'TECHNICAL_SCOPE_DENIED')
 checks.append('Server configured clock blocks a valid future intent; line authorization does not imply another stage or production')
 out={'status':'PASS_ISOLATED_DESIGN_ONLY','postgres':db.sql('SHOW server_version'),'checks':checks,'shared_branch_sha256':projection,'productive_authentication':'NOT_TESTED_NO_PRINCIPAL_OR_CREDENTIAL_CREATED','productive_viability':'BLOCKED_PUBLIC_PRIVILEGE_PERIMETER','runtime_changed':False,'scope':'Fresh PG17.11 --network none, actual passwordless local synthetic LOGIN roles/session_user, captured SGP session and actual ABRIR incorporation/closure helpers. No TLS, pooler, managed custom role authentication or productive behavior certified.'}
 (OUT/'postgres.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
if __name__=='__main__':
 db=Database()
 try:tests(db)
 finally:db.close()
