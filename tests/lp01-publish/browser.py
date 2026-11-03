"""Ordinary publishing path: actual unchanged SGP UI, no LP activation, no real data/auth."""
from pathlib import Path
import subprocess,http.server,threading,os,json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
subprocess.run(['python','scripts/prepare-sgp-legacy-artifact.py'],cwd=ROOT,check=True,capture_output=True)
os.chdir('/tmp/sgp-lp183-main-visual')
class H(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),H);threading.Thread(target=server.serve_forever,daemon=True).start();results=[]
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for width in [1440,390]:
   page=b.new_page(viewport={'width':width,'height':950});errors=[];lp_requests=[];bad=[]
   page.on('pageerror',lambda e:errors.append(str(e)))
   page.on('request',lambda r:lp_requests.append(r.url) if 'sgp_lp_operacion' in r.url or 'lp-powerbi' in r.url else None)
   page.on('response',lambda r:bad.append(r.url) if r.status>=400 and r.url.split('?')[0].endswith(('.js','.css')) else None)
   page.route('**/*',lambda r:r.continue_() if r.request.url.startswith('http://127.0.0.1:') else r.abort())
   page.goto('http://127.0.0.1:'+str(server.server_port));page.wait_for_function('window.SGPPlannerBridge && window.SGPPlannerBridge.getClient')
   # Host login is not bypassed or certified: expose the legacy panel for layout only.
   page.evaluate("document.querySelector('[data-view-panel=ensamble]').hidden=false")
   expected=['LP-01 · Programación','LP-02 · Ensamble','LP-02 · Empaque','Reporte de ubicaciones']
   assert page.locator('.production-line-tabs > button:visible').all_text_contents()==expected
   assert page.locator('#productionTrackingTab').count()==0
   for tab in ['productionPlannerTab','productionAssemblyTab','productionPackingTab','productionLocationsTab']:page.locator('#'+tab).click()
   assert page.locator('#assemblyLocationReportPanel').is_visible()
   assert not bad,bad;assert not errors,errors;assert not lp_requests
   results.append({'viewport':width,'ordinary_four_tabs_preserved':True,'app_booted':True,'missing_js_css':0,'LP_boot_or_requests':0,'page_errors':errors,'auth':'NOT_CERTIFIED; local layout only; external requests blocked'});page.close()
  b.close()
finally:server.shutdown()
(ROOT/'tests/lp01-publish/evidence/browser.json').write_text(json.dumps({'status':'PASS','results':results,'scope':'Real local ordinary artifact, no deploy/no production records'},indent=2)+'\n');print(json.dumps(results))
