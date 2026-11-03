"""Replay catalog ACL in isolated PG only; never changes or exploits productive data."""
from pathlib import Path
import importlib.util,json,subprocess
sp=importlib.util.spec_from_file_location('role_fixture',Path(__file__).with_name('postgres.py'));f=importlib.util.module_from_spec(sp);sp.loader.exec_module(f)
HERE=Path(__file__).parent;checks=[]
# Pre-review SQL10 did not reject the observed ACL; prove revocation bypass without productive calls.
old=subprocess.check_output(['git','show','b4cf8c8:docs/sql-proposals/lp01-operacion/10_roles_cierre_individual_REVIEW.sql'],cwd=f.ROOT,text=True)
db=f.Database()
try:
 current=(f.ROOT/'docs/sql-proposals/lp01-operacion/10_roles_cierre_individual_REVIEW.sql').read_text()
 # setup uses the current contained installer on a secured fixture first.
 f.setup(db)
 db.sql('ALTER TABLE public.sgp_rol_accesos DISABLE ROW LEVEL SECURITY;ALTER TABLE public.sgp_usuario_accesos DISABLE ROW LEVEL SECURITY;GRANT ALL ON public.sgp_rol_accesos,public.sgp_usuario_accesos TO anon,authenticated;ALTER TABLE public.sgp_usuarios ENABLE ROW LEVEL SECURITY;ALTER TABLE public.sgp_sesiones_app ENABLE ROW LEVEL SECURITY')
 db.sql("UPDATE public.sgp_rol_accesos SET permitido=false WHERE rol='SUPERVISOR ENSAMBLE'")
 try:db.snapshot(token='se');raise AssertionError('Revocation not set')
 except RuntimeError as e:assert 'AMBITO' in str(e)
 db.sql("SET ROLE anon;UPDATE public.sgp_rol_accesos SET permitido=true WHERE rol='SUPERVISOR ENSAMBLE'")
 assert db.snapshot(token='se')['individualClose']
 checks.append('Observed unsafe grants/RLS replayed only synthetically: direct anon update restores revoked supervisor access; no user-role escalation alleged')
finally:db.close()
# Build native/SQL08 prerequisites and replay the same unsafe grants BEFORE installing SQL10.
db=f.Database()
try:
 db.seed();f.install_catalog(db)
 db.sql('CREATE ROLE service_role');db.sql((f.ROOT/'docs/sql-proposals/lp01-operacion/06_powerbi_xlsx_REVIEW.sql').read_text());db.sql('UPDATE sgp_lp_operacion.config SET escrituras=false WHERE id');db.sql((f.ROOT/'docs/sql-proposals/lp01-operacion/08_ambitos_temporales_REVIEW.sql').read_text())
 db.sql('ALTER TABLE public.sgp_rol_accesos DISABLE ROW LEVEL SECURITY;ALTER TABLE public.sgp_usuario_accesos DISABLE ROW LEVEL SECURITY;GRANT ALL ON public.sgp_rol_accesos,public.sgp_usuario_accesos TO anon,authenticated')
 # The historical installer admitted this schema, then roll back the complete attempt.
 result=db.run(old.replace('COMMIT;','SELECT 1/0;COMMIT;'));assert result.returncode and 'division by zero' in result.stderr,result.stderr
 assert db.sql("SELECT to_regclass('sgp_lp_operacion.perfil_roles') IS NULL")=='t'
 before=db.sql("SELECT jsonb_agg(jsonb_build_object('n',c.relname,'acl',c.relacl::text,'rls',c.relrowsecurity) ORDER BY c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN('sgp_usuarios','sgp_sesiones_app','sgp_rol_accesos','sgp_usuario_accesos')")
 result=db.run(current);assert result.returncode and 'CATALOGO_ACCESOS_DML_CLIENTE' in result.stderr,result.stderr
 assert db.sql("SELECT to_regclass('sgp_lp_operacion.perfil_roles') IS NULL")=='t'
 assert before==db.sql("SELECT jsonb_agg(jsonb_build_object('n',c.relname,'acl',c.relacl::text,'rls',c.relrowsecurity) ORDER BY c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN('sgp_usuarios','sgp_sesiones_app','sgp_rol_accesos','sgp_usuario_accesos')")
 checks.append('b4cf8c8 installer admitted real-ACL replica; revised preflight rejects it atomically before creating objects or catalog defaults')
 # Isolated variant: removing table grants but leaving a column grant must still fail.
 db.sql('REVOKE ALL ON public.sgp_rol_accesos,public.sgp_usuario_accesos FROM anon,authenticated;GRANT UPDATE(permitido) ON public.sgp_rol_accesos TO anon')
 result=db.run(current);assert result.returncode and 'CATALOGO_ACCESOS_DML_CLIENTE' in result.stderr
 assert db.sql("SELECT to_regclass('sgp_lp_operacion.perfil_roles') IS NULL")=='t'
 checks.append('Column-only UPDATE grant also rejected atomically; no false safety from removing only table-level grants')
 checks.append('No ACL repair, no RLS toggle in SQL10; privilege correction requires separate authorized cross-module review')
