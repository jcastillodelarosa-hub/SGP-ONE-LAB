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
class GlobalRoleRecoveryTests(unittest.TestCase):
 def test_duplicate_roles_are_classified_without_names_or_sql(self):
  self.assertEqual(m.role_error_code(b'ERROR: role "bootstrap" already exists'),'ROLE_ALREADY_EXISTS')
  self.assertEqual(m.role_error_code(b'ERROR: unrecognized configuration parameter "private.setting"'),'ROLE_CONFIGURATION_NOT_AVAILABLE')
 def test_diagnostic_redacts_identifiers(self):
  result=m.safe_role_diagnostic(b'ERROR: permission denied to grant role "private-role"\nDETAIL: private data')
  self.assertNotIn('private-role',result);self.assertNotIn('private data',result)
  self.assertIn('[identifier]',result)
 def test_adapter_only_wraps_role_creation(self):
  raw=b'CREATE ROLE postgres;\nALTER ROLE postgres WITH NOLOGIN;\nGRANT anon TO postgres;\n'
  adapted=m.idempotent_role_creation(raw)
  self.assertIn(b'EXCEPTION WHEN duplicate_object THEN NULL',adapted)
  self.assertIn(b'ALTER ROLE postgres WITH NOLOGIN;',adapted)
  self.assertIn(b'GRANT anon TO postgres;',adapted)
  self.assertNotIn(b'DROP',adapted)
 def test_quoted_role_names_remain_quoted(self):
  self.assertIn(b'CREATE ROLE "a""b";',m.idempotent_role_creation(b'CREATE ROLE "a""b";\n'))
if __name__=='__main__':unittest.main()
