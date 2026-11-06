"""Focused visual interactions only; synthetic read fixture, no writes or SQL."""
from pathlib import Path
import http.server,threading,json,sys
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];HERE=Path(__file__).parent
class Files(http.server.SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT),**kw)
 def log_message(self,*a):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Files);threading.Thread(target=server.serve_forever,daemon=True).start();origin=f'http://127.0.0.1:{server.server_port}';results=[]
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(**({'executable_path':'/usr/bin/chromium'} if Path('/usr/bin/chromium').exists() else {}),args=['--no-sandbox'])
  for width in ([390] if '--copy-only' in sys.argv else [1440,390]):
   page=browser.new_page(viewport={'width':width,'height':1000});page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(origin) else r.abort());errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(origin+'/tests/lp01-summary-ui/fixture.html');page.wait_for_selector('[data-summary-cause=NC_V]');page.locator('[data-summary-cause=NC_V]').first.click();page.wait_for_selector('[data-shared-legacy]')
   legacy=page.locator('[data-shared-legacy] article:visible');assert legacy.count()==1
   assert '8 ventanas reportadas' in legacy.inner_text()
   assert 'Vinculada' not in legacy.inner_text() and 'Número informado' not in legacy.inner_text()
   assert page.locator('[data-shared-form] button[type=submit]').is_disabled()
   if '--copy-only' in sys.argv:
    print('PASS: legacy NC without number does not claim a reference or verified link');page.close();continue
   assert page.locator('[data-report-context]').count()==0
   nav=page.locator('.lp-order-type-tabs');top=nav.evaluate('(e)=>e.offsetTop')
   page.locator('[data-order-type=TECNO]').click();page.wait_for_selector('.lp-glass-estimate');assert page.locator('[data-report-context]').count()==0
   page.locator('[data-order-note-refresh]').click();page.wait_for_timeout(200);assert page.locator('[data-report-context]').count()==0;assert page.locator('[data-order-note-refresh]').inner_text()=='Actualizar datos'
   page.locator('#lp-tracking-drawer').screenshot(path=str(HERE/f'evidence/tecno-context-hidden-{width}.png'))
   for kind in ['ACCESORIOS','NC_AL','NOVEDAD','NC_V']:
    page.locator('[data-order-type='+kind+']').click();assert page.locator('[data-report-context]').count()==0
    assert page.locator('[data-type-pane='+kind+'] [data-shared-form] button[type=submit]').is_disabled()
    assert abs(nav.evaluate('(e)=>e.offsetTop')-top)<2
   legacy=page.locator('[data-shared-legacy] article:visible');assert '8 ventanas reportadas' in legacy.inner_text()
   if width==390:
    legacy.scroll_into_view_if_needed();box=legacy.bounding_box();assert box['x']>=0 and box['x']+box['width']<=width
    assert legacy.evaluate('(el)=>el.scrollWidth<=el.clientWidth && el.scrollHeight<=el.clientHeight')
   page.locator('#lp-tracking-drawer').screenshot(path=str(HERE/f'evidence/nc-accessible-{width}.png'))
   assert not errors,errors;results.append({'width':width,'noShiftRequired':True,'missingBackendDisablesSave':True,'refreshReadLabel':True,'legacyNCVisibleWithoutInventedLink':True,'syntheticReadOnly':True});page.close()
  browser.close()
 if '--copy-only' not in sys.argv:(HERE/'visual-focus-result.json').write_text(json.dumps(results,indent=2)+'\n');print(json.dumps(results))
finally:server.shutdown()
