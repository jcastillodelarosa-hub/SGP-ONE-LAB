"""PostgreSQL17.11 network-none, captured SGP auth/roles and synthetic rows only."""
from pathlib import Path
import importlib.util,json,uuid,sys
from concurrent.futures import ThreadPoolExecutor
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('roles_fixture',ROOT/'tests/lp01-roles/postgres.py');f=importlib.util.module_from_spec(spec);spec.loader.exec_module(f)
lit=f.lit
class Fixture:
 def __init__(self):
  self.db=f.Database();self.key,self.parts=f.setup(self.db);self.checks=[]
  self.db.sql((ROOT/'docs/sql-proposals/lp01-seguimiento/INSTALL_REVIEW.sql').read_text())
  self.db.sql((ROOT/'docs/sql-proposals/lp01-afectaciones/01_storage_DRAFT.sql').read_text())
  sql=(ROOT/'docs/sql-proposals/lp01-afectaciones/02_rpc_REVIEW.sql').read_text()
  failed=self.db.run(sql.replace('COMMIT;','SELECT 1/0;COMMIT;'));assert failed.returncode and self.db.sql("SELECT to_regclass('sgp_lp_afectaciones.config') IS NULL")=='t'
  self.db.sql(sql)
  assert self.db.sql("SELECT NOT writes AND NOT physical AND NOT pdt_links FROM sgp_lp_afectaciones.config")=='t'
  assert self.db.sql("SELECT has_function_privilege('anon','public.sgp_lp_afectaciones_consultar_v1(text,text,text)','EXECUTE')")=='f'
  self.db.sql('GRANT EXECUTE ON FUNCTION public.sgp_lp_afectaciones_consultar_v1(text,text,text),public.sgp_lp_afectaciones_comando_v1(text,text,text,date,int,jsonb) TO anon')
  self.checks.append('Atomic failed installation; default writes/physical/PDT disabled; no public grants')
  for stage in ['ENSAMBLE','EMPAQUE']:self.db.execute(self.db.cmd('ABRIR',stage=stage))
 def read(self,user='se',stage='ENSAMBLE'):
  return json.loads(self.db.sql('SET ROLE anon;SELECT public.sgp_lp_afectaciones_consultar_v1('+','.join(map(lit,[user,self.key,stage]))+');'))
 def command(self,action,n,user='se',stage='ENSAMBLE',**extra):
  return dict(id=str(uuid.uuid4()),action=action,quantity=n,revision=self.read(user,stage)['revision'],observation='QA observación',**extra)
 def query(self,c,user='se',stage='ENSAMBLE',date='2026-11-01',shift=1):
  return 'SET ROLE anon;SELECT public.sgp_lp_afectaciones_comando_v1('+','.join([lit(user),lit(self.key),lit(stage),lit(date),str(shift),lit(json.dumps(c))+'::jsonb'])+');'
 def run(self,c,**kw):return json.loads(self.db.sql(self.query(c,**kw)))
 def deny(self,c,code,**kw):
  r=self.db.run(self.query(c,**kw));assert r.returncode and code in r.stderr,(code,r.stderr)
 def close(self):self.db.close()
