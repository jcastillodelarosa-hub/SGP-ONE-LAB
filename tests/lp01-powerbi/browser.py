"""Real browser + shared XLSX endpoint + actual SQL; no persistence stubs or production access."""
from database import PowerBIDatabase,ROOT,HERE,lit
import json,http.server,threading,subprocess,os,hashlib,urllib.request,urllib.error,base64
from pathlib import Path
from playwright.sync_api import sync_playwright
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'lp01-b12-b13'))
from current_sheet import inspect_sheet
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'lp01-b12-b13'))
from navigation import open_assignment
OUT=HERE/'evidence';OUT.mkdir(exist_ok=True);os.chdir(ROOT)
class Handler(http.server.SimpleHTTPRequestHandler):
 db=None
 def log_message(self,*a):pass
 def do_POST(self):
  try:
   b=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
   if self.path=='/server-rpc' and b['name'] not in ['sgp_lp_operacion_importar_xlsx','sgp_sesion_actual']:raise ValueError('Server RPC not permitted')
   result={'data':self.db.rpc(b['name'],b['args']),'error':None}
  except Exception as e:result={'data':None,'error':{'code':'QA_SQL_ERROR','message':str(e)}}
  raw=json.dumps(result).encode();self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw)
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start();origin='http://127.0.0.1:'+str(server.server_port)
node=subprocess.Popen(['node',str(HERE/'server.mjs'),origin],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,cwd=ROOT);port=json.loads(node.stdout.readline())['port'];endpoint='http://127.0.0.1:'+str(port)+'/functions/v1/lp-powerbi'
results=[]
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,args=['--no-sandbox'])
  for width in [1440,390]:
   db=PowerBIDatabase();Handler.db=db
   try:
    model=db.models['EMPAQUE'];key=db.keys[model['records'][0]['production']];part1,part2=db.parts[(key,1)][:2]
    for part,n in [(part1,10),(part2,18)]:db.execute(db.cmd('SALE',stage='EMPAQUE',date='2026-10-31',key=key,part=part,quantity=n,observation='QA capacidad'))
    db.execute(db.cmd('EJECUTAR',stage='EMPAQUE',date='2026-10-31',key=key,part=part2,quantity=17,observation='QA último acumulado'),'LIDER')
    original_assignments=db.sql('SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM public.sgp_linea_plan_asignaciones a')
    if width==1440:
     def probe(body,origin_header=origin):
      req=urllib.request.Request(endpoint,data=json.dumps(body).encode(),headers={'Content-Type':'application/json','Origin':origin_header},method='POST')
      try:
       with urllib.request.urlopen(req) as result:return result.status
      except urllib.error.HTTPError as error:return error.code
     a=db.upload_args(stage='EMPAQUE');body={'p_token':'LIDER','command':a['p_contexto'],'filename':a['p_nombre'],'base64':a['p_base64']}
     assert probe(body,'https://unapproved.example')==403
     assert probe({**body,'document':a['p_documento']})==422
     assert probe({**body,'p_token':'invalid'})==401
     raw=bytearray(base64.b64decode(body['base64']));raw[100]^=255
     assert probe({**body,'base64':base64.b64encode(raw).decode()})==422
     assert db.sql("SELECT count(*) FROM sgp_lp_operacion.auditoria WHERE operacion='IMPORTAR_XLSX'")=='0'

    page=browser.new_page(viewport={'width':width,'height':950 if width>400 else 844});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.route('**/*',lambda r:r.continue_() if r.request.url.startswith('http://127.0.0.1:') else r.abort());page.goto(origin+'/')
    page.evaluate('''({endpoint})=>{
     document.querySelector('[data-view-panel="ensamble"]').hidden=false;
     window.SGP_CONFIG={...window.SGP_CONFIG,lpPowerBiUrl:endpoint};window.qaRole='LIDER';window.calls=[];
     window.SGPPlannerBridge.getToken=()=>window.qaRole;
     window.SGPPlannerBridge.getClient=async()=>({rpc:async(name,args)=>{window.calls.push({name,args});return(await fetch('/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,args})})).json();}});
     document.querySelector('[data-op-date]').value='2026-10-31';document.querySelector('[data-op-stage]').value='EMPAQUE';
    }''',{'endpoint':endpoint})
    audit=db.sql('SELECT count(*) FROM sgp_lp_operacion.auditoria')
    page.locator('#productionPackingTab').click();inspect_sheet(page,detail=True)
    assert db.sql('SELECT count(*) FROM sgp_lp_operacion.auditoria')==audit
    assert db.snapshot('EMPAQUE',date='2026-10-31')['turn']['estado']=='ABIERTO'
    assert original_assignments==db.sql('SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM public.sgp_linea_plan_asignaciones a')
    assert not errors,errors
    page.screenshot(path=str(OUT/f'packing-contained-{width}.png'))
    results.append({'viewport':width,'flow':'Current packing sheet; legacy import/close absent','read_only_audit':True,'assignments_preserved':True,'endpoint_admission_probes':'PASS' if width==1440 else 'verified at 1440','legacy_write_contract_coverage':'postgres.py and shared handler tests, not current UI','page_errors':errors});page.close()
   except Exception:
    (OUT/f'failure-{width}.json').write_text(json.dumps({'operation':page.locator('#productionOperationPanel').inner_text(),'status':page.locator('[data-op-status]').inner_text(),'errors':errors},indent=2));raise
   finally:db.close()
  browser.close()
finally:
 node.terminate();node.wait(timeout=10);server.shutdown()
(OUT/'browser.json').write_text(json.dumps({'results':results,'limits':['Source XLSX layouts are anonymized derivatives of provided files, not production database records','Edge deployment, gateway, actual roles/assignments and productive matching not certified']},indent=2)+'\n');print(json.dumps(results,indent=2))
