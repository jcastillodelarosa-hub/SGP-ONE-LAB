"""Actual PC/mobile operation → local transport → actual PG; no business or write stubs."""
from pathlib import Path
import sys,json,http.server,threading,os,importlib.util
from playwright.sync_api import sync_playwright
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'lp01-b12-b13'))
from current_sheet import inspect_sheet
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1]
spec=importlib.util.spec_from_file_location('continuity_checks',HERE/'postgres.py');checks=importlib.util.module_from_spec(spec);spec.loader.exec_module(checks)
Database=checks.Database;lit=checks.lit
OUT=HERE/'evidence';OUT.mkdir(exist_ok=True)
class Handler(http.server.SimpleHTTPRequestHandler):
 db=None
 def log_message(self,*args):pass
 def do_POST(self):
  try:
   body=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
   if self.path!='/rpc':raise ValueError('Only isolated transport permitted')
   value={'data':self.db.rpc(body['name'],body['args']),'error':None}
  except Exception as e:value={'data':None,'error':{'message':str(e),'code':'QA_RPC_REJECTED'}}
  raw=json.dumps(value).encode();self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(raw)
os.chdir(ROOT);server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start();origin='http://127.0.0.1:'+str(server.server_port)
results=[]
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,args=['--no-sandbox'])
  for width in [1440,390]:
   db=Database();Handler.db=db
   try:
    key='QA-SINGLE|PANELES_2';part=db.seed(key,parts=(20,))[0];multi='QA-MULTI|PANELES_2';parts=db.seed(multi,parts=(10,10))
    db.sql("UPDATE public.sgp_producciones SET produccion=CASE WHEN key_produccion="+lit(key)+" THEN 'QA Orden individual' ELSE 'QA Reparto pendiente' END;")
    planning=db.sql('SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM public.sgp_linea_plan_asignaciones a');official=db.sql('SELECT jsonb_agg(to_jsonb(a) ORDER BY key_produccion) FROM public.sgp_producciones a')
    page=browser.new_page(viewport={'width':width,'height':950 if width>400 else 844});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(origin) else r.abort());page.goto(origin+'/')
    page.evaluate('''()=>{
     document.querySelector('[data-view-panel="ensamble"]').hidden=false;
     window.SGPPlannerBridge.getToken=()=> 'COORDINADOR';
     window.SGPPlannerBridge.getClient=async()=>({rpc:async(name,args)=>(await fetch('/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,args})})).json()});
    }''')
    audit=db.sql('SELECT count(*) FROM sgp_lp_operacion.auditoria');turns=db.sql('SELECT count(*) FROM sgp_lp_operacion.turnos')
    page.evaluate("document.querySelector('[data-op-date]').value='2026-11-01'")
    page.locator('#productionPackingTab').click();inspect_sheet(page)
    page.locator('[data-op-shift]').select_option('2');page.wait_for_function("document.querySelector('[data-op-status]').textContent.includes('NO_ABIERTO')")
    inspect_sheet(page)
    assert audit==db.sql('SELECT count(*) FROM sgp_lp_operacion.auditoria') and turns==db.sql('SELECT count(*) FROM sgp_lp_operacion.turnos')
    assert planning==db.sql('SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM public.sgp_linea_plan_asignaciones a')
    assert official==db.sql('SELECT jsonb_agg(to_jsonb(a) ORDER BY key_produccion) FROM public.sgp_producciones a')
    assert not errors,errors
    page.screenshot(path=str(OUT/f'packing-contained-{width}.png'))
    results.append({'viewport':width,'current_packing_navigation':True,'manual_actions_absent':True,'turns_and_audit_unchanged':True,'planning_and_export_unchanged':True,'legacy_write_contract_coverage':'postgres.py unchanged','page_errors':errors});page.close()
   finally:db.close()
  browser.close()
finally:server.shutdown()
(OUT/'browser.json').write_text(json.dumps({'status':'PASS','results':results,'limits':['Captured actual session function, synthetic identities/config/planning','QA CSV only for closure setup; Power BI unchanged and checked by its affected regression','No deployment, real users or plant operations verified']},indent=2)+'\n');print(json.dumps(results,indent=2))
