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
  browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for width in (1440,390):
   page=browser.new_page(viewport={'width':width,'height':900});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(origin) else r.abort())
   page.goto(origin+'/tests/lp01-pending-ui/fixture.html');page.wait_for_selector('[data-order-summary="QA3|PANELES_2"] [data-summary-cause=ALUMINIO]')
   for key,label in [('QA3|PANELES_2','aluminio'),('QA1|PANELES_2','reportadas')]:
    row=page.locator('tr').filter(has=page.locator('[data-order-summary="'+key+'"]'));assert row.locator('details[data-order-part]').get_attribute('open') is None;row.scroll_into_view_if_needed();row.locator('[data-sale-edit]').wait_for(state='visible');assert 'Por definir' in row.locator('.lp-sale-row').inner_text();row.screenshot(path=f'/tmp/afectaciones-contraida-{label}-{width}.png')
   pending=page.locator('[data-order-summary="QA3|PANELES_2"]');assert 'Aluminio · ventanas por definir' in pending.inner_text();assert '19 ×' not in pending.inner_text()
   assert page.locator('[data-order-summary="QA2|PANELES_2"] [aria-label="Sin reportes ni pendientes de aluminio devueltos"]').count()==1
   assert page.locator('[data-order-summary="QA4|PANELES_2"] [aria-label="Pendientes de aluminio no disponibles"]').count()==1
   assert '2 × NC AL' in page.locator('[data-order-summary="QA5|PANELES_2"]').inner_text();assert page.locator('[data-order-summary="QA5|PANELES_2"] [data-summary-cause=ALUMINIO]').count()==0
   pending.locator('[data-summary-cause=ALUMINIO]').click();page.wait_for_selector('[data-order-type=NC_AL][aria-pressed=true]');assert all(x in page.locator('.lp-aluminum-pending').inner_text() for x in ['PRODUCCION','LEGACY','PICKING'])
   assert 'edición actual aún exige' not in page.locator('#lp-tracking-drawer').inner_text();assert page.locator('[data-tracking-context]').is_hidden();assert page.locator('[data-live-operate]').is_hidden()
   assert page.locator('[data-report-context]').count()==0
   page.locator('[data-order-type=NOVEDAD]').click();page.wait_for_selector('[data-shared-form]:visible');form=page.locator('[data-type-pane=NOVEDAD] form');form.locator('[name=observation]').fill('borrador sintético');page.evaluate('controller.load({quiet:true})');page.wait_for_timeout(300);assert form.locator('[name=observation]').input_value()=='borrador sintético'
   # Late shared read must not reopen a closed detail; there is no shift lookup now.
   page.locator('[data-tracking-close]').click();page.evaluate('window.delayShared=true');pending.locator('[data-summary-cause=ALUMINIO]').click();page.wait_for_function('!!window.releaseShared');page.locator('[data-tracking-close]').click();page.evaluate('window.delayShared=false;window.releaseShared()');page.wait_for_timeout(150);assert page.locator('#lp-tracking-drawer').is_hidden()
   pending.locator('[data-summary-cause=ALUMINIO]').click();page.wait_for_selector('[data-shared-form]:visible');page.locator('[data-order-type=NOVEDAD]').click();form=page.locator('[data-type-pane=NOVEDAD] form');form.locator('[name=quantity]').fill('1');form.locator('[name=observation]').fill('permiso revocado al guardar');form.locator('button[type=submit]').click();page.wait_for_function("document.querySelector('[data-type-pane=NOVEDAD]').textContent.includes('Acceso revocado')");assert page.locator('[data-type-pane=NOVEDAD] form').count()==0
   page.locator('#lp-tracking-drawer').screenshot(path=f'/tmp/b10-pending-detail-{width}.png');page.screenshot(path=f'/tmp/b10-pending-{width}.png',full_page=True);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');assert not errors,errors
   page.evaluate("window.denied=true;void controller.load({quiet:true})");page.wait_for_function("!document.querySelector('.lp-tracking-table')");page.close();print('PASS',width,'presence, linked, unknown, origins, no turn, late read, draft, revoked')
  browser.close()
finally:server.shutdown()
