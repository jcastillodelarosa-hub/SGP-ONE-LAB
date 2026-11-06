from pathlib import Path
import sys,json,uuid,hashlib
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'tests/lp01-shared-order'))
from fixture import setup,f
x,_=setup();db=x.db;folder=ROOT/'docs/sql-proposals/lp01-window-balance'
try:
 db.sql('CREATE TABLE public.sgp_accesorios(id_accesorio text PRIMARY KEY,key_produccion text,codigo_sap text,descripcion text,cantidad numeric,unidad text)')
 for name in ['01_definition_REVIEW.sql','02_activate_REVIEW.sql']:db.sql((ROOT/'docs/sql-proposals/lp01-shared-order'/name).read_text())
 catalog="SELECT jsonb_agg(jsonb_build_object('signature',oid::regprocedure::text,'owner',pg_get_userbyid(proowner),'acl',proacl::text,'config',proconfig,'definer',prosecdef,'definition_md5',md5(pg_get_functiondef(oid))) ORDER BY proname) FROM pg_proc WHERE oid IN('public.sgp_lp_shared_order_read_v1(text,text,text)'::regprocedure,'public.sgp_lp_shared_order_command_v1(text,text,text,jsonb)'::regprocedure)"
 before=json.loads(db.sql(catalog));db.sql((folder/'01_patch_REVIEW.sql').read_text());after=json.loads(db.sql(catalog))
 for a,b in zip(before,after):assert {k:v for k,v in a.items() if k!='definition_md5'}=={k:v for k,v in b.items() if k!='definition_md5'}
 db.sql('UPDATE public.sgp_producciones SET saldo_ensamble=8,saldo_empaque=3,saldos_inicializados=true,presente_ultimo_export=true')
 def read(stage='ENSAMBLE'):return json.loads(db.sql("SET ROLE anon;SELECT public.sgp_lp_shared_order_read_v1('COORDINADOR','QA|PANELES_2',"+f.lit(stage)+')'))
 def command(q,stage='ENSAMBLE',**kw):return dict(id=str(uuid.uuid4()),revision=read(stage)['revision'],action='CREATE',cause='NC_AL',quantity=q,observation='QA límite por etapa',**kw)
 def query(c,stage='ENSAMBLE',user='COORDINADOR'):return 'SET ROLE anon;SELECT public.sgp_lp_shared_order_command_v1('+','.join(map(f.lit,[user,x.key,stage]))+','+f.lit(json.dumps(c))+'::jsonb)'
 assert read()['stageBalance']==8 and read('EMPAQUE')['stageBalance']==3
 for stage,qty in [('ENSAMBLE',9),('EMPAQUE',4)]:
  c=command(qty,stage);old=read(stage);result=db.run(query(c,stage));assert result.returncode and 'SHARED_QUANTITY_EXCEEDS_BALANCE' in result.stderr;assert read(stage)==old
 c=command(8);first=json.loads(db.sql(query(c)));assert read()['reports'][0]['quantity']==8
 c2={**command(8),'cause':'NOVEDAD'};db.sql(query(c2));assert len(read()['reports'])==2 # categories overlap, never summed as cap
 correction={**command(4,'EMPAQUE'),'action':'CORRECT','reportId':first['reportId']};assert db.run(query(correction,'EMPAQUE')).returncode
 correction['quantity']=3;db.sql(query(correction,'EMPAQUE',user='sp'))
 db.sql('UPDATE public.sgp_producciones SET saldo_ensamble=0')
 assert json.loads(db.sql(query(c)))['duplicate'] # replay remains valid after Export changes
 assert db.run(query(command(1))).returncode
 db.sql(query(command(0)))
 db.sql('UPDATE public.sgp_producciones SET presente_ultimo_export=false')
 assert read()['stageBalance'] is None
 result=db.run(query(command(0)));assert 'SHARED_BALANCE_UNAVAILABLE' in result.stderr
 assert db.run(query(command(0),user='invalid')).returncode
 assert db.run((folder/'01_patch_REVIEW.sql').read_text()).returncode # no blind reapply
 (folder/'review-manifest.json').write_text(json.dumps({'before':before,'after':after,'sha256':hashlib.sha256((folder/'01_patch_REVIEW.sql').read_bytes()).hexdigest(),'scope':'isolated only; not installed'},indent=2)+'\n')
 result={'status':'PASS','environment':'isolated PostgreSQL synthetic only','checks':['stage-specific bounds, zero and missing source','rejected changes atomic','overlapping categories not summed','cross-stage correction','exact replay after Export change','ACL owner search_path unchanged','unauthorized denied and drift blocks repeat']};(Path(__file__).parent/'result.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
finally:x.close()
