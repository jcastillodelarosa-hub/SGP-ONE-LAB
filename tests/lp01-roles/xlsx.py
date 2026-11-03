"""New supervisor roles through the actual shared handler + parser + SQL10, synthetic catalogs."""
from pathlib import Path
import importlib.util,sys,json,base64
sp=importlib.util.spec_from_file_location('role_fixture',Path(__file__).with_name('postgres.py'));fixture=importlib.util.module_from_spec(sp);sp.loader.exec_module(fixture)
ROOT=fixture.ROOT;sys.path.insert(0,str(ROOT/'tests/lp01-cierres-integrados'));from isolated import ClosureDB,SharedHandler,body
SOURCES={s:ROOT/'tests/lp01-powerbi/fixtures'/f'{s.lower()}.xlsx' for s in ['ENSAMBLE','EMPAQUE']};results=[]
for stage,actor in [('ENSAMBLE','se'),('EMPAQUE','sp')]:
 db=ClosureDB(stage,SOURCES);handler=None
 try:
  fixture.install_catalog(db);db.sql('UPDATE sgp_lp_operacion.config SET escrituras=false WHERE id');fixture.install_profile(db)
  ctx={'stage':stage,'date':'2026-10-31'};db.execute(db.cmd('ABRIR',**ctx))
  for key,q in db.selected.items():
   for i,part in enumerate(db.parts[(key,1)]):
    n=q if i==0 else 0;db.execute(db.cmd('SALE',key=key,part=part,quantity=n,observation='QA capacidad',**ctx))
    if n:db.execute(db.cmd('EJECUTAR',key=key,part=part,quantity=n,observation='QA avance',**ctx),actor)
  handler=SharedHandler(db);request=body(db,stage,token=actor);response=handler.request(request);assert response['status']==200,response
  first=response['body']['data'];assert handler.request(request)['body']['data']['duplicate']
  other='EMPAQUE' if stage=='ENSAMBLE' else 'ENSAMBLE';bad=body(db,other,token=actor);assert handler.request(bad)['status']==422
  result=db.execute(db.cmd('CERRAR',file_id=first['fileId'],observation='QA cierre individual XLSX',**ctx),actor)
  assert result['user']==actor and all(r['diferencia']==0 for r in result['rows'])
  assert base64.b64decode(db.rpc('sgp_lp_operacion_archivo',{'p_token':actor,'p_id':first['fileId']})['base64'])==SOURCES[stage].read_bytes()
  results.append({'stage':stage,'status':'PASS','actual_handler_parser_SQL10':True,'cross_stage_denied':True,'individual_close':True,'synthetic':True})
 finally:
  if handler:handler.close()
  db.close()
(Path(__file__).parent/'evidence/xlsx.json').write_text(json.dumps({'status':'PASS','results':results,'limits':['Anonymized XLSX fixtures, synthetic SGP catalog/accounts/assignments','No new format or real productive matching certified; no productive database access']},indent=2)+'\n');print(json.dumps(results,indent=2))
