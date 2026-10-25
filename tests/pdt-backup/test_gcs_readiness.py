"""Checks for backup destination selection, no cloud requests."""
import importlib.util,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('gcs_probe',Path(__file__).with_name('gcs_readiness.py'))
probe=importlib.util.module_from_spec(spec);spec.loader.exec_module(probe)

class GcsReadinessTests(unittest.TestCase):
 def bucket(self,name='sgp-private-backups'):
  return {'name':name,'iamConfiguration':{'uniformBucketLevelAccess':{'enabled':True},'publicAccessPrevention':'enforced'}}
 def test_private_uniform_bucket(self):self.assertTrue(probe.eligible(self.bucket(),{'bindings':[]}))
 def test_public_iam_rejected(self):
  for member in ['allUsers','allAuthenticatedUsers']:
   self.assertFalse(probe.eligible(self.bucket(),{'bindings':[{'members':[member]}]}))
 def test_application_bucket_rejected(self):
  for name in ['sgp-one-lab.appspot.com','sgp-one-lab.firebasestorage.app']:
   self.assertFalse(probe.eligible(self.bucket(name),{'bindings':[]}))
 def test_unknown_or_nonuniform_configuration_rejected(self):
  self.assertFalse(probe.eligible({'name':'unknown'},{'bindings':[]}))
  b=self.bucket();b['iamConfiguration']['uniformBucketLevelAccess']['enabled']=False
  self.assertFalse(probe.eligible(b,{'bindings':[]}))
 def test_enforcement_not_assumed(self):
  b=self.bucket();b['iamConfiguration']['publicAccessPrevention']='inherited'
  self.assertFalse(probe.eligible(b,{'bindings':[]}))

if __name__=='__main__':unittest.main()
