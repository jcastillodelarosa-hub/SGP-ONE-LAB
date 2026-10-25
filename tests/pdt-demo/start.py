"""Local PDT demonstration: real QA RPCs, synthetic data, no production endpoints."""
import argparse,hashlib,http.server,json,pathlib,re,subprocess,sys,time,uuid
from urllib.parse import urlsplit
sys.dont_write_bytecode=True
ROOT=pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tests/sql/pdt'))
from installation_plan import render
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--port',type=int,default=8765)
args=parser.parse_args()
if not 1024<=args.port<=65535:parser.error('Choose a local unprivileged port')
QA='sgp-pdt-qa-91'
REST_IMAGE='postgrest/postgrest@sha256:729bf65c733b73f5b52777f0e4b853f22ed73aa67a22d38269d289779b0a8401'
def command(values,**kwargs):return subprocess.run(values,check=True,capture_output=True,**kwargs)
try:meta=json.loads(command(['docker','inspect',QA]).stdout)[0]
except subprocess.CalledProcessError:
 command(['docker','run','-d','--name',QA,'--network','none','--tmpfs','/var/lib/postgresql/data','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17.11'])
 meta=json.loads(command(['docker','inspect',QA]).stdout)[0]
if meta['HostConfig']['NetworkMode']!='none' or meta['HostConfig'].get('PortBindings'):
 raise SystemExit('STOP: QA must have network none and no published ports')
if not meta['State']['Running']:raise SystemExit('QA container stopped; start it explicitly before retrying')
for _ in range(50):
 if subprocess.run(['docker','exec',QA,'pg_isready','-U','postgres'],capture_output=True).returncode==0:break
 time.sleep(.2)
else:raise SystemExit('QA did not become ready')
version=command(['docker','exec',QA,'psql','-X','-qAt','-U','postgres','-c','SHOW server_version_num']).stdout.decode().strip()
if version!='170011':raise SystemExit('STOP: this demonstration requires PostgreSQL 17.11')
DB='sgp_pdt_qa_91_demo_'+str(time.time_ns())
command(['docker','exec',QA,'createdb','-U','postgres',DB])
def sql(text):
 r=command(['docker','exec','-i',QA,'psql','-X','-qAt','-U','postgres','-d',DB,'-v','ON_ERROR_STOP=1'],input=text,text=True)
 return r.stdout.strip()
source=ROOT/'scripts/pdt-compatibility/evidence'
a=json.loads((source/'PDT_FUNCIONES_REALES.json').read_text())
b=json.loads((source/'PDT_COMPLEMENTO_REAL.json').read_text())
refs={f['firma']:f['md5'] for f in b['referencias_ya_disponibles']}
functions=a['funciones']+b['funciones_faltantes']
for f in functions:
 if hashlib.md5(f['definicion'].replace('\r\n','\n').encode()).hexdigest()!=refs.get(f['firma'],f.get('md5')):raise SystemExit('STOP: evidence fingerprint differs')
base=(ROOT/'tests/sql/pdt/bootstrap.sql').read_text().split('CREATE FUNCTION public.sgp_validar_sesion_rol',1)[0]
columns=b['columnas_programacion']
for c in columns:
 if not re.fullmatch('[a-z_]+',c['nombre']) or not re.fullmatch('[a-z (),0-9]+',c['tipo']):raise SystemExit('Invalid fixture column')
program='CREATE TABLE public.sgp_mecanizado_programacion('+','.join('"'+c['nombre']+'" '+c['tipo']+(' NOT NULL' if c['not_null'] else '') for c in columns)+');'
base=re.sub(r'CREATE TABLE public\.sgp_mecanizado_programacion\([^;]+;',lambda _:program,base)
sql(base);sql((ROOT/'tests/sql/pdt/real-dependencies.sql').read_text())
for f in functions:sql(f['definicion'].replace('\r\n','\n')+';')
for t in b['triggers_programacion']:sql(t['definicion']+';')
sql('CREATE TRIGGER trg_sgp_picking_no_duplicar_completa BEFORE INSERT ON public.sgp_picking_entregas FOR EACH ROW EXECUTE FUNCTION public.sgp_picking_rechazar_entrega_completa_duplicada();')
sql(render('AB'));sql((ROOT/'tests/pdt-demo/seed.sql').read_text())
RPCS={'sgp_pdt_capacidades_v2','sgp_aluminio_pendientes_listar_v2','sgp_pdt_fuentes_v2','sgp_pdt_picking_v2',
 'sgp_aluminio_pendiente_validar_detalles_v1','sgp_aluminio_pendiente_registrar_avance_v1',
 'sgp_aluminio_pendiente_revertir_avance_v1','sgp_aluminio_pendiente_nc_vincular_v1',
 'sgp_pdt_estado_v2','sgp_pdt_entrega_registrar_v2','sgp_pdt_entrega_validar_v2',
 'sgp_pdt_asignar_v2','sgp_pdt_entrega_anular_v2','sgp_pdt_cerrar_v2','sgp_picking_validar_recepcion'}
