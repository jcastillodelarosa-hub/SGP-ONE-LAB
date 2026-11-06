"""Directed native close/automatic opening bridge in ephemeral PG only."""
from pathlib import Path
import sys,json,subprocess,uuid
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'tests/lp01-operacion'))
from postgres import Database,lit
HERE=Path(__file__).parent;db=Database();checks=[]
try:
 db.sql('ALTER TABLE public.sgp_producciones ADD COLUMN proyecto text;')
 for name in ['01_storage_REVIEW.sql','03_native_bridge_REVIEW.sql']:db.sql((ROOT/'docs/sql-proposals/lp01-official-close'/name).read_text())
 source=ROOT/'tests/lp01-powerbi/fixtures/ensamble.xlsx'
 parsed=json.loads(subprocess.check_output(['node',str(ROOT/'tests/lp01-powerbi/parse-fixture.mjs'),str(source)],cwd=ROOT,text=True))
 for i,r in enumerate(x for x in parsed['records'] if x['shift']==1):
  key=f'QA-NATIVE-{i}|PANELES_2';db.seed(key,parts=(10,),date='2026-10-31');db.sql('UPDATE public.sgp_producciones SET produccion='+lit(r['production'])+',proyecto='+lit(r['project'])+',sistema='+lit(r['system'])+' WHERE key_produccion='+lit(key))
 db.execute(db.cmd('ABRIR',date='2026-10-31',revision=0))
 assert db.sql('SELECT native_close OR automatic_open FROM sgp_lp_official.config')=='f'
 assert db.sql("SELECT has_function_privilege('anon','public.sgp_lp_official_open_due_v1(text,text,text)','EXECUTE')")=='f'
 db.sql('UPDATE sgp_lp_official.config SET enabled=true,native_close=true;')
 def run(command,file=None):
  r=subprocess.run(['node',str(HERE/'service-runner.mjs')],input=json.dumps({'container':db.container,'file':str(file) if file else None,'request':{'token':'COORDINADOR','command':command,'filename':'qa.xlsx','observation':'QA cierre nativo'}}),cwd=ROOT,text=True,capture_output=True)
  answer=json.loads(r.stdout);assert not r.returncode,answer;return answer
 command={'id':str(uuid.uuid4()),'action':'IMPORT','stage':'ENSAMBLE','line':'PANELES_2','date':'2026-10-31','shift':1,'revision':0}
 run(command,source);close={**command,'id':str(uuid.uuid4()),'action':'CLOSE','revision':1};receipt=run(close)
 assert receipt['nativeClosed'] is True and run(close)==receipt
 assert db.sql("SELECT estado FROM sgp_lp_operacion.turnos WHERE etapa='ENSAMBLE'")=='CERRADO'
 assert db.sql('SELECT count(*) FROM sgp_lp_operacion.cierres')=='1'
 assert db.sql('SELECT sum(ejecutado) FROM sgp_lp_operacion.ordenes')=='0'
 assert db.sql("SELECT adaptador FROM sgp_lp_operacion.archivos WHERE adaptador='LP-PBI-XLSX-2'")=='LP-PBI-XLSX-2'
 assert run({**close,'id':str(uuid.uuid4()),'action':'READ','revision':0})['revision']==2
 checks.append('Official close and native close commit atomically; retry matches receipt; history reads closed turn; manual totals untouched')
 # Explicit synthetic continuous schedule, never application fallback.
 db.sql('UPDATE public.sgp_configuracion_general SET valor='+lit(json.dumps({d:{'turno1':{'inicio':'00:00','fin':'12:00'},'turno2':{'inicio':'12:00','fin':'00:00'}} for d in ['lunes_sabado','domingo']}))+'::jsonb;')
 due="SELECT public.sgp_lp_official_open_due_v1('COORDINADOR','EMPAQUE','PANELES_2');"
 assert 'APERTURA_AUTOMATICA_NO_HABILITADA' in db.run(due).stderr
 db.sql('UPDATE sgp_lp_official.config SET automatic_open=true;')
 first=json.loads(db.sql(due));assert first['status']=='OPENED',first
 second=json.loads(db.sql(due));assert second['status']=='EXISTS',second
 assert db.sql("SELECT count(*) FROM sgp_lp_operacion.auditoria WHERE operacion='ABRIR_AUTO_OFICIAL'")=='1'
 assert 'APERTURA_SERVIDOR_NO_AUTORIZADA' in db.run(due.replace("'COORDINADOR'","'LIDER'")).stderr
 checks.append('Automatic current period uses configured schedule/timezone, requires flag and server role, and opens once without browser button')
 blocked=db.run("SELECT public.sgp_lp_official_open_due_v1('COORDINADOR','ENSAMBLE','PANELES_2');")
 assert 'TURNOS_INTERMEDIOS_PENDIENTES' in blocked.stderr
 checks.append('Automatic opening never skips missing intermediate turns')
 result={'status':'PASS','checks':checks,'scope':'Ephemeral PostgreSQL and synthetic schedules only; no credentials, jobs or grants installed'}
 (HERE/'native-bridge-postgres-result.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
finally:db.close()
