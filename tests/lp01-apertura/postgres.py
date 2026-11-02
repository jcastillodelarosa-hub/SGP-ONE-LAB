"""Read-only server plan + real manual ABRIR reference. No technical authorization is simulated."""
from pathlib import Path
from datetime import datetime
import sys,json,uuid,importlib.util,subprocess,threading,tempfile
from concurrent.futures import ThreadPoolExecutor
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1]
spec=importlib.util.spec_from_file_location('empty_helpers',ROOT/'tests/lp01-sin-actividad/postgres.py');h=importlib.util.module_from_spec(spec);spec.loader.exec_module(h)
Database=h.Database;lit=h.lit
OUT=HERE/'evidence';OUT.mkdir(exist_ok=True)
def observe(db,at,stage='ENSAMBLE',line='PANELES_2'):
 return json.loads(db.sql('SELECT sgp_lp_operacion.apertura_preparada('+','.join([lit(stage),lit(line),lit(at)+'::timestamptz'])+');'))
def prepare(plan):
 with tempfile.TemporaryDirectory() as d:
  inp=Path(d)/'input.json';out=Path(d)/'output.json';inp.write_text(json.dumps([plan]));subprocess.run(['node',str(ROOT/'scripts/lp01-opening-prepare.mjs'),str(inp),str(out)],check=True,capture_output=True,text=True,cwd=ROOT);return json.loads(out.read_text())
