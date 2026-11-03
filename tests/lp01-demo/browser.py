from pathlib import Path
import os,http.server,threading,json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'tests/lp01-demo/evidence';os.chdir('/tmp/sgp-lp183-preview')
class H(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),H);threading.Thread(target=server.serve_forever,daemon=True).start();results=[]
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for width in [1440,390]:
   page=browser.new_page(viewport={'width':width,'height':950});errors=[];external=[];page.on('pageerror',lambda e:errors.append(str(e)))
   def route(r):
    if r.request.url.startswith('http://127.0.0.1:'):r.continue_()
    else:external.append(r.request.url);r.abort()
   page.route('**/*',route);page.goto('http://127.0.0.1:'+str(server.server_port));page.wait_for_selector('[data-op-date]',state='attached')
   # Navigation via actual SGP menu, not injected visible panels.
   if width<700:page.locator('#mobileMenuToggle').click()
   page.locator('[data-view="ensamble"]').click();page.wait_for_selector('[data-order-part]')
   page.locator('[data-search]').fill('sin-coincidencia');assert page.locator('[data-order-part]').count()==0;page.locator('[data-search]').fill('')
   expected=['LP-01 · Programación','Seguimiento','LP-02 · Ensamble','LP-02 · Empaque','Reporte de ubicaciones']
   assert page.locator('.production-line-tabs > button:visible').all_text_contents()==expected
   ids=['productionPlannerTab','productionTrackingTab','productionAssemblyTab','productionPackingTab','productionLocationsTab']
   for n,tab in enumerate(ids):
    page.locator('#'+tab).click();page.wait_for_timeout(250);page.evaluate('scrollTo(0,0)')
    page.screenshot(path=str(OUT/f'tab-{n+1}-{width}.png'),full_page=True)
   assert page.locator('#assemblyLocationReportPanel').is_visible()
   page.locator('#productionPlannerTab').click();assert page.locator('#sgpPlannerExplorer').is_visible()
   page.locator('#productionPlannerTab').focus();page.keyboard.press('ArrowRight');assert page.locator('#productionTrackingTab').get_attribute('aria-selected')=='true'
   for stage in ['ENSAMBLE','EMPAQUE']:
    page.locator('#'+('productionAssemblyTab' if stage=='ENSAMBLE' else 'productionPackingTab')).click();page.wait_for_timeout(250)
    assert page.locator('[data-order-part]').count()==4
    page.locator('[data-order-part]').nth(1).locator('summary').click()
    page.evaluate('scrollTo(0,0)')
    page.screenshot(path=str(OUT/f'{stage.lower()}-tracking-{width}.png'),full_page=True)
    page.locator('[data-live-operate]').nth(1).click();page.wait_for_selector('[data-operation-detail]')
    page.evaluate('scrollTo(0,0)')
    page.screenshot(path=str(OUT/f'{stage.lower()}-operation-{width}.png'),full_page=True)
    assert not page.locator('[data-order-form] button[type=submit]:enabled').count()
    page.locator('[data-stage-reports]').click();page.wait_for_selector('[data-report]',state='attached');page.locator('#productionReportsPanel details summary').first.click()
    page.evaluate('scrollTo(0,0)')
    page.screenshot(path=str(OUT/f'{stage.lower()}-closure-{width}.png'),full_page=True)
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.locator('#productionTrackingTab').click()
   assert not errors,errors;assert not external,external
   results.append({'viewport':width,'menu_to_lp':True,'five_tabs_in_approved_order':True,'keyboard':True,'planner_and_locations_preserved':True,'stages':2,'orders':4,'search':True,'details_and_reports':True,'no_horizontal_overflow':True,'enabled_save_buttons':0,'external_requests':0,'page_errors':errors});page.close()
  browser.close()
finally:server.shutdown()
(OUT/'browser.json').write_text(json.dumps({'results':results,'scope':'Existing UI, static snapshots from isolated SQL synthetic data; writes disabled, no production transport; not live persistence verification'},indent=2)+'\n');print(json.dumps(results))
