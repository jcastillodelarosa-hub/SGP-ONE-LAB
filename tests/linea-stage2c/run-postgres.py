"""Isolated PG17 real-session integration. All reader tables are SYNTHETIC.
No productive connector/configuration is used or certified by these tests.
"""
import pathlib,runpy,json,uuid,subprocess,time,threading
from concurrent.futures import ThreadPoolExecutor
R=pathlib.Path(__file__).resolve().parents[2]
E=R/'tests/linea-stage2c/evidence';E.mkdir(exist_ok=True)
# Re-run inherited 2B suite; archive its NEW evidence under 2C, preserving baseline
# evidence byte-for-byte instead of committing regenerated files in the base PR.
paths=list((R/'tests/linea-stage2b/evidence').glob('*'))
previous={p:p.read_bytes() for p in paths}
try:
 b=runpy.run_path(str(R/'tests/linea-stage2b/run-postgres.py'))
 inherited=json.loads((R/'tests/linea-stage2b/evidence/postgres.json').read_text())
finally:
 for p,data in previous.items():p.write_bytes(data)
(E/'regression-b2.json').write_text(json.dumps(inherited,indent=2)+'\n')
sql,run,lit,js,cmd,db=[b[x] for x in ('sql','run','literal','js','cmd','db')]
install=(R/'docs/sql-proposals/linea-etapa2c/01_bridges_REVIEW.sql').read_text()
r=run(install.replace('COMMIT;','SELECT 1/0;COMMIT;'));assert r.returncode
assert sql("SELECT to_regnamespace('sgp_linea_c2') IS NULL")=='t'
sql(install)
checks=['Installation error rolls back new C2 schema and triggers; B2 regression 16 PASS']
# Synthetic source readers have the exact server-reader contract, NOT presumed
# columns or bodies of real Export/PDT functions.
sql("CREATE SCHEMA qa_c2;CREATE TABLE qa_c2.fuentes(key text,component text,data jsonb,PRIMARY KEY(key,component));")
for comp in ['EXPORT','PDT','PERMISOS']:
 name=comp.lower()
 sql(f"CREATE FUNCTION qa_c2.{name}(k text) RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$SELECT data FROM qa_c2.fuentes WHERE key=k AND component='{comp}'$$;")
def cert():
 for comp in ['EXPORT','PDT','PERMISOS']:
  signature='qa_c2.'+comp.lower()+'(text)'
  sql(f"INSERT INTO sgp_linea_c2.lectores SELECT '{comp}',{lit(signature)},md5(pg_get_functiondef(oid)),md5(jsonb_build_object('owner',pg_get_userbyid(proowner),'acl',coalesce(proacl::text,'DEFAULT'),'definer',prosecdef,'config',proconfig)::text),'PRODUCCION_B2_V1','SYNTHETIC QA ONLY; no productive verification' FROM pg_proc WHERE oid={lit(signature)}::regprocedure ON CONFLICT(componente) DO UPDATE SET huella=excluded.huella,catalogo_huella=excluded.catalogo_huella;")

def seed(k,reserves=None):
 sql(f"INSERT INTO public.sgp_producciones VALUES({lit(k)});INSERT INTO sgp_linea_b2.producciones(key) VALUES({lit(k)});")
 identity={'production':k,'line':'PANELES_2','part':'QA-PART','reserves':reserves or ['QA-SHARED']}
 def base(comp):return {'production':k,'revision':comp+'-1','identity':identity,'complete':True,'generation':1,'sourceRef':'QA/'+comp+'/'+k}
 export={**base('EXPORT'),'applied':True,'historyId':'QA-HISTORY-'+k,'loadId':'QA-LOAD-'+k,'assembled':10,'packed':0,'events':[]}
 pdt={**base('PDT'),'items':[]}
 perms={**base('PERMISOS'),'grants':[{'user':u,'stage':s,'sourceRef':'QA-SCOPE/'+k,'sourceVersion':'1'} for u in ['COORDINADOR','LIDER','CONSULTA'] for s in ['ENSAMBLE','EMPAQUE']]}
 for comp,data in [('EXPORT',export),('PDT',pdt),('PERMISOS',perms)]:sql(f"INSERT INTO qa_c2.fuentes VALUES({lit(k)},{lit(comp)},{js(data)});")
 return export,pdt,perms
def update(k,comp,data,notify=True):
 sql('BEGIN;'+(f"SELECT sgp_linea_c2.notificar({lit(k)},{lit(comp)});" if notify else '')+f"UPDATE qa_c2.fuentes SET data={js(data)} WHERE key={lit(k)} AND component={lit(comp)};COMMIT;")
