from pathlib import Path
import os,http.server,threading,json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'tests/lp01-integration/evidence';os.chdir('/tmp/sgp-lp183-main-visual')
class H(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),H);threading.Thread(target=server.serve_forever,daemon=True).start();results=[]
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for width in [1440,390]:
   page=b.new_page(viewport={'width':width,'height':950});errors=[];bad_assets=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.on('response',lambda r:bad_assets.append(r.url) if r.status>=400 and any(r.url.split('?')[0].endswith(x) for x in ['.js','.css']) else None)
   page.route('**/*',lambda r:r.continue_() if r.request.url.startswith('http://127.0.0.1:') else r.abort())
   page.goto('http://127.0.0.1:'+str(server.server_port));page.wait_for_selector('[data-op-date]',state='attached')
   page.wait_for_function('window.SGPPlannerBridge && window.SGPPlannerBridge.getClient')
   assert not bad_assets,bad_assets
   # Explicit isolated host-session fixture; never logs in to production or claims real auth.
   page.evaluate("window.SGPPlannerBridge??={};window.SGPPlannerBridge.getToken=()=> 'QA-ISOLATED-HOST-SESSION';document.querySelector('[data-view-panel=ensamble]').hidden=false;")
   for n,tab in enumerate(['productionPlannerTab','productionTrackingTab','productionAssemblyTab','productionPackingTab','productionLocationsTab']):
    page.locator('#'+tab).click();page.wait_for_timeout(200);page.evaluate('scrollTo(0,0)');page.screenshot(path=str(OUT/f'tab-{n+1}-{width}.png'),full_page=True)
   page.locator('#productionAssemblyTab').click();page.wait_for_selector('[data-order-part]');assert page.locator('[data-order-part]').count()==4
   assert 'DATOS SINTÉTICOS' in page.locator('#productionTrackingPanel').inner_text()
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   assert not errors,errors
   results.append({'viewport':width,'full_sgp_index_app_config':True,'host_session':'SYNTHETIC_FIXTURE_NOT_REAL_AUTH','five_tabs':True,'app_booted':True,'missing_js_css':len(bad_assets),'explicit_synthetic_banner':True,'synthetic_orders':4,'errors':errors,'overflow':False});page.close()
  b.close()
finally:server.shutdown()
(OUT/'browser.json').write_text(json.dumps({'status':'PASS','results':results,'limits':['Existing authenticated host access not certified; synthetic host token fixture only','Outbound network blocked; production data in Programación/ubicaciones not certified','Prior demo navigation/captures reused; this test covers new full-app artifact/bootstrap']},indent=2)+'\n');print(json.dumps(results))
