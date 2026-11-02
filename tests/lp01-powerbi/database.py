from pathlib import Path
import sys,json,subprocess,uuid,base64
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'lp01-operacion'))
from postgres import Database,ROOT,lit
HERE=Path(__file__).resolve().parent
class PowerBIDatabase(Database):
 def __init__(self,sources=None):
  self.source_paths=sources or {stage:HERE/'fixtures'/f'{stage.lower()}.xlsx' for stage in ['ENSAMBLE','EMPAQUE']}
  super().__init__()
  try:
   self.sql('CREATE ROLE service_role;')
   self.sql((ROOT/'docs/sql-proposals/lp01-operacion/06_powerbi_xlsx_REVIEW.sql').read_text())
   self.sql("UPDATE sgp_lp_operacion.config SET formato_bi_aprobado=true,adaptador_bi='LP-PBI-XLSX-1' WHERE id;")
   self.models={stage:self.parse(self.source_paths[stage]) for stage in ['ENSAMBLE','EMPAQUE']}
   self.keys={};self.parts={}
   for model in self.models.values():
    for r in model['records']:
     if r['production'] not in self.keys:
      key='PB-'+str(len(self.keys)+1)+'|PANELES_2';self.keys[r['production']]=key
      self.sql("INSERT INTO public.sgp_producciones(key_produccion,produccion,id_linea,sistema,reserva_al,saldos_inicializados,presente_ultimo_export,saldo_ensamble,saldo_empaque,ensamblado,empacado,ultima_carga_diaria,ultima_vez_export) VALUES("+lit(key)+','+lit(r['production'])+",'PANELES_2','QA','R-QA',true,true,288,288,0,0,gen_random_uuid(),'2026-10-31T06:00Z');INSERT INTO sgp_lp_operacion.permisos SELECT u,e,"+lit(key)+" FROM unnest(ARRAY['COORDINADOR','LIDER','CONSULTA'])u CROSS JOIN unnest(ARRAY['ENSAMBLE','EMPAQUE'])e;")
     key=self.keys[r['production']]
     if (key,r['shift']) not in self.parts:
      ids=[]
      # These are pre-existing LP assignments, not Mecanizado parts. Import must never alter them.
      for n in [90,90,90,18]:
       aid=str(uuid.uuid4());ids.append(aid);self.sql('INSERT INTO public.sgp_linea_plan_asignaciones VALUES('+lit(aid)+','+lit(key)+",'2026-10-31',"+str(r['shift'])+','+str(n)+",1,'PROGRAMADA',NULL);")
      self.parts[(key,r['shift'])]=ids
   for stage in ['ENSAMBLE','EMPAQUE']:
    for shift in [1]:
     self.execute(self.cmd('ABRIR',stage=stage,date='2026-10-31',shift=shift,revision=0))
     # Orders scheduled but absent from source stay present: prune only QA setup before operations,
     # not any application behavior. Fixtures are prepared to exactly cover each source period.
     present={self.keys[r['production']] for r in self.models[stage]['records'] if r['shift']==shift}
     self.sql('DELETE FROM sgp_lp_operacion.ordenes WHERE etapa='+lit(stage)+" AND fecha='2026-10-31' AND turno="+str(shift)+' AND key NOT IN('+','.join(lit(k) for k in present)+');')
     for row in self.snapshot(stage,date='2026-10-31',shift=shift)['orders']:
      self.execute(self.cmd('SALE',stage=stage,date='2026-10-31',shift=shift,key=row['key'],part=row['parte'],quantity=0,observation='QA inicialización aprobada por prueba'))
  except BaseException:
   self.close();raise
 def parse(self,path):return json.loads(subprocess.check_output(['node',str(HERE/'parse-fixture.mjs'),str(path)],cwd=ROOT,text=True))
 def rpc(self,name,args):
  if name=='sgp_sesion_actual':return json.loads(self.sql('SET ROLE service_role;SELECT public.sgp_sesion_actual('+lit(args['p_token'])+');'))
  if name=='sgp_lp_operacion_importar_xlsx':
   q='SELECT public.sgp_lp_operacion_importar_xlsx('+','.join([lit(args['p_token']),lit(json.dumps(args['p_contexto']))+'::jsonb',lit(args['p_nombre']),lit(args['p_base64']),lit(json.dumps(args['p_documento']))+'::jsonb'])+');'
   return json.loads(self.sql('SET ROLE service_role;'+q))
  if name=='sgp_lp_operacion_archivo':return json.loads(self.sql('SET ROLE anon;SELECT public.sgp_lp_operacion_archivo('+lit(args['p_token'])+','+lit(args['p_id'])+');'))
  return super().rpc(name,args)
 def upload_args(self,stage='ENSAMBLE',shift=1,token='LIDER'):
  content=self.source_paths[stage].read_bytes()
  return {'p_token':token,'p_contexto':{k:v for k,v in self.cmd('unused',stage=stage,date='2026-10-31',shift=shift).items() if k!='op'},'p_nombre':self.source_paths[stage].name,'p_base64':base64.b64encode(content).decode(),'p_documento':self.models[stage]}
