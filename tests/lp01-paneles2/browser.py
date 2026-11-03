"""UI visibility and actual VALIDAR RPC for explicit SQL09 responsibility; synthetic local only."""
from pathlib import Path
import sys,json,http.server,threading
from playwright.sync_api import sync_playwright
import importlib.util
setup_spec=importlib.util.spec_from_file_location('panels_setup',Path(__file__).with_name('postgres.py'));panels=importlib.util.module_from_spec(setup_spec);setup_spec.loader.exec_module(panels)
Database,setup,ROOT=panels.Database,panels.setup,panels.ROOT
spec=importlib.util.spec_from_file_location('broker',ROOT/'tests/lp01-cierres-integrados/browser.py')
sys.path.insert(0,str(ROOT/'tests/lp01-cierres-integrados'));broker=importlib.util.module_from_spec(spec);spec.loader.exec_module(broker)
HERE=Path(__file__).parent
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),broker.Broker);threading.Thread(target=server.serve_forever,daemon=True).start();origin=f'http://127.0.0.1:{server.server_port}';results=[]
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,args=['--no-sandbox'])
  for width in [1440,390]:
   db=Database();broker.Broker.db=db
   try:
    key,parts=setup(db);db.execute(db.cmd('ABRIR'))
    page=browser.new_page(viewport={'width':width,'height':900});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(origin) else r.abort());page.goto(origin+'/')
    page.evaluate('''()=>{
     document.querySelector('[data-view-panel="ensamble"]').hidden=false;
     window.SGPPlannerBridge.getToken=()=> 'QA-SUP-E';
     window.SGPPlannerBridge.getClient=async()=>({rpc:async(name,args)=>(await fetch('/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,args})})).json()});
     document.querySelector('[data-op-date]').value='2026-11-01';
    }''')
    page.locator('#productionTrackingTab').click();page.wait_for_selector('[data-live-operate]',state='attached');page.locator(f'[data-order-part="{parts[0]}"] summary').click();page.locator(f'[data-live-operate="{parts[0]}"]').click()
    assert page.locator('[data-validate-save]').is_visible();assert not page.locator('[data-sale-save]').count();assert not page.locator('[data-reopen]').count()
    page.locator('[data-consolidated]').fill('0');page.locator('[data-operation-note]').fill('QA supervisor autorizado');page.locator('[data-validate-save]').click();page.wait_for_function("document.querySelector('[data-op-status]').textContent.includes('Guardado confirmado')")
    snap=db.snapshot(token='QA-SUP-E');assert next(r for r in snap['orders'] if r['parte']==parts[0])['validado']
    assert 'SUPERVISOR_ENSAMBLE' in page.locator('#productionOperationPanel').text_content()
    page.screenshot(path=str(HERE/f'evidence/supervisor-{width}.png'))
    page.locator('#productionTrackingTab').click();page.locator('[data-op-stage]').select_option('EMPAQUE');page.wait_for_function("document.querySelector('[data-op-status]').textContent.includes('AMBITO')")
    assert not page.locator('[data-validate-save]').count();assert not errors
    results.append({'width':width,'SQL09_supervisor_validation':'PASS','SALE_reopen_absent':True,'other_stage_denied':'PASS','synthetic':True,'errors':errors});page.close()
   finally:db.close()
  browser.close()
finally:server.shutdown()
(HERE/'evidence/browser.json').write_text(json.dumps({'status':'PASS','results':results,'limits':['Local auth bootstrap/transport only; results and authorization are actual isolated SQL09','Does not certify real assignments, sessions or deployment']},indent=2)+'\n');print(json.dumps(results,indent=2))
