import importlib.util,json,pathlib,unittest
root=pathlib.Path(__file__).parent
spec=importlib.util.spec_from_file_location('bucket_config',root/'create_gcs_bucket.py')
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
class BucketConfigurationTests(unittest.TestCase):
 def bucket(self):return json.loads((root/'gcs-config/bucket.json').read_text())
 def test_authorized_config(self):self.assertTrue(mod.valid_bucket(self.bucket(),{'bindings':[]}))
 def test_public_or_locked_or_short_retention_rejected(self):
  b=self.bucket();b['retentionPolicy']['isLocked']=True;self.assertFalse(mod.valid_bucket(b,{'bindings':[]}))
  b=self.bucket();b['retentionPolicy']['retentionPeriod']='1';self.assertFalse(mod.valid_bucket(b,{'bindings':[]}))
  self.assertFalse(mod.valid_bucket(self.bucket(),{'bindings':[{'members':['allUsers']}]}))
 def test_other_target_rejected(self):
  b=self.bucket();b['name']='different-project-bucket';self.assertFalse(mod.valid_bucket(b,{'bindings':[]}))
if __name__=='__main__':unittest.main()
