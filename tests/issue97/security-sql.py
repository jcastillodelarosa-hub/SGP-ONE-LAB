"""Real supplied SGP auth definitions + synthetic movement fixture, existing networkless PG17.
Does not connect to Supabase or apply any production SQL. Retains the fresh QA DB.
"""
import hashlib,json,pathlib,re,subprocess,time
ROOT=pathlib.Path(__file__).resolve().parents[2];C='sgp-pdt-qa-91';D=ROOT/'docs/sql-proposals/mecanizado';OUT=ROOT/'tests/issue97/evidence'
meta=json.loads(subprocess.check_output(['docker','inspect',C]))[0]
assert meta['HostConfig']['NetworkMode']=='none' and not meta['HostConfig'].get('PortBindings')
db='sgp_pdt_qa_91_reprogramming_'+str(time.time_ns());subprocess.run(['docker','exec',C,'createdb','-U','postgres',db],check=True)
def call(q):return subprocess.run(['docker','exec','-i',C,'psql','-X','-qAt','-U','postgres','-d',db,'-v','ON_ERROR_STOP=1'],input=q,text=True,capture_output=True)
def sql(q):
 r=call(q)
 if r.returncode:raise RuntimeError(r.stderr)
 return r.stdout.strip()
results=[]
def verify(name,condition):
 if not condition:raise AssertionError(name)
 results.append(name)
def deny(q):return call('BEGIN READ ONLY;SET LOCAL ROLE anon;'+q+';ROLLBACK;').returncode!=0
sql('CREATE SCHEMA extensions;CREATE EXTENSION pgcrypto WITH SCHEMA extensions;')
sql('CREATE TABLE public.sgp_usuarios(id_usuario uuid PRIMARY KEY DEFAULT gen_random_uuid(),usuario text,nombre text,rol text,activo boolean DEFAULT true);CREATE TABLE public.sgp_sesiones_app(id_usuario uuid,token_hash text,revocado_en timestamptz,expira_en timestamptz);')
a=json.loads((ROOT/'scripts/pdt-compatibility/evidence/PDT_FUNCIONES_REALES.json').read_text())['funciones'];b=json.loads((ROOT/'scripts/pdt-compatibility/evidence/PDT_COMPLEMENTO_REAL.json').read_text())['funciones_faltantes'];auth=[]
for f in a+b:
 if f['firma'].startswith(('sgp_validar_sesion_rol(','sgp_sesion_actual(')):
  definition=f['definicion'].replace('\r\n','\n');sql(definition+';');auth.append({'signature':f['firma'],'md5':hashlib.md5(definition.encode()).hexdigest()})
assert len(auth)==2
roles=['ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO','LIDER','LIDER LINEA','CONSULTA','RECEPCION','PATINADOR','PICKING','SUPERVISOR DE PICKING','UNKNOWN']
for role in roles:
 sql("INSERT INTO public.sgp_usuarios(usuario,nombre,rol) VALUES('"+role+"','QA synthetic','"+role+"');")
sql("INSERT INTO sgp_sesiones_app SELECT id_usuario,encode(extensions.digest(usuario,'sha256'),'hex'),NULL,now()+interval '1 day' FROM sgp_usuarios;")
sql("INSERT INTO sgp_sesiones_app SELECT id_usuario,encode(extensions.digest('EXPIRED','sha256'),'hex'),NULL,now()-interval '1 hour' FROM sgp_usuarios WHERE usuario='COORDINADOR';INSERT INTO sgp_sesiones_app SELECT id_usuario,encode(extensions.digest('REVOKED','sha256'),'hex'),now(),now()+interval '1 day' FROM sgp_usuarios WHERE usuario='COORDINADOR';")
sql("CREATE TABLE public.sgp_mecanizado_reprogramaciones(id_origen uuid,id_destino uuid,produccion text,creado_en timestamptz,motivo_privado text);ALTER TABLE public.sgp_mecanizado_reprogramaciones ENABLE ROW LEVEL SECURITY;ALTER TABLE public.sgp_mecanizado_reprogramaciones FORCE ROW LEVEL SECURITY;REVOKE ALL ON public.sgp_mecanizado_reprogramaciones FROM PUBLIC,anon,authenticated,service_role;INSERT INTO public.sgp_mecanizado_reprogramaciones SELECT md5('origin'||n)::uuid,md5('target'||n)::uuid,'QA'||n,'2026-10-26T12:00:00Z'::timestamptz,'not returned' FROM generate_series(1,4)n;")
fp="SELECT md5(coalesce((SELECT string_agg(to_jsonb(r)::text,'|' ORDER BY id_origen) FROM public.sgp_mecanizado_reprogramaciones r),''))||'|'||relrowsecurity||'|'||relforcerowsecurity||'|'||coalesce(relacl::text,'')||'|'||(SELECT count(*) FROM pg_policy WHERE polrelid=c.oid) FROM pg_class c WHERE oid='public.sgp_mecanizado_reprogramaciones'::regclass"
before=sql(fp);helpers=sql("SELECT string_agg(md5(pg_get_functiondef(oid)),'|' ORDER BY proname) FROM pg_proc WHERE oid IN ('public.sgp_sesion_actual(text)'::regprocedure,'public.sgp_validar_sesion_rol(text,text[])'::regprocedure)")
proposal=(D/'20261026_reprogramaciones_lectura_v355_REVIEW.sql').read_text();inverse=(D/'20261026_reprogramaciones_lectura_v355_ROLLBACK_REVIEW.sql').read_text()
# Actual file in one transaction; both DDL and grants disappear on rollback.
sql(proposal.replace('COMMIT;','ROLLBACK;'))
verify('transactional installation rollback removes RPC',sql("SELECT to_regprocedure('public.sgp_mecanizado_reprogramaciones_listar(text)') IS NULL")=='t')
verify('rollback preserves rows/table ACL/RLS/policies',sql(fp)==before)
sql(proposal)
for role in roles[:6]:
 for technical in ['anon','authenticated']:
  data=json.loads(sql("BEGIN READ ONLY;SET LOCAL ROLE "+technical+";SELECT public.sgp_mecanizado_reprogramaciones_listar('"+role+"');ROLLBACK;"))
  verify(role+' through '+technical+' returns exactly four minimal linked rows',len(data)==4 and all(set(row)=={'id_origen','id_destino','produccion','creado_en'} and row['id_destino'] for row in data))
