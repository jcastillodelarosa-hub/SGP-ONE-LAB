"""Issue 144. Read a pinned private recovery; SQL runs only in its networkless clone.
No backup bytes, SQL output, tokens or raw exceptions are published.
"""
import hashlib
import json
import os
import pathlib
import re
import signal
import subprocess
import sys
import urllib.parse

from gcs_storage import PrivateStorage, SafeFailure, BUCKET, PREFIX, request
import backup_and_restore as recovery

CANDIDATE = 'b7e7908f822789e3315b2f222f7eda680a13590c'
RECORD = PREFIX + '20261029T103434Z-0567ffc8929b47a49cdb3745b1285f1e/recovery-verified.json'
ROOT = pathlib.Path(__file__).resolve().parents[2]
REPORT = ROOT / 'work/pdt-unified/report.json'
PHASES = (
 'docs/sql-proposals/pdt/grouped-source/01_grouped_sources_REVIEW.sql',
 'docs/sql-proposals/pdt/manual/01_manual_phase1_REVIEW.sql',
 'docs/sql-proposals/pdt/manual/02_manual_validation_REVIEW.sql',
 'docs/sql-proposals/pdt/manual/03_manual_operations_REVIEW.sql',
 'docs/sql-proposals/pdt/manual/04_programacion_vigente_REVIEW.sql',
 'docs/sql-proposals/pdt/manual/05_export_year_REVIEW.sql',
 'docs/sql-proposals/pdt/integration/06_operational_cutover_REVIEW.sql',
)
TESTS = ('real-role-authentication', 'manual-three-origins-nc-idempotency',
 'validation-partial-advance-picking-close', 'reception-mecanizado-unified-list',
 'export-week-year-guard-audit', 'utc-cutover-historical-preservation',
 'legacy-v2-dispatch', 'rollback-before-activation')
DEPENDENCIES = {
 'real-role-authentication': (),
 'manual-three-origins-nc-idempotency': ('real-role-authentication',),
 'validation-partial-advance-picking-close': ('manual-three-origins-nc-idempotency',),
 'reception-mecanizado-unified-list': ('validation-partial-advance-picking-close',),
 'export-week-year-guard-audit': ('validation-partial-advance-picking-close',),
 'utc-cutover-historical-preservation': ('real-role-authentication',),
 'legacy-v2-dispatch': ('real-role-authentication',),
}

CONTRACT_IDS = frozenset((
 'setup.session-authorization',
 'setup.transaction',
 'setup.rpc-helper',
 'setup.denied-helper',
 'setup.temp-tables',
 'real-role-authentication',
 'manual-three-origins-nc-idempotency',
 'validation-partial-advance-picking-close',
 'reception-mecanizado-unified-list',
 'export-week-year-guard-audit',
 'utc-cutover-historical-preservation',
 'setup.outcome-helper',
 'legacy-v2-dispatch',
 'setup.transaction-rollback',
))
CONTRACT_STEPS = {'cycle.assign': 'validation-partial-advance-picking-close',
 'cycle.close': 'validation-partial-advance-picking-close',
 'auth.hash-contract': 'real-role-authentication',
 'auth.role-check': 'real-role-authentication',
 'auth.role-matrix': 'real-role-authentication',
 'auth.hash-column': 'real-role-authentication',
 'auth.account-create': 'real-role-authentication',
 'auth.login': 'real-role-authentication',
 'auth.session': 'real-role-authentication',
 'auth.catalog-allow': 'real-role-authentication',
 'auth.catalog-deny': 'real-role-authentication',
 'auth.invalid-session': 'real-role-authentication',
 'manual.catalog': 'manual-three-origins-nc-idempotency',
 'manual.sources': 'manual-three-origins-nc-idempotency',
 'manual.match-picking-source': 'manual-three-origins-nc-idempotency',
 'manual.nc-source': 'manual-three-origins-nc-idempotency',
 'manual.register': 'manual-three-origins-nc-idempotency',
 'manual.retry': 'manual-three-origins-nc-idempotency',
 'manual.denied': 'manual-three-origins-nc-idempotency',
 'cycle.validation-denied': 'validation-partial-advance-picking-close',
 'cycle.validate': 'validation-partial-advance-picking-close',
 'cycle.detail': 'validation-partial-advance-picking-close',
 'cycle.stage': 'validation-partial-advance-picking-close',
 'cycle.advance': 'validation-partial-advance-picking-close',
 'cycle.advance-denied': 'validation-partial-advance-picking-close',
 'cycle.advance-final': 'validation-partial-advance-picking-close',
 'cycle.delivery': 'validation-partial-advance-picking-close',
 'cycle.source-state': 'validation-partial-advance-picking-close',
 'cycle.delivery-validate': 'validation-partial-advance-picking-close',
 'lists.manual': 'reception-mecanizado-unified-list',
 'lists.modern': 'reception-mecanizado-unified-list',
 'period.export': 'export-week-year-guard-audit',
 'period.audit': 'export-week-year-guard-audit',
 'period.export-repeat': 'export-week-year-guard-audit',
 'period.export-year-reject': 'export-week-year-guard-audit',
 'cut.config': 'utc-cutover-historical-preservation',
 'cut.read': 'utc-cutover-historical-preservation',
 'dispatch.cohort': 'legacy-v2-dispatch',
 'dispatch.validator': 'legacy-v2-dispatch',
 'dispatch.stage': 'legacy-v2-dispatch'}

