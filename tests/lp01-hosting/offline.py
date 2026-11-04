from pathlib import Path
import tempfile,importlib.util,json,zipfile,hashlib,shutil
ROOT=Path(__file__).resolve().parents[2];spec=importlib.util.spec_from_file_location('plan',ROOT/'scripts/prepare-lp-hosting-plan.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
package=json.loads((ROOT/'tests/lp01-integration/evidence/packages.json').read_text())['archives']['sgp-lp183-main-visual'];checks=[]
with tempfile.TemporaryDirectory() as t:
 root=Path(t);source=Path(package['path']);assert source.exists(),'SEALED_ZIP_UNAVAILABLE'
 p=m.prepare(source,package['sha256'],root/'valid');assert p['status']=='BLOQUEADO' and p['network_actions']==0 and p['deploy_command'] is None
 cfg=json.loads((root/'valid/firebase.review.json').read_text());assert cfg['hosting']['public']=='public' and 'rewrites' not in cfg['hosting'];checks.append('Exact sealed ZIP/file hashes verified; dedicated public root; no rewrites or Firebase actions; deploy remains blocked')
 def rejects(path,code):
  try:m.prepare(path,hashlib.sha256(path.read_bytes()).hexdigest(),root/code);raise AssertionError('Invalid package accepted')
  except ValueError as e:assert code in str(e),(code,str(e))
 bad=root/'altered.zip';shutil.copyfile(source,bad)
 try:m.prepare(bad,'0'*64,root/'bad');raise AssertionError('Digest accepted')
 except ValueError as e:assert 'ZIP_DIGEST' in str(e)
 checks.append('Altered ZIP fails externally pinned digest')
 with zipfile.ZipFile(source) as z:original={i.filename:z.read(i.filename) for i in z.infolist()}
 for extra in ['../escape.js','private/snapshot.json','src/server/handler.js','.env','credentials.json']:
  path=root/'unsafe.zip'
  with zipfile.ZipFile(path,'w') as z:
   for name,b in original.items():z.writestr(name,b)
   z.writestr(extra,'denied')
  rejects(path,'UNSAFE_PATH')
 checks.append('Traversal, private inputs and server code rejected')
 path=root/'extra.zip'
 with zipfile.ZipFile(path,'w') as z:
  for name,b in original.items():z.writestr(name,b)
  z.writestr('extra.js','not sealed')
 rejects(path,'UNMANIFESTED_FILE');checks.append('Unmanifested root asset rejected even with newly computed ZIP digest')
 path=root/'wrong.zip'
 with zipfile.ZipFile(path,'w') as z:
  for name,b in original.items():z.writestr(name,b if name!='app.js' else b'altered')
 rejects(path,'FILE_DIGEST_MISMATCH');checks.append('File alteration fails embedded manifest hash')
 try:m.prepare(source,package['sha256'],root/'valid');raise AssertionError('Existing target overwritten')
 except ValueError as e:assert 'DESTINATION' in str(e)
 checks.append('Existing review artifact cannot be overwritten')
out={'status':'PASS','checks':checks,'scope':'local sealed synthetic frontend ZIP; no Firebase metadata or active version certified','firebase_actions':0};(ROOT/'tests/lp01-hosting/evidence/offline.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
