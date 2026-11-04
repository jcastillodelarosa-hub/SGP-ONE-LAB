"""Run changed browser fixtures, preserving their historical evidence verbatim."""
from pathlib import Path
import subprocess,sys,tempfile,shutil,json
ROOT=Path(__file__).resolve().parents[2];HERE=Path(__file__).parent
names=sys.argv[1:] or ['roles','powerbi','cierres-integrados','continuidad','sin-actividad','apertura','fuentes','seguimiento']
results=[]
for name in names:
 folder=ROOT/('tests/lp01-'+name);evidence=folder/'evidence';backup=Path(tempfile.mkdtemp(prefix='sgp-compat-evidence-'));original=set()
 if evidence.exists():
  for path in evidence.rglob('*'):
   if path.is_file():rel=path.relative_to(evidence);original.add(rel);(backup/rel).parent.mkdir(parents=True,exist_ok=True);shutil.copy2(path,backup/rel)
 try:
  r=subprocess.run([sys.executable,str(folder/'browser.py')],cwd=ROOT,capture_output=True,text=True,timeout=240)
  log=Path('/tmp')/('sgp-compat-'+name+'.log');log.write_text(r.stdout+'\n'+r.stderr)
  results.append({'fixture':name,'status':'PASS' if r.returncode==0 else 'FAIL','log':str(log)})
  print(json.dumps(results[-1]),flush=True)
 finally:
  if evidence.exists():
   for path in evidence.rglob('*'):
    if path.is_file() and path.relative_to(evidence) not in original:path.unlink()
  for rel in original:shutil.copy2(backup/rel,evidence/rel)
  shutil.rmtree(backup)
previous=HERE/'compatibility-result.json'
old=json.loads(previous.read_text()) if previous.exists() else []
merged={x['fixture']:x for x in old+results};previous.write_text(json.dumps(list(merged.values()),indent=2)+'\n')
if any(x['status']!='PASS' for x in results):raise SystemExit(1)
