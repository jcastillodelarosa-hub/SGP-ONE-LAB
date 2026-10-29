"""Read-only backend smoke after deployment; user acceptance remains separate."""
import os
import subprocess
import sys

SQL = """
BEGIN READ ONLY;
SET LOCAL statement_timeout='15s';
DO $check$ BEGIN
 IF (SELECT count(*) FROM sgp_pdt_manual.corte_operativo WHERE id=1 AND desde<=clock_timestamp())<>1
 THEN RAISE EXCEPTION 'PDT_CUTOVER_NOT_ACTIVE'; END IF;
 IF to_regprocedure('public.sgp_pdt_manual_listar_v1(text)') IS NULL
 OR to_regprocedure('public.sgp_pdt_manual_registrar_v1(text,text,jsonb,jsonb,text,uuid)') IS NULL
 OR to_regprocedure('public.sgp_pdt_corte_operativo_v1(text)') IS NULL
 THEN RAISE EXCEPTION 'PDT_RELEASE_RPC_MISSING'; END IF;
 IF NOT has_function_privilege('anon','public.sgp_pdt_manual_listar_v1(text)','EXECUTE')
 OR NOT has_function_privilege('anon','public.sgp_pdt_corte_operativo_v1(text)','EXECUTE')
 THEN RAISE EXCEPTION 'PDT_RELEASE_RPC_PERMISSION_MISSING'; END IF;
END $check$;
SELECT 'PDT_POST_RELEASE_BACKEND_READ_ONLY_PASS';
ROLLBACK;
"""


def main():
    if not os.environ.get('DATABASE_URL'):
        raise RuntimeError('DATABASE_URL_MISSING')
    command = ['docker', 'run', '--rm', '-i', '-e', 'DATABASE_URL',
               '-e', 'PGOPTIONS=-c default_transaction_read_only=on -c statement_timeout=15000',
               'postgres:17', 'sh', '-c', 'psql "$DATABASE_URL" -X -qAt -v ON_ERROR_STOP=1']
    result = subprocess.run(command, input=SQL, text=True, capture_output=True, timeout=60)
    if result.returncode or 'PDT_POST_RELEASE_BACKEND_READ_ONLY_PASS' not in result.stdout:
        raise RuntimeError('POST_RELEASE_BACKEND_NOT_VERIFIED')
    print('PDT_POST_RELEASE_BACKEND_READ_ONLY_PASS')


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('::error::POST_RELEASE_BACKEND_NOT_VERIFIED')
        sys.exit(1)
