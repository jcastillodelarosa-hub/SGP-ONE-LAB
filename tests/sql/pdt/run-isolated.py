"""Run only in the explicitly named, network-disabled synthetic Docker fixture."""
import subprocess,pathlib,time,json
root=pathlib.Path(__file__).resolve().parents[3]
container='sgp-pdt-qa-91'
meta=json.loads(subprocess.check_output(['docker','inspect',container]))[0]
if meta['HostConfig']['NetworkMode']!='none' or meta['HostConfig'].get('PortBindings'):
 raise SystemExit('Refusing non-isolated PostgreSQL')
for attempt in range(30):
 if subprocess.run(['docker','exec',container,'pg_isready','-U','postgres','-d','sgp_pdt_qa_91'],capture_output=True).returncode==0:break
 time.sleep(1)
else:raise SystemExit('PostgreSQL not ready')
database='sgp_pdt_qa_91_'+str(time.time_ns())
subprocess.run(['docker','exec',container,'createdb','-U','postgres',database],check=True)
print('ISOLATED DATABASE',database)
base=root/'docs/sql-proposals/pdt'
files=[root/'tests/sql/pdt/bootstrap.sql']+[base/name for name in [
 '20261024_pdt_multifabricacion_avances_nc_DRAFT.sql','20261025_pdt_fail_closed_REVIEW.sql',
 '20261024_pdt_rpc_contracts_REVIEW.sql','20261024_pdt_reverso_REVIEW.sql','20261024_pdt_nc_vincular_REVIEW.sql',
 '20261024_pdt_listar_v2_REVIEW.sql','20261025_pdt_legacy_guard_REVIEW.sql','20261025_pdt_capacidades_REVIEW.sql']]
for f in files:
 result=subprocess.run(['docker','exec','-i',container,'psql','-X','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1'],input=f.read_text(),text=True,capture_output=True)
 if result.returncode:raise SystemExit(f.name+'\n'+result.stderr)
 print('INSTALLED SYNTHETIC',f.name)
for f in [root/'tests/sql/pdt/phase-a.sql',base/'20261026_pdt_picking_B_REVIEW.sql',root/'tests/sql/pdt/phase-b.sql']:
 result=subprocess.run(['docker','exec','-i',container,'psql','-X','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1'],input=f.read_text(),text=True,capture_output=True)
 if result.returncode:raise SystemExit(f.name+'\n'+result.stderr)
 print('PASSED SYNTHETIC',f.name,result.stdout[-250:])

subprocess.run(['python',str(root/'tests/sql/pdt/concurrency.py'),database],check=True)
