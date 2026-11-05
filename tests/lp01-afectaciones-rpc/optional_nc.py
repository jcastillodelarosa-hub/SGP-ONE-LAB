"""Optional NC contract: exact patch, both processes, later linkage; synthetic only."""
import json,uuid,hashlib
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from current_chain import Fixture,lit
HERE=Path(__file__).parent;ROOT=HERE.parents[1];x=Fixture.__new__(Fixture)
try:
 x.__init__(install_affectations=False);db=x.db
 for name in ['03_pdt_atomico_REVIEW.sql','04_conciliacion_REVIEW.sql','05_picking_original_REVIEW.sql']:db.sql((ROOT/'docs/sql-proposals/lp01-afectaciones'/name).read_text())
 db.sql('GRANT EXECUTE ON FUNCTION public.sgp_lp_afectaciones_aluminio_v1(text,text,text,date,int,jsonb,jsonb),public.sgp_lp_afectaciones_consultar_v2(text,text,text) TO anon')
 sig="'sgp_pdt_multiorigen.registrar(text,text,jsonb,jsonb,uuid,uuid)'::regprocedure"
 metadata="SELECT jsonb_build_array(proowner,proacl,prosecdef,proconfig) FROM pg_proc WHERE oid="+sig
 acl=db.sql(metadata);oldbody=db.sql('SELECT md5(prosrc) FROM pg_proc WHERE oid='+sig)
 pieces=x.pieces()
 def native(p):return 'SET ROLE anon;SELECT public.sgp_pdt_registrar_v4('+','.join([lit('ll'),lit('ENSAMBLE'),lit(json.dumps({'key_produccion':x.key,'produccion':'QA ORDER'}))+'::jsonb',lit(json.dumps(p))+'::jsonb',lit(str(uuid.uuid4()))])+')'
 original=json.loads(db.sql(native(pieces)))['ids_pendientes'][0]
 assert db.run(native([{**pieces[0],'nc':''}])).returncode
 def snapshot():return db.sql("SELECT jsonb_build_object('pending',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id_pendiente) FROM public.sgp_aluminio_pendientes p),'history',(SELECT jsonb_agg(to_jsonb(h) ORDER BY id) FROM public.sgp_aluminio_pendientes_historial h),'events',(SELECT jsonb_agg(to_jsonb(e) ORDER BY id_evento) FROM sgp_pdt_multiorigen.eventos e))")
 before=snapshot();sql=(ROOT/'docs/sql-proposals/lp01-afectaciones/06_nc_opcional_REVIEW.sql').read_text()
 db.sql('UPDATE sgp_lp_afectaciones.config SET writes=true')
 assert db.run(sql).returncode
 db.sql('UPDATE sgp_lp_afectaciones.config SET writes=false')
 assert db.run(sql.replace('COMMIT;','SELECT 1/0;COMMIT;')).returncode
 assert db.sql('SELECT md5(prosrc) FROM pg_proc WHERE oid='+sig)==oldbody and snapshot()==before
 db.sql(sql);assert snapshot()==before and db.sql(metadata)==acl
 assert db.sql('SELECT md5(prosrc) FROM pg_proc WHERE oid='+sig)=='d1195cca8c35315007969da936979546'
 assert db.run(sql).returncode # one exact transition, no blind reapplication
 db.sql('UPDATE sgp_lp_afectaciones.config SET writes=true,physical=true,pdt_links=true,atomic_pdt=true')
 db.sql("INSERT INTO public.sgp_nc_aluminio(consecutivo,cod_nc) VALUES('QA-A','QA-AMB'),('QA-B','QA-AMB')")
 created=[]
 for stage in ['ENSAMBLE','EMPAQUE']:
  for nc in ['',None,'OMIT','QA-REFERENCE']:
   piece={**pieces[0],'nc':nc}
   if nc=='OMIT':del piece['nc']
   cmd=x.command('CREATE',2,user='ll',stage=stage,cause='NC_AL')
   result=x.atomic(cmd,[piece],stage=stage);pid=result['pdtIds'][0];created.append(pid)
   assert x.atomic(cmd,[piece],stage=stage)['duplicate']
   row=json.loads(db.sql('SELECT to_jsonb(p) FROM public.sgp_aluminio_pendientes p WHERE id_pendiente='+lit(pid)))
   assert row['origen']==stage and row['cantidad']==2 and row['estado']=='PENDIENTE'
   history=json.loads(db.sql("SELECT datos_nuevos FROM public.sgp_aluminio_pendientes_historial WHERE id_pendiente="+lit(pid)+" AND tipo_evento='REGISTRO_MULTIORIGEN_V4'"))
   assert history['origen']==stage
   if nc!='QA-REFERENCE':assert row['nc'] is None and history['nc'] is None and history['ncs']==[]
   else:assert row['nc']==nc and history['ncs']==[nc]
   assert db.sql('SELECT count(*) FROM sgp_lp_afectaciones.fuentes WHERE fuente_id='+lit(pid))=='1'
  for bad in [{'nc':'BAD\nNC'},{'nc':'QA-AMB'},{'nc':'x'*121},{'nc':'','ncs':[]},{'fabricacion':'FOREIGN','nc':''}]:
   cmd=x.command('CREATE',1,user='ll',stage=stage,cause='NC_AL');assert db.run(x.atomic_query(cmd,[{**pieces[0],**bad}],stage=stage)).returncode
  cmd=x.command('CREATE',1,user='ll',stage=stage,cause='NC_AL');piece={**pieces[0],'nc':''}
  with ThreadPoolExecutor(2) as pool:out=list(pool.map(lambda _:x.atomic(cmd,[piece],stage=stage),range(2)))
  assert sorted(r['duplicate'] for r in out)==[False,True]
 # An NC can later be recorded/linked under the existing distinct role contract.
 pid=created[0];count=db.sql('SELECT count(*) FROM public.sgp_aluminio_pendientes')
 def link(token,ref):return 'SET ROLE anon;SELECT public.sgp_aluminio_pendiente_nc_vincular_v1('+','.join([lit(token),lit(pid),'ARRAY['+lit(ref)+']'])+')'
 assert db.run(link('ll','QA-LATER')).returncode
 assert db.run(link('se','QA-LATER')).returncode
 first=json.loads(db.sql(link('COORDINADOR','QA-LATER')));assert not first['duplicado']
 assert json.loads(db.sql(link('COORDINADOR','QA-LATER')))['duplicado']
 db.sql("INSERT INTO public.sgp_nc_aluminio(consecutivo,cod_nc,referencia,acabado,reserva,produccion,sistema,estado) VALUES('QA-LATER','QA-CODE','PANEL-REF','DS','R','QA ORDER','ES','Abierta')")
 assert not json.loads(db.sql(link('COORDINADOR','QA-CODE')))['duplicado']
 assert json.loads(db.sql(link('COORDINADOR','QA-CODE')))['duplicado']
 assert db.sql('SELECT count(*) FROM public.sgp_aluminio_pendiente_ncs WHERE id_pendiente='+lit(pid))=='1'
 assert db.sql('SELECT count(*) FROM public.sgp_aluminio_pendientes')==count
 assert db.sql('SELECT nc IS NULL AND estado=\'PENDIENTE\' FROM public.sgp_aluminio_pendientes WHERE id_pendiente='+lit(pid))=='t'
 assert x.read2()['available'] is None
 assert db.sql("SELECT count(*) FROM public.sgp_aluminio_pendientes_historial WHERE id_pendiente="+lit(pid)+" AND tipo_evento='VINCULACION_NC_PDT'")=='2'
 # Audit failure still rolls back NC-empty PDT + LP together.
 db.sql("CREATE FUNCTION public.qa_fail_optional() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'QA_OPTIONAL_AUDIT_FAIL';END $$;CREATE TRIGGER qa_fail_optional BEFORE INSERT ON sgp_lp_afectaciones.pdt_recibos FOR EACH ROW EXECUTE FUNCTION public.qa_fail_optional()")
 assert db.run(x.atomic_query(x.command('CREATE',1,user='ll',cause='NC_AL'),[{**pieces[0],'nc':''}])).returncode
 assert db.sql('SELECT count(*) FROM public.sgp_aluminio_pendientes')==count
 out={'status':'PASS','environment':'PostgreSQL17.11 network none synthetic only','before_md5':oldbody,'after_md5':'d1195cca8c35315007969da936979546','migration_sha256':hashlib.sha256(sql.encode()).hexdigest(),'both_stages':['blank','null','omitted','informed'],'identity_and_nc_validation_preserved':True,'idempotency_and_unique_link':True,'acl_and_existing_data_unchanged':True,'migration_and_event_rollback':True,'later_link_same_pending_and_role_enforced':True,'later_link_not_physical_availability':True}
 (HERE/'optional-nc-result.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out))
finally:
 if hasattr(x,'db'):x.close()
