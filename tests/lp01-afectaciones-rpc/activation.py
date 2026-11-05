"""Production-equivalent default ACL, six API grants and staged flags; synthetic only."""
import json,hashlib
from pathlib import Path
from current_chain import Fixture
HERE=Path(__file__).parent;ROOT=HERE.parents[1];D=ROOT/'docs/sql-proposals/lp01-afectaciones'
x=Fixture.__new__(Fixture)
try:
 x.__init__();db=x.db
 # Fixture grants facilitate other tests; reset all seven to passive production ACL.
 db.sql("DO $$ DECLARE f record;BEGIN FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'sgp_lp_afectaciones_%' LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f.signature);END LOOP;END $$")
 assert db.sql("SELECT count(*) FROM pg_default_acl WHERE defaclnamespace='public'::regnamespace AND defaclobjtype='f'")=='1'
 fingerprints=json.loads(db.sql("SELECT jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'md5',md5(p.prosrc)) ORDER BY p.proname) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'sgp_lp_afectaciones_%'"))
 (HERE/'api-fingerprints.json').write_text(json.dumps(fingerprints,indent=2)+'\n')
 checks=[]
 for name,count in [('07_api_read_ACTIVATE.sql',2),('08_api_write_ACTIVATE.sql',6),('09_enable_writes_ACTIVATE.sql',6),('10_enable_aluminum_ACTIVATE.sql',6),('11_enable_physical_ACTIVATE.sql',6)]:
  sql=(D/name).read_text()
  if name=='09_enable_writes_ACTIVATE.sql':
   for role in ['PUBLIC','authenticated','service_role']:
    db.sql('GRANT EXECUTE ON FUNCTION public.sgp_lp_afectaciones_comando_v1(text,text,text,date,integer,jsonb) TO '+role)
    bad=db.run(sql);assert bad.returncode and 'UNEXPECTED_API_ACL' in bad.stderr
    assert db.sql('SELECT NOT writes FROM sgp_lp_afectaciones.config')=='t'
    db.sql('REVOKE EXECUTE ON FUNCTION public.sgp_lp_afectaciones_comando_v1(text,text,text,date,integer,jsonb) FROM '+role)
   signature="'public.sgp_lp_afectaciones_consultar_v2(text,text,text)'::regprocedure"
   original=db.sql('SELECT pg_get_functiondef('+signature+')')
   db.sql("DO $$ DECLARE d text;b text;BEGIN SELECT pg_get_functiondef(oid),prosrc INTO d,b FROM pg_proc WHERE oid="+signature+";EXECUTE replace(d,b,b||E'\\n-- drift');END $$")
   bad=db.run(sql);assert bad.returncode and 'API_BODY_OR_SECURITY_DRIFT' in bad.stderr
   db.sql(original)
  db.sql(sql)
  assert db.sql("SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'sgp_lp_afectaciones_%' AND has_function_privilege('anon',p.oid,'EXECUTE')")==str(count)
  assert db.sql("SELECT NOT has_function_privilege('anon','public.sgp_lp_afectaciones_consultar_v1(text,text,text)','EXECUTE')")=='t'
  for role in ['authenticated','service_role']:
   assert db.sql("SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'sgp_lp_afectaciones_%' AND has_function_privilege('"+role+"',p.oid,'EXECUTE')")=='0'
  for role in ['anon','authenticated','service_role']:
   assert db.sql("SELECT NOT has_schema_privilege('"+role+"','sgp_lp_afectaciones','USAGE')")=='t'
  response=x.read2();assert response['contract']=='LP-AFFECTATIONS-2'
  checks.append({'file':name,'sha256':hashlib.sha256(sql.encode()).hexdigest(),'anon_api_count':count})
 assert db.sql('SELECT writes AND physical AND pdt_links AND atomic_pdt FROM sgp_lp_afectaciones.config')=='t'
 assert db.run("SET ROLE anon; SELECT public.sgp_lp_afectaciones_consultar_v2('invalid','QA|PANELES_2','ENSAMBLE')").returncode
 (HERE/'activation-result.json').write_text(json.dumps({'status':'PASS','environment':'isolated PostgreSQL synthetic only','checks':checks,'v1_internal':True,'private_schema_denied':True,'other_roles_denied':True,'invalid_session_denied':True},indent=2)+'\n')
 print('activation PASS')
finally:
 if hasattr(x,'db'):x.close()
