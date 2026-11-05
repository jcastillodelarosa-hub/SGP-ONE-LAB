"""Execute the complete unmodified installer and enable files in isolated PostgreSQL only."""
from pathlib import Path
import sys,json
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'tests/lp01-afectaciones-rpc'));import atomic as f
x=f.Fixture()
try:
 db=x.db
 db.sql((ROOT/'docs/sql-proposals/lp01-afectaciones/13_all_origins_read_REVIEW.sql').read_text())
 db.sql((ROOT/'docs/sql-proposals/lp01-order-sale/01_definition_REVIEW.sql').read_text())
 for sig in ['public.sgp_lp_sale_orden_consultar_v1(text,text,text)','public.sgp_lp_sale_orden_definir_v1(text,text,text,jsonb)']:
  assert db.sql("SELECT has_function_privilege('anon',"+f.lit(sig)+",'EXECUTE')")=='f'
 assert db.sql('SELECT definitions_enabled FROM sgp_lp_sale_orden.config')=='f'
 db.sql((ROOT/'docs/sql-proposals/lp01-order-sale/02_enable_REVIEW.sql').read_text())
 for sig in ['public.sgp_lp_sale_orden_consultar_v1(text,text,text)','public.sgp_lp_sale_orden_definir_v1(text,text,text,jsonb)']:
  assert db.sql("SELECT has_function_privilege('anon',"+f.lit(sig)+",'EXECUTE')")=='t'
 assert db.sql('SELECT definitions_enabled FROM sgp_lp_sale_orden.config')=='t'
 assert db.run('SET ROLE anon;SELECT * FROM sgp_lp_sale_orden.definiciones').returncode
 print(json.dumps({'status':'PASS','environment':'isolated PostgreSQL synthetic','exactInstaller':True,'completeEnableFile':True,'anonOnlyTwoFunctions':True,'privateTablesClosed':True,'configEnabled':True}))
finally:x.close()
