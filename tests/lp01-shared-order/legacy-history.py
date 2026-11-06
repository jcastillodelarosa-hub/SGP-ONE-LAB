"""Focused synthetic UI check: preserve native event context; no SQL or writes."""
from pathlib import Path
import http.server,threading
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
class Files(http.server.SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT),**kw)
 def log_message(self,*a):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Files);threading.Thread(target=server.serve_forever,daemon=True).start();origin=f'http://127.0.0.1:{server.server_port}'
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(**({'executable_path':'/usr/bin/chromium'} if Path('/usr/bin/chromium').exists() else {}),args=['--no-sandbox'])
  for width in [1440,390]:
   page=browser.new_page(viewport={'width':width,'height':900});page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(origin) else r.abort())
   page.route(origin+'/legacy-history-fixture',lambda r:r.fulfill(content_type='text/html',body='<main id="test"></main>'));page.goto(origin+'/legacy-history-fixture')
   for available in [False,True]:
    page.evaluate('''async available=>{
     const {mountSharedAffectationsPanel}=await import('/src/modules/lp01-shared-affectations-panel.js');
     const legacy={id:'old-v',cause:'NC_V',quantity:3,solved:0,confirmed:0,originStage:'ENSAMBLE',originDate:'2026-11-01',originShift:2,createdBy:'lider',ncReference:'NC-ANTERIOR'};
     const transport={read:async()=>({reports:[legacy],events:[{reportId:'old-v',action:'CREATE',user:'lider',stage:'ENSAMBLE',date:'2026-11-01',shift:2,at:'2026-11-01T18:00:00Z',observation:'Vidrio <pendiente>',quantity:3},{reportId:'other',action:'CREATE',observation:'NO MOSTRAR',quantity:99}]}),shared:{read:async()=>{if(!available)throw Error('SHARED_ORDER_UNAVAILABLE');return {reports:[],history:[],canReport:false,legacyReports:[{id:'old-v',causa:'NC_V',ventanas:3,solucionadas:0,confirmadas:0,etapa:'ENSAMBLE',origen_fecha:'2026-11-01',origen_turno:2,creado_por:'lider',ncReference:'NC-ANTERIOR'}]};}}};
     await mountSharedAffectationsPanel(document.querySelector('#test'),transport,{fixedCause:'NC_V'});
    }''',available)
    page.locator('details summary').click();history=page.locator('[data-legacy-history]');assert history.locator('article').count()==1
    assert all(t in history.inner_text() for t in ['lider','ENSAMBLE','2026-11-01 / T2','Vidrio <pendiente>','Ventanas del movimiento: 3'])
    assert 'NO MOSTRAR' not in history.inner_text();assert history.locator('pendiente').count()==0
    assert 'NC-ANTERIOR' in page.locator('[data-shared-legacy]').inner_text();assert 'Vinculada' not in page.locator('[data-shared-legacy]').inner_text()
    assert page.locator('[type=submit]').is_disabled()
   print('PASS',width,'native history scoped, escaped, context and NC retained with/without shared backend');page.close()
  browser.close()
finally:server.shutdown()
