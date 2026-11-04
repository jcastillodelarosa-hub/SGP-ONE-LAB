"""Real PostgREST + PG17.11 in network-none namespace. Synthetic identities only."""
from pathlib import Path
import importlib.util,subprocess,json,time,hashlib
ROOT=Path(__file__).resolve().parents[2];HERE=Path(__file__).parent;PKG=ROOT/'docs/sql-proposals/lp01-seguimiento'
spec=importlib.util.spec_from_file_location('roles_fixture',ROOT/'tests/lp01-roles/postgres.py');f=importlib.util.module_from_spec(spec);spec.loader.exec_module(f)
IMAGE='postgrest/postgrest:v13.0.7@sha256:0a46780309a604cdc8b56c776c6e5e15788ce58174d709e40459ab5a2d44d228'
def request(db,method,path,payload=None):
 body=json.dumps(payload).encode() if payload is not None else b''
 raw=(f'{method} {path} HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\nContent-Type: application/json\r\nContent-Length: {len(body)}\r\n\r\n').encode()+body
 r=subprocess.run(db.docker+['exec','-i',db.container,'bash','-c','exec 3<>/dev/tcp/127.0.0.1/3000\ncat >&3\ncat <&3'],env=db.env,input=raw,capture_output=True,timeout=10)
 if r.returncode:raise RuntimeError('Local API not ready')
 head,body=r.stdout.split(b'\r\n\r\n',1);status=int(head.split()[1]);return status,json.loads(body) if body else None