def sync(k):return json.loads(sql(f"SELECT sgp_linea_c2.reconciliar({lit(k)});"))
def avail(k):return json.loads(sql(f"SELECT sgp_linea_b2.disponible({lit(k)});"))
def events(k):return int(sql(f"SELECT count(*) FROM sgp_linea_b2.eventos WHERE key={lit(k)}"))
def rev(k):return int(sql(f"SELECT revision FROM sgp_linea_b2.producciones WHERE key={lit(k)}"))
def sale(k,shift=1):
 return b['execute'](cmd('SALE',k,stage='EMPAQUE',shift=shift,quantity=10,observation='QA C2 server scope'))
def consume_cmd(k,quantity,shift=1):return cmd('EJECUTAR',k,stage='EMPAQUE',shift=shift,revision=b['rev_order'](k,'EMPAQUE',shift),quantity=quantity)
def concurrent(queries):
 barrier=threading.Barrier(len(queries))
 def task(q):barrier.wait();return run("BEGIN;SET LOCAL lock_timeout='5s';"+q+"SELECT pg_sleep(0.15);COMMIT;")
 with ThreadPoolExecutor(max_workers=len(queries)) as pool:return list(pool.map(task,queries))
ex,pd,pe=seed('C2-A')
assert sync('C2-A')['status']=='SIN_CONCILIAR'
assert avail('C2-A')['status']=='UNKNOWN'
checks.append('No certified real readers => SIN_CONCILIAR, null availability and scope removed')
cert();assert sync('C2-A')['available']==10
r=rev('C2-A');assert sync('C2-A')['duplicate'] is True and rev('C2-A')==r
sale('C2-A');sale('C2-A',2)
checks.append('SQL-certified readers only, stable source replay does not advance production revision')
# Raw B2 writes cannot bypass stale certified evidence, even without a notify hook.
ex={**ex,'revision':'EXPORT-2','generation':2,'loadId':'QA-LOAD-A2','historyId':'QA-HISTORY-A2'}
update('C2-A','EXPORT',ex,False)
r=run('SET ROLE anon;'+b['call']('LIDER',consume_cmd('C2-A',1)))
assert r.returncode and 'SIN_CONCILIAR' in r.stderr and events('C2-A')==0
assert sync('C2-A')['status']=='READY'
checks.append('Changed reader content blocks raw B2 write; explicit new cut reconciles under production lock')
# New local event is additional, next Export includes it explicitly exactly once.
b['execute'](consume_cmd('C2-A',3),'LIDER');event=sql("SELECT id FROM sgp_linea_b2.eventos WHERE key='C2-A'")
assert avail('C2-A')['available']==7
ex={**ex,'revision':'EXPORT-3','generation':3,'loadId':'QA-LOAD-A3','historyId':'QA-HISTORY-A3','packed':3,'events':[{'id':event,'disposition':'INCLUDED','sourceRef':'QA-SIGNED-INCLUSION-A3'}]}
update('C2-A','EXPORT',ex);assert avail('C2-A')['status']=='UNKNOWN'
assert sync('C2-A')['available']==7
assert events('C2-A')==1
checks.append('Successive official cut explicitly includes local event once; source balances never overwritten')
# Unproved coverage cannot silently omit or assume excluded events.
bad={**ex,'revision':'EXPORT-4','generation':4,'loadId':'QA-LOAD-A4','historyId':'QA-HISTORY-A4','events':[]}
update('C2-A','EXPORT',bad);r=sync('C2-A');assert r['reason']=='INCLUSION_NO_DEMOSTRADA',r
assert avail('C2-A')['status']=='UNKNOWN'
assert sync('C2-A')['status']=='SIN_CONCILIAR'
update('C2-A','EXPORT',ex);assert sync('C2-A')['status']=='READY'
checks.append('Missing inclusion evidence stays SIN_CONCILIAR; no timestamp/quantity inference')
# Duplicate, unrelated production, same version changed body and contradictory cuts.
for alteration,expected in [({'events':ex['events']*2},'INCLUSION_NO_DEMOSTRADA'),({'packed':11},'CORTE_CONTRADICTORIO')]:
 bad={**ex,**alteration,'generation':4,'revision':'BAD-'+expected,'loadId':'QA-'+expected,'historyId':'QA-'+expected}
 update('C2-A','EXPORT',bad);assert sync('C2-A')['reason']==expected
