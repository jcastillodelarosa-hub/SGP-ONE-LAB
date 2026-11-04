"""Offline response-contract regressions; not evidence of the real gateway."""
import importlib.util, unittest
from pathlib import Path
path=Path(__file__).resolve().parents[2]/'scripts/lp-backend-readiness.py'
spec=importlib.util.spec_from_file_location('readiness',path)
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class GatewayDenials(unittest.TestCase):
 def test_platform_versions(self):
  for code in [401,'401','unauthorized','INVALID_JWT']:
   self.assertTrue(module.platform_denial(401,{'code':code,'message':'Invalid JWT'},'jwt'))
 def test_sgp_is_not_gateway_denial(self):
  self.assertFalse(module.platform_denial(401,{'code':'SGP_SESSION_INVALID','error':'JWT authorization'},'jwt'))
 def test_success_or_unrelated_error_is_not_signature_verification(self):
  for status,body in [(200,{'code':401,'message':'Invalid JWT'}),(503,{'code':401,'message':'Invalid JWT'}),(401,{'code':401,'message':'Other failure'}),(401,None),(401,{'message':'Invalid JWT'}),(401,{'code':'unsafe value','message':'Invalid JWT'})]:
   self.assertFalse(module.platform_denial(status,body,'jwt'))
if __name__=='__main__':unittest.main()
