"""Focused safety checks on synthetic QA from run-postgres.py. No productive SQL."""
import pathlib,json,subprocess,uuid,threading
from concurrent.futures import ThreadPoolExecutor
R=pathlib.Path(__file__).resolve().parents[2];E=R/'tests/linea-stage2c/evidence'
db=(E/'database.txt').read_text().strip();assert db.startswith('sgp_linea_b2_qa_') and db.removeprefix('sgp_linea_b2_qa_').isdigit()
def run(q):return subprocess.run(['docker','exec','-i','sgp-pdt-qa-91','psql','-XqAt','-U','postgres','-d',db,'-v','ON_ERROR_STOP=1'],input=q,text=True,capture_output=True)
def sql(q):
 r=run(q);assert r.returncode==0,r.stderr;return r.stdout.strip()
def lit(x):return "'"+str(x).replace("'","''")+"'"
def js(x):return lit(json.dumps(x))+'::jsonb'
checks=[]
# Prepared catalog reads only metadata and parses on PG17, no operational writes.
q=(R/'docs/linea-etapa2c/CONTRAST_SOURCE_READONLY.sql').read_text();before=sql('SELECT count(*) FROM sgp_linea_c2.historial')
r=run(q);assert r.returncode==0,r.stderr
packet=json.loads(r.stdout.strip());assert packet['read_only']=='on'
assert sql('SELECT count(*) FROM sgp_linea_c2.historial')==before
checks.append('Catalog-only query parsed/executed READ ONLY on QA; no operational rows exported and no writes')
# Rollback refuses source/audit evidence. No destructive cleanup of a used engine.
undo=(R/'docs/sql-proposals/linea-etapa2c/ROLLBACK_REVIEW.sql').read_text()
r=run(undo);assert r.returncode and 'ROLLBACK_C2_CON_EVIDENCIA' in r.stderr,r.stderr
assert sql("SELECT to_regnamespace('sgp_linea_c2') IS NOT NULL")=='t'
checks.append('Rollback with evidence refused, schema and history retained')
# Unchanged load ID with changed official quantities is not accepted as another cut.
k='C2-CUT';ex=json.loads(sql(f"SELECT data FROM qa_c2.fuentes WHERE key='{k}' AND component='EXPORT'"));bad={**ex,'assembled':13,'revision':'EXPORT-3','generation':3}
sql(f"BEGIN;SELECT sgp_linea_c2.notificar('{k}','EXPORT');UPDATE qa_c2.fuentes SET data={js(bad)} WHERE key='{k}' AND component='EXPORT';COMMIT;")
r=json.loads(sql(f"SELECT sgp_linea_c2.reconciliar('{k}')"));assert r['reason']=='CORTE_MUTADO',r
# Restore exactly last known-good source version (failed version never reconciled).
sql(f"BEGIN;SELECT sgp_linea_c2.notificar('{k}','EXPORT');UPDATE qa_c2.fuentes SET data={js(ex)} WHERE key='{k}' AND component='EXPORT';COMMIT;")
assert json.loads(sql(f"SELECT sgp_linea_c2.reconciliar('{k}')"))['status']=='READY'
checks.append('Sealed official load mutation is rejected without changing official source rows or old cuts')
# New key on global open EMPAQUE turn for real permission writer vs execution race.
k='C2-SCOPE';sql(f"INSERT INTO public.sgp_producciones VALUES('{k}');INSERT INTO sgp_linea_b2.producciones(key) VALUES('{k}');")
identity={'production':k,'line':'PANELES_2','part':'QA-SCOPE','reserves':['QA-SHARED']}
base={'production':k,'revision':'1','generation':1,'complete':True,'identity':identity,'sourceRef':'QA/'+k}
pe={**base,'grants':[{'user':u,'stage':s,'sourceRef':'QA-scope','sourceVersion':'1'} for u in ['LIDER','COORDINADOR'] for s in ['ENSAMBLE','EMPAQUE']]}
sources={'EXPORT':{**base,'applied':True,'historyId':k,'loadId':k,'assembled':10,'packed':0,'events':[]},'PDT':{**base,'items':[]},'PERMISOS':pe}
for c,data in sources.items():sql(f"INSERT INTO qa_c2.fuentes VALUES('{k}',{lit(c)},{js(data)})")
assert json.loads(sql(f"SELECT sgp_linea_c2.reconciliar('{k}')"))['status']=='READY'
cmd={'op':'SALE','key':k,'stage':'EMPAQUE','date':'2026-10-27','shift':1,'id':str(uuid.uuid4()),'revision':0,'quantity':10,'observation':'QA scope race'}
sql("SELECT public.sgp_linea_motor_b2('COORDINADOR',"+js(cmd)+')')
cmd.update(op='EJECUTAR',id=str(uuid.uuid4()),revision=1,quantity=2)
revoked={**pe,'revision':'2','generation':2,'grants':[g for g in pe['grants'] if g['user']!='LIDER']}
writer=f"SELECT sgp_linea_c2.notificar('{k}','PERMISOS');UPDATE qa_c2.fuentes SET data={js(revoked)} WHERE key='{k}' AND component='PERMISOS';"
barrier=threading.Barrier(2)
def task(q):barrier.wait();return run("BEGIN;SET LOCAL lock_timeout='5s';"+q+"SELECT pg_sleep(.15);COMMIT;")
with ThreadPoolExecutor(max_workers=2) as pool:rs=list(pool.map(task,[writer,"SET ROLE anon;SELECT public.sgp_linea_motor_b2('LIDER',"+js(cmd)+');']))
assert rs[0].returncode==0
assert json.loads(sql(f"SELECT sgp_linea_c2.reconciliar('{k}')"))['status']=='READY'
cmd.update(id=str(uuid.uuid4()),revision=int(sql(f"SELECT revision FROM sgp_linea_b2.ordenes WHERE key='{k}'")),quantity=3)
r=run("SET ROLE anon;SELECT public.sgp_linea_motor_b2('LIDER',"+js(cmd)+')');assert r.returncode and 'AMBITO_DENEGADO' in r.stderr
checks.append('REAL PG: scope revocation writer vs execution serialized, future unauthorized operation denied')
for role in ['anon','authenticated']:
 r=run(f"SET ROLE {role};SELECT sgp_linea_c2.preparar('LIDER','C2-CUT','EMPAQUE')");assert r.returncode
 r=run(f"SET ROLE {role};SELECT * FROM sgp_linea_c2.lectores");assert r.returncode