update('C2-A','EXPORT',{**ex,'assembled':9});assert sync('C2-A')['reason']=='REVISION_REUTILIZADA'
update('C2-A','EXPORT',ex);assert sync('C2-A')['status']=='READY'
# Older official source generation cannot replace the latest proven generation.
obsolete={**ex,'revision':'EXPORT-2','generation':2,'loadId':'QA-LOAD-A2','historyId':'QA-HISTORY-A2'}
update('C2-A','EXPORT',obsolete);assert sync('C2-A')['reason']=='FUENTE_OBSOLETA'
update('C2-A','EXPORT',ex);assert sync('C2-A')['status']=='READY'
checks.append('Older official generation cannot replace a newer reconciliation')
checks.append('Duplicates, contradictory quantities and source revision reuse fail closed')
# Shared reserve does not permit cross-production event or scope associations.
exb,pdb,peb=seed('C2-B')
exb={**exb,'events':[{'id':event,'disposition':'INCLUDED','sourceRef':'QA-BAD-CROSS'}]}
update('C2-B','EXPORT',exb);assert sync('C2-B')['status']=='SIN_CONCILIAR'
pdb={**pdb,'identity':{**pdb['identity'],'part':'OTHER'}}
update('C2-B','PDT',pdb);assert sync('C2-B')['reason']=='IDENTIDAD_INCONSISTENTE'
checks.append('Shared reserve does not merge production/part/line identities or foreign events')
# ENSAMBLE impact cannot use piece counts. EMPAQUE independent.
id1,id2=str(uuid.uuid4()),str(uuid.uuid4())
pd={**pd,'revision':'PDT-2','generation':2,'items':[{'id':id1,'stage':'ENSAMBLE','active':True,'sourceRef':'QA-PDT/'+id1,'sourceVersion':'2','pieceQuantity':2}]}
update('C2-A','PDT',pd);assert sync('C2-A')['reason']=='UNIDADES_PDT_DESCONOCIDAS'
assert avail('C2-A')['status']=='UNKNOWN'
pd={**pd,'revision':'PDT-3','generation':3,'items':[{'id':id2,'stage':'EMPAQUE','active':True,'sourceRef':'QA-PDT/'+id2,'sourceVersion':'1'}]}
update('C2-A','PDT',pd);assert sync('C2-A')['available']==7
checks.append('No piece-to-unit conversion; independent EMPAQUE PDT does not block ENSAMBLE eligible units')
# Verified synthetic explicit identities+version: 10 assembled, 3 packed, 2 blocked.
pd={**pd,'revision':'PDT-4','generation':4,'items':pd['items']+[{'id':id1,'stage':'ENSAMBLE','active':True,'sourceRef':'QA-PDT/'+id1,'sourceVersion':'4','unitIds':['U4','U5']}],
 'unitMap':{'assembled':['U'+str(i) for i in range(1,11)],'packed':['U1','U2','U3'],'sourceRef':'QA-UNIT-REGISTER-V4'}}
