"""Real supplied function bodies + synthetic data/dependency DDL. No production access."""
import sys,json,pathlib,subprocess,time,hashlib,re
sys.dont_write_bytecode=True
from installation_plan import ROOT,render
from real_fixture_adapter import adapt_program_inserts
container='sgp-pdt-qa-91'
meta=json.loads(subprocess.check_output(['docker','inspect',container]))[0]
if meta['HostConfig']['NetworkMode']!='none' or meta['HostConfig'].get('PortBindings'):raise SystemExit('Not isolated')
evidence=ROOT/'scripts/pdt-compatibility/evidence'
original=json.loads((evidence/'PDT_FUNCIONES_REALES.json').read_text())
complement=json.loads((evidence/'PDT_COMPLEMENTO_REAL.json').read_text())
refs={x['firma']:x['md5'] for x in complement['referencias_ya_disponibles']}
functions=original['funciones']+complement['funciones_faltantes']
verified=[]
for f in functions:
 body=f['definicion'].replace('\r\n','\n')
 expected=refs.get(f['firma'],f.get('md5'))
 if hashlib.md5(body.encode()).hexdigest()!=expected:raise SystemExit('MD5 mismatch: '+f['firma'])
 verified.append({'signature':f['firma'],'md5':expected})
database='sgp_pdt_qa_91_real_'+str(time.time_ns())
subprocess.run(['docker','exec',container,'createdb','-U','postgres',database],check=True)
def sql(text,label):
 result=subprocess.run(['docker','exec','-i',container,'psql','-X','-qAt','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1'],input=text,text=True,capture_output=True)
 if result.returncode:raise SystemExit(label+'\n'+result.stderr)
 return result.stdout.strip()
# Existing dependency model is explicit, never presented as a complete production schema.
base=(ROOT/'tests/sql/pdt/bootstrap.sql').read_text().split('CREATE FUNCTION public.sgp_validar_sesion_rol',1)[0]
columns=complement['columnas_programacion']
for c in columns:
 if not re.fullmatch(r'[a-z_]+',c['nombre']) or not re.fullmatch(r'[a-z (),0-9]+',c['tipo']):raise SystemExit('Unreviewed column identifier/type')
program='CREATE TABLE public.sgp_mecanizado_programacion('+','.join('"'+c['nombre']+'" '+c['tipo']+(' NOT NULL' if c['not_null'] else '') for c in columns)+');'
base=re.sub(r'CREATE TABLE public\.sgp_mecanizado_programacion\([^;]+;',lambda _:program,base)
sql(base,'dependency base')
sql((ROOT/'tests/sql/pdt/real-dependencies.sql').read_text(),'additional real function dependencies')
for f in functions:sql(f['definicion'].replace('\r\n','\n')+';','real function '+f['firma'])
for t in complement['triggers_programacion']:sql(t['definicion']+';','real trigger '+t['nombre'])
sql('CREATE TRIGGER trg_sgp_picking_no_duplicar_completa BEFORE INSERT ON public.sgp_picking_entregas FOR EACH ROW EXECUTE FUNCTION public.sgp_picking_rechazar_entrega_completa_duplicada();','duplicate trigger binding')
# Re-deparsed definitions must still match the supplied fingerprints before guards.
for f in verified:
 signature=f['signature'].replace("'","''")
 actual=sql("SELECT md5(pg_get_functiondef('public."+signature+"'::regprocedure))",'installed definition fingerprint')
 if actual!=f['md5']:raise SystemExit('Installed MD5 mismatch: '+f['signature'])
# Compare supplied metadata, not guessed ACLs for the seven bodies lacking ACL exports.
for f in complement['funciones_faltantes']:
 signature=f['firma'].replace("'","''")
 actual=json.loads(sql("SELECT json_build_object('owner',pg_get_userbyid(proowner),'definer',prosecdef,'returns_set',proretset,'return_type',pg_get_function_result(oid)) FROM pg_proc WHERE oid='public."+signature+"'::regprocedure",'metadata match'))
 if actual!={'owner':f['owner'],'definer':f['security_definer'],'returns_set':f['retorna_conjunto'],'return_type':f['retorno']}:raise SystemExit('Supplied metadata mismatch: '+f['firma'])
 for role,expected in f['execute'].items():
  if sql("SELECT has_function_privilege('"+role.replace("'","''")+"','public."+signature+"','EXECUTE')",'supplied EXECUTE privilege')!=('t' if expected else 'f'):raise SystemExit('Supplied privilege mismatch')