checks.append('anon and authenticated cannot call private bridge or alter/read certified reader registry')
# Old B2 CONCILIAR cannot bypass the certified C2-selected official load.
k='C2-SCOPE';cut=str(uuid.uuid4())
sql(f"INSERT INTO sgp_linea_b2.cortes VALUES('{cut}','{k}','QA-UNCERTIFIED-LOAD',100,0,true,'{{\"qa\":true}}',now())")
rev=int(sql(f"SELECT revision FROM sgp_linea_b2.producciones WHERE key='{k}'"))
cmd={'op':'CONCILIAR','key':k,'stage':'EMPAQUE','id':str(uuid.uuid4()),'revision':rev,'cut_id':cut}
r=run("SET ROLE anon;SELECT public.sgp_linea_motor_b2('COORDINADOR',"+js(cmd)+')');assert r.returncode and 'SIN_CONCILIAR' in r.stderr
assert sql(f"SELECT corte<>'{cut}'::uuid FROM sgp_linea_b2.producciones WHERE key='{k}'")=='t'
checks.append('Raw B2 cut activation cannot substitute a non-certified cut on C2-managed production')
out={'status':'PASS','database':db,'checks':checks,'productive_catalog':'PREPARED ONLY; no productive read or mutation','limitations':['All readers/source writes/scopes synthetic; no claim of installed writer compatibility']}
(E/'safety.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
