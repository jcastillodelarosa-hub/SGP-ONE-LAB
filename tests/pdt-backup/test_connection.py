"""Tests for the new credential-handling boundary, without database access."""
import contextlib,importlib.util,io,os,subprocess,unittest
from pathlib import Path
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('probe',Path(__file__).with_name('check_connection.py'))
probe=importlib.util.module_from_spec(spec);spec.loader.exec_module(probe)

class ConnectionProbeTests(unittest.TestCase):
 def execute(self,result=None,password='synthetic-private-value'):
  out=io.StringIO()
  with patch.dict(os.environ,{'SUPABASE_DB_PASSWORD':password},clear=True),patch.object(probe.subprocess,'run',return_value=result) as run,contextlib.redirect_stdout(out):
   status=probe.main()
  return status,out.getvalue(),run
 def test_secret_not_in_command_or_output_and_connection_is_read_only(self):
  status,out,run=self.execute(subprocess.CompletedProcess([],0,'SGP_POSTGRES17_READ_ONLY_OK\n',''))
  self.assertEqual(status,0);argv=run.call_args.args[0]
  self.assertNotIn('synthetic-private-value',repr(argv)+out)
  self.assertEqual(run.call_args.kwargs['env']['PGPASSWORD'],'synthetic-private-value')
  self.assertIn('PGSSLMODE=verify-full',argv);self.assertIn('PGSSLROOTCERT=/etc/sgp-ca.crt',argv);self.assertTrue(any(a.startswith('type=bind,source=') and a.endswith(',target=/etc/sgp-ca.crt,readonly') for a in argv));self.assertIn('BEGIN READ ONLY;',argv[-1])
 def test_authentication_failure_has_only_required_safe_message(self):
  status,out,_=self.execute(subprocess.CompletedProcess([],1,'','FATAL: password authentication failed synthetic-private-value'))
  self.assertEqual(status,1);self.assertEqual(out.strip(),'Autenticación PostgreSQL fallida')
 def test_tls_error_is_not_reported_as_wrong_password(self):
  status,out,_=self.execute(subprocess.CompletedProcess([],1,'','SSL error: certificate verify failed synthetic-private-value'))
  self.assertEqual(status,1);self.assertEqual(out.strip(),'Verificación TLS PostgreSQL fallida')
 def test_missing_secret_does_not_attempt_connection(self):
  status,out,run=self.execute(password='');self.assertEqual(status,1);run.assert_not_called()
 def test_wrong_database_fails_closed(self):
  status,_,_=self.execute(subprocess.CompletedProcess([],0,'UNEXPECTED_DATABASE_OR_VERSION',''))
  self.assertEqual(status,1)

if __name__=='__main__':unittest.main()
