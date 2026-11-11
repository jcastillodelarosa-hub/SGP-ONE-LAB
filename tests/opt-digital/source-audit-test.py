import importlib.util, unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('audit',Path(__file__).parents[2]/'scripts/opt-source-audit.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class SourceAuditTest(unittest.TestCase):
 def test_multiple_cuts_in_one_geometric_cell(self):
  self.assertEqual(m.parse_cell('58 3/4" Synthetic A 1\n(Line 2) A\n36 5/16" Synthetic B 1\n(Line 3) B'),[(1880,'SyntheticA(Line2)A',1),(1162,'SyntheticB(Line3)B',1)])
 def test_continuation_keeps_identity(self):
  self.assertNotEqual(m.parse_cell('10" Synthetic 2')[0][1],m.parse_cell('10" Synthetic 2\n(Line 5) C')[0][1])
 def test_invalid_cell_fails(self):
  with self.assertRaises(ValueError):m.parse_cell('truncated reference without preceding cut')
 def test_exact_fraction(self):
  self.assertEqual(m.length32('46 1/4"'),1480)
  with self.assertRaises(ValueError):m.length32('2 1/3"')
if __name__=='__main__':unittest.main()
