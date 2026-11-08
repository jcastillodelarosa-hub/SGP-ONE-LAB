#!/usr/bin/env python3
"""Focused Empaque races; reuse disposable PG17 fixture, not production connectivity."""
from pathlib import Path
import concurrent.futures as cf,importlib.util,json,shutil,sys,uuid
ROOT=Path(__file__).resolve().parents[2]
HERE=Path(__file__).parent
spec=importlib.util.spec_from_file_location('current_turn_pg17',ROOT/'tests/lp01-turno-horario/concurrency/postgres17.py')
base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
Session,Database,success,denied=base.Session,base.Database,base.success,base.denied
lit=base.harness.lit
GATE="BEGIN;SELECT pg_advisory_xact_lock(hashtextextended('EMPAQUE|PANELES_2',184));"
OPEN="SET ROLE anon;SELECT public.sgp_lp_empaque_turno_actual('coordinator');"
OUT=HERE/'result-postgres17.json'
class Container(base.Container):
 def __enter__(self):
  super().__enter__()
  try:
   db=Database(self,'qa_template')
   db.sql((ROOT/'docs/sql-proposals/lp01-turno-horario-empaque/01_horario_empaque_REVIEW.sql').read_text())
   db.sql((ROOT/'docs/sql-proposals/lp01-empaque-inclusion/01_inclusion_REVIEW.sql').read_text())
   assert db.sql('SELECT turno_horario_empaque OR incorporar_empaque FROM sgp_lp_operacion.config WHERE id')=='f'
   db.sql('UPDATE sgp_lp_operacion.config SET turno_horario_empaque=true,incorporar_empaque=true WHERE id')
   return self
  except BaseException as error:
   try:self.close()
   except Exception as cleanup:error.add_note('Cleanup failed: '+str(cleanup))
   raise

def materialize(db):return success(db.run(OPEN))['currentPeriod']
def request(period,key='QA-A|PANELES_2',**extra):return {**dict(id=str(uuid.uuid4()),date=period['date'],shift=period['shift'],key=key,revision=0,quantity=4,observation='QA explicit packing inclusion'),**extra}
def call(command):return "SET ROLE anon;SELECT public.sgp_lp_empaque_incorporar('coordinator',"+lit(json.dumps(command))+"::jsonb);"
def count(db):return db.value("SELECT jsonb_build_object('inclusions',(SELECT count(*) FROM sgp_lp_operacion.inclusiones_empaque),'openings',(SELECT count(*) FROM sgp_lp_operacion.aperturas_horario WHERE etapa='EMPAQUE'),'turns',(SELECT count(*) FROM sgp_lp_operacion.turnos WHERE etapa='EMPAQUE'),'revision',(SELECT max(revision) FROM sgp_lp_operacion.turnos WHERE etapa='EMPAQUE')); ")
def preserved(db,before):
 after=db.state()
 for key in ['source','plan','orders','audit']:assert after[key]==before[key],key

