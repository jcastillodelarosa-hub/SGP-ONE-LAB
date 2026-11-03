"""Encargo4: shared handler + unchanged XLSX adapter + SQL01/06/08, isolated synthetic catalog.
Optional originals never leave the no-network PG/local private IPC; public output has no labels.
"""
from pathlib import Path
import sys,json,uuid,base64,hashlib,subprocess
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'tests/lp01-powerbi'))
from database import PowerBIDatabase,Database,lit
HERE=Path(__file__).parent
PIN={'ENSAMBLE':'a4da8416349a731100706f14b50a716c877b20219364b14f5cc4e1321c4a8c3e','EMPAQUE':'b1bc89f36b1931a71899970398104644209a72f287f28d3d2421c602657280d2'}
class ClosureDB(PowerBIDatabase):
 def __init__(self,stage,sources):
  self.source_paths=sources;Database.__init__(self)
  try:
   self.sql('CREATE ROLE service_role;');self.sql((ROOT/'docs/sql-proposals/lp01-operacion/06_powerbi_xlsx_REVIEW.sql').read_text())
   self.models={s:self.parse(sources[s]) for s in ['ENSAMBLE','EMPAQUE']};self.keys={};self.parts={}
   records=self.models[stage]['records'];self.selected={}
   for r in records:
    if r['production'] not in self.keys:
     key='QA-CLOSE-'+str(len(self.keys)+1)+'|PANELES_2';self.keys[r['production']]=key
     self.sql("INSERT INTO public.sgp_producciones VALUES("+lit(key)+','+lit(r['production'])+",'PANELES_2','QA','QA',true,true,288,288,0,0,gen_random_uuid(),'2026-10-31T06:00Z');INSERT INTO sgp_lp_operacion.permisos SELECT u,e,"+lit(key)+" FROM unnest(ARRAY['COORDINADOR','LIDER','CONSULTA'])u CROSS JOIN unnest(ARRAY['ENSAMBLE','EMPAQUE'])e;")
    if r['shift']==1:self.selected[self.keys[r['production']]]=r['quantity']
   # Before operations, prepare only assignments for the chosen stage's T1 source universe.
   # Other-stage/period coverage is not inferred. No post-ABRIR deletion/pruning or fake zeros.
   for key in self.selected:
    ids=[]
    for i,n in enumerate([90,90,90,18]):
     root=str(uuid.uuid4());ids.append(root);self.sql('INSERT INTO public.sgp_linea_plan_asignaciones VALUES('+lit(root)+','+lit(key)+",'2026-10-31',1,"+str(n)+','+str(i+1)+",'PROGRAMADA',NULL)")
    self.parts[(key,1)]=ids
   self.empty_key='QA-EMPTY|FRAMES_2';self.seed(self.empty_key,parts=(1,),date='2026-11-10');self.sql("UPDATE public.sgp_producciones SET id_linea='FRAMES_2' WHERE key_produccion="+lit(self.empty_key))
   self.sql('UPDATE sgp_lp_operacion.config SET escrituras=false WHERE id');self.sql((ROOT/'docs/sql-proposals/lp01-operacion/08_ambitos_temporales_REVIEW.sql').read_text())
   self.sql("UPDATE sgp_lp_operacion.permisos SET valid_from='2026-01-01T00:00:00Z',valid_until='2030-01-01T00:00:00Z',duty=CASE usuario WHEN 'COORDINADOR' THEN 'PRIMARY' WHEN 'LIDER' THEN 'BACKUP' ELSE 'READ' END;UPDATE sgp_lp_operacion.config SET escrituras=true,formato_bi_aprobado=true,adaptador_bi='LP-PBI-XLSX-1' WHERE id")
  except BaseException:self.close();raise
