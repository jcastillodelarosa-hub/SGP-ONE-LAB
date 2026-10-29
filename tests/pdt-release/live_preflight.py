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
def main():
 url=os.environ.get('DATABASE_URL')
 if not url: raise RuntimeError('DATABASE_URL_MISSING')
 r=subprocess.run(['docker','run','--rm','-i','-e','DATABASE_URL','-e','PGOPTIONS=-c default_transaction_read_only=on -c statement_timeout=15000 -c lock_timeout=3000','postgres:17',
  'sh','-c','psql "$DATABASE_URL" -X -qAt -v ON_ERROR_STOP=1'],
  input=SQL,text=True,capture_output=True,timeout=50)
 if r.returncode or 'PDT_BASELINE_READ_ONLY_PASS' not in r.stdout or 'PDT_TRANSACTION_READ_ONLY_CONFIRMED' not in r.stdout:
  raise RuntimeError('PDT_BASELINE_NOT_VERIFIED')
 print('PDT_BASELINE_READ_ONLY_PASS')
if __name__=='__main__':
 try:main()
 except Exception as e:
  print('::error::'+str(e));sys.exit(1)