def test(x):
 db=x.db
 c=x.command('CREATE',5,cause='NOVEDAD');x.deny(c,'ESCRITURA_NO_HABILITADA')
 db.sql('UPDATE sgp_lp_afectaciones.config SET writes=true')
 x.deny(x.command('CREATE',2,cause='NC_AL'),'NC_AL_REQUIERE_PDT')
 r=x.run(c);rid=r['reportId'];assert x.run(c)['duplicate'];assert len(x.read()['reports'])==1
 x.deny({**c,'quantity':6},'IDEMPOTENCIA_REUTILIZADA');x.deny({**c,'id':str(uuid.uuid4())},'REVISION_DESACTUALIZADA')
 assert db.run(x.query(c,user='sp')).returncode
 assert db.run(x.query(c,user='invalid')).returncode
 x.deny(x.command('VALIDATE',5),'LP_ROL_ETAPA_DENEGADO')
 x.deny(x.command('VALIDATE',5,user='QAADMIN'),'LP_ROL_ETAPA_DENEGADO',user='QAADMIN')
 assert db.run('SET ROLE anon;SELECT * FROM sgp_lp_afectaciones.reportes').returncode
 assert db.run('SET ROLE anon;SELECT sgp_lp_afectaciones.avances('+lit(x.key)+",'ENSAMBLE','PANELES_2')").returncode
 x.checks.append('Leader records own stage; cross-stage, invalid session, admin validation and direct private access denied; idempotency/CAS')
 x.run(x.command('SOLVE',3,reportId=rid));assert x.read()['available'] is None
 x.deny(x.command('CONFIRM',2,reportId=rid),'CONFIRMACION_NO_HABILITADA')
 db.sql('UPDATE sgp_lp_afectaciones.config SET physical=true') # QA-only capability activation
 x.deny(x.command('CONFIRM',4,reportId=rid),'CONFIRMACION_SIN_SOLUCION')
 x.run(x.command('CONFIRM',2,reportId=rid));x.run(x.command('CREATE',4,cause='NC_V'))
 x.deny(x.command('VALIDATE',5,user='COORDINADOR'),'LEGADO_SIN_CONCILIAR',user='COORDINADOR')
 db.sql("INSERT INTO sgp_lp_afectaciones.conciliacion SELECT key_produccion,e,sgp_lp_afectaciones.firma_legado(key_produccion,e),'QA synthetic reconciliation' FROM public.sgp_producciones CROSS JOIN unnest(ARRAY['ENSAMBLE','EMPAQUE']) e")
 x.run(x.command('VALIDATE',5,user='COORDINADOR'),user='COORDINADOR');assert x.read()['available']==283
 db.sql("UPDATE public.sgp_producciones SET saldo_ensamble=287 WHERE key_produccion="+lit(x.key));assert x.read()['available'] is None
 db.sql("UPDATE public.sgp_producciones SET saldo_ensamble=288 WHERE key_produccion="+lit(x.key))
 x.run(x.command('CORRECT',6,reportId=rid));assert x.read()['available'] is None
 x.deny(x.command('CORRECT',1,reportId=rid),'CORRECCION_INCONSISTENTE')
 assert db.run('UPDATE sgp_lp_afectaciones.eventos SET observacion=\'rewrite\'').returncode
 x.checks.append('Partial source solution does not release; physical gate/bounds; overlapping union requires coordinator; Export change/correction invalidates union; immutable history')
 commands=[x.command('CORRECT',7,reportId=rid),x.command('CORRECT',8,reportId=rid)]
 with ThreadPoolExecutor(2) as pool:results=list(pool.map(lambda c:db.run(x.query(c)),commands))
 assert sorted(r.returncode==0 for r in results)==[False,True]
 assert any('REVISION_DESACTUALIZADA' in r.stderr for r in results)
 same=x.command('CREATE',1,cause='TECNO')
 with ThreadPoolExecutor(2) as pool:retries=list(pool.map(lambda _:x.run(same),range(2)))
 assert sorted(r['duplicate'] for r in retries)==[False,True]
 assert len([r for r in x.read()['reports'] if r['id']==same['id']])==1
 x.checks.append('Concurrent stale writes serialize: one success and one conflict; identical concurrent retries create one report')
 before=x.read();db.sql("CREATE FUNCTION public.qa_fail_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'QA_ATOMIC_FAIL';END $$;CREATE TRIGGER qa_fail BEFORE INSERT ON sgp_lp_afectaciones.eventos FOR EACH ROW EXECUTE FUNCTION public.qa_fail_event()")
 x.deny(x.command('CREATE',2,cause='NOVEDAD'),'QA_ATOMIC_FAIL');assert x.read()==before
 db.sql('DROP TRIGGER qa_fail ON sgp_lp_afectaciones.eventos;DROP FUNCTION public.qa_fail_event()')
 x.checks.append('Audit failure rolls back report, revision and consolidated state atomically')
 # Shared history is filtered by actual role/individual stage grants.
 x.run(x.command('CREATE',2,user='sp',stage='EMPAQUE',cause='NOVEDAD'),user='sp',stage='EMPAQUE')
 assert {e['stage'] for e in x.read()['events']}=={'ENSAMBLE'}
 assert {e['stage'] for e in x.read('ll')['events']}=={'ENSAMBLE','EMPAQUE'}
 db.sql("INSERT INTO sgp_lp_operacion.turnos(linea,etapa,fecha,turno,capacidad) VALUES('PANELES_2','ENSAMBLE','2026-11-01',2,288)");count=len(x.read()['reports']);x.run(x.command('SOLVE',1,reportId=rid),shift=2)
 assert len(x.read()['reports'])==count and x.read()['reports'][0]['originShift']==1
 x.checks.append('Shared history restricted by stage; next shift preserves report ID and original date/shift without copying')
 # Projection uses real LP EJECUTAR audits; origin coverage is privileged evidence, not inferred.
 for stage,user in [('ENSAMBLE','se'),('EMPAQUE','sp')]:
  db.execute(db.cmd('SALE',stage=stage,key=x.key,part=x.parts[0],quantity=5,observation='QA sale'))
  db.execute(db.cmd('EJECUTAR',stage=stage,key=x.key,part=x.parts[0],quantity=2,observation='QA first'),user)
  progress=x.read(user,stage)['progress'][stage];assert len(progress['events'])==1 and progress['opening'] is None
  db.sql('INSERT INTO sgp_lp_afectaciones.cobertura VALUES('+','.join(map(lit,[x.key,stage,progress['events'][0]['id'],'QA synthetic complete origin','QA']))+',clock_timestamp())')
  assert x.read(user,stage)['progress'][stage]['opening']['date']=='2026-11-01'
  db.execute(db.cmd('EJECUTAR',stage=stage,key=x.key,part=x.parts[0],quantity=0,observation='QA correction'),user)
  assert len(x.read(user,stage)['progress'][stage]['events'])==2 and x.read(user,stage)['progress'][stage]['opening']['date']=='2026-11-01'
 x.checks.append('Real LP audit quantities/before and corrections projected; both stage openings unknown without privileged origin coverage; preserved after correction')
 # No native PDT adapter: only QA attestations can enable the linkage test; no piece quantity field.
 sid=str(uuid.uuid4());c=x.command('CREATE',1,cause='NC_AL',sourceContract='V4',sourceId=sid)
 x.deny(c,'VINCULO_PDT_NO_HABILITADO');db.sql('UPDATE sgp_lp_afectaciones.config SET pdt_links=true');x.deny(c,'FUENTE_PDT_NO_ACREDITADA')
 db.sql('INSERT INTO sgp_lp_afectaciones.pdt_fuentes_acreditadas VALUES('+','.join(map(lit,['V4',sid,x.key,'PICKING','QA evidence']))+',true)');x.run(c)
 x.deny(x.command('CREATE',1,cause='NC_AL',sourceContract='V4',sourceId=sid),'duplicate key')
 x.checks.append('PDT disabled by default; fabricated source rejected; synthetic attested Picking ID linked once, duplicate rolls back; no piece/window conversion')
 # Revocation applies even to idempotent retries.
 db.sql("UPDATE public.sgp_sesiones_app SET revocado_en=clock_timestamp() WHERE id_usuario=(SELECT id_usuario FROM public.sgp_usuarios WHERE usuario='se')")
 assert db.run(x.query(c)).returncode
 x.checks.append('Session revocation rejects retry before returning stored receipt')
if __name__=='__main__':
 x=Fixture()
 try:
  test(x);out={'status':'PASS','environment':x.db.sql('SHOW server_version'),'network':'none','checks':x.checks,'limitations':['Synthetic data only','No native PDT source emitter','Physical permission gate remains off in installation','RPC grants not enabled by installation']}
  (Path(__file__).parent/'result.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
 finally:x.close()
