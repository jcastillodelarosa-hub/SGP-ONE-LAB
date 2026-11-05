"""Native PostgreSQL synthetic contract tests; no production connections."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import sys,json,uuid
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'tests/lp01-afectaciones-rpc'));import atomic as f
x=f.Fixture();checks=[]
try:
 db=x.db;db.sql((ROOT/'docs/sql-proposals/lp01-afectaciones/13_all_origins_read_REVIEW.sql').read_text());db.sql((ROOT/'docs/sql-proposals/lp01-order-sale/01_definition_REVIEW.sql').read_text())
 signatures=['public.sgp_lp_sale_orden_consultar_v1(text,text,text)','public.sgp_lp_sale_orden_definir_v1(text,text,text,jsonb)']
 for role in ['anon','authenticated','service_role']:
  for sig in signatures:assert db.sql('SELECT has_function_privilege('+f.lit(role)+','+f.lit(sig)+",'EXECUTE')")=='f'
 db.sql('GRANT EXECUTE ON FUNCTION '+','.join(signatures)+' TO anon') # Synthetic test only.
 def read(user='COORDINADOR',stage='ENSAMBLE',key=x.key):
  return json.loads(db.sql('SET ROLE anon;SELECT public.sgp_lp_sale_orden_consultar_v1('+','.join(map(f.lit,[user,key,stage]))+')'))
 def command(quantity=8,user='COORDINADOR',stage='ENSAMBLE'):
  d=read(user,stage);return {'id':str(uuid.uuid4()),'quantity':quantity,'revision':d['revision'],'sourceFingerprint':d['source']['fingerprint'],'observation':'QA definición por orden'}
 def query(cmd,user='COORDINADOR',stage='ENSAMBLE',key=x.key):return 'SET ROLE anon;SELECT public.sgp_lp_sale_orden_definir_v1('+','.join(map(f.lit,[user,key,stage]))+','+f.lit(json.dumps(cmd))+'::jsonb)'
 def save(cmd,**kw):return json.loads(db.sql(query(cmd,**kw)))
 def denied(cmd,reason,**kw):
  r=db.run(query(cmd,**kw));assert r.returncode and reason in r.stderr,(reason,r.stderr)
 assert read()['quantity'] is None and read()['revision']==0 and read()['history']==[]
 denied(command(),'SALE_ORDER_DEFINITIONS_DISABLED')
 db.sql('UPDATE sgp_lp_sale_orden.config SET definitions_enabled=true')
 denied(command(),'SALE_ORDER_AVAILABILITY_PENDING')
 db.sql('DELETE FROM sgp_lp_operacion.ordenes;DELETE FROM public.sgp_linea_plan_asignaciones;UPDATE sgp_lp_afectaciones.config SET writes=true')
 for stage in ['ENSAMBLE','EMPAQUE']:
  legacy=json.loads(db.sql("SET ROLE anon;SELECT public.sgp_lp_afectaciones_legado_v1('COORDINADOR','QA|PANELES_2',"+f.lit(stage)+")"))
  db.sql("SET ROLE anon;SELECT public.sgp_lp_afectaciones_conciliar_v1('COORDINADOR','QA|PANELES_2',"+f.lit(stage)+","+f.lit(str(uuid.uuid4()))+","+f.lit(legacy['fingerprint'])+","+str(legacy['revision'])+",'[]'::jsonb,'QA no legacy sources')")
  x.run(x.command('VALIDATE',0,user='COORDINADOR',stage=stage),user='COORDINADOR',stage=stage)

 initial=read();assert initial['source']['available']==288 and 'DEFINE' in initial['capabilities']
 first=command();receipt=save(first);assert receipt['quantity']==8 and receipt['operational'] is False and receipt['temporalPolicy']=='UNRESOLVED'
 assert save(first)['duplicate'] is True and len(read()['history'])==1
 db.sql("UPDATE public.sgp_usuarios SET rol='LIDER LINEA' WHERE usuario='COORDINADOR'")
 denied(first,'LP_ROL_ETAPA_DENEGADO') # Native role gate rejects before explicit retry check.
 assert db.sql('SELECT count(*) FROM sgp_lp_sale_orden.eventos')=='1'
 db.sql("UPDATE public.sgp_usuarios SET rol='COORDINADOR' WHERE usuario='COORDINADOR'")
 assert save(first)['duplicate'] is True and len(read()['history'])==1
 denied({**first,'quantity':9},'SALE_ORDER_IDEMPOTENCY_REUSED')
 denied({**first,'id':str(uuid.uuid4())},'SALE_ORDER_REVISION_STALE')
 for user in ['ll','se','sp','invalid']:
  assert db.run(query(command(),user=user)).returncode
 assert db.run("SET ROLE anon;SELECT * FROM sgp_lp_sale_orden.eventos").returncode
 for extra in [{'turn':1},{'assignment':'fake'},{'date':'2026-11-01'},{'quantity':-1},{'quantity':1.5}]:denied({**command(),**extra},'SALE_ORDER_COMMAND_INVALID')
 denied(command(289),'SALE_ORDER_EXCEEDS_AVAILABLE')
 assert save(command(10,user='QAADMIN'),user='QAADMIN')['quantity']==10
 assert save(command(4,stage='EMPAQUE'),stage='EMPAQUE')['quantity']==4
 assert read()['quantity']==10 and read(stage='EMPAQUE')['quantity']==4
 assert read('se')['quantity']==10 and 'DEFINE' not in read('se')['capabilities']
 assert db.run("SET ROLE anon;SELECT public.sgp_lp_sale_orden_consultar_v1('sp','QA|PANELES_2','ENSAMBLE')").returncode
 stale=command();db.sql("UPDATE public.sgp_producciones SET ultima_vez_export=clock_timestamp() WHERE key_produccion='QA|PANELES_2'");denied(stale,'SALE_ORDER_SOURCE_STALE')
 candidates=[command(11),command(12)]
 with ThreadPoolExecutor(2) as pool:races=list(pool.map(lambda c:db.run(query(c)),candidates))
 assert sorted(r.returncode==0 for r in races)==[False,True] and any('SALE_ORDER_REVISION_STALE' in r.stderr for r in races)
 same=command(13)
 with ThreadPoolExecutor(2) as pool:receipts=list(pool.map(lambda _:save(same),range(2)))
 assert sorted(r['duplicate'] for r in receipts)==[False,True]
 before=read();db.sql("CREATE FUNCTION public.qa_sale_fail() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'QA_SALE_AUDIT_FAIL';END $$;CREATE TRIGGER qa_sale_fail BEFORE INSERT ON sgp_lp_sale_orden.eventos FOR EACH ROW EXECUTE FUNCTION public.qa_sale_fail()")
 denied(command(14),'QA_SALE_AUDIT_FAIL');assert read()==before
 db.sql('DROP TRIGGER qa_sale_fail ON sgp_lp_sale_orden.eventos;DROP FUNCTION public.qa_sale_fail()')
 assert db.run("UPDATE sgp_lp_sale_orden.eventos SET observacion='rewrite'").returncode
 assert db.run('DELETE FROM sgp_lp_sale_orden.eventos').returncode
 assert db.sql('SELECT count(*) FROM public.sgp_linea_plan_asignaciones')=='0' and db.sql('SELECT count(*) FROM sgp_lp_operacion.ordenes')=='0'
 assert db.sql("SELECT saldo_ensamble FROM public.sgp_producciones WHERE key_produccion='QA|PANELES_2'")=='288'
 # Persist a native payload for browser integration, never a production fixture.
 (Path(__file__).parent/'native-read.json').write_text(json.dumps(read(),indent=2)+'\n')
 import time
 def blocked(name):
  deadline=time.monotonic()+10
  while time.monotonic()<deadline:
   if db.sql("SELECT count(*) FROM pg_stat_activity WHERE application_name="+f.lit(name)+" AND state='active' AND wait_event IS NOT NULL")!='0':return
   time.sleep(.03)
  raise AssertionError('Missing blocked session '+name)
 admin_cmd=command(15,user='QAADMIN')
 db.sql("UPDATE public.sgp_sesiones_app SET expira_en=clock_timestamp()+interval '2 seconds' WHERE id_usuario=(SELECT id_usuario FROM public.sgp_usuarios WHERE usuario='qaadmin')")
 with ThreadPoolExecutor(3) as pool:
  holder=pool.submit(db.sql,"SET application_name='qa-sale-holder';BEGIN;SELECT 1 FROM public.sgp_producciones WHERE key_produccion='QA|PANELES_2' FOR UPDATE;SELECT pg_sleep(4);COMMIT")
  blocked('qa-sale-holder');writer=pool.submit(db.run,"SET application_name='qa-sale-writer';"+query(admin_cmd,user='QAADMIN'));blocked('qa-sale-writer')
  revoker=pool.submit(db.sql,"SET application_name='qa-sale-revoke';UPDATE public.sgp_sesiones_app SET revocado_en=clock_timestamp() WHERE id_usuario=(SELECT id_usuario FROM public.sgp_usuarios WHERE usuario='qaadmin')");blocked('qa-sale-revoke');assert not revoker.done()
  holder.result();expired_write=writer.result();assert expired_write.returncode and 'SALE_ORDER_SESSION_EXPIRED' in expired_write.stderr,expired_write.stderr;revoker.result()
 assert db.sql("SELECT expira_en<clock_timestamp() FROM public.sgp_sesiones_app WHERE id_usuario=(SELECT id_usuario FROM public.sgp_usuarios WHERE usuario='qaadmin')")=='t' # expired during the admitted write
 assert db.sql('SELECT count(*) FROM sgp_lp_sale_orden.eventos WHERE id='+f.lit(admin_cmd['id'])+'::uuid')=='0'
 assert db.run(query(admin_cmd,user='QAADMIN')).returncode
 retry=command(15);save(retry);db.sql("UPDATE public.sgp_sesiones_app SET revocado_en=clock_timestamp() WHERE id_usuario=(SELECT id_usuario FROM public.sgp_usuarios WHERE usuario='COORDINADOR')")
 assert db.run(query(retry)).returncode
 result={'status':'PASS','environment':'isolated native PostgreSQL synthetic only','noDefaultExecute':True,'disabledByDefault':True,'coordinatorAdminOnlyWrite':True,'scopedLeaderRead':True,'unassignedOrderPersistence':True,'stageSeparation':True,'validatedAvailabilityRequired':True,'sourceRevisionChecked':True,'idempotencyAndConcurrentCAS':True,'auditFailureRollsBack':True,'immutableHistory':True,'revocationRejectsRetry':True,'concurrentRevocationSerialized':True,'roleDowngradeDenied':True,'expiredDuringWaitRejectedByWallClock':True,'noExportTurnAssignmentWrites':True,'operational':False,'temporalPolicy':'UNRESOLVED'}
 (Path(__file__).parent/'result.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
finally:x.close()