# Only fixed local codes may cross the private recovery boundary. Exception text
# can contain restored role names, identifiers or data, even in SafeFailure.
RECOVERY_CODES = frozenset((
 'ISOLATED_ENGINE_START_FAILED', 'ISOLATED_ENGINE_NOT_READY',
 'ISOLATED_DATABASE_CREATE_FAILED', 'DATABASE_RESTORE_FAILED',
 'ISOLATED_METADATA_READ_FAILED', 'RESTORED_TABLE_COUNTS_DIFFER',
 'GCS_DOWNLOAD_INTEGRITY_FAILED', 'GCS_TRANSPORT_FAILED',
 'GLOBAL_ROLES_RESTORE_FAILED', 'ROLE_ALREADY_EXISTS',
 'ROLE_CONFIGURATION_NOT_AVAILABLE', 'ROLE_PRIVILEGE_ERROR',
 'GLOBAL_SQL_SYNTAX_ERROR', 'TABLESPACE_CONFIGURATION_REQUIRED',
))
VALIDATION_CODES = frozenset((
 'POSTGRES_17_11_REQUIRED', 'NON_ISOLATED_SQL_COMMAND_REJECTED',
 'ISOLATED_SQL_REJECTED', 'HISTORICAL_ROWS_CHANGED_BY_INSTALL',
 'INCOMPLETE_CONTRACT_EVIDENCE', 'QA_ROLLBACK_DID_NOT_PRESERVE_HISTORY',
 'VALIDATION_INTERRUPTED',
))


def failure_details(phase, error):
 raw = str(error)
 code = raw.split(':', 1)[0]
 details = {'phase': phase, 'code': 'ISOLATED_FAILURE_UNCLASSIFIED'}
 if isinstance(error, SafeFailure):
  if code in RECOVERY_CODES | VALIDATION_CODES:
   details['code'] = code
  elif raw.startswith('RESTORED_CATALOG_DIFFER_'):
   sections = raw.removeprefix('RESTORED_CATALOG_DIFFER_').split(',')
   allowed = {'postgres_major', 'funciones', 'relaciones', 'triggers',
              'politicas', 'roles', 'membresias', 'secuencias',
              'grants_por_defecto', 'extensiones'}
   if sections and all(section in allowed for section in sections):
    details.update(code='RESTORED_CATALOG_DIFFER', sections=sections)
 if details['code'] in ('RESTORED_TABLE_COUNTS_DIFFER', 'RESTORED_CATALOG_DIFFER',
                         'GCS_DOWNLOAD_INTEGRITY_FAILED'):
  details['category'] = 'INTEGRITY'
 elif details['code'] == 'ROLE_PRIVILEGE_ERROR':
  details['category'] = 'PERMISSIONS'
 elif phase == 'PDT_UNIFIED_VALIDATION':
  details['category'] = 'VALIDATOR'
 else:
  details['category'] = 'RECOVERY_UNCLASSIFIED'
 return details


