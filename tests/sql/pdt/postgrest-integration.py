"""HTTP overload/security checks against a network-isolated QA DB; no production URI."""
import json,subprocess,sys,time,uuid,re,pathlib
sys.dont_write_bytecode=True
from real_fixture_adapter import adapt_program_inserts
if len(sys.argv)!=2 or not re.fullmatch(r'sgp_pdt_qa_91_[A-Za-z0-9_]+',sys.argv[1]):raise SystemExit('QA database required')
database=sys.argv[1];qa='sgp-pdt-qa-91'
meta=json.loads(subprocess.check_output(['docker','inspect',qa]))[0]
if meta['HostConfig']['NetworkMode']!='none' or meta['HostConfig'].get('PortBindings'):raise SystemExit('Not isolated')
port=35000+time.time_ns()%10000;container='sgp-pdt-rest-'+str(time.time_ns())
image='postgrest/postgrest@sha256:729bf65c733b73f5b52777f0e4b853f22ed73aa67a22d38269d289779b0a8401'
subprocess.run(['docker','run','-d','--name',container,'--network','container:'+qa,
 '-e','PGRST_DB_URI=postgresql://postgres@127.0.0.1:5432/'+database,
 '-e','PGRST_DB_ANON_ROLE=anon','-e','PGRST_DB_SCHEMAS=public','-e','PGRST_SERVER_HOST=127.0.0.1',
 '-e','PGRST_SERVER_PORT='+str(port),'-e','PGRST_DB_POOL=2',image],check=True,capture_output=True)
def sql(statement):
 r=subprocess.run(['docker','exec','-i',qa,'psql','-X','-qAt','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1'],input=statement,text=True,capture_output=True)
 if r.returncode:raise AssertionError(r.stderr)
 return r.stdout.strip()
def request(path,payload=None):
 body=b'' if payload is None else json.dumps(payload).encode()
 headers=(('GET' if payload is None else 'POST')+' '+path+' HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\nContent-Type: application/json\r\nContent-Length: '+str(len(body))+'\r\n\r\n').encode()
 r=subprocess.run(['docker','exec','-i',qa,'bash','-c','exec 3<>"/dev/tcp/127.0.0.1/$1"; cat >&3; cat <&3','qa-http',str(port)],input=headers+body,capture_output=True,timeout=15)
 if r.returncode:raise ConnectionError('QA HTTP not ready')
 head,sep,content=r.stdout.partition(b'\r\n\r\n')
 if not sep:raise ConnectionError('No QA HTTP response')
 status=int(head.splitlines()[0].split()[1])
 if b'transfer-encoding: chunked' in head.lower():
  decoded=b''
  while content:
   size,_,content=content.partition(b'\r\n');n=int(size.split(b';')[0],16)
   if not n:break
   decoded+=content[:n];content=content[n+2:]
  content=decoded
 return status,json.loads(content) if content else None
checks=[]
try:
 for attempt in range(30):
  try:
   status,_=request('/')
   if status==200:break
  except ConnectionError:pass
  time.sleep(.3)
 else:raise AssertionError('PostgREST not ready')
 program=str(uuid.uuid4());sql(adapt_program_inserts("INSERT INTO sgp_mecanizado_programacion VALUES('%s','QA-RES','QA-SYSTEM','DS')"%program))
 six={'p_token':'PICKING','p_id_programacion':program,'p_produccion':'REST-SIX','p_completa':True,'p_observacion':None,'p_faltantes':[]}
 status,data=request('/rpc/sgp_picking_entrega_orden',six);assert status==200 and data['ok'],(status,data)
 checks.append('HTTP six-argument named RPC resolves')
 eight={**six,'p_produccion':'REST-EIGHT','p_fecha_entrega':'2026-10-25','p_turno':'TURNO 1'}
 status,data=request('/rpc/sgp_picking_entrega_orden',eight);assert status==200 and data.get('turno')=='TURNO 1',(status,data)
 checks.append('HTTP eight-argument named RPC resolves')
 event=data['id_entrega'];status,data=request('/rpc/sgp_picking_validar_recepcion',{'p_token':'RECEPCION','p_id_entrega':event,'p_faltantes':[],'p_diferencias':[],'p_observacion':None})
 assert status==200 and data['estado']=='VALIDADA',(status,data);checks.append('HTTP real Reception audit works')
 detail=sql("SELECT id_detalle FROM sgp_aluminio_pendiente_detalles WHERE id_pendiente='00000000-0000-0000-0000-000000000001' AND fabricacion='E17'")
 args={'p_token':'RECEPCION','p_id':'00000000-0000-0000-0000-000000000001','p_id_detalle':detail,'p_cantidad':1,'p_turno':'T1','p_fecha_operativa':'2026-10-25','p_idempotency_key':str(uuid.uuid4()),'p_observacion':None}
 status,data=request('/rpc/sgp_aluminio_pendiente_registrar_avance_v1',args)
 assert status==400 and data.get('message')=='PDT_ROL_REAL_NO_AUTORIZADO',(status,data);checks.append('HTTP Reception machining denied')
 args.update(p_token='COORDINADOR',p_idempotency_key=str(uuid.uuid4()))
 status,data=request('/rpc/sgp_aluminio_pendiente_registrar_avance_v1',args);assert status==200 and data['ok'],(status,data);checks.append('HTTP Coordinator advance retained')
 before=sql('SELECT count(*) FROM sgp_aluminio_pendiente_detalles')
 status,data=request('/sgp_aluminio_pendiente_detalles',{'id_pendiente':args['p_id'],'fabricacion':'UNAUTHORIZED','longitud':1,'acabado':'DS','cantidad_validada':1,'creado_por':'UNAUTHORIZED'})
 assert status in (401,403,404),(status,data)
 assert sql('SELECT count(*) FROM sgp_aluminio_pendiente_detalles')==before
 checks.append('HTTP direct table write denied without mutation')
 print(json.dumps({'database':database,'postgrest':'12.2.3','network':'shared QA loopback only','checks':checks,'production_access':False},indent=2))
finally:
 subprocess.run(['docker','stop',container],capture_output=True,check=False)
