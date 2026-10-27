"""Real networkless PostgreSQL17 sessions; SYNTHETIC source captures, not production.
Clone prior verified D2 database. Preserve previous evidence and all productive sources.
"""
import pathlib,subprocess,json,time,uuid,threading
from concurrent.futures import ThreadPoolExecutor
R=pathlib.Path(__file__).resolve().parents[2];E=R/'tests/linea-stage2d/evidence'
meta=json.loads(subprocess.check_output(['docker','inspect','sgp-pdt-qa-91']))[0]
assert meta['HostConfig']['NetworkMode']=='none' and not meta['HostConfig'].get('PortBindings')
base=(E/'database.txt').read_text().strip();assert base.startswith('sgp_linea_d2_qa_') and base.removeprefix('sgp_linea_d2_qa_').isdigit()
db='sgp_linea_d2q_qa_'+str(time.time_ns())
subprocess.run(['docker','exec','sgp-pdt-qa-91','createdb','-U','postgres','-T',base,db],check=True)
def run(q):return subprocess.run(['docker','exec','-i','sgp-pdt-qa-91','psql','-XqAt','-U','postgres','-d',db,'-v','ON_ERROR_STOP=1'],input=q,text=True,capture_output=True)
def sql(q):
 p=run(q);assert p.returncode==0,p.stderr;return p.stdout.strip()
def lit(s):return "'"+str(s).replace("'","''")+"'"
def js(x):return lit(json.dumps(x))+'::jsonb'
def uid():return str(uuid.uuid4())
def get(q):return json.loads(sql(q))
def fail(q,code):
 p=run(q);assert p.returncode and code in p.stderr,(code,p.stdout,p.stderr)
checks=[]
# The captured session function remains real; sessions/identities are synthetic.
session_hash=sql("SELECT md5(pg_get_functiondef('public.sgp_sesion_actual(text)'::regprocedure))")
old_available=sql("SELECT pg_get_functiondef('sgp_linea_b2.disponible(text)'::regprocedure)")
protected=sql("SELECT md5(string_agg(pg_get_functiondef(oid),'' ORDER BY oid)) FROM pg_proc WHERE pronamespace='public'::regnamespace")
install=(R/'docs/sql-proposals/linea-etapa2d/03_consolidated_quantities_REVIEW.sql').read_text()
fail(install.replace('COMMIT;','SELECT 1/0; COMMIT;'),'division by zero')
assert sql("SELECT to_regnamespace('sgp_linea_d2q') IS NULL")=='t'
assert sql("SELECT pg_get_functiondef('sgp_linea_b2.disponible(text)'::regprocedure)")==old_available
sql(install)
checks.append('PG17 install transactional: forced failure restores schema/functions; no public RPC bodies changed')
# QA-only routing; production reader registration remains empty/not proposed.
sql("CREATE FUNCTION qa_c2.pdt_d2q(k text) RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path='' AS $$BEGIN IF left(k,2)='Q-' THEN RETURN sgp_linea_d2q.impacto(k);END IF;RETURN qa_c2.pdt_d2(k);END$$;")
sql("UPDATE sgp_linea_c2.lectores SET firma='qa_c2.pdt_d2q(text)',huella=md5(pg_get_functiondef('qa_c2.pdt_d2q(text)'::regprocedure)),catalogo_huella=(SELECT md5(jsonb_build_object('owner',pg_get_userbyid(proowner),'acl',coalesce(proacl::text,'DEFAULT'),'definer',prosecdef,'config',proconfig)::text) FROM pg_proc WHERE oid='qa_c2.pdt_d2q(text)'::regprocedure) WHERE componente='PDT'")
# Add narrowly named synthetic users via existing captured session tables.
for user,role in [('QA-PICK','LIDER PICKING'),('QA-ASM','LIDER ENSAMBLE'),('QA-RECEP','RECEPCION')]:
 sql(f"INSERT INTO public.sgp_usuarios(id_usuario,usuario,nombre,rol,activo) VALUES(gen_random_uuid(),{lit(user)},{lit(user)},{lit(role)},true);INSERT INTO public.sgp_sesiones_app(id_usuario,token_hash,expira_en) SELECT id_usuario,encode(extensions.digest({lit(user)},'sha256'),'hex'),now()+interval '1 hour' FROM public.sgp_usuarios WHERE usuario={lit(user)}")