class SharedHandler:
 def __init__(self,db):
  self.db=db;self.child=subprocess.Popen(['node',str(HERE/'handler.mjs')],cwd=ROOT,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,text=True,bufsize=1)
 def request(self,body,origin=None):
  self.child.stdin.write(json.dumps({'body':body,**({'origin':origin} if origin else {})})+'\n');self.child.stdin.flush()
  while True:
   line=self.child.stdout.readline()
   if not line:raise RuntimeError('QA_HANDLER_STOPPED')
   r=json.loads(line)
   if r['kind']=='response':return r
   assert r['name'] in ['sgp_sesion_actual','sgp_lp_operacion_importar_xlsx']
   try:answer={'data':self.db.rpc(r['name'],r['args']),'error':None}
   except Exception as e:answer={'data':None,'error':{'message':str(e),'code':'QA_SQL_ERROR'}}
   self.child.stdin.write(json.dumps(answer)+'\n');self.child.stdin.flush()
 def close(self):self.child.stdin.close();self.child.wait(timeout=10)
def body(db,stage,token='LIDER',shift=1):
 a=db.upload_args(stage=stage,token=token,shift=shift)
 return {'p_token':token,'command':a['p_contexto'],'filename':a['p_nombre'],'base64':a['p_base64']}
def empty(db,stage,**kw):return db.cmd('CERRAR',stage=stage,line='FRAMES_2',date='2026-10-31',shift=2,close_type='SIN_ACTIVIDAD',confirmed=True,observation='QA ausencia confirmada',**kw)
def scenario(stage,sources):
 db=ClosureDB(stage,sources);handler=SharedHandler(db)
 try:
  original=db.sql('SELECT jsonb_agg(to_jsonb(p) ORDER BY key_produccion) FROM public.sgp_producciones p');plan=db.sql('SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM public.sgp_linea_plan_asignaciones p')
  ctx={'stage':stage,'date':'2026-10-31'};other='EMPAQUE' if stage=='ENSAMBLE' else 'ENSAMBLE'
  db.execute(db.cmd('ABRIR',**ctx));db.execute(db.cmd('ABRIR',stage=other,date='2026-10-31'))
  db.reject(db.cmd('CERRAR',close_type='SIN_ACTIVIDAD',confirmed=True,observation='QA asignadas',**ctx),'SIN_ACTIVIDAD_EXISTEN_ORDENES','LIDER')
  db.reject(db.cmd('CERRAR',observation='QA sin archivo',**ctx),'ARCHIVO_POWER_BI_REQUERIDO','LIDER')
  target=max(db.selected,key=db.selected.get);quantity=db.selected[target];assert 2<=quantity<=90
  for key,total in db.selected.items():
   roots=db.parts[(key,1)];split=[total//2,total-total//2,0,0] if key==target else [total,0,0,0]
   for i,(root,n) in enumerate(zip(roots,split)):
    db.execute(db.cmd('SALE',key=key,part=root,quantity=n,observation='QA decisión sintética explícita',**ctx))
    if n:db.execute(db.cmd('EJECUTAR',key=key,part=root,quantity=n-(1 if key==target and i==1 else 0),observation='QA avance sintético',**ctx),'LIDER')
  request=body(db,stage)
  for token,status in [('CONSULTA',403),('RECEPCION',403),('invalid',401)]:assert handler.request({**request,'p_token':token})['status']==status
  assert handler.request(request,origin='https://unapproved.invalid')['status']==403
  assert handler.request({**request,'document':{}})['status']==422
  wrong=body(db,other);wrong['command']=request['command'];assert handler.request(wrong)['status']==422
  assert db.sql("SELECT count(*) FROM sgp_lp_operacion.auditoria WHERE operacion='IMPORTAR_XLSX'")=='0'
  result=handler.request(request);assert result['status']==200
  uploaded=result['body']['data'];assert handler.request(request)['body']['data']['duplicate']
  assert db.rpc('sgp_lp_operacion_resultado',{'p_token':'LIDER','p_id':request['command']['id']})['committed']
  raw=db.rpc('sgp_lp_operacion_archivo',{'p_token':'LIDER','p_id':uploaded['fileId']});assert base64.b64decode(raw['base64'])==sources[stage].read_bytes()
  # Read original needs complete temporal scope, not just one current sibling permission.
  db.sql("UPDATE sgp_lp_operacion.permisos SET revoked_at=clock_timestamp() WHERE usuario='LIDER' AND etapa="+lit(stage)+' AND key='+lit(target))
  try:db.rpc('sgp_lp_operacion_archivo',{'p_token':'LIDER','p_id':uploaded['fileId']});raise AssertionError('QA_REVOKED_ORIGINAL')
  except RuntimeError as e:assert 'AMBITO' in str(e)
  assert handler.request(body(db,stage))['status']==422
  db.sql("UPDATE sgp_lp_operacion.permisos SET revoked_at=NULL WHERE usuario='LIDER' AND etapa="+lit(stage)+' AND key='+lit(target))
  db.reject(db.cmd('CERRAR',file_id=uploaded['fileId'],observation='QA diferencia',**ctx),'DIFERENCIA_O_PENDIENTE_SIN_JUSTIFICAR','LIDER')
  first_cmd=db.cmd('CERRAR',file_id=uploaded['fileId'],observation='QA diferencia justificada',reasons={target:'QA diferencia1 pendiente'},**ctx)
  first=db.execute(first_cmd,'LIDER');assert db.execute(first_cmd,'LIDER')['duplicate']
  row=next(r for r in first['rows'] if r['key']==target);assert row['power_bi']==quantity and row['ejecutado']==quantity-1 and row['diferencia']==1 and len(row['assignments'])==4
  assert sum(r['power_bi'] for r in first['rows'])==sum(db.selected.values())
  assert db.snapshot(other,date='2026-10-31')['turn']['estado']=='ABIERTO'
  db.reject(db.cmd('REABRIR',observation='QA',**ctx),'REQUIERE_COORDINADOR','LIDER')
  db.reject(db.cmd('REABRIR',observation='',**ctx),'MOTIVO_REQUERIDO')
  db.execute(db.cmd('REABRIR',observation='QA corrección autorizada',**ctx))
  fix=db.cmd('EJECUTAR',key=target,part=db.parts[(target,1)][1],quantity=quantity-quantity//2,observation='QA revisión',**ctx)
  db.reject(fix,'CORRECCION_REQUIERE_COORDINADOR','LIDER');db.execute(fix)
  assert handler.request(body(db,stage))['status']==422 # leader cannot create another import in review
  second=db.execute(db.cmd('CERRAR',file_id=uploaded['fileId'],observation='QA segunda versión',reasons={},**ctx))
  assert second['version']>first['version'] and all(r['diferencia']==0 for r in second['rows'])
  reports=db.snapshot(stage,date='2026-10-31')['reports'];assert len(reports)==2 and reports[0]['snapshot']==first and reports[1]['snapshot']==second
  assert db.rpc('sgp_lp_operacion_archivo',{'p_token':'LIDER','p_id':uploaded['fileId']})['sha256']==raw['sha256']
  assert db.sql("SELECT count(*) FROM sgp_lp_operacion.archivos WHERE etapa="+lit(stage))=='1'
  assert db.sql("SELECT count(*) FROM sgp_lp_operacion.auditoria WHERE operacion='IMPORTAR_XLSX'")=='1'
  for table in ['archivos','cierres','auditoria']:
   r=db.run('UPDATE sgp_lp_operacion.'+table+" SET usuario=usuario WHERE id="+lit(uploaded['fileId'] if table=='archivos' else first['id']))
   assert r.returncode and 'HISTORIAL_INMUTABLE' in r.stderr
  # The next turn's missing source rows stay blocked; no manufactured zero rows.
  db.execute(db.cmd('ABRIR',shift=2,**ctx));blocked=handler.request(body(db,stage,shift=2));assert blocked['status']==422
  assert 'AUSENCIA_NO_ES_CERO' in blocked['body']['error'] or 'SIN_ASIGNACION_EN_TURNO' in blocked['body']['error']
  db.reject(db.cmd('CERRAR',close_type='SIN_ACTIVIDAD',confirmed=True,observation='QA pendientes',shift=2,**ctx),'SIN_ACTIVIDAD_EXISTEN_ORDENES','LIDER')
  # Independent truly empty line, same stage and same full SQL08/XLSX-mode installation.
  ec={'stage':stage,'line':'FRAMES_2','date':'2026-10-31','shift':2};db.execute(db.cmd('ABRIR',**ec));assert db.snapshot(stage,'2026-10-31',2,line='FRAMES_2')['emptyCloseEligible']
  cmd=empty(db,stage);db.reject({**cmd,'confirmed':False},'CONFIRMACION_SIN_ACTIVIDAD_REQUERIDA','LIDER');db.reject({**cmd,'observation':' '},'OBSERVACION_GENERAL_REQUERIDA','LIDER')
  e1=db.execute(cmd,'LIDER');assert e1['type']=='SIN_ACTIVIDAD' and e1['file'] is None and e1['rows']==[] and e1['closedAt'] and e1['user']=='LIDER'
  assert db.execute(cmd,'LIDER')['duplicate'];db.reject(db.cmd('REABRIR',observation='QA',**ec),'REQUIERE_COORDINADOR','LIDER')
  db.execute(db.cmd('REABRIR',observation='QA revisión vacía',**ec));e2=db.execute(empty(db,stage));assert e2['version']>e1['version']
  er=db.snapshot(stage,'2026-10-31',2,line='FRAMES_2')['reports'];assert len(er)==2 and er[0]['snapshot']==e1 and er[1]['snapshot']==e2
  db.execute(db.cmd('ABRIR',stage=stage,line='FRAMES_2',date='2026-11-01',shift=1));assert db.snapshot(stage,'2026-11-01',1,line='FRAMES_2')['orders']==[]
  assert db.sql("SELECT count(*) FROM sgp_lp_operacion.archivos WHERE linea='FRAMES_2'")=='0'
  assert original==db.sql('SELECT jsonb_agg(to_jsonb(p) ORDER BY key_produccion) FROM public.sgp_producciones p')
  assert plan==db.sql('SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM public.sgp_linea_plan_asignaciones p')
  return {'stage':stage,'source_sha256':hashlib.sha256(sources[stage].read_bytes()).hexdigest(),'source_rows':len(db.models[stage]['records']),'t1_power_bi':sum(db.selected.values()),'first_difference':1,'second_differences':0,'normal_versions':2,'empty_versions':2,'original_identical':True,'import_audit_once':True,'next_turn_incomplete_source':'BLOCKED_WITHOUT_INFERRED_ZERO','official_export_and_assignments_unchanged':True,'server_handler_and_sql08':'PASS','postgres':db.sql('SHOW server_version')}
 finally:handler.close();db.close()
def main():
 originals=len(sys.argv)==3
 if len(sys.argv) not in [1,3]:raise ValueError('QA_ARGS')
 sources=dict(zip(['ENSAMBLE','EMPAQUE'],map(Path,sys.argv[1:]))) if originals else {s:ROOT/'tests/lp01-powerbi/fixtures'/f'{s.lower()}.xlsx' for s in ['ENSAMBLE','EMPAQUE']}
 if originals:
  for s,p in sources.items():assert hashlib.sha256(p.read_bytes()).hexdigest()==PIN[s]
 results=[scenario(stage,sources) for stage in ['ENSAMBLE','EMPAQUE']]
 out={'status':'PASS','mode':'ORIGINAL_LOCAL_FILES' if originals else 'ANONYMIZED_FIXTURES','results':results,'limits':['Catalog/assignments/accounts and leader quantities synthetic; no live SGP matching certified','Original rows/names/bytes only local IPC and no-network PG; never posted to production or public artifacts','Node shared handler exercised; Edge deployment/gateway, actual users and devices not certified','With synthetic T1-only assignments, T2 coverage mismatches; no live source defect asserted and no missing row converted to zero','No PDT liberation or Export inclusion credited; official balances unchanged']}
 (HERE/'evidence'/('originals.json' if originals else 'fixtures.json')).write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
if __name__=='__main__':
 try:main()
 except BaseException:
  # Do not echo SQL/parser errors, source labels or local paths from real uploads.
  sys.stderr.write('Encargo4 isolated check failed; private inspection required. No source details logged.\n');sys.exit(1)
