"""Fail-closed PDT unified live preflight. Read-only catalog checks only."""
import os,subprocess,sys
SQL = """
BEGIN READ ONLY;
SET LOCAL statement_timeout='15s';
SELECT CASE WHEN current_setting('transaction_read_only')='on' THEN 'PDT_TRANSACTION_READ_ONLY_CONFIRMED' ELSE 'PDT_TRANSACTION_NOT_READ_ONLY' END;
DO $guard$
DECLARE s text;
BEGIN
 IF to_regclass('public.sgp_aluminio_pendientes') IS NULL
 OR to_regclass('public.sgp_usuarios') IS NULL
 OR to_regprocedure('public.sgp_login(text,text)') IS NULL
 THEN RAISE EXCEPTION 'PDT_PREFLIGHT_REQUIRED_BASELINE_MISSING'; END IF;
 IF to_regclass('sgp_pdt_manual.corte_operativo') IS NOT NULL
 OR to_regprocedure('public.sgp_pdt_corte_operativo_v1(text)') IS NOT NULL
 THEN RAISE EXCEPTION 'PDT_PREFLIGHT_CUTOVER_ALREADY_INSTALLED'; END IF;
 IF NOT has_function_privilege('anon','public.sgp_login(text,text)','EXECUTE')
 THEN RAISE EXCEPTION 'PDT_PREFLIGHT_LOGIN_PERMISSION_CHANGED'; END IF;
 IF to_regprocedure('public.sgp_pdt_validar_rol_real(text,text[])') IS NOT NULL
 AND has_function_privilege('anon','public.sgp_pdt_validar_rol_real(text,text[])','EXECUTE')
 THEN RAISE EXCEPTION 'PDT_PREFLIGHT_INTERNAL_AUTH_EXPOSED'; END IF;
END $guard$;
SELECT 'PDT_BASELINE_READ_ONLY_PASS';
ROLLBACK;
"""
def classify_failure(stderr, returncode):
 # Only fixed codes leave this process; never print libpq output or a connection URL.
 message = stderr.lower()
 guards = {
  'pdt_preflight_required_baseline_missing': 'PDT_PREFLIGHT_REQUIRED_BASELINE_MISSING',
  'pdt_preflight_cutover_already_installed': 'PDT_PREFLIGHT_CUTOVER_ALREADY_INSTALLED',
  'pdt_preflight_login_permission_changed': 'PDT_PREFLIGHT_LOGIN_PERMISSION_CHANGED',
  'pdt_preflight_internal_auth_exposed': 'PDT_PREFLIGHT_INTERNAL_AUTH_EXPOSED',
 }
 for marker, code in guards.items():
  if marker in message: return code
 if 'password authentication failed' in message or 'no password supplied' in message:
  return 'PDT_PREFLIGHT_AUTHENTICATION_FAILED'
 if 'permission denied' in message or 'must be member of role' in message:
  return 'PDT_PREFLIGHT_PERMISSION_DENIED'
 if 'does not exist' in message or 'undefined table' in message or 'undefined function' in message:
  return 'PDT_PREFLIGHT_OBJECT_MISSING'
 if 'syntax error' in message or 'cannot execute' in message:
  return 'PDT_PREFLIGHT_SQL_REJECTED'
 if any(marker in message for marker in ('could not connect', 'connection refused',
       'could not translate host', 'timeout expired', 'server closed the connection',
       'ssl error', 'certificate verify failed', 'network is unreachable')):
  return 'PDT_PREFLIGHT_CONNECTION_FAILED'
 if returncode == 125 or 'cannot connect to the docker daemon' in message:
  return 'PDT_PREFLIGHT_CLIENT_UNAVAILABLE'
 return 'PDT_BASELINE_NOT_VERIFIED'


def main():
 url=os.environ.get('DATABASE_URL')
 if not url: raise RuntimeError('DATABASE_URL_MISSING')
 try:
  r=subprocess.run(['docker','run','--rm','-i','-e','DATABASE_URL','-e','PGOPTIONS=-c default_transaction_read_only=on -c statement_timeout=15000 -c lock_timeout=3000','postgres:17',
  'sh','-c','psql "$DATABASE_URL" -X -qAt -v ON_ERROR_STOP=1'],
   input=SQL,text=True,capture_output=True,timeout=50)
 except subprocess.TimeoutExpired:
  raise RuntimeError('PDT_PREFLIGHT_CONNECTION_TIMEOUT') from None
 except FileNotFoundError:
  raise RuntimeError('PDT_PREFLIGHT_CLIENT_UNAVAILABLE') from None
 if r.returncode or 'PDT_BASELINE_READ_ONLY_PASS' not in r.stdout or 'PDT_TRANSACTION_READ_ONLY_CONFIRMED' not in r.stdout:
  raise RuntimeError(classify_failure(r.stderr, r.returncode))
 print('PDT_BASELINE_READ_ONLY_PASS')
if __name__=='__main__':
 try:main()
 except RuntimeError as e:
  print('::error::'+str(e));sys.exit(1)
 except Exception:
  print('::error::PDT_BASELINE_NOT_VERIFIED');sys.exit(1)