print('PASS all supplied function owner/return/security/EXECUTE metadata')
sql("CREATE TABLE qa_picking_defs AS SELECT oid,md5(pg_get_functiondef(oid)) digest,md5(prosrc) body_digest,proargtypes::text arg_types,prosecdef definer,proconfig,proowner FROM pg_proc WHERE proname='sgp_picking_entrega_orden';",'overload baseline')
sql("""CREATE FUNCTION public.qa_bound_entrega8(p_token text,p_id_programacion uuid,p_produccion text,p_completa boolean,p_observacion text,p_faltantes jsonb,p_fecha_entrega date,p_turno text)
RETURNS jsonb LANGUAGE sql BEGIN ATOMIC
 SELECT public.sgp_picking_entrega_orden(p_token,p_id_programacion,p_produccion,p_completa,p_observacion,p_faltantes,p_fecha_entrega,p_turno);
END;""",'known OID-bound caller')
ambiguous="EXPLAIN SELECT public.sgp_picking_entrega_orden(NULL::text,NULL::uuid,NULL::text,true::boolean,NULL::text,'[]'::jsonb);"
def check_ambiguity():
 result=subprocess.run(['docker','exec','-i',container,'psql','-X','-qAt','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1'],input=ambiguous,text=True,capture_output=True)
 if result.returncode==0 or 'is not unique' not in result.stderr:raise SystemExit('Unexpected six-argument resolution behavior')
check_ambiguity()
print('CONFIRMED pre-existing six-argument overload ambiguity')
compat=(ROOT/'docs/sql-proposals/pdt/20261025_picking_entrega_68_compat_REVIEW.sql').read_text()
recovery=(ROOT/'docs/sql-proposals/pdt/20261025_picking_entrega_68_rollback_REVIEW.sql').read_text()
# Include a non-default grant option, and require exact effective privilege parity.
sql("GRANT EXECUTE ON FUNCTION public.sgp_picking_entrega_orden(text,uuid,text,boolean,text,jsonb,date,text) TO authenticated WITH GRANT OPTION;",'grant-option fixture')
sql(compat,'compatibility lifecycle installation')
sql(compat,'compatibility idempotent reapplication')
# A new dependency on the public delegate must block recovery rather than break it.
from installation_plan import transaction_body
bound="""CREATE FUNCTION public.qa_wrapper_dependency(p_token text,p_id_programacion uuid,p_produccion text,p_completa boolean,p_observacion text,p_faltantes jsonb,p_fecha_entrega date,p_turno text)
RETURNS jsonb LANGUAGE sql BEGIN ATOMIC
 SELECT public.sgp_picking_entrega_orden(p_token,p_id_programacion,p_produccion,p_completa,p_observacion,p_faltantes,p_fecha_entrega,p_turno);
END;"""
r=subprocess.run(['docker','exec','-i',container,'psql','-X','-qAt','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1'],input='BEGIN;\n'+bound+'\n'+transaction_body(recovery)+'\nCOMMIT;',text=True,capture_output=True)
if r.returncode==0 or 'new wrapper has dependents' not in r.stderr:raise SystemExit('Recovery did not preserve new dependencies')
sql(recovery,'non-destructive original-interface recovery')
check_ambiguity()
sql(compat,'compatibility reinstallation')
sql(recovery,'original-interface recovery after reinstallation')
print('PASS compatibility lifecycle: install, idempotence, dependency stop, recovery, reinstall')
# Prove rollback with the supplied real bodies already installed, before publishing capabilities.
fault=render('AB').rsplit('COMMIT;',1)[0]+'SELECT 1/0;\nCOMMIT;'
r=subprocess.run(['docker','exec','-i',container,'psql','-X','-qAt','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1'],input=fault,text=True,capture_output=True)
if r.returncode==0 or 'division by zero' not in r.stderr:raise SystemExit('Atomic fault test did not reach injected failure:\n'+r.stderr)
if sql("SELECT to_regclass('public.sgp_pdt_fuentes') IS NULL AND NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.sgp_aluminio_pendientes'::regclass AND attname='contrato_pdt')",'rollback state')!='t':raise SystemExit('Partial DDL survived rollback')
for f in verified:
 if sql("SELECT md5(pg_get_functiondef('public."+f['signature'].replace("'","''")+"'::regprocedure))",'rollback real body')!=f['md5']:raise SystemExit('Real definition changed after rollback')
