"""Current complete chain pins reject each drift before activation; isolated only."""
import json,hashlib
from pathlib import Path
from current_chain import Fixture,lit
HERE=Path(__file__).parent;ROOT=HERE.parents[1]
x=Fixture.__new__(Fixture)
try:
 x.__init__(install_affectations=False);db=x.db
 assert db.sql("SELECT count(*) FROM pg_default_acl WHERE defaclnamespace='public'::regnamespace AND defaclobjtype='f'")=='1'
 sql=(ROOT/'docs/sql-proposals/lp01-afectaciones/03_pdt_atomico_REVIEW.sql').read_text()
 pins=json.loads((HERE/'production-readonly/required-chain.json').read_text());checks=[]
 for pin in pins:
  sig=pin['signature'];definition=db.sql('SELECT pg_get_functiondef('+lit(sig)+'::regprocedure)')
  actual=db.sql('SELECT md5(prosrc) FROM pg_proc WHERE oid='+lit(sig)+'::regprocedure');assert actual==pin['body_md5'],(sig,actual)
  db.sql('DO $$ DECLARE d text;b text;BEGIN SELECT pg_get_functiondef(oid),prosrc INTO d,b FROM pg_proc WHERE oid='+lit(sig)+"::regprocedure;EXECUTE replace(d,b,b||E'\\n-- QA incompatible body');END $$")
  try:
   result=db.run(sql);assert result.returncode and 'PDT_CONTRATO_INCOMPATIBLE' in result.stderr,(sig,result.stderr)
   assert db.sql("SELECT to_regclass('sgp_lp_afectaciones.pdt_recibos') IS NULL")=='t'
  finally:db.sql(definition)
  checks.append({'signature':sig,'body_md5':actual,'drift_rejected':True})
 view=db.sql("SELECT pg_get_viewdef('public.sgp_produccion_reservas_v'::regclass,true)")
 assert db.sql("SELECT md5(pg_get_viewdef('public.sgp_produccion_reservas_v'::regclass,true))")=='f0edf5a04ac0d41b841412c0d0c58fbb'
 db.sql('CREATE OR REPLACE VIEW public.sgp_produccion_reservas_v AS SELECT * FROM ('+view.rstrip(';')+') q WHERE true')
 try:
  result=db.run(sql);assert result.returncode and 'PDT_VISTA_RESERVAS_INCOMPATIBLE' in result.stderr
 finally:db.sql('CREATE OR REPLACE VIEW public.sgp_produccion_reservas_v AS '+view)
 assert db.run(sql.replace('COMMIT;','SELECT 1/0;COMMIT;')).returncode
 assert db.sql("SELECT to_regclass('sgp_lp_afectaciones.pdt_recibos') IS NULL")=='t'
 db.sql(sql)
 assert db.sql('SELECT NOT writes AND NOT atomic_pdt AND NOT pdt_links AND NOT physical FROM sgp_lp_afectaciones.config')=='t'
 assert db.sql("SELECT NOT has_function_privilege('anon','public.sgp_lp_afectaciones_aluminio_v1(text,text,text,date,int,jsonb,jsonb)','EXECUTE')")=='t'
 for role in ['anon','authenticated','service_role']:
  assert db.sql("SELECT NOT has_function_privilege("+lit(role)+",'public.sgp_lp_afectaciones_aluminio_v1(text,text,text,date,int,jsonb,jsonb)','EXECUTE')")=='t'
 out={'status':'PASS','environment':'PostgreSQL17.11 network none synthetic full catalog','sql03_sha256':hashlib.sha256(sql.encode()).hexdigest(),'functions':checks,'reserve_view_drift_rejected':True,'install_rollback':True,'default_disabled_no_api_grants':True}
 (HERE/'chain-guards-result.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out))
finally:
 if hasattr(x,'db'):x.close()