def lock(k):return f"SELECT revision FROM sgp_linea_b2.producciones WHERE key={lit(k)} FOR UPDATE;"
def change(k,q):return sql('BEGIN;'+lock(k)+f"SELECT sgp_linea_c2.notificar({lit(k)},'PDT');"+q+';COMMIT;')
def seed(k,basis='GROSS_REQUIRES_DEDUCTION',assembled=20,packed=0):
 sql(f"INSERT INTO public.sgp_producciones VALUES({lit(k)});INSERT INTO sgp_linea_b2.producciones(key) VALUES({lit(k)});")
 identity={'production':k,'line':'PANELES_2','part':'PART-'+k,'reserves':['R-MAIN','R-SHARED']}
 common={'production':k,'revision':'1','generation':1,'complete':True,'sourceRef':'QA/'+k,'identity':identity}
 ex={**common,'applied':True,'assembled':assembled,'packed':packed,'events':[],'loadId':'QA-load-'+k,'historyId':'QA-history-'+k}
 grants=[{'user':user,'stage':stage,'sourceRef':'QA-scope','sourceVersion':'1','validationRole':'PICKING' if user=='QA-PICK' else 'ENSAMBLE'} for user in ['COORDINADOR','LIDER','CONSULTA','QA-PICK','QA-ASM','QA-RECEP'] for stage in ['ENSAMBLE','EMPAQUE']]
 pe={**common,'grants':grants}
 for component,data in [('EXPORT',ex),('PERMISOS',pe)]:sql(f"INSERT INTO qa_c2.fuentes VALUES({lit(k)},{lit(component)},{js(data)})")
 ids=[uid(),uid()]
 sql(f"INSERT INTO public.sgp_aluminio_pendientes(id_pendiente,key_produccion,estado,cantidad,ventanas_afectadas) VALUES({lit(ids[0])},{lit(k)},'PENDIENTE',7,3),({lit(ids[1])},{lit(k)},'PENDIENTE',5,3)")
 pending=[{'id':i,'stage':'ENSAMBLE'} for i in ids] # overlaps unknown; NEVER sum3+3
 sql(f"INSERT INTO sgp_linea_d2q.fuentes VALUES({lit(k)},{js(identity)},1,20,{lit(basis)},true,{js(pending)},6,'{{\"reference\":\"QA composition estimate; overlap unresolved\"}}','QA-capture/{k}')")
 sql(f"INSERT INTO public.qa_produccion_reservas VALUES({lit(k)},{lit('PROD-'+k)},'R-SHARED','R-MAIN',true,44,'QA')")
 for stage in ['ENSAMBLE','EMPAQUE']:
  for shift in [1,2]:sql(f"INSERT INTO sgp_linea_b2.turnos(etapa,fecha,turno) VALUES({lit(stage)},'2026-11-01',{shift}) ON CONFLICT DO NOTHING")
 return ids

def state(k,stage='ENSAMBLE'):return get(f"SELECT sgp_linea_d2q.estado({lit(k)},{lit(stage)})")
def fingerprint(k):return get(f"SELECT sgp_linea_d2q.fuente({lit(k)})")['hash']
def validation(k,n=3,rev=0,token='COORDINADOR',stage='ENSAMBLE',id=None,day='2026-11-01',shift=1,hash=None):return f"SELECT sgp_linea_d2q.validar({lit(token)},{lit(k)},{lit(stage)},{n},{rev},{lit(hash or fingerprint(k))},{lit(id or uid())},'{day}',{shift},'QA validated consolidated overlap, not piece conversion');"
def sync(k):return get(f"SELECT sgp_linea_c2.reconciliar({lit(k)})")
def available(k):return get(f"SELECT sgp_linea_b2.disponible({lit(k)})")
def motor(k,op,stage='EMPAQUE',shift=1,rev=0,**kw):
 x={'id':uid(),'key':k,'op':op,'stage':stage,'date':'2026-11-01','shift':shift,'revision':rev,**kw}
 return 'SELECT public.sgp_linea_motor_b2(\'COORDINADOR\','+js(x)+');'