def close_empty(db,**ctx):return db.execute(db.cmd('CERRAR',close_type='SIN_ACTIVIDAD',confirmed=True,observation='QA cierre vacío aprobado',**ctx))
def test(db):
 checks=[];samples=[];key='QA-FUTURE|PANELES_2';db.seed(key,parts=(20,),date='2026-11-04')
 before=db.sql('SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM public.sgp_linea_plan_asignaciones x');official=db.sql('SELECT jsonb_agg(to_jsonb(x) ORDER BY key_produccion) FROM public.sgp_producciones x')
 p=observe(db,'2026-11-01T20:00Z');assert p['state']=='MANUAL_BOOTSTRAP_REQUIRED' and not p['automaticExecutionEnabled'];samples.append(p)
 db.execute(db.cmd('ABRIR',revision=0));p=observe(db,'2026-11-01T23:30Z');assert p['state']=='BLOCKED_PREVIOUS_OPEN' and p['due'];samples.append(p)
 assert db.snapshot()['automaticOpening']['automaticExecutionEnabled'] is False
 checks.append('Protected read plan exposes bootstrap/previous-open block, never closes or skips it; no automatic execution or durable executor log is claimed')
 close_empty(db)
 # Sunday turn 2 starts at 18:00 Bogota from the real configuration, not the normal weekday time.
 early=observe(db,'2026-11-01T22:59:59Z');ready=observe(db,'2026-11-01T23:00:00Z');assert early['state']=='WAITING_SCHEDULE' and ready['state']=='READY_PENDING_TECHNICAL_APPROVAL' and ready['anchor']['close']['type']=='SIN_ACTIVIDAD'
 assert ready['target']['date']=='2026-11-01' and ready['target']['shift']==2;samples.extend([early,ready])
 batch=prepare(ready);intent=batch['intents'][0];assert intent['canExecute'] is False and batch['automaticWrites']==0
 (OUT/'preparation-only.json').write_text(json.dumps(batch,indent=2)+'\n')
 late=observe(db,'2026-11-05T16:00Z');assert late['late'] and late['target']==ready['target'];assert prepare(late)['intents'][0]['command']['id']==intent['command']['id'];samples.append(late)
 checks.append('Configured Sunday/night boundary, valid SIN ACTIVIDAD predecessor, stable intent and late recovery without skipping; preparation artifact contains no execution binding')
 # Actual engine reference under synthetic coordinator session, NOT a technical principal.
 c=intent['command'];barrier=threading.Barrier(2)
 def manual(cmd):barrier.wait();return db.run('SET ROLE anon;'+db.call('COORDINADOR',cmd))
 with ThreadPoolExecutor(2) as pool:rs=list(pool.map(manual,[c,c]))
 assert all(r.returncode==0 for r in rs)
 receipt=db.rpc('sgp_lp_operacion_resultado',{'p_token':'COORDINADOR','p_id':c['id']});assert receipt['committed']
 assert db.sql('SELECT count(*) FROM sgp_lp_operacion.auditoria WHERE id='+lit(c['id']))=='1'
 assert db.snapshot(shift=2)['orders']==[]
 checks.append('Reference manual integration: prepared ABRIR executes once under concurrent synthetic coordinator calls and recovers committed response through existing receipt; NOT proof of technical executor auth')
 close_empty(db,shift=2)
 monday=observe(db,'2026-11-02T12:00Z');assert monday['target']['date']=='2026-11-02' and monday['target']['shift']==1 and monday['state']=='READY_PENDING_TECHNICAL_APPROVAL';samples.append(monday)
 cmd=prepare(monday)['intents'][0]['command'];db.execute(cmd)
 # Change only the synthetic schedule. Both server target and deterministic intent must follow it.
 config=db.sql("SELECT valor FROM public.sgp_configuracion_general WHERE clave='HORARIOS_TURNOS'")
 close_empty(db,date='2026-11-02')
 db.sql("UPDATE public.sgp_configuracion_general SET valor=jsonb_set(jsonb_set(valor,'{lunes_sabado,turno1,fin}','\"16:20\"'),'{lunes_sabado,turno2,inicio}','\"16:20\"') WHERE clave='HORARIOS_TURNOS'")
 weekday=observe(db,'2026-11-02T21:20Z');assert weekday['target']['start'].startswith('2026-11-02T21:20:00') and weekday['state']=='READY_PENDING_TECHNICAL_APPROVAL';samples.append(weekday)
 assert datetime.fromisoformat(prepare(weekday)['intents'][0]['reference']['start'].replace('Z','+00:00'))==datetime.fromisoformat(weekday['target']['start'])
 db.sql("UPDATE public.sgp_configuracion_general SET valor="+lit(config)+"::jsonb WHERE clave='HORARIOS_TURNOS'")
 checks.append('Sunday night→Monday day and changed weekday configuration determine due time; no fixed operating hours or holiday exclusions are invented')
 # A closed flag without its audited close is not an accredited predecessor.
 fkey='QA-FRAME|FRAMES_2';db.seed(fkey,parts=(1,),date='2026-11-04');db.sql("UPDATE public.sgp_producciones SET id_linea='FRAMES_2' WHERE key_produccion="+lit(fkey))
 db.execute(db.cmd('ABRIR',stage='EMPAQUE',line='FRAMES_2',revision=0));db.sql("UPDATE sgp_lp_operacion.turnos SET estado='CERRADO' WHERE etapa='EMPAQUE' AND linea='FRAMES_2'") # isolated malformed state
 invalid=observe(db,'2026-11-01T23:30Z',stage='EMPAQUE',line='FRAMES_2');assert invalid['state']=='BLOCKED_INVALID_CLOSE';samples.append(invalid)
 db.reject(db.cmd('ABRIR',stage='EMPAQUE',line='FRAMES_2',shift=2,revision=0),'CIERRE_ORIGEN_NO_ACREDITADO')
 db.execute(db.cmd('REABRIR',stage='EMPAQUE',line='FRAMES_2',observation='QA recuperación manual del estado sintético'));close_empty(db,stage='EMPAQUE',line='FRAMES_2')
 assert observe(db,'2026-11-01T23:30Z',stage='EMPAQUE',line='FRAMES_2')['state']=='READY_PENDING_TECHNICAL_APPROVAL'
 checks.append('Closed flag without audited immutable close blocks protected ABRIR; authorized manual recovery restores a valid plan; same common schedule is evaluated independently per line/stage')
 # Missing schedule does not break the read facade or invent a target.
 db.sql("UPDATE public.sgp_configuracion_general SET valor=valor #- '{lunes_sabado,turno2}' WHERE clave='HORARIOS_TURNOS'")
 assert observe(db,'2026-11-02T23:30Z')['state']=='BLOCKED_SCHEDULE_INVALID'
 db.sql("UPDATE public.sgp_configuracion_general SET valor="+lit(config)+"::jsonb WHERE clave='HORARIOS_TURNOS'")
 # Line/stage/user protections remain actual SGP checks.
 db.sql("DELETE FROM sgp_lp_operacion.permisos WHERE usuario='LIDER' AND etapa='EMPAQUE' AND key="+lit(fkey))
 try:db.snapshot('EMPAQUE',line='FRAMES_2');raise AssertionError('Wrong scope leaked plan')
 except RuntimeError as e:assert 'AMBITO_DENEGADO' in str(e)
 db.sql('UPDATE sgp_lp_operacion.config SET escrituras=false WHERE id')
 assert db.snapshot()['automaticOpening']['automaticExecutionEnabled'] is False and db.snapshot()['automaticOpening']['state']=='BLOCKED_WRITES_DISABLED'
 assert prepare(db.snapshot()['automaticOpening'])['intents']==[]
 db.reject(db.cmd('ABRIR',shift=2,date='2026-11-02',revision=0),'ESCRITURA_NO_HABILITADA')
 assert before==db.sql('SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM public.sgp_linea_plan_asignaciones x WHERE key_produccion<>'+lit(fkey))
 assert official==db.sql('SELECT jsonb_agg(to_jsonb(x) ORDER BY key_produccion) FROM public.sgp_producciones x WHERE key_produccion<>'+lit(fkey))
 checks.append('Missing schedule fails closed; scope/containment remain protected and manual fallback never changes planning or official quantities')
 (OUT/'server-plans-synthetic.json').write_text(json.dumps(samples,indent=2)+'\n')
 out={'status':'PASS_IN_PREPARATION_SCOPE','checks':checks,'limits':['No technical identity or privilege model approved/implemented','Actual ABRIR reference uses synthetic coordinator sessions solely for manual compatibility','No running automatic executor, persisted executor events, job, credential, secret or production write'],'postgres':db.sql('SHOW server_version')}
 (OUT/'postgres.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
if __name__=='__main__':
 db=Database()
 try:test(db)
 finally:db.close()