def contract_diagnostics(stdout, stderr):
 # Identifiers must be constants owned by this validator, never server text.
 started = [line.removeprefix('CONTRACT:') for line in stdout.decode(errors='replace').splitlines()
            if line.startswith('CONTRACT:') and line.removeprefix('CONTRACT:') in CONTRACT_IDS]
 details = {}
 if started:
  details['contract'] = started[-1]
 checkpoints = re.findall(rb'NOTICE:\s+(?:00000:\s+)?PDT_QA_STEP:([a-z0-9.-]+)\s*$', stderr, re.M)
 if checkpoints and details.get('contract') is not None and CONTRACT_STEPS.get(checkpoints[-1].decode()) == details['contract']:
  details['check'] = checkpoints[-1].decode()
 state = re.search(rb'(?:^|\n)(?:psql:[^\r\n]+:\s*)?ERROR:\s+([A-Z0-9]{5}):', stderr)
 if state:
  details['sqlstate'] = state.group(1).decode()
 return details


def check_environment():
 if os.environ.get('GITHUB_ACTIONS') != 'true':
  raise SafeFailure('PROTECTED_RUNNER_REQUIRED')
 if (os.environ.get('SGP_RESTORE_EXISTING') != 'true'
     or any(os.environ.get(k) for k in ('SUPABASE_DB_PASSWORD', 'SGP_INSTALL_PRODUCTION',
                                      'PGPASSWORD', 'DATABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'))):
  raise SafeFailure('ISOLATED_VALIDATION_ENVIRONMENT_REJECTED')


def validate_manifest(manifest):
 expected = {'globals': 'globals.sql', 'database': 'database.dump',
             'catalog_and_counts': 'catalog-and-counts.json'}
 base = RECORD.rsplit('/', 1)[0] + '/'
 v = manifest.get('verification', {})
 if (manifest.get('status') != 'POSTGRES_BACKUP_RESTORED_VERIFIED'
     or manifest.get('prefix') != base or manifest.get('bucket') != BUCKET
     or manifest.get('project_ref') != 'ocvxbwzqxbrfndkvjmfx'
     or not manifest.get('created_utc', '').startswith('2026-10-29T')
     or manifest.get('production_writes') is not False
     or manifest.get('source_consistent_snapshot') is not True
     or any(v.get(k) is not True for k in ('table_counts_equal', 'catalog_sections_equal',
                                          'archive_sha256_checked_on_download'))
     or v.get('restore_network') != 'none' or v.get('source_writes') is not False):
  raise SafeFailure('PINNED_RECOVERY_RECORD_NOT_VERIFIED')
 for key, filename in expected.items():
  item = manifest.get('objects', {}).get(key, {})
  if (item.get('name') != base + filename
      or not re.fullmatch(r'[1-9][0-9]*', str(item.get('generation', '')))
      or not re.fullmatch(r'[a-f0-9]{64}', str(item.get('sha256', '')))
      or type(item.get('bytes')) is not int or not 0 < item['bytes'] <= recovery.MAX_DB_BYTES):
   raise SafeFailure('PINNED_BACKUP_OBJECT_INVALID')
 return manifest


