import importlib.util,json,pathlib,unittest
p=pathlib.Path(__file__).with_name('gcs_storage.py');s=importlib.util.spec_from_file_location('channel',p)
m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class PrivateChannelTests(unittest.TestCase):
 def test_boundary_has_only_object_roles_and_exact_prefix(self):
  rule=m.boundary()['accessBoundary']['accessBoundaryRules'][0]
  self.assertEqual(rule['availablePermissions'],['inRole:roles/storage.objectCreator','inRole:roles/storage.objectViewer'])
  self.assertIn(m.PREFIX,rule['availabilityCondition']['expression'])
  self.assertTrue(rule['availableResource'].endswith('/'+m.BUCKET))
 def test_names_cannot_escape_prefix(self):
  for name in ['outside/backup.dump',m.PREFIX+'../escape',m.PREFIX+'file?query']:
   with self.assertRaises(m.SafeFailure):m.validate_name(name)
  m.validate_name(m.PREFIX+'20261025/run-1/database.dump')
 def test_metadata_enforces_privacy_and_unlocked_retention(self):
  b=json.loads((p.parent/'gcs-config/bucket.json').read_text())
  self.assertTrue(m.valid_metadata(b));b['retentionPolicy']['isLocked']=True;self.assertFalse(m.valid_metadata(b))
if __name__=='__main__':unittest.main()
