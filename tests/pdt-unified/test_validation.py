"""Security boundaries and failure behavior; never needs cloud access or data."""
import importlib.util
import contextlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tests/pdt-backup'))
import validate_pdt_unified as v
import gcs_storage as gcs
import backup_and_restore as recovery

class ValidationSecurity(unittest.TestCase):
 def manifest(self):
  base=v.RECORD.rsplit('/',1)[0]+'/'
  return {'status':'POSTGRES_BACKUP_RESTORED_VERIFIED','prefix':base,'bucket':gcs.BUCKET,
   'project_ref':'ocvxbwzqxbrfndkvjmfx','created_utc':'2026-10-29T10:34:34Z',
   'production_writes':False,'source_consistent_snapshot':True,
   'verification':{'table_counts_equal':True,'catalog_sections_equal':True,
    'archive_sha256_checked_on_download':True,'restore_network':'none','source_writes':False},
   'objects':{k:{'name':base+name,'generation':'123','bytes':1,'sha256':'a'*64}
    for k,name in [('database','database.dump'),('globals','globals.sql'),('catalog_and_counts','catalog-and-counts.json')]}}

 def test_pinned_backup_rejects_other_date_status_integrity_and_object(self):
  self.assertEqual(v.validate_manifest(self.manifest())['status'],'POSTGRES_BACKUP_RESTORED_VERIFIED')
  for field,value in [('status','BACKUP_STORED_RESTORE_PENDING'),('created_utc','2026-10-25T00:00:00Z'),('production_writes',True),('prefix',gcs.PREFIX+'other/')]:
   with self.subTest(field=field):
    m=self.manifest();m[field]=value
    with self.assertRaises(gcs.SafeFailure):v.validate_manifest(m)
  for key,value in [('generation',''),('sha256','bad'),('bytes',2**40),('name',gcs.PREFIX+'other/database.dump')]:
   with self.subTest(field=key):
    m=self.manifest();m['objects']['database'][key]=value
    with self.assertRaises(gcs.SafeFailure):v.validate_manifest(m)
  m=self.manifest();m['verification']['catalog_sections_equal']=False
  with self.assertRaises(gcs.SafeFailure):v.validate_manifest(m)

 def test_readonly_downscope_cannot_create_objects(self):
  permissions=gcs.boundary(True)['accessBoundary']['accessBoundaryRules'][0]['availablePermissions']
  self.assertEqual(permissions,['inRole:roles/storage.objectViewer'])
  storage=object.__new__(gcs.PrivateStorage);storage.read_only=True
  with patch.object(gcs,'request') as request:
   with self.assertRaisesRegex(gcs.SafeFailure,'READ_ONLY_STORAGE_WRITE_REJECTED'):storage.put('irrelevant',b'private')
   request.assert_not_called()

 def test_production_credentials_and_install_flags_rejected_before_auth(self):
  base={'GITHUB_ACTIONS':'true','SGP_RESTORE_EXISTING':'true'}
  with patch.dict(os.environ,base,clear=True):v.check_environment()
  for name in ('SUPABASE_DB_PASSWORD','SGP_INSTALL_PRODUCTION','PGPASSWORD','DATABASE_URL','SUPABASE_SERVICE_ROLE_KEY'):
   with patch.dict(os.environ,{**base,name:'forbidden'},clear=True):
    with self.assertRaises(gcs.SafeFailure):v.check_environment()
    with patch.object(recovery,'PrivateStorage') as storage:
     if name in ('SUPABASE_DB_PASSWORD','SGP_INSTALL_PRODUCTION'):
      with self.assertRaises(gcs.SafeFailure):recovery.main(validation=object())
      storage.assert_not_called()

 def test_sql_never_uses_a_network_connection_or_leaks_raw_errors(self):
  val=object.__new__(v.Validation);val.report={}
  with patch.object(subprocess,'run') as run:
   with self.assertRaises(gcs.SafeFailure):val.sql(['psql','-h','production'], 'secret SQL','test')
   run.assert_not_called()
  pg=['docker','exec','-i','private-clone','psql','-h','/tmp/sgp-restore']
  with patch.object(subprocess,'run',return_value=subprocess.CompletedProcess(pg,1,b'private data',b'ERROR: PDT_BODY_CHANGED: personal-data\nCONTEXT: token secret')):
   with self.assertRaises(gcs.SafeFailure):val.sql(pg,'secret SQL','phase')
  self.assertEqual(val.report,{'failure':{'phase':'phase','code':'PDT_BODY_CHANGED'}})

 def test_install_stops_at_first_preflight_failure(self):
  val=object.__new__(v.Validation);val.report={'phases':[]};val.candidate=ROOT
  with patch.object(Path,'read_bytes',return_value=b'BEGIN; DO $$ BEGIN RAISE EXCEPTION \'PDT_GUARD\'; END $$; COMMIT;'):
   with patch.object(val,'sql',side_effect=[b'170011\n',b'history',gcs.SafeFailure('PDT_GUARD')]) as sql:
    with self.assertRaises(gcs.SafeFailure):val.run(['docker','exec','-i'],{})
    self.assertEqual(sql.call_count,3)
    self.assertEqual(val.report['phases'][0]['status'],'FAIL')
    self.assertEqual(len(val.report['phases']),1)

 def test_workflow_operation_has_no_production_secret_or_deploy_step(self):
  text=(ROOT/'.github/workflows/firebase-preview-linea-produccion.yml').read_text()
  job=text.split('\n  validate-pdt-unified:\n')[1]
  self.assertIn("inputs.operation == 'validate-pdt-unified'",job)
  self.assertIn("github.ref == 'refs/heads/feat/issue-144-pdt-isolated-validation'",job)
  self.assertIn('environment: supabase-backup',job)
  self.assertIn('ref: '+v.CANDIDATE,job)
  for forbidden in ('SUPABASE_DB_PASSWORD','SGP_INSTALL_PRODUCTION','install-production','upload-artifact','action-hosting-deploy','service_role'):
   self.assertNotIn(forbidden,job)
  # Existing job conditions cannot match the new infrastructure branch.
  for line in text.splitlines():
   if line.strip().startswith('if: github.ref'):
    self.assertNotIn('issue-144',line)
  self.assertEqual(job.count('secrets.'),1)

 def test_contracts_preserve_helpers_auth_rls_and_rollback(self):
  sql=(ROOT/'tests/pdt-unified/contracts.sql').read_text()
  for bad in ('CREATE OR REPLACE','DISABLE ROW LEVEL SECURITY','service_role','06_ACTIVAR'):
   self.assertNotIn(bad,sql)
  self.assertIn('SET LOCAL ROLE anon',sql)
  self.assertIn('public.sgp_login',sql)
  self.assertTrue(sql.rstrip().endswith('ROLLBACK;'))
  for name in v.TESTS[:-1]:self.assertIn('PASS:'+name,sql)

 def test_clone_removed_on_restore_failure_without_gcs_write_or_production_client(self):
  class Storage:
   def verify_boundary(self):pass
   def get(self,item):
    return json.dumps({'catalog':{'grants_por_defecto':[]},'counts':{},'tables':[]}).encode() if item=='catalog' else b'roles'
  class Validation:
   report={}
   record_failure=v.Validation.record_failure
   storage=Storage()
   manifest={'prefix':'private/','objects':{'catalog_and_counts':'catalog','database':'archive','globals':'globals'}}
  calls=[]
  def run(args,**kwargs):
   calls.append(args)
   # Force failure while restoring roles, after networkless clone creation.
   if args[:3]==['docker','exec','-i']:
    return subprocess.CompletedProcess(args,1,b'',b'ERROR: private row')
   return subprocess.CompletedProcess(args,0,b'',b'')
  with patch.dict(os.environ,{'GITHUB_ACTIONS':'true','SGP_RESTORE_EXISTING':'true'},clear=True):
   with patch.object(subprocess,'run',side_effect=run),contextlib.redirect_stdout(io.StringIO()):
    self.assertEqual(recovery.main(validation=Validation()),1)
  start=next(c for c in calls if c[:3]==['docker','run','-d'])
  name=start[start.index('--name')+1]
  self.assertEqual(start[start.index('--network')+1],'none')
  self.assertIn(['docker','rm','-f',name],calls)
  self.assertFalse(any('aws-0-us-east-2.pooler.supabase.com' in str(c) for c in calls))

 def test_safe_failure_code_and_catalog_sections_survive_without_private_detail(self):
  detail=v.failure_details('RESTORE_INTEGRITY',gcs.SafeFailure('RESTORED_CATALOG_DIFFER_funciones,roles'))
  self.assertEqual(detail,{'phase':'RESTORE_INTEGRITY','code':'RESTORED_CATALOG_DIFFER',
   'sections':['funciones','roles'],'category':'INTEGRITY'})
  detail=v.failure_details('RESTORE_GLOBALS',gcs.SafeFailure('ROLE_PRIVILEGE_ERROR: private user secret'))
  self.assertEqual(detail['category'],'PERMISSIONS')
  self.assertNotIn('private',json.dumps(detail))
  for error in (gcs.SafeFailure('RESTORED_CATALOG_DIFFER_personal_data'),
                RuntimeError('private token'),gcs.SafeFailure('PRIVATE_TOKEN_VALUE')):
   detail=v.failure_details('RESTORE_INTEGRITY',error)
   self.assertEqual(detail['code'],'ISOLATED_FAILURE_UNCLASSIFIED')
   self.assertNotIn('private',json.dumps(detail).lower())

 def test_summary_is_available_in_logs_as_well_as_step_summary(self):
  import tempfile
  with tempfile.TemporaryDirectory() as folder:
   report=Path(folder)/'report.json';summary=Path(folder)/'summary.md'
   data={'decision':'NO-GO','restore':'FAILED','failure':v.failure_details(
    'RESTORE_INTEGRITY',gcs.SafeFailure('RESTORED_TABLE_COUNTS_DIFFER'))}
   report.write_text(json.dumps(data))
   output=io.StringIO()
   with patch.object(v,'REPORT',report),patch.dict(os.environ,{'GITHUB_STEP_SUMMARY':str(summary)}):
    with contextlib.redirect_stdout(output):v.summary()
   self.assertEqual(output.getvalue().rstrip(),summary.read_text().rstrip())
   self.assertIn('RESTORED_TABLE_COUNTS_DIFFER',output.getvalue())

 def test_native_sql_error_identifies_contract_checkpoint_and_sqlstate_only(self):
  val=object.__new__(v.Validation)
  val.report={'tests':[{'name':name,'status':'NOT_EXECUTED'} for name in v.TESTS]}
  pg=['docker','exec','-i','clone','psql','-h','/tmp/sgp-restore']
  stdout=b'CONTRACT:setup.temp-tables\nCONTRACT:real-role-authentication\n'
  stderr=(b'NOTICE:  00000: PDT_QA_STEP:auth.account-create\n'
          b'psql:<stdin>:55: ERROR:  42703: column "private_data" does not exist\n'
          b'CONTEXT: private token QA_DO_NOT_PUBLISH\n')
  with patch.object(subprocess,'run',return_value=subprocess.CompletedProcess(pg,1,stdout,stderr)) as run:
   with self.assertRaises(gcs.SafeFailure):val.sql(pg,'private SQL','contracts')
  self.assertIn('VERBOSITY=verbose',run.call_args.args[0])
  self.assertEqual(val.report['failure'],{'phase':'contracts','code':'ISOLATED_SQL_REJECTED',
   'contract':'real-role-authentication','check':'auth.account-create','sqlstate':'42703'})
  self.assertEqual(val.report['tests'][0]['status'],'FAIL')
  self.assertTrue(all(t['status']=='NOT_EXECUTED' for t in val.report['tests'][1:]))
  self.assertNotIn('private',json.dumps(val.report))
  self.assertNotIn('QA_DO_NOT_PUBLISH',json.dumps(val.report))

 def test_checkpoint_notices_do_not_replace_actual_named_error_code(self):
  val=object.__new__(v.Validation);val.report={'tests':[]}
  pg=['docker','exec','-i','clone','psql','-h','/tmp/sgp-restore']
  stderr=(b'NOTICE:  00000: PDT_QA_STEP:auth.login\n'
          b'ERROR:  P0001: QA_REAL_LOGIN_FAILED\nCONTEXT: private values')
  with patch.object(subprocess,'run',return_value=subprocess.CompletedProcess(pg,1,
   b'CONTRACT:real-role-authentication\n',stderr)):
   with self.assertRaises(gcs.SafeFailure):val.sql(pg,'private SQL','contracts')
  self.assertEqual(val.report['failure']['code'],'QA_REAL_LOGIN_FAILED')
  self.assertEqual(val.report['failure']['check'],'auth.login')

 def test_setup_and_unknown_diagnostic_labels_are_not_misreported_as_auth(self):
  detail=v.contract_diagnostics(b'CONTRACT:setup.rpc-helper\n',
   b'ERROR:  42501: private database privilege message')
  self.assertEqual(detail,{'contract':'setup.rpc-helper','sqlstate':'42501'})
  self.assertEqual(v.contract_diagnostics(b'CONTRACT:private-label\n',
   b'NOTICE: PDT_QA_STEP:private-value\n'),{})
  # A checkpoint from a completed contract cannot be blamed for a later setup failure.
  detail=v.contract_diagnostics(b'CONTRACT:real-role-authentication\nCONTRACT:setup.outcome-helper\n',
   b'NOTICE: PDT_QA_STEP:auth.login\nERROR:  42601: private SQL')
  self.assertEqual(detail,{'contract':'setup.outcome-helper','sqlstate':'42601'})

 def test_all_contract_markers_and_checkpoints_are_allowlisted(self):
  import re
  sql=(ROOT/'tests/pdt-unified/contracts.sql').read_text();active=None
  for line in sql.splitlines():
   if line.startswith('\\echo CONTRACT:'):
    active=line.split(':',1)[1];self.assertIn(active,v.CONTRACT_IDS)
   match=re.search("RAISE NOTICE 'PDT_QA_STEP:([^']+)';",line)
   if match:self.assertEqual(v.CONTRACT_STEPS.get(match[1]),active)
  for name in v.TESTS[:-1]:self.assertIn('\\echo CONTRACT:'+name,sql)

 def test_auth_regression_keeps_ten_cases_and_rejects_only_the_real_role_check(self):
  import hashlib,re
  evidence=json.loads((ROOT/'tests/pdt-unified/auth-role-contract.json').read_text())
  sql=(ROOT/'tests/pdt-unified/contracts.sql').read_text()
  auth=sql.split('DO $auth$',1)[1].split('END $auth$;',1)[0]
  attempted=re.findall("'([^']+)'",re.search(r'FOREACH r IN ARRAY ARRAY\[(.*?)\] LOOP',auth,re.S)[1])
  self.assertEqual(set(attempted),set(evidence['accepted_roles'])|{'LIDER'})
  self.assertEqual(len(attempted),10)
  self.assertNotIn('LIDER',evidence['accepted_roles'])
  self.assertIn('LIDER LINEA',evidence['accepted_roles'])
  self.assertIn('LIDER MECANIZADO',evidence['accepted_roles'])
  self.assertEqual(hashlib.md5(evidence['definition'].encode()).hexdigest(),evidence['definition_md5'])
  self.assertIn(evidence['definition_md5'],auth)
  catch=auth.split('EXCEPTION WHEN check_violation THEN',1)[1].split('rejected:=true;',1)[0]
  # Other roles, constraints, tables and schemas must propagate the error.
  for guard in ("r IS DISTINCT FROM 'LIDER'", "rejected_constraint IS DISTINCT FROM 'sgp_usuarios_rol_check'",
                "rejected_table IS DISTINCT FROM 'sgp_usuarios'", "rejected_schema IS DISTINCT FROM 'public'",
                'THEN RAISE; END IF;'):
   self.assertIn(guard,catch)
  negative=auth.split("IF r='LIDER' THEN",1)[1].split("RAISE NOTICE 'PDT_QA_STEP:auth.login'",1)[0]
  self.assertIn('IF NOT rejected OR EXISTS',negative)
  self.assertIn('CONTINUE;',negative)
  self.assertIn('authenticated_count<>9 OR schema_denied_count<>1',auth)
  self.assertIn("public.sgp_login",auth)
  self.assertIn("session->>'rol' IS DISTINCT FROM r",auth)

 def test_auth_report_does_not_claim_ten_successful_logins(self):
  val=object.__new__(v.Validation);val.report={'tests':[{'name':name,'status':'NOT_EXECUTED'} for name in v.TESTS]}
  pg=['docker','exec','-i','clone','psql','-h','/tmp/sgp-restore']
  with patch.object(subprocess,'run',return_value=subprocess.CompletedProcess(pg,0,
   b'CONTRACT:real-role-authentication\nPASS:real-role-authentication\n',b'')):
   val.sql(pg,'SQL hidden','contracts')
  self.assertEqual(val.report['authentication'],{'real_login_roles':9,
   'schema_denied_roles':['LIDER'],'role_check':'sgp_usuarios_rol_check','total_role_cases':10})

 def test_manual_selector_supplies_key_and_checks_exact_programacion_cardinality(self):
  sql=(ROOT/'tests/pdt-unified/contracts.sql').read_text()
  selector=sql.split('FOR p IN SELECT to_jsonb(x)',1)[1].split(') x LOOP',1)[0]
  self.assertIn('prod.key_produccion',selector)
  self.assertIn('sgp_pdt_manual.programacion(prod.key_produccion,rel.reserva)',selector)
  self.assertIn('WHERE valid.anio IS NOT NULL AND valid.semana BETWEEN 1 AND 53)=1',selector)
  self.assertIn("token,p->>'key_produccion',p->>'reserva'",sql)
  self.assertNotIn("FOR p IN SELECT value FROM jsonb_array_elements(pg_temp.rpc",sql)

 def test_failed_manual_blocks_dependents_but_runs_independent_contracts(self):
  val=object.__new__(v.Validation)
  val.report={'tests':[{'name':name,'status':'NOT_EXECUTED'} for name in v.TESTS]}
  calls=[]
  def sql(pg,script,name):
   selected=[k for k in v.TESTS[:-1] if '\\echo CONTRACT:'+k+'\n' in script]
   target=selected[-1]
   calls.append(target)
   if target=='manual-three-origins-nc-idempotency':
    val.report['failure']={'phase':'contracts','code':'PDT_MANUAL_PROGRAMACION_AMBIGUA',
     'contract':target,'check':'manual.sources'}
    raise gcs.SafeFailure('ISOLATED_SQL_REJECTED')
   return ('PASS:real-role-authentication\n'+
           ('' if target=='real-role-authentication' else 'PASS:'+target+'\n')).encode()
  with patch.object(val,'sql',side_effect=sql):
   with self.assertRaises(gcs.SafeFailure):
    val.run_contracts(['docker','exec','-i'],(ROOT/'tests/pdt-unified/contracts.sql').read_text())
  self.assertEqual(calls,['real-role-authentication','manual-three-origins-nc-idempotency',
   'utc-cutover-historical-preservation','legacy-v2-dispatch'])
  states={t['name']:t['status'] for t in val.report['tests']}
  self.assertEqual(states['manual-three-origins-nc-idempotency'],'FAIL')
  for name in ('validation-partial-advance-picking-close','reception-mecanizado-unified-list',
               'export-week-year-guard-audit','rollback-before-activation'):
   self.assertEqual(states[name],'BLOCKED')
  self.assertEqual(states['utc-cutover-historical-preservation'],'PASS')
  self.assertEqual(states['legacy-v2-dispatch'],'PASS')
  self.assertEqual(val.report['tests'][1]['failure']['check'],'manual.sources')

 def test_restore_integrity_vs_validator_failure_retains_code_and_cleans_clone(self):
  # Exercise the real orchestration through restore verification into the hook.
  # Do not use cloud data: inject only subprocess outputs and archived metadata.
  catalog={'grants_por_defecto':[]}
  class Storage:
   def verify_boundary(self):pass
   def get(self,item):
    if item=='catalog':return json.dumps({'catalog':catalog,'counts':{'public.test':1},
      'tables':[{'schema':'public','name':'test'}]}).encode()
    return b'private archive bytes'
  for failure in ('counts','catalog','validator'):
   with self.subTest(failure=failure):
    val=object.__new__(v.Validation);val.storage=Storage()
    val.manifest={'prefix':'private/','objects':{'catalog_and_counts':'catalog',
     'database':'archive','globals':'globals'}}
    val.report={'decision':'NO-GO','restore':'NOT_EXECUTED'}
    calls=[]
    def run(args,**kwargs):
     calls.append(args)
     query=kwargs.get('input',b'')
     if args[:3]==['docker','exec','-i'] and query.startswith(b'BEGIN READ ONLY'):
      if b'jsonb_object_agg(name,count)' in query:
       value={'public.test':2 if failure=='counts' else 1}
      elif b"SELECT '[]'::jsonb" in query:value=[]
      else:value=catalog
      return subprocess.CompletedProcess(args,0,json.dumps(value).encode(),b'')
     return subprocess.CompletedProcess(args,0,b'',b'')
    def reject_validator(*args):
     val.report['restore']='HASH_COUNTS_CATALOG_VERIFIED'
     raise gcs.SafeFailure('POSTGRES_17_11_REQUIRED')
    with patch.dict(os.environ,{'GITHUB_ACTIONS':'true','SGP_RESTORE_EXISTING':'true'},clear=True):
     with patch.object(subprocess,'run',side_effect=run),patch.object(recovery,'catalog_body',return_value='SELECT catalog;'):
      with patch.object(recovery,'compare_catalogs',return_value=['funciones'] if failure=='catalog' else []):
       with patch.object(val,'run',side_effect=reject_validator) as callback,contextlib.redirect_stdout(io.StringIO()) as output:
        self.assertEqual(recovery.main(validation=val),1)
        self.assertEqual(callback.call_count,1 if failure=='validator' else 0)
    expected={'counts':'RESTORED_TABLE_COUNTS_DIFFER','catalog':'RESTORED_CATALOG_DIFFER',
     'validator':'POSTGRES_17_11_REQUIRED'}[failure]
    self.assertEqual(val.report['failure']['code'],expected)
    self.assertEqual(val.report['decision'],'NO-GO')
    self.assertEqual(val.report['failure']['phase'],'PDT_UNIFIED_VALIDATION' if failure=='validator' else 'RESTORE_INTEGRITY')
    self.assertEqual(val.report['restore'],'HASH_COUNTS_CATALOG_VERIFIED' if failure=='validator' else 'FAILED')
    self.assertNotIn('private',output.getvalue())
    self.assertIn(expected,output.getvalue())
    start=next(c for c in calls if c[:3]==['docker','run','-d'])
    self.assertIn(['docker','rm','-f',start[start.index('--name')+1]],calls)

if __name__=='__main__':unittest.main()
