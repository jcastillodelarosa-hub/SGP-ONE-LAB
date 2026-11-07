"""Real browser + shared XLSX endpoint + actual SQL; no persistence stubs or production access."""
from database import PowerBIDatabase,ROOT,HERE,lit
import json,http.server,threading,subprocess,os,hashlib,urllib.request,urllib.error,base64
from pathlib import Path
from playwright.sync_api import sync_playwright
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
    page.locator('#productionPackingTab' if page.locator('[data-op-stage]').input_value()=='EMPAQUE' else '#productionAssemblyTab').click();page.wait_for_selector('[data-live-operate]',state='attached')
    open_assignment(page,part1);page.wait_for_selector('[data-executed]')
    page.locator('[data-executed]').fill('10');page.locator('[data-operation-note]').fill('QA acumulado de esta asignación');page.locator('[data-order-form] button[type=submit]').click();page.wait_for_function("document.querySelector('[data-op-status]').textContent.includes('Guardado confirmado')")
    page.locator('[data-bi-file]').set_input_files(str(HERE/'fixtures/ensamble.xlsx'));page.wait_for_function("document.querySelector('[data-close-status]').textContent.includes('otra etapa')")
    page.locator('[data-bi-file]').set_input_files(str(HERE/'fixtures/empaque.xlsx'));page.wait_for_selector('[data-import]')
    preview=page.locator('[data-bi-preview]').inner_text();assert 'Líder 27 · Power BI 31 · Diferencia 4' in preview
    drop={'next':True}
    def lose_reply(route):
     if drop['next']:
      response=route.fetch()
      if response.status==200:drop['next']=False;route.abort()
      else:route.fulfill(response=response)
     else:route.continue_()
    page.route('**/functions/v1/lp-powerbi',lose_reply)
    page.locator('[data-import]').click();page.wait_for_function("document.querySelector('[data-save-status]').textContent.includes('fetch')")
    assert db.sql("SELECT count(*) FROM sgp_lp_operacion.auditoria WHERE operacion='IMPORTAR_XLSX'")=='1'
    page.locator('[data-operation-pending-retry]').click();page.wait_for_function("document.querySelector('[data-op-status]').textContent.includes('Guardado confirmado')")
    assert db.sql("SELECT count(*) FROM sgp_lp_operacion.auditoria WHERE operacion='IMPORTAR_XLSX'")=='1'

    for field in page.locator('[data-close-reason]').all():field.fill('QA diferencia por producción contrastada')
    page.locator('[data-close-note]').fill('QA cierre XLSX por producción');page.locator('#productionOperationPanel').screenshot(path=str(OUT/f'reconciliation-{width}.png'))
    page.locator('[data-close]').click();page.wait_for_function("document.querySelector('[data-op-status]').textContent.includes('Guardado confirmado')")
    report=db.snapshot('EMPAQUE',date='2026-10-31')['reports'][0]['snapshot'];assert next(r for r in report['rows'] if r['key']==key)['ejecutado']==27
    page.locator('[data-stage-reports]').click();page.wait_for_selector('[data-report]',state='attached');page.locator('#productionReportsPanel details summary').click()
    with page.expect_download() as d:page.locator('[data-original]').click()
    d.value.save_as(OUT/f'original-{width}.xlsx');assert (OUT/f'original-{width}.xlsx').read_bytes()==(HERE/'fixtures/empaque.xlsx').read_bytes()
    page.locator('#productionReportsPanel').screenshot(path=str(OUT/f'report-{width}.png'))
    # Reopening and versioning are tested in actual PostgreSQL; UI prevents leader reopening.
    assert db.snapshot('ENSAMBLE',date='2026-10-31')['turn']['estado']=='ABIERTO'
    assert original_assignments==db.sql('SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM public.sgp_linea_plan_asignaciones a')
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');assert not errors,errors
    results.append({'viewport':width,'flow':'Browser→shared XLSX server parser→real PostgreSQL service RPC with SGP auth→grouped versioned closure','latest_sum':27,'stage':'EMPAQUE','power_bi':31,'difference':4,'assignments_preserved':True,'original_download_identical':True,'wrong_stage_rejected':True,'lost_reply_retried_once':True,'untrusted_origin_and_normalized_payload_rejected':'PASS' if width==1440 else 'NOT_REPEATED; server checks verified once at 1440','external_network':'blocked','page_errors':errors});page.close()
   except Exception:
    (OUT/f'failure-{width}.json').write_text(json.dumps({'operation':page.locator('#productionOperationPanel').inner_text(),'status':page.locator('[data-op-status]').inner_text(),'errors':errors},indent=2));raise
   finally:db.close()
  browser.close()
finally:
 node.terminate();node.wait(timeout=10);server.shutdown()
(OUT/'browser.json').write_text(json.dumps({'results':results,'limits':['Source XLSX layouts are anonymized derivatives of provided files, not production database records','Edge deployment, gateway, actual roles/assignments and productive matching not certified']},indent=2)+'\n');print(json.dumps(results,indent=2))