class Validation:
 def record_failure(self, phase, error):
  failure = failure_details(phase, error)
  self.report['decision'] = 'NO-GO'
  self.report.setdefault('failure', failure)
  if phase != 'PDT_UNIFIED_VALIDATION':
   self.report['restore'] = 'FAILED'
  return failure['code']

 def __init__(self, candidate):
  self.candidate = candidate
  self.storage = PrivateStorage(read_only=True)
  # Resolve only the exact verified record; freeze its generation before reading.
  url = 'https://storage.googleapis.com/storage/v1/b/' + BUCKET + '/o/' + urllib.parse.quote(RECORD, safe='')
  metadata = json.loads(request(url, self.storage.token))
  generation = str(metadata.get('generation', ''))
  if not re.fullmatch(r'[1-9][0-9]*', generation):
   raise SafeFailure('RECOVERY_RECORD_GENERATION_INVALID')
  record = request(url + '?' + urllib.parse.urlencode({'alt': 'media', 'generation': generation}), self.storage.token)
  self.manifest = validate_manifest(json.loads(record))
  self.report = {'decision': 'NO-GO', 'code_sha': CANDIDATE,
   'infrastructure_sha': os.environ.get('GITHUB_SHA', ''),
   'run_id': os.environ.get('GITHUB_RUN_ID', ''),
   'backup_sha256': self.manifest['objects']['database']['sha256'],
   'recovery_record_sha256': hashlib.sha256(record).hexdigest(),
   'recovery_record_generation': generation, 'image': recovery.IMAGE,
   'restore': 'NOT_EXECUTED', 'phases': [], 'tests': [{'name': name, 'status': 'NOT_EXECUTED'} for name in TESTS],
   'production_writes': False, 'pc_mobile': 'NOT_VERIFIED'}

 def sql(self, pg, text, name):
  # Never inherit PGHOST or invoke a network client; pg is recovery's docker exec.
  if pg[:3] != ['docker', 'exec', '-i'] or '-h' not in pg or pg[pg.index('-h')+1] != '/tmp/sgp-restore':
   raise SafeFailure('NON_ISOLATED_SQL_COMMAND_REJECTED')
  command = pg + ['-v', 'VERBOSITY=verbose'] if name == 'contracts' else pg
  result = subprocess.run(command, input=text.encode(), capture_output=True, timeout=300)
  if name == 'contracts':
   passed = set(result.stdout.decode(errors='replace').splitlines())
   for test in self.report['tests']:
    if 'PASS:' + test['name'] in passed:
     test['status'] = 'PASS'
   if 'PASS:real-role-authentication' in passed:
    self.report['authentication'] = {'real_login_roles': 9, 'schema_denied_roles': ['LIDER'],
     'role_check': 'sgp_usuarios_rol_check', 'total_role_cases': 10}
  if result.returncode:
   # Whitelist a code, never a detail, identifier, SQL context or row.
   match = re.search(rb'(?:^|\n)(?:psql:[^\r\n]+:\s*)?ERROR:[ \t]+(?:[A-Z0-9]{5}:[ \t]+)?((?:PDT|QA)_[A-Z][A-Z0-9_]*)(?=[: \r\n]|$)', result.stderr)
   self.report['failure'] = {'phase': name, 'code': match.group(1).decode() if match else 'ISOLATED_SQL_REJECTED'}
   if name == 'contracts':
    details = contract_diagnostics(result.stdout, result.stderr)
    self.report['failure'].update(details)
    for test in self.report['tests']:
     if test['name'] == details.get('contract'):
      test['status'] = 'FAIL'
   raise SafeFailure('ISOLATED_SQL_REJECTED')
  return result.stdout

 def run_contracts(self, pg, source):
  # Each probe owns a transaction. Recreate only prerequisite fixtures; a
  # failed dependent contract cannot hide cutover or legacy dispatch results.
  blocks = {}
  marker = None
  for line in source.splitlines(keepends=True):
   if line.startswith('\\echo CONTRACT:'):
    marker = line.removeprefix('\\echo CONTRACT:').strip()
    blocks[marker] = line
   elif marker is not None:
    blocks[marker] += line
  setup = ('setup.transaction', 'setup.rpc-helper', 'setup.denied-helper', 'setup.temp-tables')
  selected = {
   'real-role-authentication': (),
   'manual-three-origins-nc-idempotency': (),
   'validation-partial-advance-picking-close': ('manual-three-origins-nc-idempotency',),
   'reception-mecanizado-unified-list': ('manual-three-origins-nc-idempotency', 'validation-partial-advance-picking-close'),
   'export-week-year-guard-audit': ('manual-three-origins-nc-idempotency', 'validation-partial-advance-picking-close'),
   'utc-cutover-historical-preservation': (),
   'legacy-v2-dispatch': ('setup.outcome-helper',),
  }
  for name in TESTS[:-1]:
   test = next(t for t in self.report['tests'] if t['name'] == name)
   blocked_by = [dep for dep in DEPENDENCIES[name]
                 if next(t for t in self.report['tests'] if t['name'] == dep)['status'] != 'PASS']
   if blocked_by:
    test.update(status='BLOCKED', blocked_by=blocked_by)
    continue
   parts = ['\\echo CONTRACT:setup.session-authorization\nSET SESSION AUTHORIZATION postgres;\n']
   parts.extend(blocks[k] for k in setup)
   parts.append(blocks['real-role-authentication'])
   parts.extend(blocks[k] for k in selected[name])
   if name != 'real-role-authentication':
    parts.append(blocks[name])
   parts.append(blocks['setup.transaction-rollback'])
   try:
    output = self.sql(pg, ''.join(parts), 'contracts')
    passed = [line for line in output.decode().splitlines() if line.startswith('PASS:')]
    expected = ['PASS:real-role-authentication']
    expected += ['PASS:' + k for k in selected[name] if not k.startswith('setup.')]
    if name != 'real-role-authentication':
     expected.append('PASS:' + name)
    if passed != expected:
     raise SafeFailure('INCOMPLETE_CONTRACT_EVIDENCE')
    test['status'] = 'PASS'
   except SafeFailure:
    test['status'] = 'FAIL'
    detail = self.report.pop('failure', {'phase': 'contracts', 'code': 'INCOMPLETE_CONTRACT_EVIDENCE'})
    test['failure'] = detail
  failed = [t for t in self.report['tests'][:-1] if t['status'] != 'PASS']
  if failed:
   self.report['tests'][-1].update(status='BLOCKED', blocked_by=[t['name'] for t in failed])
   self.report['failure'] = {'phase': 'contracts', 'code': 'FUNCTIONAL_CONTRACTS_INCOMPLETE'}
   raise SafeFailure('INCOMPLETE_CONTRACT_EVIDENCE')

 def run(self, pg, manifest):
  self.report['restore'] = 'HASH_COUNTS_CATALOG_VERIFIED'
  version = self.sql(pg, 'SHOW server_version_num;', 'engine').strip()
  if version != b'170011':
   raise SafeFailure('POSTGRES_17_11_REQUIRED')
  history_query = "SELECT jsonb_build_object('pending',(SELECT md5(coalesce(jsonb_agg(to_jsonb(p) ORDER BY id_pendiente)::text,'')) FROM public.sgp_aluminio_pendientes p),'history',(SELECT md5(coalesce(jsonb_agg(to_jsonb(h) ORDER BY to_jsonb(h)::text)::text,'')) FROM public.sgp_aluminio_pendientes_historial h));"
  baseline = self.sql(pg, history_query, 'historical-baseline').strip()
  for path in PHASES:
   data = (self.candidate / path).read_bytes()
   phase = {'name': path, 'sha256': hashlib.sha256(data).hexdigest(), 'status': 'FAIL'}
   self.report['phases'].append(phase)
   # Execute the unmodified REVIEW including its transaction and guards.
   self.sql(pg, 'SET ROLE postgres;\n' + data.decode(), path)
   phase['status'] = 'PASS'
  if self.sql(pg, history_query, 'post-install-history').strip() != baseline:
   raise SafeFailure('HISTORICAL_ROWS_CHANGED_BY_INSTALL')
  contract_error = None
  try:
   self.run_contracts(pg, (ROOT / 'tests/pdt-unified/contracts.sql').read_text())
  except SafeFailure as error:
   contract_error = error
  if self.sql(pg, history_query, 'post-test-history').strip() != baseline:
   raise SafeFailure('QA_ROLLBACK_DID_NOT_PRESERVE_HISTORY')
  self.report['historical_rows_preserved'] = True
  if contract_error is not None:
   raise contract_error
  # Before-activation rollback must pass on the still-empty installation.
  for path in ('docs/sql-proposals/pdt/integration/06_ROLLBACK_REVIEW.sql',
               'docs/sql-proposals/pdt/manual/05_ROLLBACK_REVIEW.sql',
               'docs/sql-proposals/pdt/manual/04_ROLLBACK_REVIEW.sql',
               'docs/sql-proposals/pdt/manual/03_ROLLBACK_REVIEW.sql',
               'docs/sql-proposals/pdt/manual/02_ROLLBACK_REVIEW.sql',
               'docs/sql-proposals/pdt/manual/ROLLBACK_REVIEW.sql'):
   self.sql(pg, 'SET ROLE postgres;\n' + (self.candidate / path).read_text(), 'rollback')
  self.report['tests'][-1]['status'] = 'PASS'
  self.report['decision'] = 'GO'
  return 0


