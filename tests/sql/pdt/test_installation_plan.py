import unittest
from installation_plan import files,manifest,render,transaction_body

class InstallationPlanTests(unittest.TestCase):
 def test_ten_ordered_proposals(self):
  self.assertEqual(len(files('AB')),10)
  self.assertEqual(len(manifest('AB')),10)
  self.assertTrue(files('A')[-1].endswith('capacidades_REVIEW.sql'))
 def test_only_outer_wrapper_removed(self):
  self.assertEqual(transaction_body('-- reviewed\nBEGIN;\nDO $$ BEGIN PERFORM 1; END $$;\nCOMMIT;'),'-- reviewed\nDO $$ BEGIN PERFORM 1; END $$;')
 def test_unknown_wrappers_rejected(self):
  for sql in ['SELECT 1;','BEGIN;\nSELECT 1;','SELECT 1;\nBEGIN;\nCOMMIT;']:
   with self.assertRaises(ValueError):transaction_body(sql)
 def test_single_commit_in_assembled_batch(self):
  text=render('AB')
  self.assertEqual(sum(line.strip()=='COMMIT;' for line in text.splitlines()),1)
  self.assertTrue(text.endswith('COMMIT;\n'))
  self.assertIn('sgp_pdt_validar_rol_real',text)
  self.assertIn("SET LOCAL lock_timeout='5s'",text)

if __name__=='__main__':unittest.main()
