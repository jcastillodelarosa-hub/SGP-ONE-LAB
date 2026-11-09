import json, threading, functools, shutil, os
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(SimpleHTTPRequestHandler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
fixture={'contract':'GLASS-PREPARATION-1','year':2026,'week':46,'line':'PANELES_2','canWrite':True,'dates':[],'weeks':[{'year':2026,'week':46}],'fingerprints':[{'reservation':'R','priority':'1.1','fingerprint':'abc'}],'rows':[{'key':'A','reservation':'R','priority':'1.1','production':'Order A','system':'ES','finish':'White','windows':3},{'key':'B','reservation':'R','priority':'1.1','production':'Order B','system':'ES','finish':'White','windows':4}]}
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=None if os.environ.get('CI') else shutil.which('chromium'),headless=True,args=['--no-sandbox'])
 for width in [1366,390]:
  page=browser.new_page(viewport={'width':width,'height':800})
  page.route('**/*',lambda route: route.continue_() if route.request.url.startswith(f'http://127.0.0.1:{server.server_port}/') else route.abort())
  page.goto(f'http://127.0.0.1:{server.server_port}/tests/glass-preparation/fixture.html')
  page.evaluate('(f)=>{document.body.innerHTML="<main id=host></main>";window.fixture=f;window.calls=[]}',fixture)
  page.evaluate('''async()=>{const{mountGlassPreparation}=await import('/src/modules/glass-preparation.js');window.ui=mountGlassPreparation(document.querySelector('#host'),{getToken:()=> 'test',getClient:async()=>({rpc:async(name,args)=>{window.calls.push({name,args});if(name.endsWith('_read'))return {data:structuredClone(window.fixture)};window.fixture.dates=args.p_command.changes.map(x=>({...x,preparation_date:x.date,revision:1}));return {data:{ok:true,id:args.p_command.id,saved:1}}}})});await window.ui.load()}''')
  assert page.locator('[data-rows] tr').count()==1
  page.locator('[data-all]').check();page.locator('[data-batch-date]').fill('2026-11-10');page.locator('[data-apply]').click()
  assert page.locator('[data-date]').input_value()=='2026-11-10'
  page.locator('[data-save]').click();page.wait_for_function("document.querySelector('[data-status]').textContent==='1 fechas guardadas.'")
  assert len(page.evaluate('calls.filter(x=>x.name.endsWith("_save"))'))==1
  assert page.locator('[data-date]').input_value()=='2026-11-10'
  with page.expect_download() as download:page.locator('[data-export]').click()
  assert download.value.suggested_filename.endswith('.xlsx')
  page.screenshot(path=f'/tmp/b21-{width}.png',full_page=True)
  page.locator('[data-search]').fill('missing');assert 'No hay' in page.locator('[data-rows]').inner_text()
  page.close()
 browser.close()
server.shutdown();print('PASS browser B21 PC/mobile load group/multiselect/date/save/readback/filter, mocked RPC (not production)')
