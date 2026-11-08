#!/usr/bin/env python3
"""Focused real-session current-shift tests. Disposable local PG17, no production inputs."""
from pathlib import Path
import importlib.util,concurrent.futures as cf,hashlib,json,shutil,subprocess,sys,time
ROOT=Path(__file__).resolve().parents[3]
HERE=Path(__file__).parent
BASE=ROOT/'tests/lp01-incorporar/concurrency'
spec=importlib.util.spec_from_file_location('existing_pg17',BASE/'postgres17.py')
harness=importlib.util.module_from_spec(spec);spec.loader.exec_module(harness)
Session,Database,success,denied=harness.Session,harness.Database,harness.success,harness.denied
CALL="SET ROLE anon;SELECT public.sgp_lp_ensamble_turno_actual('leader');"
GATE=harness.GATE
OUT=HERE/'result-postgres17.json'

class Container(harness.Container):
 def __enter__(self):
  self.started=True
  try:
   subprocess.run(self.docker+['run','-d','--rm','--network','none','--name',self.container,'-e','POSTGRES_HOST_AUTH_METHOD=trust',harness.IMAGE],env=self.env,check=True,capture_output=True,text=True)
   deadline=time.monotonic()+35
   while time.monotonic()<deadline:
    ready=subprocess.run(self.docker+['exec',self.container,'pg_isready','-U','postgres'],env=self.env,capture_output=True)
    logs=subprocess.run(self.docker+['logs',self.container],env=self.env,capture_output=True,text=True)
    if ready.returncode==0 and 'PostgreSQL init process complete' in logs.stdout:break
    time.sleep(.1)
   else:raise RuntimeError('Ephemeral PostgreSQL did not start')
   result=subprocess.run(self.docker+['exec','-i',self.container,'psql','-X','-qAt','-U','postgres','-v','ON_ERROR_STOP=1'],env=self.env,input='SHOW server_version_num;CREATE DATABASE qa_template;',text=True,capture_output=True,check=True)
   assert 170000<=int(result.stdout.splitlines()[0])<180000,result.stdout
   db=Database(self,'qa_template');fixture=(BASE/'fixture.sql').read_text();manifest=json.loads((BASE/'fixture-manifest.json').read_text())
   assert hashlib.sha256(fixture.encode()).hexdigest()==manifest['fixture_sha256']
   db.sql(fixture)
   db.sql('ALTER TABLE public.sgp_producciones ADD COLUMN excluida_export boolean NOT NULL DEFAULT false')
   # Required install order: horario before INCORPORAR; no source bodies modified.
   db.sql((ROOT/'docs/sql-proposals/lp01-turno-horario/01_turno_horario_REVIEW.sql').read_text())
   assert db.sql('SELECT turno_horario_ensamble FROM sgp_lp_operacion.config WHERE id')=='f'
   before=db.sql("SELECT sgp_lp_operacion.puede_operar('leader','ENSAMBLE','CERRAR')")
   assert before=='t'
   db.sql((ROOT/'docs/sql-proposals/lp01-incorporar-post-export/01_incorporar_REVIEW.sql').read_text())
   assert db.sql("SELECT sgp_lp_operacion.puede_operar('leader','ENSAMBLE','CERRAR')")==before
   assert db.sql('SELECT incorporar_ensamble FROM sgp_lp_operacion.config WHERE id')=='f'
   # Only fixture state: guarantee tests are far from a boundary, using real server time.
   # Both 12h slots cover every day; slot1 began at the previous whole hour.
   db.sql("""WITH h AS(SELECT to_char((clock_timestamp() AT TIME ZONE 'America/Bogota')-interval '1 hour','HH24:00') a,
    to_char((clock_timestamp() AT TIME ZONE 'America/Bogota')+interval '11 hours','HH24:00') b),
    slots AS(SELECT jsonb_build_object('turno1',jsonb_build_object('inicio',a,'fin',b),'turno2',jsonb_build_object('inicio',b,'fin',a)) v FROM h)
    UPDATE public.sgp_configuracion_general SET valor=jsonb_build_object('lunes_sabado',v,'domingo',v) FROM slots WHERE clave='HORARIOS_TURNOS';
    DELETE FROM sgp_lp_operacion.turnos;
    INSERT INTO sgp_lp_operacion.turnos(etapa,linea,fecha,turno) VALUES('ENSAMBLE','PANELES_2',(clock_timestamp() AT TIME ZONE 'America/Bogota')::date-10,1);
    UPDATE sgp_lp_operacion.config SET turno_horario_ensamble=true WHERE id;""")
   self.version=db.sql('SELECT version()');return self
  except BaseException as error:
   try:self.close()
   except Exception as cleanup_error:error.add_note('Container cleanup failed: '+str(cleanup_error))
   raise

