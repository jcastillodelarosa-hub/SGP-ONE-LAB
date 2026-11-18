"""Synthetic-only native PostgreSQL fence tests. Existing disposable CI container required."""
import json,subprocess,sys,time
from pathlib import Path
root=Path(__file__).resolve().parents[2];c=sys.argv[1];db='opt_fence_synthetic'
def query(q,d=db):
 return subprocess.run(['docker','exec','-i',c,'psql','-X','-U','postgres','-d',d,'-At','-v','ON_ERROR_STOP=1'],input=q,text=True,capture_output=True)
def ok(q,d=db):
 r=query(q,d);assert r.returncode==0,r.stderr;return r.stdout.strip()
ok('CREATE DATABASE '+db,'postgres')
ok("""CREATE SCHEMA sgp_opt_shared;
CREATE TABLE sgp_opt_shared.approvals(sha256 text,fuentes jsonb);
CREATE TABLE sgp_opt_shared.documents(id_documento uuid PRIMARY KEY,sha256 text);
CREATE TABLE sgp_opt_shared.sources(id_documento uuid,consecutivo text,origen text,UNIQUE(consecutivo));""")
ok((root/'docs/sql-proposals/opt-shared/import_uncertainty_fence_REVIEW.sql').read_text())
assert 'FENCE_CLOSED' in query("SELECT sgp_opt_shared.assert_import_request('safe','[{\"consecutivo\":\"SAFE\"}]');").stderr
ok("""INSERT INTO sgp_opt_shared.import_uncertainties(incident_id,pdf_sha256,opt,original_identity) VALUES
('00000000-0000-4000-8000-000000000001',repeat('1',64),'OPT-SYNTH-1','{}'),
('00000000-0000-4000-8000-000000000002',repeat('2',64),'OPT-SYNTH-2','{}');
UPDATE sgp_opt_shared.import_fence_control SET certified=true,certificate='SYNTHETIC-CERTIFICATE';
CREATE FUNCTION public.cached_synthetic(p_pdf bytea,p_sources jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
BEGIN PERFORM sgp_opt_shared.assert_import_request(p_pdf,p_sources);RETURN '{"duplicate":true}'::jsonb;END$$;""")
assert 'PREVIOUS_OUTCOME_UNRESOLVED' in query("SELECT public.cached_synthetic('safe','[{\"consecutivo\":\"OPT-SYNTH-1\",\"origen\":\"PROYECTO\"}]');").stderr
assert 'true' in ok("SELECT public.cached_synthetic('safe','[{\"consecutivo\":\"PROJECT-SAFE\",\"origen\":\"PROYECTO\"}]');")
# Inventory cardinality is evidence-driven, not hardcoded to the original two.
ok("""INSERT INTO sgp_opt_shared.import_uncertainties(incident_id,pdf_sha256,opt,original_identity)
SELECT ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
encode(sha256(convert_to('synthetic-'||n,'UTF8')),'hex'),'OPT-SYNTH-'||n,'{}'::jsonb
FROM generate_series(3,9) n;
UPDATE sgp_opt_shared.import_fence_control SET expected_active=9;""")
for n in range(1,10):
 assert 'PREVIOUS_OUTCOME_UNRESOLVED' in query("SELECT public.cached_synthetic('safe','[{\"consecutivo\":\"OPT-SYNTH-"+str(n)+"\",\"origen\":\"PROYECTO\"}]');").stderr
ok('UPDATE sgp_opt_shared.import_fence_control SET expected_active=2;')
assert 'REGISTRY_MISMATCH' in query("SELECT public.cached_synthetic('safe','[{\"consecutivo\":\"PROJECT-SAFE\"}]');").stderr
ok('UPDATE sgp_opt_shared.import_fence_control SET expected_active=9;')
assert 'true' in ok("SELECT public.cached_synthetic('safe','[{\"consecutivo\":\"PROJECT-SAFE\"}]');")
assert 'FENCE_ISOLATION' in query("BEGIN ISOLATION LEVEL REPEATABLE READ; SELECT public.cached_synthetic('safe','[{\"consecutivo\":\"PROJECT-SAFE\"}]');").stderr
# Shared precheck lock protects decisions until importer commits.
def session(q,name):
 p=subprocess.Popen(['docker','exec','-i',c,'psql','-X','-U','postgres','-d',db,'-At','-v','ON_ERROR_STOP=1'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
 p.stdin.write("SET application_name='"+name+"';"+q);p.stdin.close()
 for _ in range(100):
  if ok("SELECT count(*) FROM pg_stat_activity WHERE application_name='"+name+"' AND wait_event='PgSleep';")=='1':return p
  time.sleep(.025)
 raise AssertionError('session never reached synchronization point')
a=session("BEGIN; SELECT public.cached_synthetic('safe','[{\"consecutivo\":\"PROJECT-SAFE\"}]'); SELECT pg_sleep(2);COMMIT;",'fence_reader')
r=query("BEGIN;SET lock_timeout='250ms';UPDATE sgp_opt_shared.import_fence_control SET certified=false;COMMIT;");assert 'lock timeout' in r.stderr,r.stderr
a.wait(timeout=5);assert a.returncode==0,a.stderr.read()
# Administrative registry transaction blocks import immediately, not after a write.
a=session("BEGIN;UPDATE sgp_opt_shared.import_uncertainties SET index_sha256=repeat('a',64);SELECT pg_sleep(2);ROLLBACK;",'fence_admin')
r=query("SELECT public.cached_synthetic('safe','[{\"consecutivo\":\"PROJECT-SAFE\"}]');");assert 'could not obtain lock' in r.stderr,r.stderr
a.wait(timeout=5);assert a.returncode==0,a.stderr.read()
ok((root/'docs/sql-proposals/opt-shared/import_uncertainty_fence_CLOSE_REVIEW.sql').read_text())
assert 'FENCE_CLOSED' in query("SELECT public.cached_synthetic('safe','[{\"consecutivo\":\"PROJECT-SAFE\"}]');").stderr
assert ok('SELECT count(*) FROM sgp_opt_shared.import_uncertainties;')=='9'
print(json.dumps({'synthetic':True,'productionWrites':0,'registryRowsPreserved':9,'nineSyntheticIdentitiesBlocked':True,'staleExpectedCountFailsClosed':True,'cachedReceiptProtected':True,'safeProyectoAllowedWhenCertified':True,'importVsClosureSerialized':True,'registryChangeBlocksImportWithoutWrite':True,'repeatableReadRejected':True,'closedRollback':True}))