print('PASS atomic rollback preserves all 11 supplied definitions')
sql(render('A'),'atomic phase A')
# Same 63 acceptance assertions, using real bodies/session lookup and explicit real columns.
for name in ['phase-a.sql','phase-b.sql','regression-real-contracts.sql']:
 if name=='phase-b.sql':sql(render('B'),'atomic phase B')
 text=(ROOT/'tests/sql/pdt'/name).read_text().replace("'Rol no autorizado'","'PERMISO_DENEGADO'")
 if name=='regression-real-contracts.sql':
  a=text.index('CREATE OR REPLACE FUNCTION public.sgp_validar_sesion_rol');b=text.index('SELECT qa_assert',a)
  text=text[:a]+text[b:] # Do NOT replace real authorization with the behavioral mock.
 text=adapt_program_inserts(text)
 print(name,sql(text,name)[-220:])
print('ISOLATED REAL-CONTRACT DATABASE',database)
print('SUPPLIED FUNCTION HASHES VERIFIED',len(verified))
print('PROGRAMMING COLUMNS',len(columns),'TRIGGERS',len(complement['triggers_programacion']))

print('real-rpc-integration.sql',sql((ROOT/'tests/sql/pdt/real-rpc-integration.sql').read_text(),'real RPC integration')[-300:])
subprocess.run([sys.executable,str(ROOT/'tests/sql/pdt/concurrency.py'),database,'--real-contracts'],check=True)
report={'database':database,'production_access':False,'atomic_failure_rollback_verified':True,'compatibility_lifecycle_verified':True,'source_functions_verified':verified,
 'supplied_function_metadata_verified':True,'programming_columns':columns,'programming_triggers':complement['triggers_programacion'],
 'source_note':complement.get('nota_procedencia'),'schema_scope':'19 real programming columns; other dependency DDL reconstructed explicitly for tests',
 'extensions_available':sql("SELECT json_agg(json_build_object('name',name,'default_version',default_version)) FROM pg_available_extensions WHERE name IN ('pgcrypto','uuid-ossp','pg_stat_statements','supabase_vault','plpgsql')",'extension inventory')}
report_path=pathlib.Path('/tmp')/(database+'-report.json');report_path.write_text(json.dumps(report,indent=2))
resolution=subprocess.run(['docker','exec','-i',container,'psql','-X','-qAt','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1'],input=ambiguous,text=True,capture_output=True)
if resolution.returncode:raise SystemExit('Six-argument call is still ambiguous after compatibility migration')
report['legacy_six_call']='resolved; original eight-argument OID/body/ACL retained privately and public forwarder requires seven arguments, optional turno'
report_path.write_text(json.dumps(report,indent=2))
unchanged=[]
for f in verified:
 if f['signature'].startswith(('sgp_aluminio_pendiente_estado(','sgp_aluminio_pendiente_resolver(')):continue
 signature=f['signature']
 if signature=='sgp_picking_entrega_orden(text,uuid,text,boolean,text,jsonb,date,text)':
  definition=sql("SELECT pg_get_functiondef('sgp_pdt_compat_91."+signature+"'::regprocedure)",'relocated original body')
  # SQL output is stripped by helper; pg_get_functiondef has one final newline.
  definition=definition.replace('FUNCTION sgp_pdt_compat_91.sgp_picking_entrega_orden(', 'FUNCTION public.sgp_picking_entrega_orden(')+'\n'
  if hashlib.md5(definition.encode()).hexdigest()!=f['md5']:raise SystemExit('Relocated original definition changed beyond schema')
 else:
  if sql("SELECT md5(pg_get_functiondef('public."+signature.replace("'","''")+"'::regprocedure))",'unchanged supplied body')!=f['md5']:raise SystemExit('Unintended modification of supplied definition')
 unchanged.append(signature)
report['unchanged_supplied_bodies_after_install']=unchanged
report['evidence_files_sha256']={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in evidence.glob('*.json')}
report_path.write_text(json.dumps(report,indent=2))
print('EVIDENCE REPORT',report_path)
