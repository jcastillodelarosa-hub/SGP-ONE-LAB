"""Real isolated PostgreSQL, synthetic fixture only. Never connects to Supabase."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import sys,json,uuid,subprocess
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'tests/lp01-afectaciones-rpc'));import atomic as f
x=f.Fixture();checks=[]
try:
 db=x.db
 sql=(ROOT/'docs/sql-proposals/lp01-order-details/01_definition_REVIEW.sql').read_text()
 failed=db.run(sql.replace('COMMIT;','SELECT 1/0;COMMIT;'));assert failed.returncode and db.sql("SELECT to_regnamespace('sgp_lp_order_details') IS NULL")=='t'
 db.sql(sql)
 assert db.run(sql).returncode
 signatures=['public.sgp_lp_order_details_read_v1(text,text,text)','public.sgp_lp_order_note_save_v1(text,text,text,jsonb)']
 for role in ['anon','authenticated','service_role']:
  for sig in signatures:assert db.sql('SELECT has_function_privilege('+f.lit(role)+','+f.lit(sig)+",'EXECUTE')")=='f'
 db.sql('GRANT EXECUTE ON FUNCTION '+','.join(signatures)+' TO anon') # synthetic only
 def read(user='COORDINADOR',stage='ENSAMBLE',key=x.key):return json.loads(db.sql('SET ROLE anon;SELECT public.sgp_lp_order_details_read_v1('+','.join(map(f.lit,[user,key,stage]))+')'))
 def command(text='Observación de la orden'):
  return dict(id=str(uuid.uuid4()),revision=read()['note']['revision'],observation=text)
 def query(c,user='COORDINADOR',stage='ENSAMBLE',key=x.key):return 'SET ROLE anon;SELECT public.sgp_lp_order_note_save_v1('+','.join(map(f.lit,[user,key,stage]))+','+f.lit(json.dumps(c))+'::jsonb)'
 def save(c,**kw):return json.loads(db.sql(query(c,**kw)))
 def deny(c,reason,**kw):
  r=db.run(query(c,**kw));assert r.returncode and reason in r.stderr,(reason,r.stderr)
 assert read()['note']['revision']==0 and read()['note']['observation']=='' and read()['history']==[]
 assert read()['export']['quantity'] is None and read()['export']['percentage'] is None
 deny(command(),'ORDER_NOTE_DISABLED')
 checks.append('Transactional install rollback; reinstallation rejected; no default API/private grants; explicit disabled capability')
 db.sql('UPDATE sgp_lp_order_details.config SET writes=true')
 before=db.sql('SELECT jsonb_agg(to_jsonb(o) ORDER BY parte) FROM sgp_lp_operacion.ordenes o')
 c=command();first=save(c);assert save(c)['duplicate'];assert read()['note']['revision']==1
 assert read(stage='EMPAQUE')['note']==read()['note']
 assert read(stage='EMPAQUE')['history']==read()['history']
 deny({**c,'observation':'changed'},'ORDER_NOTE_IDEMPOTENCY_REUSED')
 deny({**c,'id':str(uuid.uuid4())},'ORDER_NOTE_REVISION_STALE')
 save(command('Nota líder'),user='ll');assert read()['note']['actor']=='ll'
 for user in ['invalid','CONSULTA','sp']:
  assert db.run(query(command(),user=user)).returncode
 assert db.run(query(command(),key='QA|FRAMES_2')).returncode
 assert db.run(query(command(),stage='CORTE')).returncode
 for bad in [None,7,{},['note'],'x'*2001]:deny({**command(),'observation':bad},'ORDER_NOTE_COMMAND_INVALID')
 deny({**command(),'revision':None},'ORDER_NOTE_COMMAND_INVALID')
 deny({**command(),'unexpected':True},'ORDER_NOTE_COMMAND_INVALID')
 assert db.run(query({**command(),'id':'not-uuid'})).returncode
 save(command(''));assert read()['note']['observation']=='' # deliberate clear audited
 checks.append('One canonical production note shared across stages; leader/coordinator existing NOTA permissions; wrong scope/role/inputs rejected; deliberate clear audited; original per-turn notes preserved')
 same=command('exact retry')
 with ThreadPoolExecutor(2) as pool:results=list(pool.map(lambda _:save(same),range(2)))
 assert sorted(r['duplicate'] for r in results)==[False,True]
 races=[command('writer A'),command('writer B')]
 with ThreadPoolExecutor(2) as pool:results=list(pool.map(lambda c:db.run(query(c)),races))
 assert sorted(r.returncode==0 for r in results)==[False,True] and any('ORDER_NOTE_REVISION_STALE' in r.stderr for r in results)
 last=read();assert last['note']['revision']==len(last['history'])
 for role in ['anon','authenticated','service_role']:
  assert db.run('SET ROLE '+role+'; SELECT * FROM sgp_lp_order_details.notes').returncode
 assert db.run("UPDATE sgp_lp_order_details.events SET observation='rewrite'").returncode
 assert db.run('DELETE FROM sgp_lp_order_details.events').returncode
 db.sql("CREATE FUNCTION public.qa_note_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'QA_FAIL';END $$; CREATE TRIGGER qa_fail BEFORE INSERT ON sgp_lp_order_details.events FOR EACH ROW EXECUTE FUNCTION public.qa_note_fail()")
 deny(command('rolled back'),'QA_FAIL');assert read()==last
 db.sql('DROP TRIGGER qa_fail ON sgp_lp_order_details.events;DROP FUNCTION public.qa_note_fail()')
 assert db.sql('SELECT jsonb_agg(to_jsonb(o) ORDER BY parte) FROM sgp_lp_operacion.ordenes o')==before
 checks.append('Concurrent CAS: exactly one editor wins; same UUID replay commits once; immutable audit; late failure rolls back note; independent connection reread persists')
 db.sql('ALTER TABLE public.sgp_producciones ADD COLUMN IF NOT EXISTS cantidad numeric, ADD COLUMN IF NOT EXISTS porc_vidrio numeric')
 for q,p in [(60,80),(3,50),(1,1),(None,None),(-1,101),(1,'NaN')]:
  def value(v):return 'NULL' if v is None else f.lit(str(v))+'::numeric'
  db.sql('UPDATE public.sgp_producciones SET cantidad='+value(q)+',porc_vidrio='+value(p)+' WHERE key_produccion='+f.lit(x.key))
  e=read()['export'];assert e['quantity']==(None if q is None else str(q)) and e['percentage']==(None if p is None else str(p))
 checks.append('Export read preserves exact numeric text including null/invalid inputs for explicit client rejection; no percentage heuristic or production writes')
 # Hold an actual successful note transaction; concurrent revocation must wait.
 held=subprocess.Popen(db.docker+['exec','-i',db.container,'psql','-d',db.database,'-X','-qAt','-U','postgres','-v','ON_ERROR_STOP=1'],env=db.env,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,bufsize=1)
 held.stdin.write('BEGIN;'+query(command('Held transaction'))+';\n');held.stdin.flush();line=held.stdout.readline();assert line.strip(),held.stderr.read();assert json.loads(line)['contract']=='LP-ORDER-NOTE-SAVED-1'
 for q in ["UPDATE public.sgp_usuarios SET activo=false WHERE usuario='COORDINADOR'", "UPDATE public.sgp_sesiones_app SET revocado_en=clock_timestamp() WHERE token_hash=encode(extensions.digest('COORDINADOR','sha256'),'hex')"]:
  denied=db.run("SET lock_timeout='150ms';"+q);assert denied.returncode and 'lock timeout' in denied.stderr
 held.stdin.write('COMMIT;\\q\n');held.stdin.flush();held.wait(timeout=10)
 checks.append('Actual note transaction serializes with concurrent account/session revocation through existing catalog/session locks')
 db.sql("UPDATE public.sgp_usuario_accesos SET permitido=false WHERE id_usuario=(SELECT id_usuario FROM public.sgp_usuarios WHERE usuario='COORDINADOR')")
 assert db.run(query(same)).returncode
 assert db.run("SET ROLE anon;SELECT public.sgp_lp_order_details_read_v1('COORDINADOR','QA|PANELES_2','ENSAMBLE')").returncode
 checks.append('Revoked access denies new read and retry of an already committed request')
 out={'status':'PASS','scope':'PostgreSQL 17.11 network none; actual captured SGP auth and synthetic rows; no productive session','checks':checks}
 (Path(__file__).parent/'result.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out))
finally:x.close()
