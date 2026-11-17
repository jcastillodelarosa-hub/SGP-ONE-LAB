"""Native synthetic full-writer precheck and existing resolution-guard coexistence."""
import json,re,subprocess,sys
from pathlib import Path
root=Path(__file__).resolve().parents[2];container=sys.argv[1];db='fence_integration_synthetic'
def query(q,d=db):
 return subprocess.run(['docker','exec','-i',container,'psql','-X','-U','postgres','-d',d,'-At','-v','ON_ERROR_STOP=1'],input=q,text=True,capture_output=True)
def ok(q,d=db):
 r=query(q,d);assert r.returncode==0,r.stderr;return r.stdout.strip()
ok('CREATE DATABASE '+db,'postgres')
s=(root/'tests/opt-digital/import-retail-reservation-v4-sql.mjs').read_text()
seed=re.search(r'await db.exec\(`(.*?)`\);',s,re.S).group(1).replace('${program}','00000000-0000-0000-0000-000000000001').replace('CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;','')
ok(seed+re.search(r'await db.exec\("(ALTER TABLE.*?)"\);',s).group(1))
for f in ['install_REVIEW.sql','import_channel_REVIEW.sql','import_channel_proyecto_v2_REVIEW.sql','import_channel_retail_v3_REVIEW.sql','import_channel_retail_v4_REVIEW.sql']:
 ok((root/'docs/sql-proposals/opt-shared'/f).read_text())
# Preexisting synthetic approval exercises the owner-only core without new approval insert.
ok("""INSERT INTO sgp_opt_shared.approvals(id_aprobacion,sha256,manifest_sha256,fuentes,evidencia)
VALUES('00000000-0000-4000-8000-000000000099',repeat('1',64),repeat('f',64),'[{"consecutivo":"OPT-SYNTH-1"}]','{"sgp_binding":{}}');""")
ok((root/'docs/opt-recovery/installed-resolution-20261114221005.sql').read_text())
ok((root/'docs/sql-proposals/opt-shared/import_uncertainty_fence_REVIEW.sql').read_text())
ok("""UPDATE sgp_opt_shared.config SET enabled=true,access_window='mecanizado',read_roles=ARRAY['LIDER MECANIZADO'],write_roles=ARRAY['LIDER MECANIZADO'];
INSERT INTO sgp_opt_shared.import_uncertainties(incident_id,pdf_sha256,opt,original_identity) VALUES
('00000000-0000-4000-8000-000000000001',repeat('1',64),'OPT-SYNTH-1','{}'),
('00000000-0000-4000-8000-000000000002',repeat('2',64),'OPT-SYNTH-2','{}');
UPDATE sgp_opt_shared.import_fence_control SET certified=true,certificate='SYNTHETIC-CERTIFICATE';""")
snap=ok("""SELECT json_agg(json_build_object('name',n.nspname||'.'||p.proname,'signature',n.nspname||'.'||p.proname||'('||oidvectortypes(p.proargtypes)||')','definition',pg_get_functiondef(p.oid),'sha256',encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex'))) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE (n.nspname='public' AND p.proname IN ('sgp_opt_importar_validado_v1','sgp_opt_importar_proyecto_validado_v2','sgp_opt_importar_retail_validado_v3','sgp_opt_importar_retail_validado_v4','sgp_opt_importar_retail_resuelto_v1')) OR (n.nspname='sgp_opt_shared' AND p.proname='import_manifest');""")
code="import {buildReview} from './scripts/build-opt-fence-precheck-review.mjs';let s='';for await(const b of process.stdin)s+=b;process.stdout.write(buildReview(JSON.parse(s)));"
r=subprocess.run(['node','--input-type=module','-e',code],input=snap,text=True,capture_output=True,cwd=root);assert r.returncode==0,r.stderr
ok(r.stdout)
# A second application aborts on exact definition drift; it is not an implicit retry.
assert 'WRITER_DRIFT' in query(r.stdout).stderr
for n in ['validado_v1','proyecto_validado_v2','retail_validado_v3','retail_validado_v4','retail_resuelto_v1']:
 prefix="'synthetic-token',"
 if n=='retail_resuelto_v1':prefix+="'{}'::jsonb,'synthetic',NULL::uuid,NULL::uuid,NULL::uuid,"
 call="SELECT public.sgp_opt_importar_"+n+"("+prefix+"'safe'::bytea,'[]'::jsonb,'[{\"consecutivo\":\"OPT-SYNTH-1\",\"origen\":\"PROYECTO\"}]'::jsonb,'{}'::jsonb);"
 assert 'PREVIOUS_OUTCOME_UNRESOLVED' in query(call).stderr,n
 # Unrelated Proyecto passes fence and fails original validation, never masquerading as imported.
 err=query(call.replace('OPT-SYNTH-1','PROJECT-SAFE')).stderr
 assert 'FENCE' not in err and 'UNRESOLVED' not in err and err,n
assert 'PREVIOUS_OUTCOME_UNRESOLVED' in query("SELECT sgp_opt_shared.import_manifest('00000000-0000-4000-8000-000000000099','safe'::bytea,'[]'::jsonb);").stderr
# Both trigger sets remain, quarantine did not replace resolution authorization.
assert ok("SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal AND tgname='resolution_guard';")=='3'
assert ok("SELECT count(*) FROM sgp_opt_shared.import_resolution_consumption;")=='0'
assert ok("SELECT count(*) FROM sgp_opt_shared.documents;")=='0'
print(json.dumps({'synthetic':True,'productionWrites':0,'sixDefinitionsPatched':True,'fiveRpcPrechecksBlockBeforeReturns':True,'allResolutionGuardsRetained':True,'driftAborts':True,'unrelatedProyectoPassesFence':True,'documentsWritten':0}))
