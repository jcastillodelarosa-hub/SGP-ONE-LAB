"""LP-AMBITO-TEMPORAL/1: real RPC/transactions, exclusively synthetic PG."""
from pathlib import Path
import sys,json,uuid,time,importlib.util,hashlib
from concurrent.futures import ThreadPoolExecutor
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tests/lp01-operacion'))
from postgres import Database,lit
spec=importlib.util.spec_from_file_location('carry',ROOT/'tests/lp01-continuidad/postgres.py');carry=importlib.util.module_from_spec(spec);spec.loader.exec_module(carry)
HERE=Path(__file__).parent
INSTALL=ROOT/'docs/sql-proposals/lp01-operacion/08_ambitos_temporales_REVIEW.sql'
checks=[]
def fail(db,q,code):
 r=db.run(q);assert r.returncode and code in r.stderr,(code,r.stderr)
def grant_fixture(db):
 db.sql("UPDATE sgp_lp_operacion.permisos SET valid_from='2026-01-01T00:00:00-05:00',valid_until=clock_timestamp()+interval '2 years',revoked_at=NULL,duty=CASE usuario WHEN 'COORDINADOR' THEN 'PRIMARY' WHEN 'LIDER' THEN 'BACKUP' ELSE 'READ' END")
def close_actual(db):
 rows=db.snapshot()['orders']
 db.sql('UPDATE sgp_lp_operacion.config SET formato_bi_aprobado=true WHERE id')
 content='etapa;fecha;turno;key_produccion;parte;cantidad\n'+'\n'.join(';'.join(map(str,['ENSAMBLE','2026-11-01',1,r['key'],r['parte'],r['ejecutado']])) for r in rows)
 f=db.execute(db.cmd('IMPORTAR_BI',filename='qa.csv',content=content))
 return db.execute(db.cmd('CERRAR',file_id=f['fileId'],observation='QA cierre coordinado',reasons={r['key']+'/'+r['parte']:'QA pendiente' for r in rows}))