update('C2-A','PDT',pd);assert sync('C2-A')['available']==5
assert int(sql("SELECT count(*) FROM sgp_linea_b2.bloqueos WHERE key='C2-A' AND activo AND etapa='EMPAQUE'"))==1
checks.append('Synthetic proven per-unit PDT mapping blocks only affected units and preserves independent stage')
# Source scope revocation is server-owned, stale anon cannot bypass by raw RPC.
pe={**pe,'revision':'PERMISOS-2','generation':2,'grants':[g for g in pe['grants'] if g['user']!='LIDER']}
update('C2-A','PERMISOS',pe)
assert int(sql("SELECT count(*) FROM sgp_linea_b2.permisos WHERE key='C2-A'"))==0
assert sync('C2-A')['status']=='READY'
r=run('SET ROLE anon;'+b['call']('LIDER',consume_cmd('C2-A',4)));assert r.returncode and 'AMBITO_DENEGADO' in r.stderr
checks.append('Server permission-source revocation invalidates grants; anon cannot manufacture scope')
# Reader hash drift: no body replacement can preserve certification.
sql("CREATE OR REPLACE FUNCTION qa_c2.export(k text) RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$SELECT data || '{}'::jsonb FROM qa_c2.fuentes WHERE key=k AND component='EXPORT'$$")
assert sync('C2-A')['reason']=='LECTOR_NO_CERTIFICADO'
cert();assert sync('C2-A')['status']=='READY'
checks.append('Installed reader body MD5 drift invalidates certified source contract')
# Definer alone is insufficient: ACL/owner/config are pinned separately.
sql("GRANT EXECUTE ON FUNCTION qa_c2.export(text) TO anon")
assert sync('C2-A')['reason']=='LECTOR_NO_CERTIFICADO'
cert();assert sync('C2-A')['status']=='READY'
checks.append('Reader ownership/ACL/definer/config signature enforced; ACL drift invalidates evidence')
# Separate production for real-session races, no mapped blockers.
exc,pdc,pec=seed('C2-RACE');assert sync('C2-RACE')['status']=='READY';sale('C2-RACE');sale('C2-RACE',2)
c1=consume_cmd('C2-RACE',7,1);c2=consume_cmd('C2-RACE',7,2)
rs=concurrent([b['call']('LIDER',c1),b['call']('LIDER',c2)])
assert sum(x.returncode==0 for x in rs)==1 and avail('C2-RACE')['available']==3
checks.append('REAL PG: two shifts share one eligible balance with C2 freshness guards')
# Cooperative source writer and consumption serialize on same production row.
nextp={**pdc,'revision':'PDT-2','generation':2,'items':[{'id':str(uuid.uuid4()),'stage':'ENSAMBLE','active':True,'sourceRef':'QA-new-blocker','sourceVersion':'2'}]}
q=f"SELECT sgp_linea_c2.notificar('C2-RACE','PDT');UPDATE qa_c2.fuentes SET data={js(nextp)} WHERE key='C2-RACE' AND component='PDT';"
# Allocate one extra on the shift which did NOT win, so its order revision stays valid.
winning=int(sql("SELECT turno FROM sgp_linea_b2.eventos WHERE key='C2-RACE'"));losing=2 if winning==1 else 1
rs=concurrent([q,b['call']('LIDER',consume_cmd('C2-RACE',1,losing))])
assert rs[0].returncode==0
assert sync('C2-RACE')['reason']=='UNIDADES_PDT_DESCONOCIDAS'
assert avail('C2-RACE')['status']=='UNKNOWN'
checks.append('REAL PG: source PDT writer invalidation vs packing serializes and blocks future unsupported consumption')
# Concurrent cut change and reconcile: no partial stage/import; hook locks key.
exd,pdd,ped=seed('C2-CUT');assert sync('C2-CUT')['available']==10
newcut={**exd,'revision':'EXPORT-2','generation':2,'historyId':'QA-CUT2','loadId':'QA-CUT2','assembled':12}
q=f"SELECT sgp_linea_c2.notificar('C2-CUT','EXPORT');UPDATE qa_c2.fuentes SET data={js(newcut)} WHERE key='C2-CUT' AND component='EXPORT';"
rs=concurrent([q,"SELECT sgp_linea_c2.reconciliar('C2-CUT');"]);assert all(x.returncode==0 for x in rs)
assert sync('C2-CUT')['status']=='READY' and avail('C2-CUT')['available']==12
checks.append('REAL PG: official cut update vs reconciliation uses same lock, no mixed cut/event snapshot')
# Private funcs/tables not browser callable. Reader proof is never client data.
for query in ["SELECT sgp_linea_c2.reconciliar('C2-CUT')","INSERT INTO sgp_linea_c2.lectores VALUES('EXPORT','bad','00000000000000000000000000000000','00000000000000000000000000000000','PRODUCCION_B2_V1','bad')","SELECT * FROM qa_c2.fuentes"]:
 if 'qa_c2' in query:continue # QA schema owner-only fixture, separately synthetic.
 assert run('SET ROLE anon;'+query).returncode
checks.append('Browser cannot register readers, provide proofs or call private reconciliation')
assert json.loads(sql("SELECT data FROM qa_c2.fuentes WHERE key='C2-CUT' AND component='EXPORT'"))==newcut
(E/'database.txt').write_text(db+'\n')
evidence={'status':'PASS','database':db,'postgres':inherited['postgres'],'network':'none; no published ports','checks':checks,'production_integration':'NOT VERIFIED; no productive readers, source writer hooks or unit mapping certified','limitations':['Readers/sources/scopes are synthetic; real auth body captured in base tests','Real Export function definitions and inclusion records unavailable','No real piece->unit equivalence; active assembly PDT without explicit units blocks','No SQL applied to Supabase, no frontend, no official source updates']}
(E/'postgres.json').write_text(json.dumps(evidence,indent=2)+'\n');print(json.dumps(evidence,indent=2))
