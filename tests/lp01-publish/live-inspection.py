"""Offline regressions of read-only diagnosis; fixtures never certify Firebase."""
from pathlib import Path
import importlib.util,hashlib,json,tempfile,unittest,zipfile,gzip,urllib.error,yaml
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('live',ROOT/'scripts/lp-hosting-inspect-published.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Inspection(unittest.TestCase):
 def test_inspect_never_routes_to_publish_or_recovery(self):
  y=yaml.load((ROOT/'.github/workflows/firebase-hosting.yml').read_text(),Loader=yaml.BaseLoader)
  steps=y['jobs']['controlled']['steps']
  for s in steps:
   if s.get('uses','').startswith('FirebaseExtended/'):
    self.assertEqual(s['if'],"needs.gate.outputs.route == 'publish' || needs.gate.outputs.route == 'visual'")
   if s.get('env',{}).get('LP_METADATA_OPERATION')=='recover':self.assertEqual(s['if'],"needs.gate.outputs.route == 'recover'")
  upload=next(s for s in steps if s.get('name','').startswith('Sanitized metadata'))
  self.assertEqual(upload['if'],'always()')
  inspector=next(s for s in steps if s.get('run')=='python scripts/lp-hosting-inspect-published.py')
  self.assertEqual(inspector['env']['LP_ROUTE'],'inspect');self.assertIn("== 'inspect'",inspector['if'])
 def test_exact_paths_and_differences(self):
  manifest={'files':{'index.html':'x','src/modules/lp01-operation.js':'y'}}
  good=[{'path':'/'+p} for p in list(manifest['files'])+['manifest.json']]
  self.assertTrue(m.paths_report(manifest,good)['matches'])
  bad=good[1:]+[{'path':'unexpected.json'}];r=m.paths_report(manifest,bad)
  self.assertEqual(r['missing'],['index.html']);self.assertEqual(r['additional'],['unexpected.json']);self.assertFalse(r['matches'])
 def test_ambiguous_unsafe_paths_rejected(self):
  for files in [[{'path':'/index.html'},{'path':'index.html'}],[{'path':None}],[{'path':'bad\npath'}]]:
   with self.assertRaises(ValueError):m.paths_report({'files':{}},files)
 def test_pins_exact_and_no_arbitrary_artifact(self):
  pin=json.loads((ROOT/'deployment/lp-live-verification.json').read_text())
  env={var:pin[field] for field,var in [('source_sha','LP_SOURCE_SHA'),('artifact_run_id','LP_RUN'),('zip_sha256','LP_ZIP_SHA'),('expected_live_version','LP_EXPECTED_LIVE')]}
  m.check_pins(pin,env)
  for var in env:
   with self.assertRaises(ValueError):m.check_pins(pin,env|{var:'different'})
 def test_zip_provenance_and_integrity(self):
  with tempfile.TemporaryDirectory() as t:
   root=Path(t);source='a'*40
   data={'index.html':b'QA','app.js':b'QA','config.js':b'QA','src/modules/lp01-followup.js':b'QA','src/modules/lp01-operation.js':b"import {importPowerBI} from './lp01-powerbi-client.js'; sgp_lp_operacion_consultar"}
   manifest={'mode':'FULL_SGP_RUNTIME_LP','production_deploy':True,'source_head':source,'files':{p:hashlib.sha256(b).hexdigest() for p,b in data.items()}}
   with zipfile.ZipFile(root/'lp-visual.zip','w') as z:
    for p,b in data.items():z.writestr(p,b)
    z.writestr('manifest.json',json.dumps(manifest))
   digest=hashlib.sha256((root/'lp-visual.zip').read_bytes()).hexdigest();pin={'source_sha':source,'zip_sha256':digest}
   (root/'lp-visual-digest.json').write_text(json.dumps(pin));actual,public=m.sealed(root,pin,root/'valid');self.assertEqual(actual,manifest)
   with self.assertRaisesRegex(ValueError,'SEALED_PROVENANCE_MISMATCH'):m.sealed(root,pin|{'source_sha':'b'*40},root/'wrong')
   (root/'lp-visual.zip').write_bytes(b'changed')
   with self.assertRaisesRegex(ValueError,'ZIP_DIGEST_MISMATCH'):m.sealed(root,pin,root/'changed')
 def test_public_body_hash_and_encoding_without_network(self):
  body=b'QA public bytes';expected=hashlib.sha256(body).hexdigest()
  class Response:
   status=200
   headers={'Content-Encoding':'gzip','Cache-Control':'no-store'}
   def read(self,n):return gzip.compress(body)
   def __enter__(self):return self
   def __exit__(self,*args):pass
  class Opener:
   def open(self,request,timeout):
    self_request=request
    assert request.method=='GET' and request.full_url=='https://sgp-one-lab.web.app/'
    return Response()
  with patch.object(m.urllib.request,'build_opener',return_value=Opener()):
   self.assertTrue(m.public_asset('index.html',expected)['bytes_match'])
   self.assertFalse(m.public_asset('index.html','0'*64)['bytes_match'])
  with self.assertRaises(ValueError):m.public_asset('../private.json',expected)
if __name__=='__main__':unittest.main()