def save(report):
 REPORT.parent.mkdir(parents=True, exist_ok=True)
 REPORT.write_text(json.dumps(report, indent=2) + '\n')


def summary():
 # Report is produced only by this trusted script, never candidate SQL output.
 report = json.loads(REPORT.read_text()) if REPORT.exists() else {
  'decision': 'NO-GO', 'code_sha': CANDIDATE, 'failure': {'code': 'VALIDATION_NOT_COMPLETED'}}
 text = 'PDT unified — isolated validation\n\n```json\n' + json.dumps(report, indent=2) + '\n```\n'
 if os.environ.get('GITHUB_STEP_SUMMARY'):
  with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as out:
   out.write(text)
 # The API exposes job logs, but not step-summary contents. Publish this same
 # already-sanitized report there so a subsequent failure remains diagnosable.
 print(text)


def main():
 validation = None
 report = {'decision': 'NO-GO', 'code_sha': CANDIDATE, 'production_writes': False}
 try:
  check_environment()
  candidate = pathlib.Path(os.environ['SGP_CANDIDATE_PATH']).resolve()
  result = subprocess.run(['git', '-C', str(candidate), 'rev-parse', 'HEAD'], capture_output=True, text=True, check=True)
  if result.stdout.strip() != CANDIDATE:
   raise SafeFailure('CANDIDATE_SHA_MISMATCH')
  if subprocess.run(['git','-C',str(candidate),'diff','--quiet','HEAD','--'], capture_output=True).returncode:
   raise SafeFailure('CANDIDATE_WORKTREE_CHANGED')
  validation = Validation(candidate)
  report = validation.report
  def interrupted(*_):
   raise SafeFailure('VALIDATION_INTERRUPTED')
  signal.signal(signal.SIGTERM, interrupted)
  status = recovery.main(validation=validation)
  if status:
   report['decision'] = 'NO-GO'
   report.setdefault('failure', {'code': 'RECOVERY_OR_CONTRACTS_FAILED'})
  return status
 except Exception as error:
  if isinstance(error, SafeFailure) and re.fullmatch(r'[A-Z][A-Z0-9_]*', str(error)):
   report.setdefault('failure', {'code': str(error)})
  report['decision'] = 'NO-GO'
  report.setdefault('failure', {'code': 'VALIDATION_NOT_COMPLETED'})
  return 1
 finally:
  save(report)


if __name__ == '__main__':
 if sys.argv[1:] == ['--summary']:
  summary()
 else:
  sys.exit(main())