ids=seed('Q-OVERLAP')
assert state('Q-OVERLAP')['state']=='ESTIMACION'
assert sync('Q-OVERLAP')['status']=='SIN_CONCILIAR'
fail(validation('Q-OVERLAP',21),'CANTIDAD_FUERA_DE_SALDO')
fail(validation('Q-OVERLAP',token='QA-RECEP'),'OPERACION_NO_AUTORIZADA')
fail(validation('Q-OVERLAP',day='2026-11-02'),'TURNO_NO_AUTORIZADO')
fail(validation('Q-OVERLAP',token='CONSULTA'),'OPERACION_NO_AUTORIZADA')
sql("UPDATE sgp_linea_b2.turnos SET estado='EN_REVISION' WHERE etapa='ENSAMBLE' AND fecha='2026-11-01' AND turno=2")
fail(validation('Q-OVERLAP',token='QA-PICK',shift=2),'TURNO_NO_AUTORIZADO')
sql("UPDATE sgp_linea_b2.turnos SET estado='ABIERTO' WHERE etapa='ENSAMBLE' AND fecha='2026-11-01' AND turno=2")
event=uid();q=validation('Q-OVERLAP',token='QA-PICK',id=event)
assert get(q)['revision']==1 and get(q)['duplicate'] is True
assert sync('Q-OVERLAP')['available']==17
assert state('Q-OVERLAP')['estimated']==6 and state('Q-OVERLAP')['validated']==3
assert sql("SELECT count(*) FROM sgp_linea_d2q.validaciones WHERE key='Q-OVERLAP'")=='1'
fail(q.replace(',3,0,',',4,0,'),'IDEMPOTENCIA_REUTILIZADA')
checks.append('Global20 minus human-validated3=17; two PDT each count3 not summed; estimate6 unused; retry immutable once')
# Reserve changes, NC status or complementary evidence always invalidate, never auto-release.
change('Q-OVERLAP',f"UPDATE public.sgp_aluminio_pendientes SET nc='QA-CLOSED-NC' WHERE id_pendiente={lit(ids[0])}")
assert state('Q-OVERLAP')['state']=='REVISION_PENDIENTE'
assert sync('Q-OVERLAP')['status']=='SIN_CONCILIAR'
fail(validation('Q-OVERLAP',rev=1,hash='OLD'),'FUENTE_OBSOLETA')
get(validation('Q-OVERLAP',rev=1,token='QA-ASM'));assert sync('Q-OVERLAP')['available']==17
# Even without writer notification, fingerprint comparison blocks stale input.
sql(f"UPDATE public.sgp_aluminio_pendientes SET estado_repo='PROCESADO' WHERE id_pendiente={lit(ids[0])}")
assert state('Q-OVERLAP')['state']=='REVISION_PENDIENTE'
fail("SELECT sgp_linea_c2.exigir_vigencia('Q-OVERLAP')",'VALIDACION_CONSOLIDADA_REQUERIDA')
get(validation('Q-OVERLAP',rev=2));assert sync('Q-OVERLAP')['available']==17
checks.append('NC closed/PDT solution/status change requires reviewed quantity; uncoordinated edit detected but not proof of race-safe productive writers')
# Complementary lines and reception differences are fingerprints, not credits.
mp,delivery,detail,line=uid(),uid(),uid(),uid()
sql(f"INSERT INTO public.sgp_mecanizado_programacion VALUES({lit(mp)},'R-MAIN','PANELES_2','PENDIENTE');INSERT INTO public.sgp_picking_entregas(id_entrega,id_programacion,produccion,completa,estado) VALUES({lit(delivery)},{lit(mp)},'PROD-Q-OVERLAP',false,'AUDITADA_DIFERENCIA');INSERT INTO public.sgp_aluminio_pendiente_detalles VALUES({lit(detail)},{lit(ids[0])},'QA-PANEL');INSERT INTO public.sgp_pdt_fuentes(id_detalle,id_pieza) VALUES({lit(detail)},'QA-PANEL');INSERT INTO public.sgp_pdt_entrega_lineas VALUES({lit(line)},{lit(delivery)},{lit(detail)},'QA-PANEL',7,'AUDITADA_DIFERENCIA')")
assert state('Q-OVERLAP')['state']=='REVISION_PENDIENTE'
get(validation('Q-OVERLAP',rev=3));assert sync('Q-OVERLAP')['available']==17
change('Q-OVERLAP',f"UPDATE public.sgp_picking_entregas SET estado='VALIDADA' WHERE id_entrega={lit(delivery)};UPDATE public.sgp_pdt_entrega_lineas SET estado='VALIDADA' WHERE id_linea={lit(line)}")
assert state('Q-OVERLAP')['state']=='REVISION_PENDIENTE'
get(validation('Q-OVERLAP',rev=4));assert sync('Q-OVERLAP')['available']==17
checks.append('Shared reserve R-SHARED under principal R-MAIN; difference/complement positive7 pieces invalidates without auto-credit even VALIDADA')
# Stage-independent Empaque validation may be corrected without reducing packing twice.
get(validation('Q-OVERLAP',n=9,stage='EMPAQUE'))
assert sync('Q-OVERLAP')['available']==17
get(validation('Q-OVERLAP',n=2,rev=5));assert sync('Q-OVERLAP')['available']==18
checks.append('Ensamble and Empaque quantities independent; deliberate correction revises only current consolidated count, never sums stage blocks')
# Two real connections start before locks; production-wide CAS serializes edits.
seed('Q-CAS');bar=threading.Barrier(2)
queries=[validation('Q-CAS',n=n) for n in (2,3)]
def parallel(q):bar.wait();return run('BEGIN;'+q+'SELECT pg_sleep(0.15);COMMIT;')
with ThreadPoolExecutor(2) as pool:results=list(pool.map(parallel,queries))
assert sum(p.returncode==0 for p in results)==1
assert any('CONFLICTO_REVISION' in p.stderr for p in results)
checks.append('REAL PG: two separate sessions, distinct UUID edits at revision0 -> one commit, one CAS reject')
# Source basis avoids double discount of already-net assembly.
seed('Q-NET','NET_EXCLUDES_BLOCKED',assembled=17,packed=5)
get(validation('Q-NET'));assert sync('Q-NET')['available']==12
fail(validation('Q-NET',n=4,rev=1),'CANTIDAD_FUERA_DE_SALDO')
checks.append('NET17 already excludes3 from total20; packed5 ->12, no repeated subtraction; inconsistent reduction rejected')
# Real concurrent native consumption from distinct shifts. Shared production lock.
seed('Q-PACK');get(validation('Q-PACK'));assert sync('Q-PACK')['available']==17
for shift in (1,2):sql(motor('Q-PACK','SALE',shift=shift,quantity=17,observation='QA'))
bar=threading.Barrier(2);queries=[motor('Q-PACK','EJECUTAR',shift=i,rev=1,quantity=10) for i in (1,2)]
with ThreadPoolExecutor(2) as pool:results=list(pool.map(parallel,queries))
assert sum(p.returncode==0 for p in results)==1
assert any('SALDO_INSUFICIENTE' in p.stderr for p in results)
assert available('Q-PACK')['available']==7
checks.append('REAL PG: two shifts each consume10 from17 -> exactly one succeeds,7 remain; no fabricated unit IDs')
# Closed turn validation correction denied; other open turn can revise forward
# without rewriting the immutable earlier close snapshot.
win=1
sql("INSERT INTO sgp_linea_b2.turnos(etapa,fecha,turno) VALUES('EMPAQUE','2026-11-03',1)")
sql(motor('Q-PACK','SALE',date='2026-11-03',quantity=0,observation='QA separate closing turn'))
close=get(motor('Q-PACK','CERRAR',date='2026-11-03',shift=win,rev=1,observation='QA immutable close',reasons={'Q-PACK':'QA pending'}))
hash_before=sql(f"SELECT md5(snapshot::text) FROM sgp_linea_b2.cierres WHERE id={lit(close['id'])}")
fail(validation('Q-PACK',rev=1,stage='EMPAQUE',shift=win,day='2026-11-03'),'TURNO_NO_AUTORIZADO')
other=3-win
get(validation('Q-PACK',n=4,rev=1,stage='ENSAMBLE',shift=other))
assert sync('Q-PACK')['available']==6
assert sql(f"SELECT md5(snapshot::text) FROM sgp_linea_b2.cierres WHERE id={lit(close['id'])}")==hash_before
checks.append('Closed shift rejected; future/open-shift consolidated correction preserves prior immutable close hash')
# Correct assembly downwards on active consolidated block: no packing orphaned.
sql(motor('Q-PACK','SALE',stage='ENSAMBLE',shift=other,quantity=20,observation='QA'))
# Seed local positive assembly on a separate production so correction owns its shift.
seed('Q-CORR',assembled=10);get(validation('Q-CORR'));sync('Q-CORR')
sql(motor('Q-CORR','SALE',stage='ENSAMBLE',quantity=10,observation='QA'))
sql(motor('Q-CORR','EJECUTAR',stage='ENSAMBLE',rev=1,quantity=5))
assert available('Q-CORR')['available']==12
sql(motor('Q-CORR','SALE',quantity=10,observation='QA'))
sql(motor('Q-CORR','EJECUTAR',rev=1,quantity=10))
fail(motor('Q-CORR','EJECUTAR',stage='ENSAMBLE',rev=2,quantity=0,observation='QA downward'),'EJECUCION_SIN_RESPALDO_CONSOLIDADO')
assert available('Q-CORR')['available']==2
checks.append('Native assembly correction cannot orphan packed10 plus blocked3; entire event/order write rolls back')
# Export source revision change invalidates reviewed quantity before any availability.
change('Q-CORR',"UPDATE qa_c2.fuentes SET data=jsonb_set(jsonb_set(data,'{revision}','\"2\"'),'{generation}','2') WHERE key='Q-CORR' AND component='EXPORT'")
assert state('Q-CORR')['state']=='REVISION_PENDIENTE'
assert sync('Q-CORR')['status']=='SIN_CONCILIAR'
checks.append('Export source revision invalidates validation even if totals match; official sources never overwritten by engine')
# NET source: unaffected units can be assembled, then partially packed.
seed('Q-PARTIAL','NET_EXCLUDES_BLOCKED',assembled=0)
get(validation('Q-PARTIAL'));assert sync('Q-PARTIAL')['available']==0
sql(motor('Q-PARTIAL','SALE',stage='ENSAMBLE',quantity=17,observation='QA'))
sql(motor('Q-PARTIAL','EJECUTAR',stage='ENSAMBLE',rev=1,quantity=5))
sql(motor('Q-PARTIAL','SALE',quantity=5,observation='QA'))
sql(motor('Q-PARTIAL','EJECUTAR',rev=1,quantity=3))
assert available('Q-PARTIAL')['available']==2
fail(motor('Q-PARTIAL','EJECUTAR',stage='ENSAMBLE',rev=2,quantity=18),'EJECUCION_SIN_RESPALDO_CONSOLIDADO')
checks.append('Initially0 NET assembled: validate3 affected, assemble5 unaffected, pack3 partially ->2 remain; cannot assemble18 above17 ceiling')
# Source writer and consumer on real separate sessions share production lock.
seed('Q-RACE');get(validation('Q-RACE'));sync('Q-RACE')
sql(motor('Q-RACE','SALE',quantity=17,observation='QA'))
bar=threading.Barrier(2)
writer="BEGIN;"+lock('Q-RACE')+"SELECT sgp_linea_c2.notificar('Q-RACE','PDT');UPDATE public.sgp_aluminio_pendientes SET estado_repo='PROCESADO' WHERE key_produccion='Q-RACE';SELECT pg_sleep(0.15);COMMIT;"
consumer='BEGIN;'+motor('Q-RACE','EJECUTAR',rev=1,quantity=17)+'COMMIT;'
with ThreadPoolExecutor(2) as pool:results=list(pool.map(parallel,[writer,consumer]))
assert results[0].returncode==0
# Either consume committed before the edit, or it rejected after invalidation.
assert sql("SELECT count(*)<=1 FROM sgp_linea_b2.eventos WHERE key='Q-RACE'")=='t'
assert state('Q-RACE')['state']=='REVISION_PENDIENTE'
assert available('Q-RACE')['available'] is None
checks.append('REAL PG: source writer vs consumer serialized by production lock; resulting validation stale and future availability blocked')
# Optional individual path still works; legacy public definitions unchanged.
assert get("SELECT sgp_linea_c2.reconciliar('D2-FULL')")['status']=='READY'
assert available('D2-FULL')['available']==20
assert protected==sql("SELECT md5(string_agg(pg_get_functiondef(oid),'' ORDER BY oid)) FROM pg_proc WHERE pronamespace='public'::regnamespace")
assert session_hash==sql("SELECT md5(pg_get_functiondef('public.sgp_sesion_actual(text)'::regprocedure))")
fail("SET ROLE anon; SELECT * FROM sgp_linea_d2q.validaciones",'permission denied')
fail("SET ROLE authenticated; SELECT sgp_linea_d2q.validar('QA',NULL,NULL,0,0,NULL,NULL,NULL,1,'x')",'permission denied')
fail("UPDATE sgp_linea_d2q.validaciones SET cantidad=0",'HISTORIAL_INMUTABLE')
checks.append('Unit path fallback intact, captured/public RPC and auth hashes unchanged, anon/authenticated denied, audit immutable')
out={'status':'PASS','database':db,'base':base,'postgres':sql('SHOW server_version'),'checks':checks,'scope':'Synthetic counts/identities/certified QA readers; real networkless PG17 sessions. NOT integration proof for productive writers/readers.','noProductionOperations':True}
(E/'consolidated-postgres.json').write_text(json.dumps(out,indent=2)+'\n');(E/'consolidated-database.txt').write_text(db+'\n')
print(json.dumps(out,indent=2))
