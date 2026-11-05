from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import sys,json,uuid
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'tests/lp01-afectaciones-rpc'));import atomic as f
x=f.Fixture()
try:
 db=x.db
 for name in ['01_definition_REVIEW.sql','02_glass_nc_REVIEW.sql']:db.sql((ROOT/'docs/sql-proposals/lp01-order-details'/name).read_text())
 sigs=['public.sgp_lp_glass_nc_report_v1(text,text,text,date,integer,jsonb,text)','public.sgp_lp_glass_nc_read_v1(text,text,text)']
 for role in ['anon','authenticated','service_role']:
  for sig in sigs:assert db.sql('SELECT has_function_privilege('+f.lit(role)+','+f.lit(sig)+",'EXECUTE')")=='f'
 db.sql('GRANT EXECUTE ON FUNCTION '+','.join(sigs)+' TO anon')
 def query(c,nc='NC-123',user='ll'):
  return 'SET ROLE anon;SELECT public.sgp_lp_glass_nc_report_v1('+','.join([f.lit(user),f.lit(x.key),"'ENSAMBLE'","'2026-11-01'",'1',f.lit(json.dumps(c))+'::jsonb',f.lit(nc) if nc is not None else 'NULL'])+')'
 def read():return json.loads(db.sql("SET ROLE anon;SELECT public.sgp_lp_glass_nc_read_v1('COORDINADOR','QA|PANELES_2','ENSAMBLE')"))
 c=x.command('CREATE',3,user='ll',cause='NC_V');assert db.run(query(c)).returncode
 db.sql('UPDATE sgp_lp_order_details.config SET writes=true;UPDATE sgp_lp_afectaciones.config SET writes=true')
 first=json.loads(db.sql(query(c)));assert first['ncReference']=='NC-123' and first['ncVerified'] is False
 assert json.loads(db.sql(query(c)))['duplicate'];assert db.run(query(c,'different')).returncode
 assert read()['references']==[{'reportId':first['reportId'],'reference':'NC-123','verified':False}]
 for nc in [None,'','x'*81,'NC\n123']:
  assert db.run(query(x.command('CREATE',1,user='ll',cause='NC_V'),nc)).returncode
 for cause in ['TECNO','NOVEDAD','NC_AL']:
  assert db.run(query(x.command('CREATE',1,user='ll',cause=cause))).returncode
 assert db.run(query(x.command('CREATE',1,user='ll',cause='NC_V'),user='sp')).returncode
 same=x.command('CREATE',2,user='ll',cause='NC_V')
 with ThreadPoolExecutor(2) as pool:r=list(pool.map(lambda _:json.loads(db.sql(query(same))),range(2)))
 assert sorted(a['duplicate'] for a in r)==[False,True]
 assert len(read()['references'])==2
 before=db.sql('SELECT count(*) FROM sgp_lp_afectaciones.eventos')
 db.sql("CREATE FUNCTION public.qa_nc_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'QA_NC_FAIL';END $$;CREATE TRIGGER qa_nc_fail BEFORE INSERT ON sgp_lp_order_details.glass_nc FOR EACH ROW EXECUTE FUNCTION public.qa_nc_fail()")
 assert db.run(query(x.command('CREATE',1,user='ll',cause='NC_V'))).returncode
 assert len(read()['references'])==2 and db.sql('SELECT count(*) FROM sgp_lp_afectaciones.eventos')==before
 assert db.run('SET ROLE anon;SELECT * FROM sgp_lp_order_details.glass_nc').returncode
 out={'status':'PASS','scope':'Synthetic isolated PostgreSQL17.11; no productive NC or session','checks':['No default grants; disabled before activation','Manual NC reference and reported windows commit atomically; reference is explicitly unverified','Same UUID idempotent; changed NC rejected; concurrent retry creates once','Invalid input, other causes and unauthorized actor denied','Late NC insert failure rolls back native report and event; no physical confirmation or automatic Tecno report']}
 (Path(__file__).parent/'glass-nc-result.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out))
finally:x.close()