def cases(container):
 checks=[]
 with cf.ThreadPoolExecutor(max_workers=5) as pool:
  db=container.case('packing_clock');before=db.state()
  with Session(db,'qa_gate') as gate:
   gate.execute(GATE);a=db.worker(pool,'qa_a',OPEN);b=db.worker(pool,'qa_b',OPEN)
   db.wait_blocked('qa_a','qa_gate');db.wait_blocked('qa_b','qa_gate');gate.execute('COMMIT;')
   replies=[success(a.result(timeout=30)),success(b.result(timeout=30))]
   assert sum(r['created'] for r in replies)==1;assert replies[0]['currentPeriod']==replies[1]['currentPeriod']
  assert count(db)==dict(inclusions=0,openings=1,turns=1,revision=0);preserved(db,before)
  checks.append('Concurrent Empaque materialization creates one empty turn and one audit; Ensamble sources unchanged')
  db=container.case('packing_same');period=materialize(db);r=request(period);before=db.state()
  with Session(db,'qa_gate') as gate:
   gate.execute(GATE);a=db.worker(pool,'qa_a',call(r));db.wait_blocked('qa_a','qa_gate')
   b=db.worker(pool,'qa_b',call(r));db.wait_blocked('qa_b','qa_a');gate.execute('COMMIT;')
   first=success(a.result(timeout=30));second=success(b.result(timeout=30));assert first['id']==second['id'];assert second['duplicate'] is True
  assert count(db)==dict(inclusions=1,openings=1,turns=1,revision=1);preserved(db,before)
  checks.append('Identical concurrent inclusion UUID returns same receipt: one inclusion, one revision')
  db=container.case('packing_cas');period=materialize(db);before=db.state()
  with Session(db,'qa_gate') as gate:
   gate.execute(GATE);a=db.worker(pool,'qa_a',call(request(period)));b=db.worker(pool,'qa_b',call(request(period,'QA-B|PANELES_2')))
   db.wait_blocked('qa_a','qa_gate');db.wait_blocked('qa_b','qa_gate');gate.execute('COMMIT;')
   replies=[a.result(timeout=30),b.result(timeout=30)];assert sum(r.returncode==0 for r in replies)==1
   denied(next(r for r in replies if r.returncode!=0),'CONFLICTO_REVISION_TURNO')
  assert count(db)==dict(inclusions=1,openings=1,turns=1,revision=1);preserved(db,before)
  checks.append('Different keys with same turn revision: exactly one inclusion commits, loser leaves no effects')
  db=container.case('packing_contained');period=materialize(db);before=db.state()
  with Session(db,'qa_container') as gate:
   gate.execute('BEGIN;UPDATE sgp_lp_operacion.config SET incorporar_empaque=false WHERE id;')
   pending=db.worker(pool,'qa_a',call(request(period)));db.wait_blocked('qa_a','qa_container');gate.execute('COMMIT;')
   denied(pending.result(timeout=30),'INCORPORAR_EMPAQUE_NO_HABILITADO')
  assert count(db)==dict(inclusions=0,openings=1,turns=1,revision=0);preserved(db,before)
  checks.append('Containment committed while request awaits config prevents any inclusion')
  db=container.case('packing_admitted');period=materialize(db);r=request(period);before=db.state()
  with Session(db,'qa_gate') as gate:
   gate.execute(GATE);pending=db.worker(pool,'qa_a',call(r));db.wait_blocked('qa_a','qa_gate')
   contain=db.worker(pool,'qa_container','UPDATE sgp_lp_operacion.config SET incorporar_empaque=false WHERE id;')
   db.wait_blocked('qa_container','qa_a');gate.execute('COMMIT;');success(pending.result(timeout=30));assert contain.result(timeout=30).returncode==0
  assert success(db.run(call(r)))['duplicate'] is True
  denied(db.run(call(request(period,'QA-B|PANELES_2',revision=1))),'INCORPORAR_EMPAQUE_NO_HABILITADO')
  assert count(db)==dict(inclusions=1,openings=1,turns=1,revision=1);preserved(db,before)
  checks.append('Containment drains admitted inclusion; receipt survives but later request is denied')
  db=container.case('packing_revocation');period=materialize(db);before=db.state()
  with Session(db,'qa_revoker') as gate:
   gate.execute("BEGIN;UPDATE public.sgp_usuario_accesos SET permitido=false WHERE id_usuario=(SELECT id_usuario FROM public.sgp_usuarios WHERE usuario='coordinator');")
   pending=db.worker(pool,'qa_a',call(request(period)));db.wait_blocked('qa_a','qa_revoker');gate.execute('COMMIT;');denied(pending.result(timeout=30),'AMBITO')
  assert count(db)==dict(inclusions=0,openings=1,turns=1,revision=0);preserved(db,before)
  checks.append('Native access revocation committed during wait rejects coordinator with no inclusion effects')
 return checks

def main():
 report=dict(status='NOT_RUN',engine=base.harness.IMAGE,results=[],safety='Disposable Docker --network none, no mounts/ports/credentials; unchanged server clock.');code=2
 if not shutil.which('docker'):report['reason']='Docker unavailable; pending real PostgreSQL17 CI execution'
 else:
  try:
   with Container() as container:
    results=cases(container);report.update(status='PASS',engine=container.version,groups=len(results),results=results);code=0
  except Exception as error:report.update(status='FAILED',reason=str(error),cleanupNotes=getattr(error,'__notes__',[]));code=1
 OUT.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2));return code
if __name__=='__main__':sys.exit(main())
