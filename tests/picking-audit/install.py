import os
"""Install REVIEW only into the own network-none synthetic fixture."""
import subprocess,pathlib,json
root=pathlib.Path(__file__).resolve().parents[2]
c='sgp-audit-test'
assert json.loads(subprocess.check_output(['docker','inspect',c]))[0]['HostConfig']['NetworkMode']=='none'
subprocess.run(['docker','exec','-i',c,'psql','-U','postgres','-d',os.environ.get('AUDIT_TEST_DB','sgp_parcial_integration'),'-v','ON_ERROR_STOP=1'],input=(root/'docs/sql-proposals/picking-audit/install-review.sql').read_text(),text=True,check=True)
