"""Real UI → local transport → real SQL. Synthetic data, no stubs for closing/permissions."""
from pathlib import Path
import sys,json,os,http.server,threading,importlib.util
from playwright.sync_api import sync_playwright
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1]
spec=importlib.util.spec_from_file_location('empty_helpers',HERE/'postgres.py');h=importlib.util.module_from_spec(spec);spec.loader.exec_module(h)
Database=h.Database;lit=h.lit
OUT=HERE/'evidence';OUT.mkdir(exist_ok=True)
class Handler(http.server.SimpleHTTPRequestHandler):
 db=None
 def log_message(self,*args):pass
 def do_POST(self):
  try:
   b=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
   if self.path!='/rpc':raise ValueError('Isolated RPC only')
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
    key='QA-FUTURE|PANELES_2';db.seed(key,parts=(1,),date='2026-11-04')
    planning=db.sql('SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM public.sgp_linea_plan_asignaciones a');official=db.sql('SELECT jsonb_agg(to_jsonb(a) ORDER BY key_produccion) FROM public.sgp_producciones a')
    page=browser.new_page(viewport={'width':width,'height':950 if width>400 else 844});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(origin) else r.abort());page.goto(origin+'/')
    page.evaluate('''()=>{
     document.querySelector('[data-view-panel="ensamble"]').hidden=false;
     window.SGPPlannerBridge.getToken=()=> 'COORDINADOR';
     window.SGPPlannerBridge.getClient=async()=>({rpc:async(name,args)=>(await fetch('/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,args})})).json()});
    }''')
    page.locator('#productionTrackingTab').click();page.wait_for_selector('[data-op-date]');page.locator('[data-op-date]').fill('2026-11-01');page.locator('[data-op-date]').dispatch_event('change')
    page.wait_for_function("document.querySelector('[data-op-status]').textContent.includes('NO_ABIERTO')")
    page.locator('[data-open]').click();page.wait_for_function("document.querySelector('[data-op-status]').textContent.includes('Guardado confirmado')")
    page.locator('[data-turn-operation]').click();page.wait_for_selector('[data-empty-close]')
    assert page.locator('[data-bi-file]').is_disabled() and page.locator('[data-close-empty]').is_enabled()
    page.locator('[data-close-empty]').click();page.wait_for_function("document.querySelector('[data-close-status]').textContent.includes('Confirma explícitamente')")
    page.locator('[data-empty-confirm]').check();page.locator('[data-close-empty]').click();page.wait_for_function("document.querySelector('[data-close-status]').textContent.includes('justificación obligatoria')")
    assert db.sql('SELECT count(*) FROM sgp_lp_operacion.cierres')=='0'
    page.locator('[data-close-note]').fill('QA turno vacío confirmado por responsable');page.locator('[data-operation-detail]').screenshot(path=str(OUT/f'empty-confirmation-{width}.png'))
    lost={'done':False,'id':None}
    def lose_close(route):
     b=route.request.post_data_json
     if b['name']=='sgp_lp_operacion_comando' and b['args']['p_cmd']['op']=='CERRAR' and not lost['done']:
      lost['done']=True;lost['id']=b['args']['p_cmd']['id'];response=route.fetch();assert response.json()['data']['type']=='SIN_ACTIVIDAD';route.abort()
     else:route.continue_()
    page.route('**/rpc',lose_close)
    page.locator('[data-close-empty]').click();page.wait_for_function("document.querySelector('[data-op-status]').textContent.includes('No se confirmó')")
    page.locator('[data-operation-pending-retry]').click();page.wait_for_function("document.querySelector('[data-op-status]').textContent.includes('Guardado confirmado')")
    assert db.sql('SELECT count(*) FROM sgp_lp_operacion.cierres')=='1' and db.sql('SELECT count(*) FROM sgp_lp_operacion.auditoria WHERE id='+lit(lost['id']))=='1'
    page.locator('[data-stage-reports]').click();page.locator('[data-report-id] > summary').click();assert 'SIN ACTIVIDAD' in page.locator('#productionReportsPanel').inner_text();assert page.locator('[data-original]:visible').count()==0
    with page.expect_download() as d:page.locator('[data-report]').click()
    d.value.save_as(OUT/f'empty-close-{width}.csv');csv=(OUT/f'empty-close-{width}.csv').read_text(encoding='utf-8-sig');assert 'SIN ACTIVIDAD' in csv and 'QA turno vacío confirmado' in csv and 'No aplica: turno sin órdenes' in csv
    page.locator('#productionReportsPanel').screenshot(path=str(OUT/f'empty-report-{width}.png'))
    page.locator('#productionTrackingTab').click();page.wait_for_selector('[data-next-turn]');page.locator('[data-next-turn]').click()
    page.wait_for_function("document.querySelector('[data-op-shift]').value==='2'&&document.querySelector('[data-op-status]').textContent.includes('NO_ABIERTO')")
    page.locator('[data-open]').click();page.wait_for_function("document.querySelector('[data-op-status]').textContent.includes('Guardado confirmado')")
    page.locator('[data-turn-operation]').click();page.locator('[data-empty-confirm]').check();page.locator('[data-close-note]').fill('QA siguiente turno vacío');page.locator('[data-close-empty]').click();page.wait_for_function("document.querySelector('[data-op-status]').textContent.includes('Guardado confirmado')")
    assert db.snapshot(shift=2)['turn']['estado']=='CERRADO';first=db.snapshot(shift=2)['reports'][0]['snapshot']
    page.evaluate("window.SGPPlannerBridge.getToken=()=> 'LIDER'");page.locator('#productionTrackingTab').click();page.locator('[data-op-load]').click();page.wait_for_function("document.querySelector('[data-op-status]').textContent.includes('CERRADO')")
    page.locator('[data-turn-operation]').click();assert page.locator('[data-reopen]').count()==0
    page.evaluate("window.SGPPlannerBridge.getToken=()=> 'COORDINADOR'");page.locator('#productionTrackingTab').click();page.locator('[data-op-load]').click();page.wait_for_function("document.querySelector('[data-op-status]').textContent.includes('CERRADO')")
    page.locator('[data-turn-operation]').click();page.locator('[data-close-note]').fill('QA reapertura autorizada');page.locator('[data-reopen]').click();page.wait_for_function("document.querySelector('[data-op-status]').textContent.includes('Guardado confirmado')")
    assert db.snapshot(shift=2)['turn']['estado']=='EN_REVISION'
    page.locator('[data-empty-confirm]').check();page.locator('[data-close-note]').fill('QA segunda versión vacía');page.locator('[data-close-empty]').click();page.wait_for_function("document.querySelector('[data-op-status]').textContent.includes('Guardado confirmado')")
    reports=db.snapshot(shift=2)['reports'];assert len(reports)==2 and reports[0]['snapshot']==first and reports[1]['snapshot']['version']>first['version']
    assert planning==db.sql('SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM public.sgp_linea_plan_asignaciones a')
    page.locator('[data-close-note]').fill('QA incorporar nueva programación');page.locator('[data-reopen]').click();page.wait_for_function("document.querySelector('[data-op-status]').textContent.includes('Guardado confirmado')")
    page.locator('[data-empty-confirm]').check();page.locator('[data-close-note]').fill('QA vista previa obsoleta no debe cerrar')
    db.sql(h.insert_assignment(key,shift=2)) # Synthetic assignment arriving after preview, not app behavior.
    new_plan=db.sql('SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM public.sgp_linea_plan_asignaciones a')
    page.locator('[data-close-empty]').click();page.wait_for_function("document.querySelector('[data-close-status]').textContent.includes('tiene órdenes asignadas o abiertas')")
    assert len(db.snapshot(shift=2)['reports'])==2
    page.locator('#productionTrackingTab').click();page.locator('[data-op-load]').click();page.wait_for_function("document.querySelector('[data-op-status]').textContent.includes('EN_REVISION')")
    page.locator('[data-open]').click();page.wait_for_function("document.querySelector('[data-op-status]').textContent.includes('Guardado confirmado')")
    page.locator('[data-turn-operation]').click();assert page.locator('[data-close-empty]').count()==0
    assert db.snapshot(shift=2)['orders'][0]['ejecutado']==0 and page.locator('[data-close]').is_disabled()
    assert official==db.sql('SELECT jsonb_agg(to_jsonb(a) ORDER BY key_produccion) FROM public.sgp_producciones a') and new_plan==db.sql('SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM public.sgp_linea_plan_asignaciones a')
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth') and not errors,errors
    page.locator('[data-operation-detail]').screenshot(path=str(OUT/f'order-blocks-empty-{width}.png'))
    results.append({'viewport':width,'actual_sql':True,'explicit_confirmation_and_motive':True,'no_powerbi_file':True,'lost_close_reply_one_version_one_audit':True,'csv_metadata_download':True,'next_configured_shift_opens':True,'leader_cannot_reopen':True,'coordinator_reopen_immutable_versions':True,'assignment_after_preview_rejected':True,'zero_execution_order_requires_normal_close':True,'planning_and_export_unchanged_by_app':True,'page_errors':errors,'network':'local only; external blocked'});page.close()
   finally:db.close()
  browser.close()
finally:server.shutdown()
(OUT/'browser.json').write_text(json.dumps({'status':'PASS','results':results,'scope':'Chromium → actual shared controller → local transport → real PostgreSQL with captured SGP session and synthetic sources; no plant/deployment verification'},indent=2)+'\n');print(json.dumps(results,indent=2))
