"""Read-only PostgreSQL connection check in GitHub's protected environment.
Never prints credentials, subprocess errors, database content or connection URLs.
No backup data is created or uploaded by this step.
"""
import os,re,subprocess,sys

SQL="""BEGIN READ ONLY;
SELECT CASE WHEN current_database()='postgres'
 AND current_setting('server_version_num')::integer BETWEEN 170000 AND 179999
 THEN 'SGP_POSTGRES17_READ_ONLY_OK' ELSE 'UNEXPECTED_DATABASE_OR_VERSION' END;
ROLLBACK;"""

def classify_error(error):
    if re.search(r'(?:password|sasl) authentication failed|authentication failed',error,re.I):
        return 'Autenticación PostgreSQL fallida'
    if re.search(r'certificate|ssl error|tls|root certificate',error,re.I):
        return 'Verificación TLS PostgreSQL fallida'
    return 'Conectividad PostgreSQL fallida'

def report_failure(message):
    print(message)
    if os.environ.get('GITHUB_ACTIONS')=='true':
        print('::error title=Supabase read-only connection::'+message)

def main():
    password=os.environ.get('SUPABASE_DB_PASSWORD')
    if not password:
        report_failure('Secreto SUPABASE_DB_PASSWORD no disponible en el entorno supabase-backup')
        return 1
    environment=os.environ.copy()
    environment['PGPASSWORD']=password
    # Pass secret by environment name, never its value or a URI in argv.
    argv=['docker','run','--rm','--log-driver=none','--env','PGPASSWORD',
        '--env','PGHOST=aws-0-us-east-2.pooler.supabase.com',
        '--env','PGPORT=5432','--env','PGDATABASE=postgres',
        '--env','PGUSER=postgres.ocvxbwzqxbrfndkvjmfx',
        '--env','PGSSLMODE=verify-full','--env','PGSSLROOTCERT=system',
        '--env','PGCONNECT_TIMEOUT=20',
        '--env','PGOPTIONS=-c default_transaction_read_only=on -c statement_timeout=15000',
        'postgres:17','psql','-X','-qAt','--no-password','-v','ON_ERROR_STOP=1','-c',SQL]
    try:
        result=subprocess.run(argv,env=environment,capture_output=True,text=True,timeout=90)
    except (subprocess.SubprocessError,OSError):
        report_failure('Conectividad PostgreSQL fallida')
        return 1
    if result.returncode:
        report_failure(classify_error(result.stderr))
        return 1
    if result.stdout.strip()!='SGP_POSTGRES17_READ_ONLY_OK':
        report_failure('Base o versión PostgreSQL inesperada; intervención detenida')
        return 1
    print('Conexión PostgreSQL verificada: solo lectura, TLS y servidor PostgreSQL 17')
    summary=os.environ.get('GITHUB_STEP_SUMMARY')
    if summary:
        with open(summary,'a',encoding='utf-8') as handle:
            handle.write('Conexión PostgreSQL: VERIFICADA, solo lectura y TLS.\n\n'
                         'No se generó un respaldo ni se aplicó SQL. El respaldo requiere '
                         'destino privado cifrado, restauración comprobada y ventana de escrituras coordinada.\n')
    return 0

if __name__=='__main__':sys.exit(main())