for role in roles[6:]:verify(role+' denied',deny("SELECT public.sgp_mecanizado_reprogramaciones_listar('"+role+"')"))
for token in ["NULL","''","'EXPIRED'","'REVOKED'","'NOT_A_SESSION'"]:verify('invalid session '+token+' denied',deny('SELECT public.sgp_mecanizado_reprogramaciones_listar('+token+')'))
# The legacy alias still works elsewhere, but not in this read RPC.
verify('legacy RECEPCION to LIDER equivalence unchanged',bool(sql("SELECT public.sgp_validar_sesion_rol('RECEPCION',ARRAY['LIDER'])")))
verify('direct SELECT remains denied',deny('SELECT * FROM public.sgp_mecanizado_reprogramaciones'))
verify('PUBLIC has no EXECUTE',sql("SELECT NOT EXISTS(SELECT 1 FROM pg_proc p, LATERAL aclexplode(p.proacl) a WHERE p.oid='public.sgp_mecanizado_reprogramaciones_listar(text)'::regprocedure AND a.grantee=0 AND a.privilege_type='EXECUTE')")=='t')
verify('service_role not granted this RPC',sql("SELECT NOT has_function_privilege('service_role','public.sgp_mecanizado_reprogramaciones_listar(text)','EXECUTE')")=='t')
verify('stable definer owned by postgres with empty search_path',sql("SELECT prosecdef AND provolatile='s' AND proowner='postgres'::regrole AND proconfig=ARRAY['search_path=\"\"'] FROM pg_proc WHERE oid='public.sgp_mecanizado_reprogramaciones_listar(text)'::regprocedure")=='t')
verify('rows/ACL/RLS/policies preserved after installation and reads',sql(fp)==before)
verify('auth definitions unchanged',sql("SELECT string_agg(md5(pg_get_functiondef(oid)),'|' ORDER BY proname) FROM pg_proc WHERE oid IN ('public.sgp_sesion_actual(text)'::regprocedure,'public.sgp_validar_sesion_rol(text,text[])'::regprocedure)")==helpers)
verify('unexpected existing RPC blocks reinstallation',call(proposal).returncode!=0)
original=sql("SELECT pg_get_functiondef('public.sgp_mecanizado_reprogramaciones_listar(text)'::regprocedure)")
sql(original.replace('DECLARE sesion jsonb;', '-- QA changed body\nDECLARE sesion jsonb;'))
verify('inverse refuses a subsequently modified function',call(inverse).returncode!=0)
sql(original)
sql(inverse)
verify('guarded inverse removes only RPC',sql("SELECT to_regprocedure('public.sgp_mecanizado_reprogramaciones_listar(text)') IS NULL")=='t' and sql(fp)==before)
# Retain an installed copy for independent review of the fresh isolated database.
sql(proposal)
report={'status':'PASS','postgres':sql('SELECT version()'),'database':db,'network':'none','production_access':False,'auth_definitions':auth,'sql_sha256':hashlib.sha256(proposal.encode()).hexdigest(),'assertions':len(results),'results':results,'limits':'Supplied auth function bodies; synthetic users/sessions/table. Not an entire Supabase replica.'}
(OUT/'rpc-security-results.json').write_text(json.dumps(report,indent=2));print(json.dumps({'status':report['status'],'assertions':len(results),'database':db}))
