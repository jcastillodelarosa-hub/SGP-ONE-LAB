import importlib.util,pathlib,sys,unittest
p=pathlib.Path(__file__).with_name('backup_and_restore.py');sys.path.insert(0,str(p.parent))
s=importlib.util.spec_from_file_location('backup_worker',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class BackupSafetyTests(unittest.TestCase):
 def test_source_transactions_are_read_only_and_rolled_back(self):
  q=m.readonly_query('SELECT 1;','00000001-00000002-1')
  self.assertTrue(q.startswith('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;'))
  self.assertIn("SET TRANSACTION SNAPSHOT '00000001-00000002-1';",q)
  self.assertTrue(q.endswith('ROLLBACK;\n'))
 def test_snapshot_rejects_injection(self):
  with self.assertRaises(m.SafeFailure):m.readonly_query('SELECT 1;',"';COMMIT;--")
 def test_catalog_wrapper_is_not_nested(self):
  q=m.catalog_body();self.assertNotIn('BEGIN TRANSACTION READ ONLY;',q);self.assertNotIn('ROLLBACK;',q)
 def test_identifier_and_string_quoting(self):
  self.assertEqual(m.ident('a"b'),'"a""b"');self.assertEqual(m.literal("a'b"),"'a''b'")
if __name__=='__main__':unittest.main()