REST='sgp-pdt-demo-rest-'+str(time.time_ns());REST_PORT=35000+time.time_ns()%10000
command(['docker','run','-d','--name',REST,'--network','container:'+QA,
 '-e','PGRST_DB_URI=postgresql://postgres@127.0.0.1:5432/'+DB,'-e','PGRST_DB_ANON_ROLE=anon',
 '-e','PGRST_DB_SCHEMAS=public','-e','PGRST_SERVER_HOST=127.0.0.1','-e','PGRST_SERVER_PORT='+str(REST_PORT),'-e','PGRST_DB_POOL=2',REST_IMAGE])
def rest(path,body=None):
 payload=b'' if body is None else json.dumps(body).encode()
 header=(('GET' if body is None else 'POST')+' '+path+' HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\nContent-Type: application/json\r\nContent-Length: '+str(len(payload))+'\r\n\r\n').encode()
 r=command(['docker','exec','-i',QA,'bash','-c','exec 3<>"/dev/tcp/127.0.0.1/$1"; cat >&3; cat <&3','qa-demo',str(REST_PORT)],input=header+payload,timeout=20)
 head,_,content=r.stdout.partition(b'\r\n\r\n');status=int(head.splitlines()[0].split()[1])
 if b'transfer-encoding: chunked' in head.lower():
  out=b''
  while content:
   size,_,content=content.partition(b'\r\n');n=int(size.split(b';')[0],16)
   if not n:break
   out+=content[:n];content=content[n+2:]
  content=out
 return status,content
STATIC={'/':'tests/pdt-demo/index.html','/demo.js':'tests/pdt-demo/demo.js','/demo.css':'tests/pdt-demo/demo.css','/styles.css':'styles.css',
 '/src/modules/pdt-v2-controller.js':'src/modules/pdt-v2-controller.js','/src/services/aluminum-pending-v2.js':'src/services/aluminum-pending-v2.js',
 '/src/domain/aluminum-pending-balances.js':'src/domain/aluminum-pending-balances.js'}
class Handler(http.server.BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def send(self,status,data,kind='application/json'):
  self.send_response(status);self.send_header('Content-Type',kind+'; charset=utf-8');self.send_header('Content-Length',str(len(data)))
  self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff')
  self.send_header('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'")
  self.end_headers();self.wfile.write(data)
 def allowed_host(self):return self.headers.get('Host') in {f'localhost:{args.port}',f'127.0.0.1:{args.port}'}
 def do_GET(self):
  if not self.allowed_host():return self.send(403,b'{}')
  path=urlsplit(self.path).path
  if path=='/api/demo-state':
   state=json.loads(sql("SELECT json_build_object('delivery',(SELECT to_jsonb(e) FROM sgp_picking_entregas e WHERE produccion='DEMO-B' LIMIT 1),'faltantes',(SELECT coalesce(json_agg(json_build_object('id_faltante',f.id_faltante,'id_pieza',f.id_pieza,'ventanas_afectadas',1)),'[]') FROM sgp_picking_faltantes f JOIN sgp_picking_entregas e USING(id_entrega) WHERE e.produccion='DEMO-B'),'other_open',(SELECT count(*) FROM sgp_aluminio_pendientes WHERE id_pieza='demo-other' AND estado='PENDIENTE'))"))
   return self.send(200,json.dumps(state).encode())
  if path not in STATIC:return self.send(404,b'{}')
  p=ROOT/STATIC[path];kind={'.html':'text/html','.js':'text/javascript','.css':'text/css'}[p.suffix]
  self.send(200,p.read_bytes(),kind)
 def do_POST(self):
  origin=self.headers.get('Origin');expected='http://'+self.headers.get('Host','')
  if not self.allowed_host() or origin not in (None,expected) or self.headers.get('Content-Type','').split(';')[0]!='application/json':return self.send(403,b'{}')
  name=self.path.removeprefix('/rpc/')
  if self.path!='/rpc/'+name or name not in RPCS:return self.send(404,b'{}')
  try:
   n=int(self.headers.get('Content-Length','0'))
   if not 0<n<=32768:return self.send(413,b'{}')
   body=json.loads(self.rfile.read(n))
   if not isinstance(body,dict):raise ValueError()
   status,content=rest('/rpc/'+name,body);self.send(status,content)
  except (ValueError,subprocess.SubprocessError):self.send(400,b'{"message":"Solicitud de demo rechazada"}')
try:
 for _ in range(40):
  try:
   if rest('/')[0]==200:break
  except (subprocess.SubprocessError,IndexError,ValueError):pass
  time.sleep(.2)
 else:raise SystemExit('PostgREST did not become ready')
 with http.server.ThreadingHTTPServer(('127.0.0.1',args.port),Handler) as server:
  print(json.dumps({'url':f'http://localhost:{args.port}','database':DB,'backend':'PostgreSQL 17.11 + PostgREST 12.2.3 QA','synthetic_only':True,'production_access':False}),flush=True)
  print('Ctrl+C stops this server and its PostgREST container; QA DB is preserved.',flush=True)
  server.serve_forever()
except KeyboardInterrupt:pass
finally:subprocess.run(['docker','stop',REST],capture_output=True)
