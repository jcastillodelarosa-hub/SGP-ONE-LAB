"""Directed admission delta only: no repeat of the full contract suite."""
from pathlib import Path
import sys,json,uuid,subprocess
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'tests/lp01-afectaciones-rpc'));import atomic as f
x=f.Fixture()
try:
 db=x.db;db.sql((ROOT/'docs/sql-proposals/lp01-order-details/01_definition_REVIEW.sql').read_text())
 db.sql('GRANT EXECUTE ON FUNCTION public.sgp_lp_order_details_read_v1(text,text,text),public.sgp_lp_order_note_save_v1(text,text,text,jsonb) TO anon')
 def read():return json.loads(db.sql("SET ROLE anon;SELECT public.sgp_lp_order_details_read_v1('COORDINADOR','QA|PANELES_2','ENSAMBLE')"))
 def command():return dict(id=str(uuid.uuid4()),revision=read()['note']['revision'],observation='Admission QA')
 def query(cmd):return "SET ROLE anon;SELECT public.sgp_lp_order_note_save_v1('COORDINADOR','QA|PANELES_2','ENSAMBLE',"+f.lit(json.dumps(cmd))+'::jsonb)'
 def flags(global_on,note_on):db.sql('UPDATE sgp_lp_operacion.config SET escrituras='+str(global_on).lower()+';UPDATE sgp_lp_order_details.config SET writes='+str(note_on).lower())
 for global_on,note_on in [(False,False),(False,True),(True,False)]:
  flags(global_on,note_on);assert 'NOTE' not in read()['capabilities']
  r=db.run(query(command()));assert r.returncode and ('ESCRITURA_NO_HABILITADA' if not global_on else 'ORDER_NOTE_DISABLED') in r.stderr
  assert read()['note']['revision']==0
 flags(True,True);assert 'NOTE' in read()['capabilities'];cmd=command();assert json.loads(db.sql(query(cmd)))['revision']==1
 # The writer's shared admission lock must block a concurrent global shutdown.
 held=subprocess.Popen(db.docker+['exec','-i',db.container,'psql','-d',db.database,'-X','-qAt','-U','postgres','-v','ON_ERROR_STOP=1'],env=db.env,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,bufsize=1)
 held.stdin.write('BEGIN;'+query(command())+';\n');held.stdin.flush();assert json.loads(held.stdout.readline())['revision']==2
 for q in ['UPDATE sgp_lp_operacion.config SET escrituras=false','UPDATE sgp_lp_order_details.config SET writes=false']:
  r=db.run("SET lock_timeout='150ms';"+q);assert r.returncode and 'lock timeout' in r.stderr
 held.stdin.write('COMMIT;\\q\n');held.stdin.flush();held.wait(timeout=10)
 flags(False,True);assert 'NOTE' not in read()['capabilities'];r=db.run(query(cmd));assert r.returncode and 'ESCRITURA_NO_HABILITADA' in r.stderr
 flags(True,False);r=db.run(query(cmd));assert r.returncode and 'ORDER_NOTE_DISABLED' in r.stderr
 assert read()['note']['revision']==2
 out={'status':'PASS','scope':'Directed isolated PostgreSQL17.11 synthetic admission tests only','checks':['Three disabled flag combinations suppress NOTE and reject write without persistence','Both flags true permits note','Actual note transaction holds global and local flag locks; concurrent shutdown waits','After shutdown, reads remain available and even previously successful UUID retries are denied']}
 (Path(__file__).parent/'admission-result.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out))
finally:x.close()
