"""New workflow only, isolated PG; does not rerun parser/storage evidence."""
from pathlib import Path
import sys,json,subprocess,uuid,hashlib
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'tests/lp01-operacion'))
from postgres import Database,lit
HERE=Path(__file__).parent;db=Database();checks=[]
try:
 db.sql((ROOT/'docs/sql-proposals/lp01-official-close/01_storage_REVIEW.sql').read_text())
 key='QA-WORKFLOW|PANELES_2';db.seed(key,parts=(10,),date='2026-10-31');db.execute(db.cmd('ABRIR',date='2026-10-31',revision=0))
 db.sql("DELETE FROM sgp_lp_operacion.ordenes;DELETE FROM public.sgp_linea_plan_asignaciones;")
 db.sql("UPDATE sgp_lp_official.config SET enabled=true WHERE id;")
 def run(action,revision=0,token='COORDINADOR',expect=None,**extra):
  c={'id':str(uuid.uuid4()),'action':action,'stage':'ENSAMBLE','line':'PANELES_2','date':'2026-10-31','shift':1,'revision':revision,**extra}
  p=subprocess.run(['node',str(HERE/'service-runner.mjs')],input=json.dumps({'container':db.container,'request':{'token':token,'command':c,'observation':'QA motivo'}}),cwd=ROOT,text=True,capture_output=True)
  r=json.loads(p.stdout)
  if expect:assert p.returncode and expect in r['error'],r
  else:assert not p.returncode,r
  return r
 read=run('READ');assert read['state']['revision']==0
 assert db.sql("SELECT has_function_privilege('anon','public.sgp_lp_official_read_v1(text,jsonb)','EXECUTE')")=='f'
 run('DEFINE_AVAILABLE',key=key,quantity=8,token='LIDER',expect='DEFINICION_REQUIERE_COORDINADOR')
 define=run('DEFINE_AVAILABLE',key=key,quantity=8);assert define['revision']==1
 added=run('INCORPORATE',1,token='LIDER',key=key,quantity=5,priority=2);assert added['revision']==2
 view=run('READ');assert view['availability'][0]['quantity']==8 and view['plan']['rows'][0]['quantity']==5
 assert view['state']['inclusions'][0]['initialPlan']['rows']==[]
 assert db.sql('SELECT count(*) FROM public.sgp_linea_plan_asignaciones')=='0'
 checks.append('Coordinator definition and leader incorporation persist with original empty plan and reason; planner untouched')
 run('INCORPORATE',2,key=key,quantity=2,priority=3,expect='ORDEN_YA_PROGRAMADA')
 run('DEFINE_AVAILABLE',1,key=key,quantity=3,expect='CONFLICTO_REVISION')
 checks.append('Duplicate incorporation and stale revision reject')
 db.sql("UPDATE sgp_lp_operacion.turnos SET estado='CERRADO';UPDATE sgp_lp_official.config SET enabled=false;")
 assert run('READ')['revision']==2
 run('DEFINE_AVAILABLE',2,key=key,quantity=4,expect='OFFICIAL_NOT_ENABLED')
 checks.append('Historical read survives native closed turn and disabled writes; mutations stay blocked')
 db.sql("DELETE FROM sgp_lp_operacion.permisos WHERE usuario='LIDER' AND key="+lit(key))
 run('READ',token='LIDER',expect='AMBITO_DENEGADO')
 checks.append('Revoked key blocks reading persisted definition and incorporation')
 result={'status':'PASS','checks':checks,'scope':'Ephemeral PostgreSQL; no production activation'}
 (HERE/'workflow-postgres-result.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
finally:db.close()
