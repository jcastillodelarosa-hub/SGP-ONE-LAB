"""Prove whole-install rollback and successful AB commit on a new synthetic DB."""
import json,subprocess,sys,time
sys.dont_write_bytecode=True
from installation_plan import ROOT,render
container='sgp-pdt-qa-91'
meta=json.loads(subprocess.check_output(['docker','inspect',container]))[0]
if meta['HostConfig']['NetworkMode']!='none' or meta['HostConfig'].get('PortBindings'):raise SystemExit('Not isolated')
database='sgp_pdt_qa_91_atomic_'+str(time.time_ns())
subprocess.run(['docker','exec',container,'createdb','-U','postgres',database],check=True)
def sql(text):
 return subprocess.run(['docker','exec','-i',container,'psql','-X','-qAt','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1'],input=text,text=True,capture_output=True)
for path in [ROOT/'tests/sql/pdt/bootstrap.sql',ROOT/'supabase/migrations/20261023_picking_no_duplicar_entrega_completa.sql']:
 r=sql(path.read_text())
 if r.returncode:raise SystemExit(r.stderr)
original=sql("SELECT md5(pg_get_functiondef('public.sgp_aluminio_pendiente_resolver(text,uuid)'::regprocedure))").stdout.strip()
script=render('AB');failing=script.rsplit('COMMIT;',1)[0]+'SELECT 1/0;\nCOMMIT;'
r=sql(failing)
if r.returncode==0 or 'division by zero' not in r.stderr:raise SystemExit('Expected injected failure missing')
check=sql("SELECT to_regclass('public.sgp_pdt_fuentes') IS NULL AND NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.sgp_aluminio_pendientes'::regclass AND attname='contrato_pdt')").stdout.strip()
if check!='t':raise SystemExit('Partial installation survived rollback')
if sql("SELECT md5(pg_get_functiondef('public.sgp_aluminio_pendiente_resolver(text,uuid)'::regprocedure))").stdout.strip()!=original:raise SystemExit('Legacy body changed after rollback')
print('PASS atomic failure restores schema and original legacy body')
r=sql(script)
if r.returncode:raise SystemExit(r.stderr)
if sql("SELECT (public.sgp_pdt_capacidades_v2('COORDINADOR')->>'cierre_v2')::boolean").stdout.strip()!='t':raise SystemExit('AB capabilities not enabled after commit')
print('PASS full AB transaction commits with final capabilities only')
print('ISOLATED DATABASE',database)
