"""Real PG17 sessions with synthetic B2/auth/ACK fixtures. No productive pool.
Run bootstrap.py only when its QA baseline is unavailable. Prior D2 evidence intact.
"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime,timezone
import subprocess,json,time,uuid,threading
R=Path(__file__).resolve().parents[2];E=R/'tests/linea-stage2e/evidence'
meta=json.loads(subprocess.check_output(['docker','inspect','sgp-pdt-qa-91']))[0]
assert meta['HostConfig']['NetworkMode']=='none' and not meta['HostConfig'].get('PortBindings')
base=(E/'base.txt').read_text().strip();assert base.startswith('sgp_linea_b2_qa_') and base.removeprefix('sgp_linea_b2_qa_').isdigit()
db='sgp_linea_e2_qa_'+str(time.time_ns());subprocess.run(['docker','exec','sgp-pdt-qa-91','createdb','-U','postgres','-T',base,db],check=True)
def run(q,database=db):return subprocess.run(['docker','exec','-i','sgp-pdt-qa-91','psql','-XqAt','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1'],input=q,text=True,capture_output=True)
def sql(q,database=db):
 p=run(q,database);assert p.returncode==0,p.stderr;return p.stdout.strip()
def get(q):return json.loads(sql(q))
def lit(x):return "'"+str(x).replace("'","''")+"'"
def uid():return str(uuid.uuid4())
def fail(q,code):
 p=run(q);assert p.returncode and code in p.stderr,(code,p.stdout,p.stderr)
checks=[]
hashq="SELECT md5(string_agg(pg_get_functiondef(oid),'' ORDER BY oid)) FROM pg_proc WHERE pronamespace='public'::regnamespace"
h=sql(hashq)
install=(R/'docs/sql-proposals/linea-etapa2e/01_export_manifest_REVIEW.sql').read_text()
fail(install.replace('COMMIT;','SELECT 1/0;COMMIT;'),'division by zero')
assert sql("SELECT to_regnamespace('sgp_linea_e2') IS NULL")=='t'
sql(install);assert sql(hashq)==h
checks.append('Transactional failed installation rolls back; private ACK extension leaves public function definitions unchanged')
def seed(k):sql(f"INSERT INTO public.sgp_producciones VALUES({lit(k)});INSERT INTO sgp_linea_b2.producciones(key) VALUES({lit(k)});INSERT INTO sgp_linea_b2.permisos VALUES('COORDINADOR','ENSAMBLE',{lit(k)}),('COORDINADOR','EMPAQUE',{lit(k)}),('LIDER','EMPAQUE',{lit(k)})")
def event(k,stage='ENSAMBLE',shift=1,n=5):return f"INSERT INTO sgp_linea_b2.eventos VALUES({lit(uid())},{lit(k)},{lit(stage)},'2026-10-27',{shift},{n},'QA-owner','QA SYNTHETIC',now(),'{{}}');"
def ack(k,load):return f"INSERT INTO sgp_linea_d2.export_ack SELECT {lit(load)},key,id,CASE WHEN etapa='EMPAQUE' THEN 'EXCLUDED' ELSE 'INCLUDED' END,'QA explicit independent attestation','R1',md5(to_jsonb(e)::text),'QA-owner',now() FROM sgp_linea_b2.eventos e WHERE key={lit(k)} AND NOT EXISTS(SELECT 1 FROM sgp_linea_d2.export_ack a WHERE a.carga={lit(load)} AND a.key=e.key AND a.evento=e.id);"
def seal(k,load):return f"SELECT sgp_linea_e2.sellar({lit(k)},{lit(load)},'R1','QA-history/{load}','QA-cut-hash','QA-writer-contract');"
seed('E2-EXPLICIT');sql(event('E2-EXPLICIT')+event('E2-EXPLICIT','EMPAQUE',2,2))
fail(seal('E2-EXPLICIT','L1'),'INCLUSION_EXPLICITA_INCOMPLETA')
sql(ack('E2-EXPLICIT','L1'));v=get(seal('E2-EXPLICIT','L1'));assert v['eventCount']==2 and v['status']=='SELLADO_NO_CERTIFICADO'
assert get(seal('E2-EXPLICIT','L1'))['duplicate'] is True
q="SELECT sgp_linea_e2.leer('COORDINADOR','E2-EXPLICIT','L1')"
v=get('BEGIN READ ONLY;'+q+';COMMIT;');assert v['available'] is None and v['status']=='PENDIENTE_CERTIFICACION_EXPORT'
assert {x['disposition'] for x in v['events']}=={'INCLUDED','EXCLUDED'}
checks.append('Missing dispositions block sealing; explicit INCLUDED/EXCLUDED retained and retry idempotent; no availability certification')
fail(q.replace('COORDINADOR','LIDER'),'AMBITO_DENEGADO')
fail(q.replace('COORDINADOR','NOT_A_SESSION'),'PERMISO_DENEGADO')
fail("SET ROLE anon;SELECT * FROM sgp_linea_e2.manifiestos",'permission denied')
fail("SET ROLE authenticated;SELECT sgp_linea_e2.sellar('K','L','R','H','C','W')",'permission denied')
checks.append('Captured real session body checks both stage scopes; missing scope/session and anon/authenticated direct access denied')
prior=sql("SELECT md5(eventos::text) FROM sgp_linea_e2.manifiestos WHERE key='E2-EXPLICIT' AND carga='L1'")
sql(event('E2-EXPLICIT',n=3))
fail(ack('E2-EXPLICIT','L1'),'ACK_POSTERIOR_A_SELLADO')
fail(seal('E2-EXPLICIT','L2'),'INCLUSION_EXPLICITA_INCOMPLETA')
sql(ack('E2-EXPLICIT','L2'));assert get(seal('E2-EXPLICIT','L2'))['eventCount']==3
assert sql("SELECT md5(eventos::text) FROM sgp_linea_e2.manifiestos WHERE key='E2-EXPLICIT' AND carga='L1'")==prior
fail("UPDATE sgp_linea_e2.manifiestos SET history_ref='OTHER'",'HISTORIAL_INMUTABLE')
fail(seal('E2-EXPLICIT','L1').replace('QA-cut-hash','CHANGED'),'CORTE_SELLADO_INMUTABLE')
checks.append('Successive cuts require explicit event inventories; later events do not rewrite prior receipt, conflict on same cut rejected')
seed('E2-RACE');sql(event('E2-RACE')+ack('E2-RACE','RACE'));bar=threading.Barrier(2)
def parallel(q):bar.wait();return run(q)
writer="BEGIN;SELECT revision FROM sgp_linea_b2.producciones WHERE key='E2-RACE' FOR UPDATE;"+event('E2-RACE','EMPAQUE',2,1)+ack('E2-RACE','RACE')+'SELECT pg_sleep(0.1);COMMIT;'
sealer='BEGIN;'+seal('E2-RACE','RACE')+'SELECT pg_sleep(0.1);COMMIT;'
with ThreadPoolExecutor(2) as pool:rs=list(pool.map(parallel,[writer,sealer]))
assert rs[1].returncode==0
if rs[0].returncode:assert 'ACK_POSTERIOR_A_SELLADO' in rs[0].stderr
assert sql("SELECT jsonb_array_length(eventos) FROM sgp_linea_e2.manifiestos WHERE key='E2-RACE'")==sql("SELECT count(*) FROM sgp_linea_b2.eventos WHERE key='E2-RACE'")
checks.append('REAL separate PG sessions: seal vs event/ACK transaction serialized by production lock; no partially committed event')
cat=get((R/'docs/linea-etapa2e/MISSING_CONTRACTS_READONLY.sql').read_text());assert cat['read_only']=='on'
checks.append('Missing-contracts catalog SQL executes READ ONLY on QA; does not invent absent Export definitions or read operational rows')
# Minimum columns used by exact versioned PR125 guard, not a production schema clone.
sql('CREATE TABLE public.sgp_picking_entregas(id_entrega uuid PRIMARY KEY,id_programacion uuid,produccion text,fecha_operativa date,turno_entrega text);')
sql((R/'tests/linea-stage2e/fixtures/picking-guard125.sql').read_text())
insert="INSERT INTO public.sgp_picking_entregas VALUES(gen_random_uuid(),gen_random_uuid(),'QA-GUARD',DATE,SHIFT);"
fail(insert.replace('DATE','current_date-2').replace('SHIFT','NULL'),'PICKING_FECHA_TURNO_REQUERIDOS')
fail(insert.replace('DATE','current_date+2').replace('SHIFT',"'TURNO 1'"),'PICKING_TURNO_FUTURO')
sql(insert.replace('DATE','current_date-2').replace('SHIFT',"'TURNO 1'"))
assert sql("SELECT count(*) FROM public.sgp_picking_entregas WHERE fecha_operativa=current_date-2 AND turno_entrega='TURNO 1'")=='1'
checks.append('Exact PR125 code on minimum QA table: incomplete/future shift rejected, past explicit shift accepted; no operational guard bypass')
undo=(R/'docs/sql-proposals/linea-etapa2e/ROLLBACK_REVIEW.sql').read_text();fail(undo,'E2_CON_EVIDENCIA_NO_BORRAR')
empty='sgp_linea_e2_empty_'+str(time.time_ns());subprocess.run(['docker','exec','sgp-pdt-qa-91','createdb','-U','postgres','-T',base,empty],check=True)
sql(install,empty);sql(undo,empty);assert sql("SELECT to_regnamespace('sgp_linea_e2') IS NULL",empty)=='t'
checks.append('Empty-only rollback succeeds; deletion refused when manifest evidence exists')
assert sql("SELECT md5(string_agg(snapshot::text,'' ORDER BY id)) FROM sgp_linea_b2.cierres")==sql("SELECT md5(string_agg(snapshot::text,'' ORDER BY id)) FROM sgp_linea_b2.cierres",base)
checks.append('All inherited historical close hashes unchanged; prior stages and official importer not rewritten')
out={'status':'PASS','capturedAtUtc':datetime.now(timezone.utc).isoformat(),'database':db,'base':base,'postgres':sql('SHOW server_version'),'checks':checks,'scope':'Networkless PG17 real sessions, synthetic B2/ACK sources. Exact PR125 code on minimal QA fields; NOT a productive schema clone or real Export integration.','productionWrites':False}
(E/'postgres.json').write_text(json.dumps(out,indent=2)+'\n');(E/'database.txt').write_text(db+'\n');print(json.dumps(out,indent=2))
