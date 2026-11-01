"""Real PG17 isolated, captured session implementation, synthetic source data only."""
from pathlib import Path
import json,subprocess,os,time,uuid,threading
from concurrent.futures import ThreadPoolExecutor
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'tests/lp01-operacion/evidence';OUT.mkdir(exist_ok=True)
class Database:
 def __init__(self):
  self.container='sgp-lp184-'+str(time.time_ns());self.env=os.environ.copy()
  for name in ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']:self.env.pop(name,None)
  self.docker=['docker','--host=unix:///var/run/docker.sock']
  subprocess.run(self.docker+['run','-d','--rm','--network','none','--name',self.container,'-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17.11'],env=self.env,check=True,capture_output=True)
  for _ in range(100):
   r=subprocess.run(self.docker+['exec',self.container,'pg_isready','-U','postgres'],env=self.env,capture_output=True)
   logs=subprocess.run(self.docker+['logs',self.container],env=self.env,capture_output=True,text=True)
   if r.returncode==0 and 'PostgreSQL init process complete' in logs.stdout:break
   time.sleep(.1)
  else:raise RuntimeError('Postgres no inició')
  self.sql("CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA extensions;CREATE EXTENSION pgcrypto WITH SCHEMA extensions;CREATE TABLE public.sgp_usuarios(id_usuario uuid PRIMARY KEY DEFAULT gen_random_uuid(),usuario text,nombre text,rol text,activo boolean DEFAULT true);CREATE TABLE public.sgp_sesiones_app(id_usuario uuid,token_hash text,revocado_en timestamptz,expira_en timestamptz);CREATE TABLE public.sgp_producciones(key_produccion text PRIMARY KEY,produccion text,id_linea text,sistema text,reserva_al text,saldos_inicializados boolean,presente_ultimo_export boolean,saldo_ensamble numeric,saldo_empaque numeric,ensamblado numeric,empacado numeric,ultima_carga_diaria uuid,ultima_vez_export timestamptz);CREATE TABLE public.sgp_linea_plan_asignaciones(id uuid PRIMARY KEY,key_produccion text REFERENCES public.sgp_producciones,fecha date,turno int,cantidad int,prioridad int,estado text,origen_id uuid);")
  self.sql(json.loads((ROOT/'tests/lp01-operacion/session-readonly.json').read_text())['definition'])
  self.sql("INSERT INTO public.sgp_usuarios(usuario,nombre,rol) SELECT x,'QA synthetic',x FROM unnest(ARRAY['COORDINADOR','LIDER','CONSULTA','RECEPCION']) x;INSERT INTO public.sgp_sesiones_app SELECT id_usuario,encode(extensions.digest(usuario,'sha256'),'hex'),NULL,now()+interval '1 day' FROM public.sgp_usuarios;")
  install=(ROOT/'docs/sql-proposals/lp01-operacion/01_operacion_REVIEW.sql').read_text()
  r=self.run(install.replace('COMMIT;','SELECT 1/0;COMMIT;'));assert r.returncode and self.sql("SELECT to_regnamespace('sgp_lp_operacion') IS NULL")=='t'
  self.sql(install)
  assert self.sql('SELECT escrituras FROM sgp_lp_operacion.config')=='f'
  # QA configuration only. Proposed production installer leaves writes and BI adapter disabled.
  self.sql('UPDATE sgp_lp_operacion.config SET escrituras=true WHERE id;')
 def run(self,q):return subprocess.run(self.docker+['exec','-i',self.container,'psql','-X','-qAt','-U','postgres','-v','ON_ERROR_STOP=1'],env=self.env,input=q,text=True,capture_output=True)
 def sql(self,q):
  r=self.run(q)
  if r.returncode:raise RuntimeError(r.stderr)
  return r.stdout.strip()
 def close(self):subprocess.run(self.docker+['stop',self.container],env=self.env,check=True,capture_output=True)
 def rpc(self,name,args):
  if name=='sgp_detalle_ubicacion_vidrio':q='SELECT public.sgp_detalle_ubicacion_vidrio('+lit(args['p_token'])+','+lit(args['p_key_produccion'])+');'
  elif name=='sgp_lp_operacion_consultar':q='SELECT public.'+name+'('+','.join([lit(args['p_token']),lit(args['p_etapa']),lit(args['p_linea']),lit(args['p_fecha']),str(args['p_turno'])])+');'
  elif name=='sgp_lp_operacion_comando':q=self.call(args['p_token'],args['p_cmd'])
  else:raise ValueError('RPC no autorizada en QA '+name)
  return json.loads(self.sql('SET ROLE anon;'+q))
 def call(self,token,c):return 'SELECT public.sgp_lp_operacion_comando('+lit(token)+','+lit(json.dumps(c))+'::jsonb);'
 def execute(self,c,token='COORDINADOR'):return self.rpc('sgp_lp_operacion_comando',{'p_token':token,'p_cmd':c})
 def reject(self,c,code,token='COORDINADOR'):
  r=self.run('SET ROLE anon;'+self.call(token,c));assert r.returncode and code in r.stderr,(code,r.stderr)
 def seed(self,key='QA|PANELES_2',parts=(90,90,90,18),date='2026-11-01',shift=1):
  self.sql("INSERT INTO public.sgp_producciones(key_produccion,produccion,id_linea,sistema,reserva_al,saldos_inicializados,presente_ultimo_export,saldo_ensamble,saldo_empaque,ensamblado,empacado,ultima_carga_diaria,ultima_vez_export) VALUES("+lit(key)+",'TORRE NORTE','PANELES_2','ES7100','R1,R2',true,true,288,288,0,0,gen_random_uuid(),'2026-11-01T06:00Z');INSERT INTO sgp_lp_operacion.permisos SELECT u,e,"+lit(key)+" FROM unnest(ARRAY['COORDINADOR','LIDER','CONSULTA'])u CROSS JOIN unnest(ARRAY['ENSAMBLE','EMPAQUE'])e;")
  ids=[]
  for i,n in enumerate(parts):
   part=str(uuid.uuid4());ids.append(part)
   self.sql('INSERT INTO public.sgp_linea_plan_asignaciones VALUES('+','.join([lit(part),lit(key),lit(date),str(shift),str(n),str(i+1),lit('PROGRAMADA'),'NULL'])+');')
  return ids
 def prepare_glass(self,key):
  self.sql("ALTER TABLE public.sgp_producciones ADD COLUMN id text,ADD COLUMN cantidad numeric;CREATE TABLE public.sgp_ubicacion_vidrio_actual(key_produccion text,activo boolean,estado_orden text,disponible numeric,posicion text,composicion text);")
  self.sql(json.loads((ROOT/'tests/lp01-operacion/role-readonly.json').read_text())['definition'])
  self.sql(json.loads((ROOT/'tests/lp01-operacion/glass-readonly.json').read_text())['definition'])
  self.sql((ROOT/'docs/sql-proposals/lp01-operacion/04_vidrio_REVIEW.sql').read_text())
  self.sql("INSERT INTO public.sgp_ubicacion_vidrio_actual VALUES("+lit(key)+",true,'preparado - sin movimiento',32,'B1','QA OVES-1'),("+lit(key)+",true,'en transito',8,'T1','QA OVES-2');")
  assert self.rpc('sgp_detalle_ubicacion_vidrio',{'p_token':'LIDER','p_key_produccion':key})['categorias_version']==2
  self.sql((ROOT/'docs/sql-proposals/lp01-operacion/05_restaurar_vidrio_REVIEW.sql').read_text())
  assert 'categorias_version' not in self.rpc('sgp_detalle_ubicacion_vidrio',{'p_token':'LIDER','p_key_produccion':key})
  self.sql((ROOT/'docs/sql-proposals/lp01-operacion/04_vidrio_REVIEW.sql').read_text())
 def rev(self,stage='ENSAMBLE',date='2026-11-01',shift=1,key=None,part=None):
  q='SELECT revision FROM sgp_lp_operacion.'+('ordenes' if key else 'turnos')+" WHERE linea='PANELES_2' AND etapa="+lit(stage)+' AND fecha='+lit(date)+' AND turno='+str(shift)
  if key:q+=' AND key='+lit(key)+' AND parte='+lit(part)
  return int(self.sql(q))
 def cmd(self,op,stage='ENSAMBLE',date='2026-11-01',shift=1,key=None,part=None,**kw):
  c={'id':str(uuid.uuid4()),'op':op,'stage':stage,'line':'PANELES_2','date':date,'shift':shift,**kw}
  if key:c.update(key=key,part=part)
  if 'revision' not in c:c['revision']=self.rev(stage,date,shift,key,part)
  return c
 def snapshot(self,stage='ENSAMBLE',date='2026-11-01',shift=1,token='LIDER',line='PANELES_2'):return self.rpc('sgp_lp_operacion_consultar',{'p_token':token,'p_etapa':stage,'p_linea':line,'p_fecha':date,'p_turno':shift})
