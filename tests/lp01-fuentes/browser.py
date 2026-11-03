"""PC/mobile → current UI → actual captured SQL read RPC; synthetic sources only."""
from database import SourcesDatabase,HERE,ROOT,lit
from pathlib import Path
import json,http.server,threading,os
from playwright.sync_api import sync_playwright
OUT=HERE/'evidence';os.chdir(ROOT)
class Handler(http.server.SimpleHTTPRequestHandler):
 db=None
 def log_message(self,*a):pass
 def do_POST(self):
  try:
   if self.path!='/rpc':raise ValueError('Local RPC only')
   b=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
   if b['name'] not in ['sgp_lp_operacion_consultar']:raise ValueError('Read RPC only')
   result={'data':self.db.rpc(b['name'],b['args']),'error':None}
  except Exception as e:result={'data':None,'error':{'message':str(e),'code':'QA_READ_ERROR'}}
  raw=json.dumps(result).encode();self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(raw)
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start();base='http://127.0.0.1:'+str(server.server_port);results=[]
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,args=['--no-sandbox'])
  for width in [1440,390]:
   db=SourcesDatabase();Handler.db=db
   try:
    db.fixture();before=db.unchanged();part=db.parts[0]
    page=browser.new_page(viewport={'width':width,'height':950 if width>400 else 844});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.abort());page.goto(base+'/')
    page.evaluate('''()=>{document.querySelector('[data-view-panel="ensamble"]').hidden=false;window.qaToken='COORDINADOR';window.SGPPlannerBridge.getToken=()=>window.qaToken;window.SGPPlannerBridge.getClient=async()=>({rpc:async(name,args)=>(await fetch('/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,args})})).json()});}''')
    page.locator('#productionTrackingTab').click();page.wait_for_selector('[data-op-date]')
    page.locator('[data-op-date]').fill('2026-11-01');page.locator('[data-op-date]').dispatch_event('change')
    page.wait_for_selector('[data-order-part="'+part+'"]')
    for stage in ['ENSAMBLE','EMPAQUE']:
     page.locator('#productionTrackingTab').click();page.locator('[data-op-stage]').select_option(stage)
     page.wait_for_function("s=>document.querySelector('[data-op-status]').textContent.includes('ABIERTO') && document.querySelector('[data-live-orders]').textContent.includes(s)",arg=stage)
     details=page.locator('[data-order-part="'+part+'"]');details.locator('summary').click();details.locator('[data-live-operate]').click()
     page.wait_for_function("s=>document.querySelector('[data-operation-detail] h4').textContent.includes(s)",arg=stage)
     # Only a genuine zero could mean assembly complete. NULL must remain unknown.
     if stage=='EMPAQUE':assert 'completo según Export' not in page.locator('[data-live-orders]').inner_text()
     page.locator('[data-material-load]').click();page.wait_for_function("document.querySelector('[data-material-summary]').textContent.includes('por nombre')")
     text=page.locator('[data-material-summary]').inner_text();assert 'PDT 3 REF' not in text and 'No acredita asociación' in text and 'homónimas' in text
     assert 'SALE' in text and 'La fuente no informó' not in text
     page.locator('[data-operation-detail]').screenshot(path=str(OUT/f'{stage.lower()}-{width}.png'))
    assert before==db.unchanged()
    # Actual SQL authentication failure, no synthetic denial response.
    page.locator('#productionTrackingTab').click()
    detail=page.locator('[data-order-part="'+part+'"]');detail.wait_for()
    if detail.get_attribute('open') is None:detail.locator('summary').click()
    detail.locator('[data-live-operate]').click()
    db.sql("UPDATE public.sgp_sesiones_app SET expira_en=now()-interval '1 minute' WHERE token_hash=encode(extensions.digest('COORDINADOR','sha256'),'hex')")
    page.locator('[data-material-load]').click();page.wait_for_function("document.querySelector('[data-material-summary]').textContent.includes('SESION_NO_AUTORIZADA')")
    db.sql("UPDATE public.sgp_sesiones_app SET expira_en=now()+interval '1 day' WHERE token_hash=encode(extensions.digest('COORDINADOR','sha256'),'hex')")
    # Actual join produces two matching keys. Consumer must reject, not pick first.
    db.sql("INSERT INTO public.sgp_prioridades(anio,semana,id_linea,key_produccion,prioridad) VALUES(2026,44,'PANELES_2','QA|PANELES_2',1),(2026,44,'PANELES_2','QA|PANELES_2',2)")
    page.locator('#productionTrackingTab').click()
    detail=page.locator('[data-order-part="'+part+'"]');detail.wait_for()
    if detail.get_attribute('open') is None:detail.locator('summary').click()
    detail.locator('[data-live-operate]').click();page.locator('[data-material-load]').click()
    page.wait_for_function("document.querySelector('[data-material-summary]').textContent.includes('ambigua')")
    assert before==db.unchanged() and not errors,errors
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    results.append({'viewport':width,'stages':['ENSAMBLE','EMPAQUE'],'actual_sql_material_read':True,'server_scoped_snapshot_only':True,'homonymous_diagnostics_suppressed':True,'null_export_not_zero':True,'name_based_pdt_limit_visible':True,'invalid_session_denied':True,'duplicate_sql_identity_rejected':True,'production_plan_pdt_sale_audit_unchanged':True,'page_errors':errors});page.close()
   finally:db.close()
  browser.close()
finally:server.shutdown()
out={'status':'PASS','results':results,'scope':'Real current UI and captured read RPC/session functions in PG17.11, synthetic upstream relations; external network blocked. Not productive Supabase or plant verification.'}
(OUT/'browser.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
