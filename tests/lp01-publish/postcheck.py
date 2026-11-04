"""Offline regressions: platform paths are verified, not broadly ignored."""
from pathlib import Path
import importlib.util,unittest,tempfile,json,gzip
spec=importlib.util.spec_from_file_location('postcheck',Path(__file__).resolve().parents[2]/'scripts/lp-hosting-postcheck.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
def f(path,h='same'):return {'path':'/'+path,'hash':h,'status':'ACTIVE'}
class Postcheck(unittest.TestCase):
 def test_transport_encoding_preserves_byte_verification(self):
  for body in [b'ok',b'current source'*100]:
   self.assertEqual(m.decode_public_body(gzip.compress(body),'gzip',len(body)),body)
   self.assertEqual(m.decode_public_body(body,'identity',len(body)),body)
  self.assertEqual(len(m.decode_public_body(gzip.compress(b'x'*100000),'gzip',5)),6)
  with self.assertRaisesRegex(ValueError,'PUBLIC_ENCODING_NOT_VERIFIED'):m.decode_public_body(b'unknown','br',10)
 def setUp(self):
  self.platform=[f(p) for p in sorted(m.PLATFORM_FILES)]
  self.expected={'index.html':'local-hash'}
  self.application=[f('index.html','new'),f('manifest.json','new')]
 def test_exact_artifact_and_unchanged_platform(self):
  self.assertEqual(m.verify_inventory(self.platform,self.application+self.platform,self.expected),(2,2))
  self.assertEqual(m.verify_inventory([],self.application,self.expected),(2,0))
 def test_missing_or_unexpected_application(self):
  for files in [self.application[:1]+self.platform,self.application+self.platform+[f('unexpected.js')]]:
   with self.assertRaisesRegex(ValueError,'LIVE_INVENTORY_DIFFERENT'):m.verify_inventory(self.platform,files,self.expected)
 def test_no_reserved_prefix_exception(self):
  with self.assertRaisesRegex(ValueError,'LIVE_INVENTORY_DIFFERENT'):m.verify_inventory(self.platform,self.application+self.platform+[f('__/unexpected.js')],self.expected)
 def test_platform_must_be_retained_and_unchanged(self):
  for before,after in [([],self.application+self.platform),(self.platform,self.application),(self.platform,self.application+[f(p,'changed') for p in m.PLATFORM_FILES])]:
   with self.assertRaises(ValueError):m.verify_inventory(before,after,self.expected)
 def test_duplicate_or_reserved_artifact_rejected(self):
  with self.assertRaisesRegex(ValueError,'DUPLICATE_HOSTING_PATH'):m.verify_inventory([],self.application+[f('index.html')],self.expected)
  with self.assertRaisesRegex(ValueError,'RESERVED_PATH_IN_ARTIFACT'):m.verify_inventory([],[],{'__/firebase/init.js':'x'})
 def test_public_bytes_include_manifest_and_reject_stale_content(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d);(p/'index.html').write_bytes(b'current');(p/'manifest.json').write_text(json.dumps({'files':{'index.html':'hash'}}))
   seen=[]
   def fetch(path,size):seen.append(path);return (p/path).read_bytes()
   self.assertEqual(m.verify_public_bytes(p,fetch),2);self.assertEqual(set(seen),{'index.html','manifest.json'})
   with self.assertRaisesRegex(ValueError,'PUBLIC_BYTES_DIFFER'):m.verify_public_bytes(p,lambda path,size:b'stale')
if __name__=='__main__':unittest.main()
