"""Actual PC/mobile operation → local transport → actual PG; no business or write stubs."""
from pathlib import Path
import sys,json,http.server,threading,os,importlib.util
from playwright.sync_api import sync_playwright
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
    page.locator('#productionTrackingTab').click();page.wait_for_selector('[data-op-date]')
    page.locator('[data-op-stage]').select_option('EMPAQUE');page.locator('[data-op-date]').fill('2026-11-01');page.locator('[data-op-date]').dispatch_event('change')
    page.wait_for_function("document.querySelector('[data-op-status]').textContent.includes('NO_ABIERTO')")
    page.locator('[data-turn-capacity]').fill('20');page.locator('[data-open]').click();page.wait_for_function("document.querySelector('[data-op-status]').textContent.includes('Guardado confirmado')")
    rows=db.snapshot('EMPAQUE')['orders'];assert next(r for r in rows if r['key']==key)['sale']==20 and all(r['sale'] is None for r in rows if r['key']==multi)
    page.locator('[data-order-part="'+part+'"] > summary').click();page.locator('[data-live-operate="'+part+'"]').click();assert 'Inicializado desde saldo oficial elegible' in page.locator('[data-operation-detail]').inner_text()
    page.locator('[data-executed]').fill('8');page.locator('[data-operation-note]').fill('QA ejecución del primer turno');page.locator('[data-order-form] button[type=submit]').click();page.wait_for_function("document.querySelector('[data-op-status]').textContent.includes('Guardado confirmado')")
    for x in parts:db.execute(db.cmd('SALE',stage='EMPAQUE',key=multi,part=x,quantity=0,observation='QA decisión explícita de aplazar'))
    checks.close_turn(db,stage='EMPAQUE') # Actual SQL QA close, not XLSX adapter certification.
    page.locator('#productionTrackingTab').click();page.locator('[data-op-load]').click();page.wait_for_selector('[data-next-turn]')
    page.locator('[data-next-turn]').click();page.wait_for_function("document.querySelector('[data-op-shift]').value==='2' && document.querySelector('[data-op-status]').textContent.includes('NO_ABIERTO')")
    page.locator('[data-turn-capacity]').fill('20');page.locator('[data-open]').click();page.wait_for_function("document.querySelector('[data-op-status]').textContent.includes('Guardado confirmado')")
    row=next(r for r in db.snapshot('EMPAQUE',shift=2)['orders'] if r['parte']==part);assert row['sale']==12 and row['ejecutado']==0 and row['contexto_origen']['ejecutado']==8
    page.locator('[data-order-part="'+part+'"] > summary').click();page.locator('[data-live-operate="'+part+'"]').click();assert 'Antigüedad original 2026-11-01 / T1' in page.locator('[data-operation-detail]').inner_text()
    page.locator('[data-operation-detail]').screenshot(path=str(OUT/f'packing-continuity-{width}.png'))
    # Commit succeeds, writes become contained, response is lost: read receipt confirms it once.
    lost={'done':False,'id':None}
    def commit_then_lose(route):
     body=route.request.post_data_json
     if body['name']=='sgp_lp_operacion_comando' and body['args']['p_cmd']['op']=='NOTA' and not lost['done']:
      lost['done']=True;lost['id']=body['args']['p_cmd']['id'];response=route.fetch();assert response.json()['data']['ok']
      db.sql('UPDATE sgp_lp_operacion.config SET escrituras=false WHERE id;');route.abort()
     else:route.continue_()
    page.route('**/rpc',commit_then_lose)
    page.locator('[data-operation-note]').fill('QA nota confirmable durante contención');page.locator('[data-note-save]').click();page.wait_for_function("document.querySelector('[data-op-status]').textContent.includes('No se confirmó')")
    page.locator('[data-operation-pending-retry]').click();page.wait_for_function("document.querySelector('[data-op-status]').textContent.includes('Guardado confirmado')")
    assert db.sql('SELECT count(*) FROM sgp_lp_operacion.auditoria WHERE id='+lit(lost['id']))=='1'
    assert not db.snapshot('EMPAQUE',shift=2)['writes'];assert page.locator('[data-order-form] button[type=submit]').is_disabled()
    assert planning==db.sql('SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM public.sgp_linea_plan_asignaciones a');assert official==db.sql('SELECT jsonb_agg(to_jsonb(a) ORDER BY key_produccion) FROM public.sgp_producciones a')
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth') and not errors,errors
    page.locator('[data-operation-detail]').screenshot(path=str(OUT/f'contained-receipt-{width}.png'))
    results.append({'viewport':width,'actual_rpc_persistence':True,'single_sale_initialized':20,'ambiguous_split_pending':True,'next_operational_shift':2,'next_sale':12,'next_executed':0,'original_age_preserved':True,'lost_commit_receipt_while_contained':True,'planning_and_export_unchanged':True,'page_errors':errors,'network':'local only; external blocked'});page.close()
   finally:db.close()
  browser.close()
finally:server.shutdown()
(OUT/'browser.json').write_text(json.dumps({'status':'PASS','results':results,'limits':['Captured actual session function, synthetic identities/config/planning','QA CSV only for closure setup; Power BI unchanged and checked by its affected regression','No deployment, real users or plant operations verified']},indent=2)+'\n');print(json.dumps(results,indent=2))
