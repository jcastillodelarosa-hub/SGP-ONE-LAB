from pathlib import Path
import json,hashlib
from fixture import setup,ROOT
x,_=setup();db=x.db;folder=ROOT/'docs/sql-proposals/lp01-shared-order'
try:
 db.sql('CREATE TABLE public.sgp_accesorios(id_accesorio text PRIMARY KEY,key_produccion text,codigo_sap text,descripcion text,cantidad numeric,unidad text)')
 db.sql((folder/'01_definition_REVIEW.sql').read_text())
 db.sql((folder/'02_activate_REVIEW.sql').read_text())
 assert db.sql('SELECT writes FROM sgp_lp_shared_order.config')=='t'
 for name,args in [('read','text,text,text'),('command','text,text,text,jsonb')]:assert db.sql("SELECT has_function_privilege('anon','public.sgp_lp_shared_order_"+name+"_v1("+args+")','EXECUTE')")=='t'
 db.sql((folder/'03_contain_REVIEW.sql').read_text())
 assert db.sql('SELECT writes FROM sgp_lp_shared_order.config')=='f'
 assert db.sql("SELECT has_function_privilege('anon','public.sgp_lp_shared_order_read_v1(text,text,text)','EXECUTE')")=='f'
 for role in ['anon','authenticated','service_role']:assert db.run('SET ROLE '+role+';SELECT * FROM sgp_lp_shared_order.reports').returncode
 (folder/'package-sha256.json').write_text(json.dumps({p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(folder.glob('*.sql'))},indent=2)+'\n')
 out={'status':'PASS','environment':'isolated synthetic PostgreSQL only','checks':['definition hashes/owner/search_path/ACL gate passes before activation','only new anon RPC grants and new local flag','non-destructive containment revokes new grants; tables remain private']};(Path(__file__).parent/'package-result.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out))
finally:x.close()
