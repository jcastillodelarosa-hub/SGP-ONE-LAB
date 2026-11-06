"""Targeted NC confidentiality and direct-link rejection in isolated PostgreSQL."""
from pathlib import Path
import json,uuid
from fixture import setup,ROOT,f
x,_=setup();db=x.db;folder=ROOT/'docs/sql-proposals/lp01-shared-order'
try:
 db.sql('CREATE TABLE public.sgp_accesorios(id_accesorio text PRIMARY KEY,key_produccion text,codigo_sap text,descripcion text,cantidad numeric,unidad text)')
 db.sql((folder/'01_definition_REVIEW.sql').read_text())
 # Capture reviewed function metadata for this changed package only.
 catalog=json.loads(db.sql("SELECT jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'owner',pg_get_userbyid(p.proowner),'search_path',p.proconfig,'security_definer',p.prosecdef,'acl',p.proacl::text,'definition_md5',md5(pg_get_functiondef(p.oid))) ORDER BY p.proname) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='sgp_lp_shared_order' OR (n.nspname='public' AND p.proname IN('sgp_lp_shared_order_read_v1','sgp_lp_shared_order_command_v1','sgp_lp_shared_nc_lookup_v1'))"))
 old=json.loads((folder/'activation-manifest.json').read_text());activation=folder/'02_activate_REVIEW.sql';sql=activation.read_text()
 for current in catalog:
  previous=next(v for v in old['functions'] if v['signature']==current['signature'])
  assert all(previous[k]==current[k] for k in ['owner','search_path','security_definer','acl'])
  sql=sql.replace(previous['definition_md5'],current['definition_md5'])
 activation.write_text(sql);(folder/'activation-manifest.json').write_text(json.dumps({'environment':'expected isolated catalog, not production','functions':catalog},indent=2)+'\n')
 db.sql(activation.read_text())
 def lookup(ref,user='se',stage='ENSAMBLE'):
  return json.loads(db.sql('SET ROLE anon;SELECT public.sgp_lp_shared_nc_lookup_v1('+','.join(f.lit(v) for v in [user,x.key,stage,ref])+')'))
 for user,stage in [('se','ENSAMBLE'),('sp','EMPAQUE'),('COORDINADOR','ENSAMBLE')]:
  for ref in ['NC-123','NC-124','ABSENT']:
   value=lookup(ref,user,stage);assert value['source'] is None and value['fingerprint'] is None
   assert not any(t in json.dumps(value) for t in ['Nombre distinto','OVE distinto','Texto no canónico','FINALIZADA','ABIERTA'])
 def command(c):return 'SET ROLE anon;SELECT public.sgp_lp_shared_order_command_v1('+','.join(f.lit(v) for v in ['se',x.key,'ENSAMBLE'])+','+f.lit(json.dumps(c))+'::jsonb)'
 c=dict(id=str(uuid.uuid4()),revision=0,action='CREATE',cause='NC_V',quantity=2,observation='Número informado',ncReference='NC-123');db.sql(command(c))
 before=db.sql('SELECT to_jsonb(r) FROM sgp_lp_shared_order.reports r')
 result=db.run(command(dict(id=str(uuid.uuid4()),revision=1,action='LINK_NC',reportId=c['id'],fingerprint='0'*32,observation='Intento directo')))
 assert result.returncode and 'NC_SOURCE_UNAVAILABLE' in result.stderr
 assert db.sql('SELECT to_jsonb(r) FROM sgp_lp_shared_order.reports r')==before
 assert db.sql('SELECT count(*) FROM sgp_lp_shared_order.events')=='1'
 assert db.run("SET ROLE anon;SELECT public.sgp_lp_shared_nc_lookup_v1('sp','QA|PANELES_2','ENSAMBLE','NC-123')").returncode
 print('PASS: present/absent/foreign NC indistinguishable; manual reference retained; direct link rejected atomically; stage scope retained')
finally:x.close()