def lit(v):return "'"+str(v).replace("'","''")+"'"
def test(db):
 checks=['Atomic installation failure leaves no objects; default writes disabled']
 key='QA|PANELES_2';parts=db.seed();source_before=db.sql('SELECT jsonb_agg(to_jsonb(p)) FROM public.sgp_producciones p')
 for stage in ['ENSAMBLE','EMPAQUE']:db.execute(db.cmd('ABRIR',stage=stage,revision=0))
 for stage in ['ENSAMBLE','EMPAQUE']:
  for part,n in zip(parts,[90,90,90,18]):db.execute(db.cmd('SALE',stage=stage,key=key,part=part,quantity=n,observation='QA capacidad validada'))
 assert sum(o['sale'] for o in db.snapshot()['orders'])==288
 checks.append('288 = 90 + 90 + 90 + 18; stage/part identities persist independently')
 db.reject(db.cmd('SALE',key=key,part=parts[3],quantity=19,observation='QA'),'SUPERA_CANTIDAD_DE_PARTE')
 db.reject(db.cmd('SALE',key=key,part=parts[0],quantity=90,observation='QA'),'REQUIERE_COORDINADOR','LIDER')
 db.reject(db.cmd('EJECUTAR',key=key,part=parts[0],quantity=20,observation='QA'),'SESION_NO_AUTORIZADA','RECEPCION')
 db.reject(db.cmd('EJECUTAR',key=key,part=parts[0],quantity=20,observation='QA'),'ESCRITURA_NO_HABILITADA','CONSULTA')
 db.reject(db.cmd('EJECUTAR',key=key,part=parts[0],quantity=20,observation='QA'),'SESION_NO_AUTORIZADA','invalid')
 db.sql("INSERT INTO public.sgp_usuarios(usuario,nombre,rol) VALUES('QA-NOSCOPE','QA','LIDER');INSERT INTO public.sgp_sesiones_app SELECT id_usuario,encode(extensions.digest(usuario,'sha256'),'hex'),NULL,now()+interval '1 day' FROM public.sgp_usuarios WHERE usuario='QA-NOSCOPE';")
 db.reject(db.cmd('EJECUTAR',key=key,part=parts[0],quantity=20,observation='QA'),'AMBITO_DENEGADO','QA-NOSCOPE')
 db.reject({**db.cmd('EJECUTAR',key=key,part=parts[0],quantity=20,observation='QA'),'role':'COORDINADOR'},'CAMPOS_NO_PERMITIDOS','LIDER')
 db.sql("UPDATE public.sgp_sesiones_app SET expira_en=now()-interval '1 day' WHERE id_usuario=(SELECT id_usuario FROM public.sgp_usuarios WHERE usuario='LIDER');")
 db.reject(db.cmd('EJECUTAR',key=key,part=parts[0],quantity=20,observation='QA'),'SESION_NO_AUTORIZADA','LIDER')
 db.sql("UPDATE public.sgp_sesiones_app SET expira_en=now()+interval '1 day' WHERE id_usuario=(SELECT id_usuario FROM public.sgp_usuarios WHERE usuario='LIDER');")
 checks.append('Real captured session: exact role, missing production scope, read-only user, forged role, expired and invalid token rejected')
 # latest replaces, retry once; no fake additive execution.
 for n in [30,50,40,90]:
  c=db.cmd('EJECUTAR',key=key,part=parts[0],quantity=n,observation='QA acumulado corregido');db.execute(c,'LIDER');assert db.execute(c,'LIDER')['duplicate']
  db.reject({**c,'quantity':n+1},'IDEMPOTENCIA_REUTILIZADA','LIDER')
 assert [o['ejecutado'] for o in db.snapshot()['orders']]==[90,0,0,0]
 assert db.snapshot('EMPAQUE')['orders'][0]['ejecutado']==0
 db.execute(db.cmd('EJECUTAR',stage='EMPAQUE',key=key,part=parts[0],quantity=30,observation='QA simultáneo'),'LIDER')
 checks.append('Cumulative 30→50→40→90 replaces; retries once; P1 never closes P2–P4, original or other stage')
 af={'NC_AL':12,'NC_V':8,'TECNO':3,'NOVEDAD':0}
 db.execute(db.cmd('AFECTAR',key=key,part=parts[1],affectations=af,observation='QA líder informa'),'LIDER')
 assert db.snapshot()['orders'][1]['consolidado'] is None
 db.reject(db.cmd('VALIDAR',key=key,part=parts[1],affectations=af,consolidated=10,observation='QA'),'CONSOLIDACION_INVALIDA')
 db.execute(db.cmd('VALIDAR',key=key,part=parts[1],affectations=af,consolidated=15,observation='QA superposición verificada'))
 assert db.snapshot()['orders'][1]['consolidado']==15 # NOT 23
 checks.append('Affected windows overlap: 12/8/3 consolidated 15 with mandatory coordinator reason and immutable history')
 frame_parts=db.seed('QA|FRAMES_2',parts=(40,));db.sql("UPDATE public.sgp_producciones SET id_linea='FRAMES_2' WHERE key_produccion='QA|FRAMES_2';DELETE FROM sgp_lp_operacion.permisos WHERE usuario='LIDER' AND key='QA|FRAMES_2';")
 db.execute(db.cmd('ABRIR',stage='ENSAMBLE',line='FRAMES_2',revision=0))
 db.execute(db.cmd('SALE',key='QA|FRAMES_2',part=frame_parts[0],line='FRAMES_2',revision=0,quantity=40,observation='QA otra línea'))
 assert len(db.snapshot()['orders'])==4
 assert db.snapshot(line='FRAMES_2',token='COORDINADOR')['turn']['estado']=='ABIERTO'
 db.reject(db.cmd('EJECUTAR',key=key,part=parts[0],line='FRAMES_2',quantity=1,observation='QA'),'AMBITO_DENEGADO','LIDER')
 checks.append('Separate physical lines: independent turn and files, wrong line rejected; leader closes only its scoped line')

 source_before=db.sql('SELECT jsonb_agg(to_jsonb(p)) FROM public.sgp_producciones p')
 # Strict Power BI gate; source format remains unapproved in proposed installation.
 db.reject(db.cmd('IMPORTAR_BI',filename='qa.csv',content='QA'),'FORMATO_POWER_BI_PENDIENTE_APROBACION')
 db.reject(db.cmd('CERRAR',observation='QA cierre'),'ARCHIVO_POWER_BI_REQUERIDO')
 db.sql('UPDATE sgp_lp_operacion.config SET formato_bi_aprobado=true WHERE id;')
 content='etapa;fecha;turno;key_produccion;parte;cantidad\n'+'\n'.join('ENSAMBLE;2026-11-01;1;'+key+';'+p+';'+str(89 if i==0 else 0) for i,p in enumerate(parts))
 db.reject(db.cmd('IMPORTAR_BI',filename='qa.csv',content=content.replace(';1;',';2;')),'ARCHIVO_BI_PERIODO_O_FILA_INVALIDA')
 db.reject(db.cmd('IMPORTAR_BI',filename='qa.csv',content=content+'\n'+content.splitlines()[1]),'ORDEN_BI_AJENA_O_DUPLICADA')
 imported=db.execute(db.cmd('IMPORTAR_BI',filename='qa.csv',content=content),'LIDER')
 db.reject(db.cmd('CERRAR',file_id=imported['fileId'],observation='QA'),'DIFERENCIA_O_PENDIENTE_SIN_JUSTIFICAR','LIDER')
 reasons={key+'/'+p:'QA diferencia Power BI o pendiente' for p in parts}
 close=db.execute(db.cmd('CERRAR',file_id=imported['fileId'],observation='QA cierre comentado',reasons=reasons),'LIDER')
 assert next(r for r in close['rows'] if r['parte']==parts[0])['diferencia']==-1
 db.reject(db.cmd('EJECUTAR',key=key,part=parts[0],quantity=80,observation='QA'),'REAPERTURA_REQUERIDA','LIDER')
 db.reject(db.cmd('REABRIR',observation='QA'),'REQUIERE_COORDINADOR','LIDER')
 db.execute(db.cmd('REABRIR',observation='QA error de digitación'))
 db.reject(db.cmd('EJECUTAR',key=key,part=parts[0],quantity=80,observation='QA'),'CORRECCION_REQUIERE_COORDINADOR','LIDER')
 db.reject(db.cmd('EJECUTAR',key=key,part=parts[0],quantity=90),'MOTIVO_DE_REVISION_REQUERIDO')
 db.execute(db.cmd('EJECUTAR',key=key,part=parts[0],quantity=89,observation='QA corrección autorizada'))
 db.execute(db.cmd('CERRAR',file_id=imported['fileId'],observation='QA versión 2',reasons=reasons))
 reports=db.snapshot()['reports'];assert len(reports)==2 and reports[0]['snapshot']==close
 assert db.snapshot('EMPAQUE')['turn']['estado']=='ABIERTO'
 checks.append('Real SQL CSV adapter QA: period/identity/duplicates/differences/file hash; stage closure, coordinator reopening, immutable versions')
 # Actual concurrent sessions, not simulated CAS.
 def concurrent(cs):
  barrier=threading.Barrier(2)
  def one(c):barrier.wait();return db.run('BEGIN;SET LOCAL ROLE anon;'+db.call('COORDINADOR',c)+'SELECT pg_sleep(0.05);COMMIT;')
  with ThreadPoolExecutor(2) as pool:return list(pool.map(one,cs))
 c=db.cmd('EJECUTAR',stage='EMPAQUE',key=key,part=parts[1],quantity=10,observation='QA race')
 rs=concurrent([c,c]);assert all(r.returncode==0 for r in rs)
 c=db.cmd('EJECUTAR',stage='EMPAQUE',key=key,part=parts[1],quantity=11,observation='QA race')
 rs=concurrent([c,{**c,'id':str(uuid.uuid4()),'quantity':12}]);assert sum(r.returncode==0 for r in rs)==1 and any('CONFLICTO_REVISION' in r.stderr for r in rs)
 checks.append('Actual concurrent PG sessions: identical retry once; stale CAS rejects a competing edit')
 db.sql("INSERT INTO public.sgp_linea_plan_asignaciones VALUES(gen_random_uuid(),"+lit(key)+",'2026-11-01',2,1,1,'PROGRAMADA',"+lit(parts[0])+");")
 db.execute(db.cmd('ABRIR',shift=2,revision=0))
 carried=db.snapshot(shift=2)['orders'];assert len(carried)==4 and all(o['ejecutado']==0 and o['sale']==0 and o['abierta'] for o in carried)
 db.reject(db.cmd('SALE',shift=2,key=key,part=parts[0],quantity=2,observation='QA'),'SUPERA_CANTIDAD_DE_PARTE')
 db.execute(db.cmd('SALE',shift=2,key=key,part=parts[0],quantity=1,observation='QA'))
 checks.append('Next-turn opening carries once with original root even after legacy planner carry; execution resets, original part capacity enforced')
 # Private proven release; unresolved overlaps never inferred from aluminum pieces.
 db.execute(db.cmd('SALE',shift=2,key=key,part=parts[0],quantity=0,observation='QA'))
 release=str(uuid.uuid4());db.sql('INSERT INTO sgp_lp_operacion.liberaciones VALUES('+lit(release)+','+lit(key)+",'ENSAMBLE',8,'{\"QA\":\"synthetic consolidated window evidence, not aluminum pieces\"}',true,NULL)")
 c=db.cmd('LIBERAR',shift=2,key=key,part=parts[1],release_id=release,observation='QA liberación consolidada');db.execute(c);db.execute(c)
 db.reject(db.cmd('LIBERAR',shift=2,key=key,part=parts[1],release_id=release,observation='QA'),'LIBERACION_NO_CONSOLIDADA_O_CONSUMIDA')
 assert next(r for r in db.snapshot(shift=2)['orders'] if r['parte']==parts[1])['sale']==8 and db.snapshot(shift=2)['notifications'][-1]['nuevo']==8
 checks.append('Trusted synthetic PDT release associates key/stage once, no piece→window conversion; notification persisted')
 db.execute(db.cmd('EJECUTAR',stage='EMPAQUE',key=key,part=parts[3],quantity=18,observation='QA parte completa'),'LIDER')
 packing=db.snapshot('EMPAQUE')['orders'];packing_csv='etapa;fecha;turno;key_produccion;parte;cantidad\n'+'\n'.join('EMPAQUE;2026-11-01;1;'+r['key']+';'+r['parte']+';'+str(r['ejecutado']) for r in packing)
 f=db.execute(db.cmd('IMPORTAR_BI',stage='EMPAQUE',filename='qa-packing.csv',content=packing_csv))
 race_close=db.cmd('CERRAR',stage='EMPAQUE',file_id=f['fileId'],observation='QA cierre concurrente',reasons={r['key']+'/'+r['parte']:'QA pendiente' for r in packing})
 race_exec=db.cmd('EJECUTAR',stage='EMPAQUE',key=key,part=parts[2],quantity=1,observation='QA avance concurrente')
 rs=concurrent([race_close,race_exec]);assert sum(r.returncode==0 for r in rs)==1
 assert all(r.returncode==0 or any(c in r.stderr for c in ['CONFLICTO_REVISION','REAPERTURA_REQUERIDA']) for r in rs)
 checks.append('Real PG close vs execution serializes: one succeeds; other observes revision conflict or closed turn')
 db.execute(db.cmd('ABRIR',stage='EMPAQUE',shift=2,revision=0))
 assert len(db.snapshot('EMPAQUE',shift=2)['orders'])==3 and all(r['parte']!=parts[3] for r in db.snapshot('EMPAQUE',shift=2)['orders'])
 checks.append('A fully executed 18-unit part is not carried as open; sibling parts remain independent')
 assert source_before==db.sql('SELECT jsonb_agg(to_jsonb(p)) FROM public.sgp_producciones p')
 db.sql("UPDATE public.sgp_producciones SET ultima_carga_diaria=gen_random_uuid() WHERE key_produccion="+lit(key)) # isolated source refresh
 db.reject(db.cmd('SALE',shift=2,key=key,part=parts[1],quantity=9,observation='QA'),'EXPORT_CAMBIO_REQUIERE_CONCILIACION')
 checks.append('Official Export never written by engine; changed load fails closed without inclusion manifest')
 for table in ['auditoria','cierres','archivos','notificaciones']:
  r=db.run('UPDATE sgp_lp_operacion.'+table+" SET usuario='attack'");assert r.returncode and 'INMUTABLE' in r.stderr
  r=db.run('SET ROLE anon;SELECT * FROM sgp_lp_operacion.'+table);assert r.returncode and 'permission denied' in r.stderr
 assert db.sql("SELECT count(*) FROM pg_tables WHERE schemaname='sgp_lp_operacion' AND NOT rowsecurity")=='0'
 checks.append('Immutable history/files/reports/notifications; RLS enabled, private schema inaccessible to browser')
 before=db.snapshot()['reports'];db.sql((ROOT/'docs/sql-proposals/lp01-operacion/02_CONTENER_REVIEW.sql').read_text())
 db.reject(db.cmd('NOTA',shift=2,key=key,part=parts[1],observation='QA'),'ESCRITURA_NO_HABILITADA')
 assert db.snapshot()['reports']==before
 db.sql((ROOT/'docs/sql-proposals/lp01-operacion/03_VERIFICAR_READ_ONLY.sql').read_text())
 r=db.run((ROOT/'docs/sql-proposals/lp01-operacion/01_operacion_REVIEW.sql').read_text());assert r.returncode and 'INSTALACION_EXISTENTE_REVISAR_VERSION' in r.stderr
 checks.append('Containment stops all writes while preserving reports; SELECT postchecks execute; reinstall refuses existing schema')

 result={'status':'PASS','postgres':db.sql('SHOW server_version'),'checks':checks,'limits':['Synthetic approved CSV-v1 adapter, NOT real Power BI format certification','PDT release private synthetic evidence, NOT real Picking/Mecanizado delivery certification','No productive installation, scopes or daily Export inclusion bridge']}
 (OUT/'postgres.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
if __name__=='__main__':
 db=Database()
 try:test(db)
 finally:db.close()