checks=[];db=f.Database();api=db.container+'-api'
try:
 key,parts=f.setup(db);db.seed('UNASSIGNED|PANELES_2',parts=())
 # Synthetic, network-none database only: reproduce the observed public defaults.
 db.sql('ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon,authenticated,service_role;ALTER ROLE service_role BYPASSRLS;')
 default_metadata="SELECT jsonb_agg(jsonb_build_array(defaclrole,defaclnamespace,defaclobjtype,defaclacl) ORDER BY oid) FROM pg_default_acl"
 defaults_before=db.sql(default_metadata)
 existing_metadata="SELECT jsonb_agg(jsonb_build_array(p.oid,p.proowner,p.proacl,p.prosecdef,p.proconfig) ORDER BY p.oid) FROM pg_proc p WHERE p.pronamespace IN('public'::regnamespace,'sgp_lp_operacion'::regnamespace) AND p.proname NOT IN('sgp_lp_seguimiento_consultar','seguimiento_prototipo')"
 existing_before=db.sql(existing_metadata)
 # Unknown future columns and opaque payload values must not escape the allowlist.
 for table in ['public.sgp_producciones','public.sgp_linea_plan_asignaciones','sgp_lp_operacion.ordenes','sgp_lp_operacion.auditoria']:
  db.sql('ALTER TABLE '+table+" ADD COLUMN qa_private_future text DEFAULT 'DO_NOT_EXPOSE'")
 db.execute(db.cmd('ABRIR'));db.execute(db.cmd('SALE',key=key,part=parts[0],quantity=3,observation='QA visible note'))
 installer=(PKG/'INSTALL_REVIEW.sql').read_text()
 metadata="SELECT jsonb_agg(jsonb_build_array(oid,proowner,proacl,prosecdef,proconfig) ORDER BY oid) FROM pg_proc WHERE oid IN ('public.sgp_lp_operacion_comando(text,jsonb)'::regprocedure,'sgp_lp_operacion.operaciones_rol(text,text)'::regprocedure)"
 before=db.sql(metadata)
 backup=json.loads(db.sql((PKG/'PREFLIGHT_READ_ONLY.sql').read_text()));assert backup['functions']
 oldbody=db.sql("SELECT md5(prosrc) FROM pg_proc WHERE oid='public.sgp_lp_operacion_comando(text,jsonb)'::regprocedure")
 # Removing the one-line fix must reproduce the real preflight failure, atomically.
 revoke_service='REVOKE ALL ON FUNCTION public.sgp_lp_seguimiento_consultar(text,text,text) FROM service_role;'
 assert installer.count(revoke_service)==1
 uncorrected=db.run(installer.replace(revoke_service,''))
 assert uncorrected.returncode and 'UNEXPECTED_FUNCTION_ACL' in uncorrected.stderr
 assert db.sql("SELECT to_regprocedure('public.sgp_lp_seguimiento_consultar(text,text,text)') IS NULL")=='t'
 assert db.sql("SELECT md5(prosrc) FROM pg_proc WHERE oid='public.sgp_lp_operacion_comando(text,jsonb)'::regprocedure")==oldbody
 assert db.sql(default_metadata)==defaults_before and db.sql(existing_metadata)==existing_before
 failed=db.run(installer.replace('NOTIFY pgrst,',"SELECT 1/0;NOTIFY pgrst,"));assert failed.returncode
 assert db.sql("SELECT to_regprocedure('public.sgp_lp_seguimiento_consultar(text,text,text)') IS NULL")=='t'
 assert db.sql("SELECT md5(prosrc) FROM pg_proc WHERE oid='public.sgp_lp_operacion_comando(text,jsonb)'::regprocedure")==oldbody
 db.sql(installer);assert db.sql(metadata)==before
 assert db.sql(default_metadata)==defaults_before and db.sql(existing_metadata)==existing_before
 for role in ['anon','authenticated','service_role']:
  assert db.sql("SELECT has_function_privilege('"+role+"','public.sgp_lp_seguimiento_consultar(text,text,text)','EXECUTE')")=='f'
  denied=db.run("SET ROLE "+role+";SELECT public.sgp_lp_seguimiento_consultar('COORDINADOR','ENSAMBLE','PANELES_2')")
  assert denied.returncode and 'permission denied for function sgp_lp_seguimiento_consultar' in denied.stderr
 checks.append('Observed public default EXECUTE grants reproduced only in isolated fixture; old installer rejected atomically; corrected install denies anon/authenticated/service_role and preserves default ACL plus existing function metadata')
 assert db.run(installer).returncode
 checks.append('Atomic installer rollback on forced failure; repeated install refuses existing objects; existing OID/owner/ACL/SECURITY/search_path preserved')
 db.sql('CREATE ROLE qa_api_authenticator LOGIN NOINHERIT;GRANT anon TO qa_api_authenticator;')
 subprocess.run(db.docker+['run','-d','--rm','--network','container:'+db.container,'--name',api,'-e','PGRST_DB_URI=postgres://qa_api_authenticator@127.0.0.1:5432/postgres','-e','PGRST_DB_SCHEMAS=public','-e','PGRST_DB_ANON_ROLE=anon','-e','PGRST_SERVER_HOST=127.0.0.1','-e','GHCRTS=-N2',IMAGE],env=db.env,check=True,capture_output=True)
 for _ in range(100):
  try:request(db,'GET','/');break
  except Exception:time.sleep(.1)
 else:raise AssertionError('PostgREST startup failed')
 def call(token='COORDINADOR',stage='ENSAMBLE',line='PANELES_2',**extra):return request(db,'POST','/rpc/sgp_lp_seguimiento_consultar',dict(p_token=token,p_etapa=stage,p_linea=line,**extra))
 assert call()[0] in [401,403,404]
 db.sql((PKG/'ENABLE_API_REVIEW.sql').read_text())
 service_denied=db.run("SET ROLE service_role;SELECT public.sgp_lp_seguimiento_consultar('COORDINADOR','ENSAMBLE','PANELES_2')")
 assert service_denied.returncode and 'permission denied for function sgp_lp_seguimiento_consultar' in service_denied.stderr
 assert db.sql(default_metadata)==defaults_before
 for _ in range(60):
  status,result=call()
  if status==200:break
  time.sleep(.1)
 assert status==200,(status,result)
 allowed={'identity','key','line','stage','oficial','saldo','classification','history','assignments','operations'}
 assert all(set(p)==allowed for p in result['productions'])
 assert 'DO_NOT_EXPOSE' not in json.dumps(result) and 'qa_private' not in json.dumps(result)
 assert any(p['key']=='UNASSIGNED|PANELES_2' and not p['assignments'] for p in result['productions'])
 for token in ['COORDINADOR','QAADMIN']:
  for stage in ['ENSAMBLE','EMPAQUE']:assert call(token,stage)[0]==200
 for token in ['', 'invalid', 'se','sp','ll','CONSULTA']:
  status,result=call(token);assert status>=400,(token,status,result)
 for stage,line in [('OTHER','PANELES_2'),('ENSAMBLE','FRAMES_2'),('ENSAMBLE','OTHER')]:assert call(stage=stage,line=line)[0]>=400
 assert call(role='ADMINISTRADOR')[0]>=400
 for path in ['/sgp_producciones','/sgp_linea_plan_asignaciones','/rpc/seguimiento_prototipo']:
  status,_=request(db,'GET' if '/rpc/' not in path else 'POST',path,{} if '/rpc/' in path else None);assert status>=400,(path,status)
 assert db.run("SET ROLE authenticated;SELECT public.sgp_lp_seguimiento_consultar('COORDINADOR','ENSAMBLE','PANELES_2')").returncode
 assert db.run("SET ROLE anon;SELECT sgp_lp_operacion.seguimiento_prototipo('COORDINADOR','ENSAMBLE','PANELES_2')").returncode
 checks.append('Actual HTTP PostgREST: blocked before enable; anon-only facade allows coordinator/admin stages; invalid/forged roles/session/scope and private/table access denied; future columns/payload excluded')
 db.sql("UPDATE public.sgp_sesiones_app SET revocado_en=now() WHERE id_usuario=(SELECT id_usuario FROM public.sgp_usuarios WHERE usuario='COORDINADOR')")
 assert call()[0]>=400
 db.sql("UPDATE public.sgp_sesiones_app SET revocado_en=NULL WHERE id_usuario=(SELECT id_usuario FROM public.sgp_usuarios WHERE usuario='COORDINADOR');UPDATE public.sgp_usuario_accesos SET permitido=false WHERE id_usuario=(SELECT id_usuario FROM public.sgp_usuarios WHERE usuario='COORDINADOR')")
 assert call()[0]>=400
 db.sql("UPDATE public.sgp_usuario_accesos SET permitido=true WHERE id_usuario=(SELECT id_usuario FROM public.sgp_usuarios WHERE usuario='COORDINADOR')")
 db.sql("UPDATE public.sgp_usuarios SET activo=false WHERE usuario='COORDINADOR'")
 assert call()[0]>=400
 db.sql("UPDATE public.sgp_usuarios SET activo=true WHERE usuario='COORDINADOR';UPDATE public.sgp_sesiones_app SET expira_en=now()-interval '1 second' WHERE id_usuario=(SELECT id_usuario FROM public.sgp_usuarios WHERE usuario='COORDINADOR')")
 assert call()[0]>=400
 db.sql("UPDATE public.sgp_sesiones_app SET expira_en=now()+interval '1 day' WHERE id_usuario=(SELECT id_usuario FROM public.sgp_usuarios WHERE usuario='COORDINADOR')")
 checks.append('Live local HTTP calls reject revoked/expired session, inactive account and effective access')
 # Removal cannot bypass containment. Safe recovery never restores broader VALIDAR.
 assert db.run((PKG/'REMOVE_REVIEW.sql').read_text()).returncode
 db.sql((PKG/'CONTAIN_REVIEW.sql').read_text());assert call()[0]>=400
 db.sql("CREATE VIEW public.qa_tracking_dependency AS SELECT public.sgp_lp_seguimiento_consultar('COORDINADOR','ENSAMBLE','PANELES_2') AS result")
 assert db.run((PKG/'REMOVE_REVIEW.sql').read_text()).returncode
 assert db.sql("SELECT to_regprocedure('public.sgp_lp_seguimiento_consultar(text,text,text)') IS NOT NULL")=='t'
 db.sql('DROP VIEW public.qa_tracking_dependency')
 db.sql((PKG/'REMOVE_REVIEW.sql').read_text())
 assert db.sql("SELECT to_regprocedure('public.sgp_lp_seguimiento_consultar(text,text,text)') IS NULL")=='t'
 assert db.sql("SELECT 'VALIDAR'=ANY(sgp_lp_operacion.operaciones_rol('ADMINISTRADOR','ENSAMBLE'))")=='f'
 db.sql(installer);assert db.sql("SELECT has_function_privilege('anon','public.sgp_lp_seguimiento_consultar(text,text,text)','EXECUTE')")=='f'
 checks.append('Remove requires containment; rollback removes only new reader/facade and preserves coordinator-only validation; reinstallation remains revoked')
 assert db.sql(default_metadata)==defaults_before and db.sql(existing_metadata)==existing_before
 assert db.sql("SELECT has_function_privilege('service_role','public.sgp_lp_seguimiento_consultar(text,text,text)','EXECUTE')")=='f'
 checks.append('service_role with BYPASSRLS cannot execute the facade before/after API enable; containment/removal/reinstallation preserve project default ACLs and all preexisting function metadata')
 output={'status':'PASS','checks':checks,'postgrest_image':IMAGE,'isolation':'network none; local synthetic authenticator only','production_operations':0,'default_acl_fixture':'postgres/public EXECUTE: postgres, anon, authenticated, service_role; unchanged by candidate','package_sha256':json.loads((PKG/'package-pins.json').read_text())['files']}
 (HERE/'api-result.json').write_text(json.dumps(output,indent=2)+'\n');print(json.dumps(output))
finally:
 subprocess.run(db.docker+['rm','-f',api],env=db.env,capture_output=True);db.close()