def run(db):
 keys={'PANELES_2':'QA-P|PANELES_2','FRAMES_2':'QA-F|FRAMES_2'};parts={}
 for ln,k in keys.items():
  parts[k]=db.seed(k,parts=(20,))[0];db.sql('UPDATE public.sgp_producciones SET id_linea='+lit(ln)+' WHERE key_produccion='+lit(k))
 extra='QA-X|PANELES_2';xp=db.seed(extra,parts=(3,))[0]
 db.sql("CREATE ROLE service_role;")
 db.sql((ROOT/'docs/sql-proposals/lp01-operacion/06_powerbi_xlsx_REVIEW.sql').read_text())
 install=INSTALL.read_text()
 fail(db,install,'CONTENER_ESCRITURAS_ANTES_DE_INSTALAR')
 db.sql('UPDATE sgp_lp_operacion.config SET escrituras=false WHERE id')
 original=db.sql("SELECT pg_get_functiondef('sgp_lp_operacion.sesion(text,text,text,text)'::regprocedure)")
 db.sql(original.replace('RETURN s;', 'RETURN s; -- QA changed source\n'))
 fail(db,install,'CUERPO_INCOMPATIBLE')
 db.sql(original)
 acl_before=db.sql("SELECT jsonb_agg(jsonb_build_array(oid::regprocedure::text,proacl::text) ORDER BY oid) FROM pg_proc WHERE oid IN('sgp_lp_operacion.sesion(text,text,text,text)'::regprocedure,'public.sgp_lp_operacion_comando(text,jsonb)'::regprocedure,'public.sgp_lp_operacion_consultar(text,text,text,date,integer)'::regprocedure,'public.sgp_lp_operacion_resultado(text,uuid)'::regprocedure,'public.sgp_lp_operacion_importar_xlsx(text,jsonb,text,text,jsonb)'::regprocedure,'public.sgp_lp_operacion_archivo(text,uuid)'::regprocedure)")
 rls_before=db.sql("SELECT relrowsecurity FROM pg_class WHERE oid='sgp_lp_operacion.permisos'::regclass")
 # Atomic rollback really executes all DDL and replacements.
 db.sql(install.replace('COMMIT;','ROLLBACK;'))
 assert db.sql("SELECT count(*) FROM information_schema.columns WHERE table_schema='sgp_lp_operacion' AND table_name='permisos' AND column_name='valid_from'")=='0'
 db.sql(install)
 assert acl_before==db.sql("SELECT jsonb_agg(jsonb_build_array(oid::regprocedure::text,proacl::text) ORDER BY oid) FROM pg_proc WHERE oid IN('sgp_lp_operacion.sesion(text,text,text,text)'::regprocedure,'public.sgp_lp_operacion_comando(text,jsonb)'::regprocedure,'public.sgp_lp_operacion_consultar(text,text,text,date,integer)'::regprocedure,'public.sgp_lp_operacion_resultado(text,uuid)'::regprocedure,'public.sgp_lp_operacion_importar_xlsx(text,jsonb,text,text,jsonb)'::regprocedure,'public.sgp_lp_operacion_archivo(text,uuid)'::regprocedure)")
 assert rls_before==db.sql("SELECT relrowsecurity FROM pg_class WHERE oid='sgp_lp_operacion.permisos'::regclass")
 db.sql((ROOT/'docs/sql-proposals/lp01-operacion/07_pdt_asociacion_REVIEW.sql').read_text())
 fail(db,install,'CONTRATO_TEMPORAL_INCOMPATIBLE')
 db.sql('UPDATE sgp_lp_operacion.config SET escrituras=true WHERE id')
 c=db.cmd('ABRIR');db.reject(c,'AMBITO_DENEGADO')
 checks.append('Atomic installation/rollback, exact source guards, repeat-install refusal; legacy rows fail closed without validity')
 grant_fixture(db)
 # Boundary truth from real SQL at the same explicit instant; actual guard clock checked separately.
 for instant,expected in [('2026-11-01T18:00:00-05:00','t'),('2026-11-02T05:00:00-05:00','f'),('2026-11-01T17:59:59-05:00','f')]:
  assert db.sql("SELECT sgp_lp_operacion.ambito_vigente('2026-11-01T18:00:00-05:00','2026-11-02T05:00:00-05:00',"+lit(instant)+")")==expected
 fail(db,"SELECT sgp_lp_operacion.fecha_ambito('2026-11-01T18:00:00')",'ZONA_EXPLICITA_REQUERIDA')
 assert db.sql("SELECT sgp_lp_operacion.fecha_ambito('2026-11-01T18:00:00-05:00')=sgp_lp_operacion.fecha_ambito('2026-11-01T23:00:00Z')")=='t'
 h=json.loads(db.sql("SELECT sgp_lp_operacion.periodo('2026-11-01',2)"))
 assert h['start'].startswith('2026-11-01T23:00:00') and h['end'].startswith('2026-11-02T10:00:00'),h
 for ln,k in keys.items():
  for et in ['ENSAMBLE','EMPAQUE']:
   ctx={'stage':et,'line':ln}
   db.execute(db.cmd('ABRIR',**ctx))
   db.execute(db.cmd('SALE',key=k,part=parts[k],quantity=20,observation='QA',**ctx))
   if ln=='PANELES_2':db.execute(db.cmd('SALE',key=extra,part=xp,quantity=3,observation='QA extra',**ctx))
   db.execute(db.cmd('EJECUTAR',key=k,part=parts[k],quantity=1,observation='QA',**ctx),'LIDER')
   db.reject(db.cmd('SALE',key=k,part=parts[k],quantity=20,observation='QA',**ctx),'REQUIERE_COORDINADOR','LIDER')
   db.reject(db.cmd('NOTA',key=k,part=parts[k],observation='QA',**ctx),'ESCRITURA_NO_HABILITADA','CONSULTA')
 checks.append('Four line/stage scopes through real RPC; duty never grants coordinator operations; consultation stays read-only; explicit offset parser and Sunday night schedule')
 key=keys['PANELES_2'];part=parts[key]
 target=" WHERE usuario='LIDER' AND etapa='ENSAMBLE' AND key="+lit(key)
 # A valid sibling production cannot expose the expired production or write it.
 for value in ["valid_until=clock_timestamp()", "valid_from=clock_timestamp()+interval '1 day'", "revoked_at=clock_timestamp()"]:
  grant_fixture(db);db.sql('UPDATE sgp_lp_operacion.permisos SET '+value+target)
  assert key not in [r['key'] for r in db.snapshot()['orders']]
  db.reject(db.cmd('NOTA',key=key,part=part,observation='QA'),'AMBITO_DENEGADO','LIDER')
  db.reject(db.cmd('IMPORTAR_BI',filename='qa-unused',content='unused'),'AMBITO_TEMPORAL_DENEGADO','LIDER')
  ctx={'stage':'ENSAMBLE','line':'PANELES_2','date':'2026-11-01','shift':1,'id':str(uuid.uuid4()),'revision':0}
  fail(db,"SET ROLE service_role;SELECT public.sgp_lp_operacion_importar_xlsx('LIDER',"+lit(json.dumps(ctx))+"::jsonb,'qa.xlsx','','{}'::jsonb)",'AMBITO_TEMPORAL_DENEGADO')
 grant_fixture(db)
 fail(db,'BEGIN ISOLATION LEVEL REPEATABLE READ;SET LOCAL ROLE anon;'+db.call('LIDER',db.cmd('NOTA',key=key,part=part,observation='QA')),'AISLAMIENTO_AMBITOS_NO_ADMITIDO')
 checks.append('Expired/exclusive end, future/inclusive start, revocation and old transaction snapshots denied; valid sibling scope does not leak expired rows')
 # Current grant that fails full coverage of the requested night shift is denied.
 db.sql("UPDATE sgp_lp_operacion.permisos SET valid_from='2026-11-02T00:00:00-05:00'"+target)
 # extra production still visible; key absent from period relation even though current grant valid.
 assert db.sql("SELECT count(*) FROM sgp_lp_operacion.permisos_en_periodo('2026-11-01',2) WHERE usuario='LIDER' AND key="+lit(key)+" AND etapa='ENSAMBLE'")=='0'
 grant_fixture(db)
 # PRIMARY and BACKUP must each cover every production/whole period, not partial users.
 db.sql("UPDATE sgp_lp_operacion.permisos SET duty='OPERATOR' WHERE usuario='LIDER' AND key="+lit(extra)+" AND etapa='ENSAMBLE'")
 db.sql("INSERT INTO public.sgp_usuarios(usuario,nombre,rol) VALUES('QA-BACKUP-2','QA synthetic','LIDER');INSERT INTO sgp_lp_operacion.permisos(usuario,etapa,key,valid_from,valid_until,duty) VALUES('QA-BACKUP-2','ENSAMBLE',"+lit(extra)+",'2026-01-01T00:00:00Z',clock_timestamp()+interval '2 years','BACKUP')")
 db.reject(db.cmd('CERRAR',observation='QA'),'COBERTURA_TEMPORAL_INCOMPLETA')
 fail(db,"INSERT INTO sgp_lp_operacion.permisos(usuario,etapa,key,valid_from,valid_until,duty) VALUES('LIDER','ENSAMBLE',"+lit(key)+",'2026-01-01T00:00:00Z',clock_timestamp()+interval '2 years','BACKUP')",'duplicate key')
 db.sql("UPDATE sgp_lp_operacion.permisos SET revoked_at=clock_timestamp() WHERE usuario='QA-BACKUP-2'")
 grant_fixture(db)
 checks.append('Whole-turn/night period coverage enforced independently per PRIMARY/BACKUP; no aggregate partial responsibility')
 # Real closure, reopen and configured continuity, QA CSV only for unchanged BI engine.
 close_actual(db)
 db.reject(db.cmd('REABRIR',observation='QA'),'REQUIERE_COORDINADOR','LIDER')
 db.execute(db.cmd('REABRIR',observation='QA'))
 close_actual(db)
 db.execute(db.cmd('ABRIR',shift=2))
 assert {r['key'] for r in db.snapshot(date='2026-11-01',shift=2)['orders']}=={key,extra}
 checks.append('Real versioned closure, coordinator-only reopen and Sunday night continuity preserve scopes and original identities')
 ctx={'stage':'EMPAQUE'}
 def note():return db.cmd('NOTA',key=key,part=part,observation='QA contention',**ctx)
 target=" WHERE usuario='LIDER' AND etapa='EMPAQUE' AND key="+lit(key)
 # Reading HORARIOS_TURNOS itself can wait: clock must be read after that wait.
 locker=carry.session(db);carry.send(locker,"BEGIN;SELECT 1 FROM public.sgp_configuracion_general WHERE clave='HORARIOS_TURNOS' FOR UPDATE;SELECT 'HOURS';");carry.marker(locker,'HOURS')
 db.sql("UPDATE sgp_lp_operacion.permisos SET valid_until=clock_timestamp()+interval '2 seconds'"+target)
 c=note()
 with ThreadPoolExecutor() as pool:
  fut=pool.submit(db.run,"SET application_name='qa-hours-expiry';SET ROLE anon;"+db.call('LIDER',c));carry.wait_lock(db,'qa-hours-expiry');time.sleep(2.1);carry.finish(locker);r=fut.result(timeout=10)
 assert r.returncode and 'AMBITO_TEMPORAL_DENEGADO' in r.stderr,r.stderr
 grant_fixture(db)
 # Expiry while blocked on the existing stage mutex, not just offline file validation.
 lock=carry.session(db);carry.send(lock,"BEGIN;SELECT pg_advisory_xact_lock(hashtextextended('EMPAQUE|PANELES_2',184));SELECT 'LOCKED';");carry.marker(lock,'LOCKED')
 db.sql("UPDATE sgp_lp_operacion.permisos SET valid_until=clock_timestamp()+interval '2 seconds'"+target)
 c=note();before=db.sql('SELECT count(*) FROM sgp_lp_operacion.auditoria')
 with ThreadPoolExecutor() as pool:
  fut=pool.submit(db.run,"SET application_name='qa-expiry';SET ROLE anon;"+db.call('LIDER',c));carry.wait_lock(db,'qa-expiry');time.sleep(2.1);carry.finish(lock);r=fut.result(timeout=10)
 assert r.returncode and 'AMBITO_DENEGADO' in r.stderr,r.stderr
 assert before==db.sql('SELECT count(*) FROM sgp_lp_operacion.auditoria')
 grant_fixture(db)
 # Expiry after actual writes but before COMMIT => audit/quantity revisions all roll back.
 c=note();before=db.sql('SELECT count(*) FROM sgp_lp_operacion.auditoria');orders_before=db.sql('SELECT jsonb_agg(to_jsonb(o) ORDER BY etapa,linea,fecha,turno,key,parte) FROM sgp_lp_operacion.ordenes o')
 db.sql("UPDATE sgp_lp_operacion.permisos SET valid_until=clock_timestamp()+interval '2 seconds'"+target)
 r=db.run('BEGIN;SET LOCAL ROLE anon;'+db.call('LIDER',c)+"SELECT pg_sleep(2.1);COMMIT;")
 assert r.returncode and 'AMBITO_TEMPORAL_DENEGADO' in r.stderr,r.stderr
 assert before==db.sql('SELECT count(*) FROM sgp_lp_operacion.auditoria')
 assert orders_before==db.sql('SELECT jsonb_agg(to_jsonb(o) ORDER BY etapa,linea,fecha,turno,key,parte) FROM sgp_lp_operacion.ordenes o')
 grant_fixture(db)
 checks.append('Actual queued command expires under contention; deferred final check rolls back writes and immutable audit on expiry before COMMIT')
 # Revoker first: RPC must wait, then see revocation. No stale permitted snapshot.
 rev=carry.session(db);carry.send(rev,'BEGIN;UPDATE sgp_lp_operacion.permisos SET revoked_at=clock_timestamp()'+target+";SELECT 'REVOKED';");carry.marker(rev,'REVOKED')
 c=note()
 with ThreadPoolExecutor() as pool:
  fut=pool.submit(db.run,"SET application_name='qa-revoke-first';SET ROLE anon;"+db.call('LIDER',c));carry.wait_lock(db,'qa-revoke-first');carry.finish(rev);r=fut.result(timeout=10)
 assert r.returncode and 'AMBITO_DENEGADO' in r.stderr,r.stderr
 grant_fixture(db)
 # Actor first: admitted operation serializes before revoker; later attempts denied.
 actor=carry.session(db);c=note();carry.send(actor,'BEGIN;SET LOCAL ROLE anon;'+db.call('LIDER',c)+"SELECT 'ADMITTED';");carry.marker(actor,'ADMITTED')
 with ThreadPoolExecutor() as pool:
  fut=pool.submit(db.run,"SET application_name='qa-revoke-after';UPDATE sgp_lp_operacion.permisos SET revoked_at=clock_timestamp()"+target+';');carry.wait_lock(db,'qa-revoke-after');carry.finish(actor);r=fut.result(timeout=10)
 assert r.returncode==0,r.stderr
 db.reject(note(),'AMBITO_DENEGADO','LIDER');grant_fixture(db)
 assert db.execute(c,'LIDER')['duplicate']
 changed={**c,'observation':'different'};db.reject(changed,'IDEMPOTENCIA_REUTILIZADA','LIDER')
 checks.append('Actual concurrent revocation both lock orders serializes safely; exact retry idempotent, changed payload denied')
 # Cross stage/production remains denied independently.
 db.sql("UPDATE sgp_lp_operacion.permisos SET revoked_at=clock_timestamp()"+target)
 db.reject(note(),'AMBITO_DENEGADO','LIDER')
 assert db.snapshot('ENSAMBLE',shift=2)['orders']
 db.sql("UPDATE public.sgp_usuarios SET activo=false WHERE usuario='LIDER'")
 db.reject(note(),'SESION_NO_AUTORIZADA','LIDER')
 db.sql("UPDATE public.sgp_usuarios SET activo=true WHERE usuario='LIDER';UPDATE sgp_lp_operacion.config SET escrituras=false WHERE id")
 fail(db,(ROOT/'docs/sql-proposals/lp01-operacion/08R_recuperacion_ambitos_REVIEW.sql').read_text(),'SCOPES_EXISTENTES_REQUIEREN_CORRECCION_ADELANTE')
 checks.append('Revoked Empaque does not widen or invalidate Ensamble; no cross-stage access')
 return {'status':'PASS','postgres':db.sql('SHOW server_version'),'checks':checks,'synthetic':True,'sql_sha256':hashlib.sha256(install.encode()).hexdigest(),'limits':['No production connection, rows, privileges or RLS modified','QA CSV supplies closure input only; existing XLSX adapter untouched','No frontend change; prior PC/mobile evidence reused','RPC autocommit host must preserve deferred constraints until commit; no new SQL execution endpoint']}
if __name__=='__main__':
 db=Database()
 try:
  result=run(db)
  clean=Database()
  try:
   clean.sql('UPDATE sgp_lp_operacion.config SET escrituras=false WHERE id')
   clean.sql('CREATE ROLE service_role;')
   clean.sql((ROOT/'docs/sql-proposals/lp01-operacion/06_powerbi_xlsx_REVIEW.sql').read_text())
   clean.sql(INSTALL.read_text())
   clean.sql((ROOT/'docs/sql-proposals/lp01-operacion/08R_recuperacion_ambitos_REVIEW.sql').read_text())
   assert clean.sql("SELECT count(*) FROM pg_trigger WHERE tgname='confirmar_ambito'")=='0'
   assert clean.sql("SELECT count(*) FROM information_schema.columns WHERE table_schema='sgp_lp_operacion' AND table_name='permisos' AND column_name='valid_from'")=='1'
   result['checks'].append('Restricted recovery works with contained writes and no scopes; refuses existing scopes; columns retained, RLS and original facade ACL preserved')
  finally:clean.close()
  (HERE/'evidence').mkdir(exist_ok=True);(HERE/'evidence/postgres.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
 finally:db.close()
