"""Offline OPT positive-list and sealed-preflight regression. No network or publishing."""
from pathlib import Path
import importlib.util,json,hashlib,zipfile,tempfile,sys
root=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('preflight',root/'scripts/prepare-lp-hosting-plan.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
source=Path(sys.argv[1]);payload={str(p.relative_to(source)):p.read_bytes() for p in source.rglob('*') if p.is_file()}
assert all(rel in payload for rel in module.OPT_FILES)
assert not any(p.endswith('.pdf') or p.startswith(('tests/','private/','docs/')) for p in payload)
def archive(directory,name,values):
 values=dict(values);manifest=json.loads(values['manifest.json']);manifest['files']={p:hashlib.sha256(b).hexdigest() for p,b in values.items() if p!='manifest.json'};values['manifest.json']=json.dumps(manifest).encode();target=directory/(name+'.zip')
 with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED) as z:
  for p,b in values.items():z.writestr(p,b)
 return target,hashlib.sha256(target.read_bytes()).hexdigest()
with tempfile.TemporaryDirectory(prefix='opt-preflight-') as temp:
 directory=Path(temp);z,h=archive(directory,'valid',payload);result=module.prepare(z,h,directory/'valid-out',kind='runtime');assert result['network_actions']==0
 for name,mutation,expected in [('missing',lambda p:p.pop('vendor/opt-pdf/pdf.worker.min.mjs'),'OPT_FRONTEND_INCOMPLETE'),('missing-scope',lambda p:p.pop('src/services/opt-programming-scope.js'),'OPT_FRONTEND_INCOMPLETE'),('extra',lambda p:p.update({'vendor/opt-pdf/unreviewed.mjs':b'export default 1'}),'UNSAFE_OPT_PATH'),('private',lambda p:p.update({'opt-digital/source.pdf':b'synthetic sentinel'}),'UNSAFE_OPT_PATH'),('arbitrary-mjs',lambda p:p.update({'vendor/unreviewed.mjs':b'export default 1'}),'UNSAFE_PATH')]:
  changed=dict(payload);mutation(changed);z,h=archive(directory,name,changed)
  try:module.prepare(z,h,directory/(name+'-out'),kind='runtime');raise AssertionError('unsafe package accepted')
  except ValueError as error:assert expected in str(error),(name,error)
print(json.dumps({'status':'PASS','checks':['complete runtime package','missing worker rejected','missing programming dependency rejected','extra OPT module rejected','private source rejected','arbitrary mjs rejected'],'networkActions':0}))
