"""Isolated PostgREST + PostgreSQL Retail timeout verification, private inputs.
Usage as profile-opt-retail-sql-local.py; requires owned PostgreSQL container.
Creates only a local PostgREST companion sharing its network-none namespace.
"""
import json,runpy,subprocess,sys,time
from pathlib import Path
root=Path(__file__).resolve().parents[1]
s=runpy.run_path(str(root/'scripts/profile-opt-retail-sql-local.py'),init_globals={'PROFILE_PREPARE_ONLY':True})
c=s['container'];case=s['prepared'][0];db=case['db'];payload=case['payload'];companion=c+'-rest'
def sql(q):
 r=subprocess.run(['docker','exec','-i',c,'psql','-X','-U','postgres','-d',db,'-At','-v','ON_ERROR_STOP=1'],input=q,text=True,capture_output=True)
 assert r.returncode==0,r.stderr[-200:]
 return r.stdout.strip()
def http():
 body=json.dumps(payload).encode();request=b'POST /rpc/sgp_opt_importar_retail_validado_v3 HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nConnection: close\r\nContent-Length: '+str(len(body)).encode()+b'\r\n\r\n'+body
 start=time.monotonic();r=subprocess.run(['docker','exec','-i',c,'bash','-c','exec 3<>/dev/tcp/127.0.0.1/3000; cat >&3; cat <&3'],input=request,capture_output=True,timeout=8)
 assert r.returncode==0
 header,data=r.stdout.split(b'\r\n\r\n',1)
 if b'transfer-encoding: chunked' in header.lower():
  chunks=[]
  while data:
   line,data=data.split(b'\r\n',1);n=int(line.split(b';')[0],16)
   if not n:break
   chunks.append(data[:n]);data=data[n+2:]
  data=b''.join(chunks)
 return int(header.split()[1]),json.loads(data),round((time.monotonic()-start)*1000,3)
def counts():return sql('SELECT (SELECT count(*) FROM sgp_opt_shared.approvals),(SELECT count(*) FROM sgp_opt_shared.documents),(SELECT count(*) FROM sgp_opt_shared.pieces),(SELECT count(*) FROM sgp_opt_shared.document_plans),(SELECT count(*) FROM sgp_opt_shared.cuts);')
results={}
try:
 subprocess.run(['docker','run','--name',companion,'--network','container:'+c,'-e','PGRST_DB_URI=postgres://postgres@127.0.0.1:5432/'+db,'-e','PGRST_DB_ANON_ROLE=service_role','-e','PGRST_SERVER_HOST=127.0.0.1','-d','postgrest/postgrest:v12.2.12'],check=True,stdout=subprocess.DEVNULL)
 # Test-only delay occurs after manifest persistence, inside the same transaction.
 sql("CREATE FUNCTION public.timeout_test_delay() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN PERFORM pg_sleep(2);RETURN NEW;END$$; CREATE TRIGGER timeout_test_delay BEFORE INSERT ON sgp_opt_shared.document_plans FOR EACH ROW EXECUTE FUNCTION public.timeout_test_delay();")
 for _ in range(50):
  logs=subprocess.run(['docker','logs',companion],capture_output=True,text=True)
  if 'Schema cache loaded' in logs.stdout+logs.stderr:break
  time.sleep(.1)
 status,data,ms=http();assert data.get('code')=='57014',(status,data)
 assert counts()=='0|0|0|0|0',counts()
 # New transaction can obtain conflicting locks immediately: cancelled one is gone.
 sql('BEGIN;LOCK TABLE public.sgp_producciones,public.sgp_mecanizado_programacion,public.sgp_mecanizado_programacion_detalle,public.sgp_maestro_piezas IN ROW EXCLUSIVE MODE NOWAIT;ROLLBACK;')
 results['statementTimeout']={'status':status,'sqlstate':data['code'],'httpElapsedMs':ms,'counts':counts(),'locksReleased':True}
 sql('DROP TRIGGER timeout_test_delay ON sgp_opt_shared.document_plans;DROP FUNCTION public.timeout_test_delay();')
 status,data,ms=http();assert status==200 and data['ok'] is True
 results['normal']={'status':status,'httpElapsedMs':ms,'counts':counts()}
 # Advisory consecutive wait, before any new approval: function-local 250ms applies.
 opt=payload['p_sources'][0]['consecutivo'].replace("'","''")
 p=subprocess.Popen(['docker','exec','-i',c,'psql','-X','-U','postgres','-d',db,'-At'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
 p.stdin.write("SET application_name='retail_timeout_holder';BEGIN;SELECT pg_advisory_xact_lock(hashtextextended('"+opt+"',440));SELECT pg_sleep(2);ROLLBACK;\n");p.stdin.close()
 for _ in range(100):
  if sql("SELECT count(*) FROM pg_stat_activity WHERE application_name='retail_timeout_holder' AND wait_event='PgSleep';")=='1':break
 before=counts();status,data,ms=http();assert data.get('code')=='55P03',(status,data);assert counts()==before
 p.wait(timeout=5)
 results['lockTimeout']={'status':status,'sqlstate':data['code'],'httpElapsedMs':ms,'countsUnchanged':True}
 results['otherSessionSettings']=sql("SELECT current_setting('statement_timeout'),current_setting('lock_timeout');")
 assert results['otherSessionSettings']=='0|0'
 print(json.dumps({'engine':'PostgreSQL17.11','postgrest':'12.2.12','network':'none, companion shares database namespace','productionWrites':0,'statementTimeoutMs':1000,'lockTimeoutMs':250,'results':results,'limits':'Local exact RPC SQL with synthetic actor and private original payload. Test-only 2s delay after manifest insert proves rollback. Hosted PostgREST hoisting/config remains a preactivation check.'},indent=2))
finally:
 subprocess.run(['docker','rm','-f',companion],capture_output=True)
