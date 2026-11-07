"""Visible coordinator plan and actual manual fallback; NOT an automatic executor test."""
from pathlib import Path
import sys,json,os,http.server,threading,importlib.util
from playwright.sync_api import sync_playwright
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1]
spec=importlib.util.spec_from_file_location('auto_helpers',HERE/'postgres.py');h=importlib.util.module_from_spec(spec);spec.loader.exec_module(h)
Database=h.Database
OUT=HERE/'evidence';OUT.mkdir(exist_ok=True)
class Handler(http.server.SimpleHTTPRequestHandler):
 db=None
 def log_message(self,*args):pass
 def do_POST(self):
  try:
   b=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
   if self.path!='/rpc':raise ValueError('Local test RPC only')
   value={'data':self.db.rpc(b['name'],b['args']),'error':None}
  except Exception as e:value={'data':None,'error':{'message':str(e),'code':'QA_RPC_REJECTED'}}
  raw=json.dumps(value).encode();self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(raw)
os.chdir(ROOT);server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start();origin='http://127.0.0.1:'+str(server.server_port);results=[]
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,args=['--no-sandbox'])
  for width in [1440,390]:
   db=Database();Handler.db=db
   try:
    db.seed('QA-FUTURE|PANELES_2',parts=(20,),date='2026-11-04')
    official=db.sql('SELECT jsonb_agg(to_jsonb(x)) FROM public.sgp_producciones x');planning=db.sql('SELECT jsonb_agg(to_jsonb(x)) FROM public.sgp_linea_plan_asignaciones x')
    page=browser.new_page(viewport={'width':width,'height':950 if width>400 else 844});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(origin) else r.abort());page.goto(origin+'/')
    page.evaluate('''()=>{document.querySelector('[data-view-panel="ensamble"]').hidden=false;window.SGPPlannerBridge.getToken=()=> 'COORDINADOR';window.SGPPlannerBridge.getClient=async()=>({rpc:async(name,args)=>(await fetch('/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,args})})).json()});}''')
    page.locator('#productionPackingTab').click();page.wait_for_selector('[data-op-date]');page.locator('[data-op-date]').fill('2026-11-01');page.locator('[data-op-date]').dispatch_event('change')
    page.wait_for_function("document.querySelector('[data-op-status]').textContent.includes('NO_ABIERTO')")
    assert 'El inicio por horario está aprobado; falta activar el motor automático seguro.' in page.locator('[data-auto-opening]').inner_text()
    page.locator('[data-open]').click();page.wait_for_function("document.querySelector('[data-op-status]').textContent.includes('Guardado confirmado')")
    assert all(text in page.locator('[data-auto-opening]').inner_text() for text in ['aunque el anterior siga pendiente', 'El motor anterior todavía requiere actualización', 'no se cerrará el anterior automáticamente'])
    audit=db.sql('SELECT count(*) FROM sgp_lp_operacion.auditoria');turns=db.sql('SELECT count(*) FROM sgp_lp_operacion.turnos')
    for _ in range(2):
     page.locator('[data-op-load]').click();page.wait_for_function("document.querySelector('[data-op-status]').textContent.includes('Turno ABIERTO')")
    assert audit==db.sql('SELECT count(*) FROM sgp_lp_operacion.auditoria') and turns==db.sql('SELECT count(*) FROM sgp_lp_operacion.turnos')
    page.locator('#productionTrackingPanel').screenshot(path=str(OUT/f'previous-open-block-{width}.png'))
    page.locator('[data-op-shift]').select_option('2');page.wait_for_function("document.querySelector('[data-op-status]').textContent.includes('NO_ABIERTO')")
    page.locator('[data-open]').click();page.wait_for_function("document.querySelector('[data-op-status]').textContent.includes('TURNO_ORIGEN_REQUIERE_CIERRE')")
    assert db.sql('SELECT count(*) FROM sgp_lp_operacion.turnos')=='1'
    page.locator('[data-op-shift]').select_option('1');page.wait_for_function("document.querySelector('[data-op-status]').textContent.includes('Turno ABIERTO')")
    page.locator('[data-turn-operation]').click();page.locator('[data-empty-confirm]').check();page.locator('[data-close-note]').fill('QA responsable cierra el origen vacío');page.locator('[data-close-empty]').click();page.wait_for_function("document.querySelector('[data-op-status]').textContent.includes('Guardado confirmado')")
    page.locator('#productionPackingTab').click();page.wait_for_selector('[data-next-turn]')
    assert 'pendiente de autorización técnica' in page.locator('[data-auto-opening]').inner_text()
    assert db.snapshot('EMPAQUE')['automaticOpening']['state']=='READY_PENDING_TECHNICAL_APPROVAL'
    audit=db.sql('SELECT count(*) FROM sgp_lp_operacion.auditoria')
    page.locator('[data-op-load]').click();page.wait_for_function("document.querySelector('[data-op-status]').textContent.includes('Turno CERRADO')")
    assert audit==db.sql('SELECT count(*) FROM sgp_lp_operacion.auditoria') and db.sql('SELECT count(*) FROM sgp_lp_operacion.turnos')=='1'
    page.locator('#productionTrackingPanel').screenshot(path=str(OUT/f'technical-approval-pending-{width}.png'))
    page.locator('[data-next-turn]').click();page.wait_for_function("document.querySelector('[data-op-shift]').value==='2'&&document.querySelector('[data-op-status]').textContent.includes('NO_ABIERTO')")
    page.locator('[data-open]').click();page.wait_for_function("document.querySelector('[data-op-status]').textContent.includes('Guardado confirmado')")
    assert db.snapshot('EMPAQUE',shift=2)['turn']['estado']=='ABIERTO' and db.snapshot('EMPAQUE',shift=2)['orders']==[]
    assert all(text in page.locator('[data-auto-opening]').inner_text() for text in ['aunque el anterior siga pendiente', 'El motor anterior todavía requiere actualización', 'no se cerrará el anterior automáticamente'])
    page.evaluate("window.SGPPlannerBridge.getToken=()=> 'LIDER'");page.locator('[data-op-load]').click();page.wait_for_function("document.querySelector('[data-op-status]').textContent.includes('Turno ABIERTO')")
    assert page.locator('[data-open]').count()==0 and page.locator('[data-auto-opening]').count()==0
    assert official==db.sql('SELECT jsonb_agg(to_jsonb(x)) FROM public.sgp_producciones x') and planning==db.sql('SELECT jsonb_agg(to_jsonb(x)) FROM public.sgp_linea_plan_asignaciones x')
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth') and not errors,errors
    results.append({'viewport':width,'stage':'EMPAQUE','actual_protected_sql':True,'read_plan_no_writes':True,'prior_open_block_visible':True,'prior_open_not_closed_or_skipped':True,'technical_binding_explicitly_pending':True,'manual_fallback_after_valid_empty_close':True,'leader_not_granted_opening':True,'planning_and_export_unchanged':True,'page_errors':errors,'automatic_executor':'NOT IMPLEMENTED OR CERTIFIED; manual actions only'});page.close()
   finally:db.close()
  browser.close()
finally:server.shutdown()
(OUT/'browser.json').write_text(json.dumps({'status':'PASS_FOR_OBSERVER_AND_MANUAL_FALLBACK','results':results},indent=2)+'\n');print(json.dumps(results,indent=2))
