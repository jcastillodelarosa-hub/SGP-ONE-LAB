from pathlib import Path
import sys,json,uuid,subprocess,http.server,threading,re
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'tests/lp01-operacion'))
from postgres import Database,lit
HERE=Path(__file__).parent
if __name__=='__main__':
 db=Database();server=None;session=None
 try:
  key='QA|PANELES_2';db.seed(key,parts=(1,));old=str(uuid.uuid4());new=str(uuid.uuid4())
  db.sql('''CREATE TABLE public.sgp_cargas_diarias(id_carga_diaria uuid,tipo_fuente text,id_linea text);
CREATE TABLE public.sgp_export_diario_historial(registro_id bigint,id_carga_diaria uuid,key_produccion text,id_linea text,presente boolean,saldo_ensamble numeric,saldo_empaque numeric);''')
  db.sql("INSERT INTO public.sgp_cargas_diarias VALUES("+lit(old)+",'EXPORT','PANELES_2');INSERT INTO public.sgp_export_diario_historial VALUES(1,"+lit(old)+','+lit(key)+",'PANELES_2',true,248,248);UPDATE public.sgp_producciones SET saldo_ensamble=248,saldo_empaque=248,ultima_carga_diaria="+lit(old)+' WHERE key_produccion='+lit(key))
  session=subprocess.Popen(db.docker+['exec','-i',db.container,'psql','-X','-qAt','-U','postgres','-v','ON_ERROR_STOP=1'],env=db.env,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,bufsize=1)
  class H(http.server.BaseHTTPRequestHandler):
   reads=0
   def log_message(self,*a):pass
   def do_POST(self):
    b=json.loads(self.rfile.read(int(self.headers['content-length'])));q=b['sql'];select=q.startswith('SELECT')
    for i,v in enumerate(b.get('params') or [],1):q=q.replace('$'+str(i),lit(v))
    if select:q="SELECT coalesce(jsonb_agg(to_jsonb(q)), '[]'::jsonb) FROM ("+q+') q'
    else:assert q in ['BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY','COMMIT','ROLLBACK']
    session.stdin.write(q+";SELECT 'END_RESULT';\n");session.stdin.flush();result=[]
    while True:
     line=session.stdout.readline().strip()
     if line=='END_RESULT':break
     if line:result=json.loads(line)
    if select:
     H.reads+=1
     if H.reads==1:db.sql("INSERT INTO public.sgp_cargas_diarias VALUES("+lit(new)+",'EXPORT','PANELES_2');INSERT INTO public.sgp_export_diario_historial VALUES(2,"+lit(new)+','+lit(key)+",'PANELES_2',true,200,200);UPDATE public.sgp_producciones SET saldo_ensamble=200,saldo_empaque=200,ultima_carga_diaria="+lit(new)+' WHERE key_produccion='+lit(key))
    raw=json.dumps({'rows':result}).encode();self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(raw)
  server=http.server.ThreadingHTTPServer(('127.0.0.1',0),H);threading.Thread(target=server.serve_forever,daemon=True).start()
  r=subprocess.run(['node',str(HERE/'run.mjs'),'http://127.0.0.1:'+str(server.server_port),key,old],capture_output=True,text=True,check=True,timeout=30);v=json.loads(r.stdout)
  assert v['first']['observed']['cut']==old and v['first']['apply'] is False
  assert v['next']['observed']['cut']==new and v['next']['reason']=='stale_cut'
  assert db.sql('SELECT saldo_empaque FROM public.sgp_producciones WHERE key_produccion='+lit(key))=='200' # only the synthetic concurrent writer changes this value
  out={'status':'PASS','checks':['Actual JavaScript reader executes real repeatable-read/read-only PostgreSQL transaction','Concurrent synthetic load commits after first SELECT; observed old cut remains coherent','Next transaction sees new cut and rejects expected old cut','No source manifest produced, no budget or SALE mutation'],'scope':'New isolated PG17.11; synthetic production/load/history, actual reader SQL; HTTP adapter only transports SQL to persistent QA connection, no business result stubs'}
  (HERE/'evidence/postgres.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
 finally:
  if server:server.shutdown()
  if session:
   session.stdin.write('\\q\n');session.stdin.flush();session.wait(timeout=5)
  db.close()
