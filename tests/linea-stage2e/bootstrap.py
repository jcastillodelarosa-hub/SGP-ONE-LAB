"""Restore a networkless synthetic baseline, preserving all prior evidence bytes.
Only the existing B2 fixture is rebuilt; 2D code/tests are reused unchanged.
"""
from pathlib import Path
import json,runpy,subprocess
R=Path(__file__).resolve().parents[2];E=R/'tests/linea-stage2e/evidence'
meta=json.loads(subprocess.check_output(['docker','inspect','sgp-pdt-qa-91']))[0]
assert meta['HostConfig']['NetworkMode']=='none' and not meta['HostConfig'].get('PortBindings')
roles="DO $$BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN;END IF;IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN;END IF;END$$;"
p=subprocess.run(['docker','exec','-i','sgp-pdt-qa-91','psql','-XqAt','-U','postgres','-v','ON_ERROR_STOP=1'],input=roles,text=True,capture_output=True);assert p.returncode==0,p.stderr
prior={p:p.read_bytes() for p in (R/'tests/linea-stage2b/evidence').iterdir() if p.is_file()}
try:
 runpy.run_path(str(R/'tests/linea-stage2b/run-postgres.py'))
 data=json.loads((R/'tests/linea-stage2b/evidence/postgres.json').read_text())
 db=(R/'tests/linea-stage2b/evidence/database.txt').read_text().strip()
 assert db.startswith('sgp_linea_b2_qa_') and db.removeprefix('sgp_linea_b2_qa_').isdigit()
 def sql(q):
  p=subprocess.run(['docker','exec','-i','sgp-pdt-qa-91','psql','-XqAt','-U','postgres','-d',db,'-v','ON_ERROR_STOP=1'],input=q,text=True,capture_output=True)
  assert p.returncode==0,p.stderr
 # Isolated prerequisite namespace ONLY, not a fake installation of D2 unit flow.
 sql('CREATE SCHEMA sgp_linea_d2;REVOKE ALL ON SCHEMA sgp_linea_d2 FROM PUBLIC,anon,authenticated;')
 sql((R/'docs/sql-proposals/linea-etapa2d/02_export_ack_REVIEW.sql').read_text())
 (E/'base.txt').write_text(db+'\n')
 (E/'bootstrap.json').write_text(json.dumps({'status':'PASS','database':db,'inheritedB2Checks':data['checks'],'scope':'Synthetic B2/auth fixture rebuilt for E2 tests; existing D2 ACK proposal only, NOT full D2 productive schema; prior evidence restored byte-for-byte'},indent=2)+'\n')
finally:
 for p,b in prior.items():p.write_bytes(b)
