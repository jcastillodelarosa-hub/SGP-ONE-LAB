from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import sys,json,uuid
ROOT=Path(__file__).resolve().parents[2];from fixture import setup,f
x,_=setup();db=x.db
try:
 db.sql('CREATE TABLE public.sgp_accesorios(id_accesorio text PRIMARY KEY,key_produccion text,codigo_sap text,descripcion text,cantidad numeric,unidad text);INSERT INTO public.sgp_accesorios VALUES(\'A1\',\'QA|PANELES_2\',\'ACC-1\',\'Accesorio\',20,\'piezas\'),(\'A2\',NULL,\'ACC-2\',\'Ambiguo\',30,\'piezas\')')
 db.sql((ROOT/'docs/sql-proposals/lp01-shared-order/01_definition_REVIEW.sql').read_text())
 sigs=['public.sgp_lp_shared_order_read_v1(text,text,text)','public.sgp_lp_shared_order_command_v1(text,text,text,jsonb)','public.sgp_lp_shared_nc_lookup_v1(text,text,text,text)']
 for sig in sigs:
  for role in ['anon','authenticated','service_role']:assert db.sql('SELECT has_function_privilege('+f.lit(role)+','+f.lit(sig)+",'EXECUTE')")=='f'
 catalog=json.loads(db.sql("SELECT jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'owner',pg_get_userbyid(p.proowner),'search_path',p.proconfig,'security_definer',p.prosecdef,'acl',p.proacl::text,'definition_md5',md5(pg_get_functiondef(p.oid))) ORDER BY p.proname) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='sgp_lp_shared_order' OR (n.nspname='public' AND p.proname IN('sgp_lp_shared_order_read_v1','sgp_lp_shared_order_command_v1','sgp_lp_shared_nc_lookup_v1'))"))
 (ROOT/'docs/sql-proposals/lp01-shared-order/activation-manifest.json').write_text(json.dumps({'environment':'expected isolated catalog, not production','functions':catalog},indent=2)+'\n')
 db.sql('GRANT EXECUTE ON FUNCTION '+','.join(sigs)+' TO anon')
 def query(cmd,user='COORDINADOR',stage='ENSAMBLE',key=x.key):return 'SET ROLE anon;SELECT public.sgp_lp_shared_order_command_v1('+','.join(map(f.lit,[user,key,stage]))+','+f.lit(json.dumps(cmd))+'::jsonb)'
 def read(user='COORDINADOR',stage='ENSAMBLE'):return json.loads(db.sql('SET ROLE anon;SELECT public.sgp_lp_shared_order_read_v1('+','.join(map(f.lit,[user,x.key,stage]))+')'))
 def cmd(**kw):return dict(id=str(uuid.uuid4()),revision=read()['revision'],action='CREATE',cause='NOVEDAD',quantity=3,observation='Reporte compartido',**kw)
 c=cmd();assert db.run(query(c)).returncode
 db.sql('UPDATE sgp_lp_shared_order.config SET writes=true')
 # No open turn is needed and none is invented by the new writer.
 db.sql("UPDATE sgp_lp_operacion.turnos SET estado='CERRADO'")
 before=db.sql('SELECT jsonb_agg(to_jsonb(t)) FROM sgp_lp_operacion.turnos t')
 save=lambda c,**kw:json.loads(db.sql(query(c,**kw)))
 first=save(c,user='se');assert save(c,user='se')['duplicate']
 assert read(user='sp',stage='EMPAQUE')['reports']==read(user='se')['reports']
 assert db.run(query({**c,'id':str(uuid.uuid4())})).returncode
 second={**cmd(),'action':'CORRECT','reportId':first['reportId'],'quantity':5};save(second,user='sp',stage='EMPAQUE')
 assert read()['reports'][0]['quantity']==5 and read()['history'][-1]['stage']=='EMPAQUE'
 for user,stage in [('se','EMPAQUE'),('sp','ENSAMBLE'),('CONSULTA','ENSAMBLE'),('invalid','ENSAMBLE')]:assert db.run(query(cmd(),user=user,stage=stage)).returncode
 for delta in [{'quantity':-1},{'quantity':1.5},{'cause':'TECNO'},{'quantity':None},{'observation':''},{'sourceRef':'A2','cause':'ACCESORIOS'}]:assert db.run(query({**cmd(),**delta})).returncode
 accessory={**cmd(),'cause':'ACCESORIOS','sourceRef':'A1','quantity':2};save(accessory,user='sp',stage='EMPAQUE')
 assert read()['accessories'][0]['pieces']=='20' and len(read()['accessories'])==1
 assert [r for r in read()['reports'] if r['cause']=='ACCESORIOS'][0]['quantity']==2
 assert db.run(query({**accessory,'id':str(uuid.uuid4()),'revision':read()['revision']})).returncode
 nc={**cmd(),'cause':'NC_V','ncReference':'NC-123'};r=save(nc,user='se');rid=r['reportId']
 lookup=lambda:json.loads(db.sql("SET ROLE anon;SELECT public.sgp_lp_shared_nc_lookup_v1('sp','QA|PANELES_2','EMPAQUE','NC-123')"))
 link={**cmd(),'action':'LINK_NC','reportId':rid,'fingerprint':lookup()['fingerprint'],'observation':'Verificado explícitamente para esta orden y línea'}
 assert lookup()['source'] is None and lookup()['fingerprint'] is None
 assert db.run(query(link,user='sp',stage='EMPAQUE')).returncode
 n=[a for a in read()['reports'] if a['id']==rid][0];assert n['nc_link'] is None and n['confirmed']==0 and n['sourceNow'] is None
 assert len(read()['legacyReports'])==1 and read()['legacyReports'][0]['etapa']=='ENSAMBLE'
 # Changes in the other stage cause a shared CAS conflict; exact concurrent retry inserts once.
 race=[cmd(),cmd()]
 with ThreadPoolExecutor(2) as pool:out=list(pool.map(lambda c:db.run(query(c)),race))
 assert sorted(a.returncode==0 for a in out)==[False,True]
 same=cmd()
 with ThreadPoolExecutor(2) as pool:out=list(pool.map(lambda _:save(same),range(2)))
 assert sorted(a['duplicate'] for a in out)==[False,True]
 before_reports=read()['reports']
 db.sql("CREATE FUNCTION public.qa_shared_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'QA_FAIL';END $$;CREATE TRIGGER qa_fail BEFORE INSERT ON sgp_lp_shared_order.events FOR EACH ROW EXECUTE FUNCTION public.qa_shared_fail()")
 assert db.run(query(cmd())).returncode and read()['reports']==before_reports
 db.sql('DROP TRIGGER qa_fail ON sgp_lp_shared_order.events')
 assert db.sql('SELECT jsonb_agg(to_jsonb(t)) FROM sgp_lp_operacion.turnos t')==before
 assert db.run('SET ROLE anon;SELECT * FROM sgp_lp_shared_order.reports').returncode
 assert db.run('DELETE FROM sgp_lp_shared_order.events').returncode
 db.sql('UPDATE sgp_lp_operacion.config SET escrituras=false');assert not read()['canReport'] and db.run(query(cmd())).returncode
 db.sql('UPDATE sgp_lp_operacion.config SET escrituras=true')
 # Existing order note remains one shared value across stage-specific actors.
 db.sql('GRANT EXECUTE ON FUNCTION public.sgp_lp_order_note_save_v1(text,text,text,jsonb),public.sgp_lp_order_details_read_v1(text,text,text) TO anon')
 note=dict(id=str(uuid.uuid4()),revision=0,observation='Nota de toda la orden desde Ensamble')
 db.sql("SET ROLE anon;SELECT public.sgp_lp_order_note_save_v1('se','QA|PANELES_2','ENSAMBLE',"+f.lit(json.dumps(note))+"::jsonb)")
 observed=json.loads(db.sql("SET ROLE anon;SELECT public.sgp_lp_order_details_read_v1('sp','QA|PANELES_2','EMPAQUE')"))
 assert observed['note']['observation']==note['observation']
 db.sql("UPDATE public.sgp_usuario_accesos SET permitido=false WHERE id_usuario=(SELECT id_usuario FROM public.sgp_usuarios WHERE usuario='se')")
 assert db.run(query(cmd(),user='se')).returncode
 assert db.run("SET ROLE anon;SELECT public.sgp_lp_shared_order_read_v1('se','QA|PANELES_2','ENSAMBLE')").returncode
 result={'status':'PASS','environment':'Isolated PostgreSQL; synthetic rows only','checks':['shared read/edit across coordinator and stage-specific supervisors','closed turns untouched; no fake turn or assignment','canonical accessory source only; manual windows independent of pieces','NC stays unverified without canonical relation; no source disclosure or physical receipt','legacy reports retained in original context','shared CAS concurrency, idempotency, audit rollback, private ACL and global containment']}
 (Path(__file__).parent/'contracts-result.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
finally:x.close()
