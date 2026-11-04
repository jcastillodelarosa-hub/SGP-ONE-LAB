"""Exact activation DML against real SQL01/06/08/10 on synthetic PG, no network."""
from pathlib import Path
import importlib.util,json,hashlib,subprocess
spec=importlib.util.spec_from_file_location('roles',Path(__file__).with_name('postgres.py'))
f=importlib.util.module_from_spec(spec);spec.loader.exec_module(f)
db=f.Database();checks=[];script=(f.ROOT/'deployment/lp-runtime-activation.sql').read_text()
try:
 f.setup(db)
 db.sql("UPDATE sgp_lp_operacion.config SET escrituras=false,formato_bi_aprobado=false,adaptador_bi='LP-PBI-XLSX-1' WHERE id;UPDATE sgp_lp_operacion.perfil_roles SET habilitado=false WHERE id")
 def flags():return db.sql('SELECT escrituras::text||formato_bi_aprobado::text||habilitado::text FROM sgp_lp_operacion.config CROSS JOIN sgp_lp_operacion.perfil_roles')
 before=db.sql('SELECT jsonb_agg(to_jsonb(p) ORDER BY key_produccion) FROM public.sgp_producciones p')
 r=db.run(script.replace('COMMIT;','SELECT 1/0;COMMIT;'))
 assert r.returncode and flags()=='falsefalsefalse'
 checks.append('Forced failure rolls back both configuration rows; no partial activation')
 db.sql("GRANT SELECT ON public.sgp_rol_accesos TO anon")
 f.deny(db,script,'LP_ACTIVATION_ACL_UNSAFE');assert flags()=='falsefalsefalse'
 db.sql('REVOKE SELECT ON public.sgp_rol_accesos FROM anon')
 db.sql("UPDATE sgp_lp_operacion.config SET adaptador_bi='CSV-QA' WHERE id")
 f.deny(db,script,'LP_ACTIVATION_STATE_NOT_APPROVED');assert flags()=='falsefalsefalse'
 db.sql("UPDATE sgp_lp_operacion.config SET adaptador_bi='LP-PBI-XLSX-1' WHERE id")
 checks.append('Unsafe catalog ACL and incompatible BI adapter rejected before any activation')
 # Real shared role lock: activation cannot overtake an in-flight protected read.
 held=subprocess.Popen(db.docker+['exec','-i',db.container,'psql','-X','-qAt','-U','postgres','-v','ON_ERROR_STOP=1'],env=db.env,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
 held.stdin.write("BEGIN;LOCK TABLE sgp_lp_operacion.perfil_roles IN SHARE MODE;SELECT 'held';\n");held.stdin.flush();assert held.stdout.readline().strip()=='held'
 f.deny(db,script.replace("lock_timeout='5s'","lock_timeout='150ms'"),'lock timeout');assert flags()=='falsefalsefalse'
 held.stdin.write('COMMIT;\\q\n');held.stdin.flush();held.wait(timeout=10)
 db.sql(script);assert flags()=='truetruetrue'
 # Retry must not update even the tuples, preserving admission revision semantics.
 identity=db.sql('SELECT xmin::text FROM sgp_lp_operacion.config UNION ALL SELECT xmin::text FROM sgp_lp_operacion.perfil_roles')
 db.sql(script);assert identity==db.sql('SELECT xmin::text FROM sgp_lp_operacion.config UNION ALL SELECT xmin::text FROM sgp_lp_operacion.perfil_roles')
 assert before==db.sql('SELECT jsonb_agg(to_jsonb(p) ORDER BY key_produccion) FROM public.sgp_producciones p')
 assert db.snapshot(token='se')['individualClose'] and db.snapshot('EMPAQUE',token='sp')['individualClose']
 checks.append('Exclusive activation waits for role containment; timeout changes nothing; success and retry preserve data/tuple versions and stage scopes')
 db.sql((f.ROOT/'docs/sql-proposals/lp01-operacion/02_CONTENER_REVIEW.sql').read_text())
 assert flags()=='falsetruetrue'
 f.deny(db,script,'LP_ACTIVATION_STATE_NOT_APPROVED')
 checks.append('Recovery contains writes while retaining profile/history; mixed state cannot silently reactivate')
 out={'status':'PASS','synthetic':True,'postgres':'17.11','script_sha256':hashlib.sha256(script.encode()).hexdigest(),'checks':checks,'limits':['Synthetic accounts and source data only; not proof of real user operations','No credentials, external network or production changes; temporary ACL changes confined to synthetic PostgreSQL']}
 (Path(__file__).parent/'evidence/activation.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
finally:db.close()
