"""PC/mobile → current UI → actual captured SQL read RPC; synthetic sources only."""
from database import SourcesDatabase,HERE,ROOT,lit
from pathlib import Path
import json,http.server,threading,os
from playwright.sync_api import sync_playwright
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'lp01-b12-b13'))
from current_sheet import inspect_sheet,RETIRED
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
    page.locator('#productionPackingTab').click();page.wait_for_selector('[data-op-date]')
    page.locator('[data-op-date]').fill('2026-11-01');page.locator('[data-op-date]').dispatch_event('change')
    page.wait_for_selector('[data-assembly-key]')
    for stage in ['ENSAMBLE','EMPAQUE']:
     page.locator('#productionPackingTab' if stage=='EMPAQUE' else '#productionAssemblyTab').click()
     inspect_sheet(page,stage)
     page.locator('button[data-assembly-detail]').first.click();page.wait_for_selector('section[data-assembly-detail]')
     pane=page.locator('section[data-assembly-detail]')
     assert pane.locator('[data-assembly-balance]').inner_text()==('Pendiente' if stage=='ENSAMBLE' else '288')
     pane.locator('.lp-assembly-materials summary').click();text=pane.locator('.lp-assembly-materials').inner_text()
     assert 'PDT 3 REF' not in text and 'homónimas' in text and 'no libera ventanas' in text
     assert page.locator(RETIRED).count()==0
     pane.screenshot(path=str(OUT/f'{stage.lower()}-{width}.png'))
    assert before==db.unchanged()
    # Refresh through the actual current route; PostgreSQL rejects the expired session.
    db.sql("UPDATE public.sgp_sesiones_app SET expira_en=now()-interval '1 minute' WHERE token_hash=encode(extensions.digest('COORDINADOR','sha256'),'hex')")
    page.locator('#productionPackingTab').click();page.wait_for_function("document.querySelector('[data-op-status]').textContent.includes('SESION_NO_AUTORIZADA')")
    assert page.locator('section[data-assembly-detail]').count()==0
    db.sql("UPDATE public.sgp_sesiones_app SET expira_en=now()+interval '1 day' WHERE token_hash=encode(extensions.digest('COORDINADOR','sha256'),'hex')")
    # Duplicate source identity must remain uncredited in the shared materials detail.
    db.sql("INSERT INTO public.sgp_prioridades(anio,semana,id_linea,key_produccion,prioridad) VALUES(2026,44,'PANELES_2','QA|PANELES_2',1),(2026,44,'PANELES_2','QA|PANELES_2',2)")
    page.locator('#productionPackingTab').click();page.wait_for_selector('[data-assembly-key]');page.locator('button[data-assembly-detail]').first.click();page.wait_for_selector('section[data-assembly-detail]')
    material=page.locator('.lp-assembly-materials');material.locator('summary').click()
    text=material.text_content()
    assert 'PDT 3 REF' not in text and 'Sin fuente acreditada para esta producción' in text and 'no libera ventanas' in text,text
    assert before==db.unchanged() and not errors,errors
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    results.append({'viewport':width,'stages':['ENSAMBLE','EMPAQUE'],'current_shared_material_detail':True,'homonymous_diagnostics_suppressed':True,'null_export_not_zero':True,'invalid_session_denied':True,'duplicate_sql_identity_uncredited':True,'production_plan_pdt_sale_audit_unchanged':True,'page_errors':errors});page.close()
   finally:db.close()
  browser.close()
finally:server.shutdown()
out={'status':'PASS','results':results,'scope':'Real current UI and captured read RPC/session functions in PG17.11, synthetic upstream relations; external network blocked. Not productive Supabase or plant verification.'}
(OUT/'browser.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