finally:db.close()
# On a secured fixture, replacement must preserve owners/ACL/security/RLS and remain disabled.
db=f.Database()
try:
 db.seed();f.install_catalog(db);db.sql('CREATE ROLE service_role');db.sql((f.ROOT/'docs/sql-proposals/lp01-operacion/06_powerbi_xlsx_REVIEW.sql').read_text());db.sql('UPDATE sgp_lp_operacion.config SET escrituras=false WHERE id');db.sql((f.ROOT/'docs/sql-proposals/lp01-operacion/08_ambitos_temporales_REVIEW.sql').read_text())
 query="SELECT jsonb_object_agg(p.oid::text,jsonb_build_object('signature',pg_get_function_identity_arguments(p.oid),'owner',p.proowner,'acl',p.proacl::text,'definer',p.prosecdef,'config',p.proconfig)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='sgp_lp_operacion' OR(n.nspname='public' AND p.proname='sgp_admin_usuario_guardar')"
 before=json.loads(db.sql(query));tables=db.sql("SELECT jsonb_agg(jsonb_build_object('id',oid,'acl',relacl::text,'rls',relrowsecurity) ORDER BY oid) FROM pg_class WHERE oid IN('public.sgp_usuarios'::regclass,'public.sgp_sesiones_app'::regclass,'public.sgp_rol_accesos'::regclass,'public.sgp_usuario_accesos'::regclass)")
 db.sql(current);after=json.loads(db.sql(query));assert all(after.get(k)==v for k,v in before.items())
 assert tables==db.sql("SELECT jsonb_agg(jsonb_build_object('id',oid,'acl',relacl::text,'rls',relrowsecurity) ORDER BY oid) FROM pg_class WHERE oid IN('public.sgp_usuarios'::regclass,'public.sgp_sesiones_app'::regclass,'public.sgp_rol_accesos'::regclass,'public.sgp_usuario_accesos'::regclass)")
 assert db.sql('SELECT habilitado FROM sgp_lp_operacion.perfil_roles')=='f'
 assert db.sql("SELECT relrowsecurity FROM pg_class WHERE oid='sgp_lp_operacion.perfil_roles'::regclass")=='t'
 f.deny(db,'SET ROLE anon;SELECT * FROM sgp_lp_operacion.perfil_roles','permission denied')
 checks.append('Secured fixture: installation preserves all previous function OIDs/signatures/owners/ACL/SECURITY/search_path and native table ACL/RLS; profile false/private RLS enabled')
finally:db.close()
(HERE/'evidence/compatibility.json').write_text(json.dumps({'status':'PASS_ISOLATED_CHECKS','installation_verdict':'BLOCKED_REAL_ACL','synthetic':True,'checks':checks,'production_operations':'SELECT catalog only; zero DDL/DML'},indent=2)+'\n');print(json.dumps(checks,indent=2))