def counts(db):return db.value("SELECT jsonb_build_object('turns',(SELECT count(*) FROM sgp_lp_operacion.turnos),'openings',(SELECT count(*) FROM sgp_lp_operacion.aperturas_horario),'orders',(SELECT count(*) FROM sgp_lp_operacion.ordenes),'audit',(SELECT count(*) FROM sgp_lp_operacion.auditoria));")
def untouched(db,before):
 after=db.state()
 for key in ['source','plan','orders','audit']:assert after[key]==before[key],key
 assert db.sql("SELECT estado FROM sgp_lp_operacion.turnos ORDER BY fecha,turno LIMIT 1")=='ABIERTO'
 assert db.sql('SELECT min(revision) FROM sgp_lp_operacion.turnos')=='0'

def run_cases(container):
 checks=['Combined installation horario then post-Export INCORPORAR preserves existing CERRAR authority and both default-false flags']
 with cf.ThreadPoolExecutor(max_workers=5) as pool:
  db=container.case('clock_race');before=db.state()
  with Session(db,'qa_gate') as gate:
   gate.execute(GATE)
   a=db.worker(pool,'qa_clock_a',CALL);b=db.worker(pool,'qa_clock_b',CALL)
   db.wait_blocked('qa_clock_a','qa_gate');db.wait_blocked('qa_clock_b','qa_gate');gate.execute('COMMIT;')
   replies=[success(a.result(timeout=30)),success(b.result(timeout=30))]
   assert sum(x['created'] for x in replies)==1
   assert replies[0]['currentPeriod']==replies[1]['currentPeriod']
  assert counts(db)==dict(turns=2,openings=1,orders=0,audit=0);untouched(db,before)
  checks.append('Two real sessions on same current period serialize: one turn, one opening audit, one created result; prior open and sources unchanged')
  db=container.case('clock_flag_before');before=db.state()
  with Session(db,'qa_container') as holder:
   holder.execute('BEGIN;UPDATE sgp_lp_operacion.config SET turno_horario_ensamble=false WHERE id;')
   pending=db.worker(pool,'qa_clock',CALL);db.wait_blocked('qa_clock','qa_container');holder.execute('COMMIT;')
   assert success(pending.result(timeout=30))['state']=='DISABLED'
  assert db.state()==before;assert counts(db)['openings']==0
  checks.append('Committed containment during config wait returns DISABLED and creates nothing')
  db=container.case('clock_flag_admitted');before=db.state()
  with Session(db,'qa_gate') as gate:
   gate.execute(GATE);pending=db.worker(pool,'qa_clock',CALL);db.wait_blocked('qa_clock','qa_gate')
   contain=db.worker(pool,'qa_container','UPDATE sgp_lp_operacion.config SET turno_horario_ensamble=false WHERE id;')
   db.wait_blocked('qa_container','qa_clock');gate.execute('COMMIT;')
   assert success(pending.result(timeout=30))['created'] is True;assert contain.result(timeout=30).returncode==0
  assert success(db.run(CALL))['state']=='DISABLED';assert counts(db)['openings']==1;untouched(db,before)
  checks.append('Containment waits for admitted opener, preserves its audit, blocks later materialization')
  db=container.case('clock_revoked_before');before=db.state()
  with Session(db,'qa_revoker') as revoker:
   revoker.execute("BEGIN;UPDATE public.sgp_usuario_accesos SET permitido=false WHERE id_usuario=(SELECT id_usuario FROM public.sgp_usuarios WHERE usuario='leader');")
   pending=db.worker(pool,'qa_clock',CALL);db.wait_blocked('qa_clock','qa_revoker');revoker.execute('COMMIT;')
   denied(pending.result(timeout=30),'AMBITO')
  assert db.state()==before;assert counts(db)['openings']==0
  checks.append('Session awaiting native permission revocation resumes denied without opening/audit')
  db=container.case('clock_revoke_admitted');before=db.state()
  with Session(db,'qa_gate') as gate:
   gate.execute(GATE);pending=db.worker(pool,'qa_clock',CALL);db.wait_blocked('qa_clock','qa_gate')
   revoke=db.worker(pool,'qa_revoker',"UPDATE public.sgp_usuario_accesos SET permitido=false WHERE id_usuario=(SELECT id_usuario FROM public.sgp_usuarios WHERE usuario='leader');")
   db.wait_blocked('qa_revoker','qa_clock');gate.execute('COMMIT;')
   assert success(pending.result(timeout=30))['created'] is True;assert revoke.result(timeout=30).returncode==0
  denied(db.run(CALL),'AMBITO');assert counts(db)['openings']==1;untouched(db,before)
  checks.append('Native authorization lock drains admitted opening before revocation; later call is denied')
 return checks

def main():
 report={'status':'NOT_RUN','engine':harness.IMAGE,'results':[],'safety':'Disposable local Docker --network none; no mounts/ports/credentials; real product clock_timestamp unchanged.'};code=2
 if not shutil.which('docker'):report['reason']='docker executable unavailable; real-session cases were not run'
 else:
  container=Container()
  try:
   with container:
    results=run_cases(container);report.update(status='PASS',engine=container.version,groups=len(results),results=results);code=0
  except Exception as error:report.update(status='FAILED',reason=str(error),cleanupNotes=getattr(error,'__notes__',[]));code=1
 OUT.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2));return code
if __name__=='__main__':sys.exit(main())
