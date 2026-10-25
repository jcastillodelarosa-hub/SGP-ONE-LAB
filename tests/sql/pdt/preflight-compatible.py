"""Read-only structural gate on an EXISTING disposable replica. Never installs SQL.
Passing this gate is NOT full compatibility/authentication acceptance.
Usage: python tests/sql/pdt/preflight-compatible.py sgp_pdt_qa_91_<replica>
"""
import json,subprocess,sys,argparse,pathlib
sys.dont_write_bytecode=True
from catalog_compatibility import load_catalog,compare_catalogs
container='sgp-pdt-qa-91'
parser=argparse.ArgumentParser(description='Read-only replica preflight; never installs SQL')
parser.add_argument('database')
parser.add_argument('--production-catalog',type=pathlib.Path,help='Complete JSON export from PDT_PREFLIGHT_SUPABASE.sql')
args=parser.parse_args()
if not args.database.startswith('sgp_pdt_qa_91_'):
 raise SystemExit('STOP: identify an existing isolated replica (sgp_pdt_qa_91_*)')
database=args.database
baseline=None
if args.production_catalog:
 try:baseline=load_catalog(args.production_catalog)
 except (ValueError,OSError) as error:raise SystemExit('STOP: '+str(error))
info=json.loads(subprocess.check_output(['docker','inspect',container]))[0]
if info['HostConfig']['NetworkMode']!='none' or info['HostConfig'].get('PortBindings'):
 raise SystemExit('STOP: destination is not network-isolated')
query="""
BEGIN READ ONLY;
SELECT json_build_object(
 'functions',(SELECT coalesce(json_agg(json_build_object('name',p.proname,
 'args',pg_get_function_identity_arguments(p.oid),'types',oidvectortypes(p.proargtypes),
 'arity',p.pronargs,'return_type',pg_get_function_result(p.oid),'returns_set',p.proretset,'language',l.lanname,'definer',p.prosecdef,'config',p.proconfig,
 'acl',p.proacl::text,'definition_hash',md5(pg_get_functiondef(p.oid)),
 'synthetic_auth',p.proname='sgp_validar_sesion_rol' AND position('token=ANY(roles)' in p.prosrc)>0)), '[]'::json)
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang
 WHERE n.nspname='public' AND p.proname IN ('sgp_aluminio_pendiente_resolver',
 'sgp_aluminio_pendiente_estado','sgp_picking_entrega_orden','sgp_picking_validar_recepcion','sgp_validar_sesion_rol','sgp_sesion_actual')),
 'triggers',(SELECT coalesce(json_agg(json_build_object('table',c.relname,'name',t.tgname,
 'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid),'function_hash',md5(pg_get_functiondef(t.tgfoid)))),'[]'::json)
 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE NOT t.tgisinternal AND n.nspname='public' AND c.relname IN ('sgp_picking_entregas','sgp_mecanizado_programacion','sgp_aluminio_pendientes')));
ROLLBACK;
"""
r=subprocess.run(['docker','exec','-i',container,'psql','-X','-qAt','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1'],input=query,text=True,capture_output=True)
if r.returncode:raise SystemExit('STOP: metadata read failed (no installation attempted)\n'+r.stderr)
meta=json.loads(r.stdout);functions=meta['functions'];triggers=meta['triggers'];failures=[]
for name,types in [('sgp_aluminio_pendiente_resolver','text, uuid'),('sgp_aluminio_pendiente_estado','text, uuid, text, text')]:
 if not any(f['name']==name and f['types']==types for f in functions):failures.append('missing exact signature: '+name+'('+types+')')
entregas=[f for f in functions if f['name']=='sgp_picking_entrega_orden']
if sorted(f['arity'] for f in entregas)!=[6,8]:failures.append('Picking delivery overloads must have 6 and 8 input parameters')
if not any(f['name']=='sgp_picking_validar_recepcion' for f in functions):failures.append('missing Picking reception validator')
if not any(f['name']=='sgp_validar_sesion_rol' for f in functions):failures.append('missing SGP authorization function')
if not any(f['name']=='sgp_sesion_actual' and f['types']=='text' and f['return_type'] in ['json','jsonb'] and not f['returns_set'] for f in functions):failures.append('missing exact session object contract: sgp_sesion_actual(text) returns json/jsonb')
if any(f['synthetic_auth'] for f in functions):failures.append('synthetic authorization function is not real SGP authentication')
if not any(t['table']=='sgp_picking_entregas' and t['name']=='trg_sgp_picking_no_duplicar_completa' and t['enabled'] in ['O','A'] for t in triggers):failures.append('missing/enabled-state mismatch: duplicate complete delivery trigger')
if len([t for t in triggers if t['table']=='sgp_mecanizado_programacion'])!=3:failures.append('expected 3 existing programming triggers before installation')
if any(t['table']=='sgp_aluminio_pendientes' for t in triggers):failures.append('unexpected PDT user triggers before installation: review baseline or prior installation')
if baseline is not None:
 export_sql=pathlib.Path(__file__).resolve().parents[3]/'PDT_PREFLIGHT_SUPABASE.sql'
 result=subprocess.run(['docker','exec','-i',container,'psql','-X','-qAt','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1'],input=export_sql.read_text(),text=True,capture_output=True)
 if result.returncode:raise SystemExit('STOP: replica catalog extraction failed; no installation attempted')
 replica=json.loads(result.stdout)
 if replica.get('captura',{}).get('transaccion_solo_lectura')!='on':raise SystemExit('STOP: expected read-only extraction')
 differences=compare_catalogs(baseline,replica)
 if differences:failures.append('Production/replica catalog differences: '+', '.join(differences))
else:
 failures.append('Missing complete production catalog: minimum inventory alone cannot authorize compatibility installation')
print(json.dumps({'database':database,'read_only':True,'installation_attempted':False,'failures':failures,'catalog':meta},indent=2))
if failures:raise SystemExit('STOP: structural differences not resolved; no installation permitted')
print('Minimum inventory matches. Still requires approved column/constraint/body/permissions comparison and real-session tests. No installation performed.')
