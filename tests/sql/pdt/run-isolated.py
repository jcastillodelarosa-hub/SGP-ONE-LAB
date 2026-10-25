"""Run only in the explicitly named, network-disabled synthetic Docker fixture."""
import subprocess,pathlib,time,json,argparse,sys
sys.dont_write_bytecode=True
from installation_plan import render
root=pathlib.Path(__file__).resolve().parents[3]
parser=argparse.ArgumentParser(description='Explicitly distinguish synthetic tests from replica compatibility preflight')
mode=parser.add_mutually_exclusive_group(required=True)
mode.add_argument('--synthetic',action='store_true',help='Install mocks in a NEW disposable database; never real compatibility acceptance')
mode.add_argument('--compatible-db',help='READ-ONLY preflight of an existing isolated replica; never install automatically')
parser.add_argument('--production-catalog',help='Read-only production JSON export, used only with --compatible-db')
args=parser.parse_args()
if args.production_catalog and not args.compatible_db:parser.error('--production-catalog requires --compatible-db')
if args.compatible_db:
 command=[sys.executable,str(root/'tests/sql/pdt/preflight-compatible.py'),args.compatible_db]
 if args.production_catalog:command+=['--production-catalog',args.production_catalog]
 raise SystemExit(subprocess.run(command).returncode)
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
files=[root/'tests/sql/pdt/bootstrap.sql',root/'supabase/migrations/20261023_picking_no_duplicar_entrega_completa.sql']
for f in files:
 result=subprocess.run(['docker','exec','-i',container,'psql','-X','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1'],input=f.read_text(),text=True,capture_output=True)
 if result.returncode:raise SystemExit(f.name+'\n'+result.stderr)
 print('INSTALLED SYNTHETIC',f.name)
# Both phases install atomically; capabilities are never exposed midway.
for label,statement in [('phase A atomic install',render('A')),
 ('phase-a.sql',(root/'tests/sql/pdt/phase-a.sql').read_text()),
 ('phase B atomic install',render('B')),
 ('phase-b.sql',(root/'tests/sql/pdt/phase-b.sql').read_text()),
 ('regression-real-contracts.sql',(root/'tests/sql/pdt/regression-real-contracts.sql').read_text())]:
 result=subprocess.run(['docker','exec','-i',container,'psql','-X','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1'],input=statement,text=True,capture_output=True)
 if result.returncode:raise SystemExit(label+'\n'+result.stderr)
 print('PASSED SYNTHETIC',label,result.stdout[-250:])

subprocess.run(['python',str(root/'tests/sql/pdt/concurrency.py'),database],check=True)
