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
   assert 'Sin reportes ni pendientes de aluminio devueltos' in page.locator('[data-order-summary="QA2|PANELES_2"]').inner_text()
   assert 'pendientes de aluminio no disponibles' in page.locator('[data-order-summary="QA4|PANELES_2"]').inner_text()
   assert '2 × NC AL' in page.locator('[data-order-summary="QA5|PANELES_2"]').inner_text();assert page.locator('[data-order-summary="QA5|PANELES_2"] [data-summary-cause=ALUMINIO]').count()==0
   pending.locator('[data-summary-cause=ALUMINIO]').click();page.wait_for_selector('[data-cause-filter=ALUMINIO][aria-pressed=true]');assert all(x in page.locator('.lp-aluminum-pending').inner_text() for x in ['PRODUCCION','LEGACY','PICKING'])
   assert 'edición actual aún exige' not in page.locator('#lp-tracking-drawer').inner_text();assert 'Disponible se consulta por orden' in page.locator('[data-sale-context]').inner_text();assert page.locator('[data-live-operate]').inner_text()=='Avance · requiere asignación'
   assert page.locator('[data-register-affectation] summary').is_visible();assert page.evaluate("document.querySelector('[data-report-context]').compareDocumentPosition(document.querySelector('[data-order-affectations]')) & Node.DOCUMENT_POSITION_FOLLOWING")
   page.locator('[data-register-affectation] summary').click();form=page.locator('[data-affect-context]');form.locator('[name=date]').fill('2026-11-05');form.locator('[name=shift]').select_option('1');form.locator('button').click();page.wait_for_function("document.querySelector('[data-context-status]').textContent.includes('No hay un turno abierto')");assert page.locator('[data-order-affectations] form').is_hidden()
   page.evaluate('window.delayTurn=true');form.locator('button').click();page.wait_for_function('!!window.releaseTurn');form.locator('[name=date]').fill('2026-11-04');page.evaluate('window.delayTurn=false;window.releaseTurn()');page.wait_for_timeout(150);assert page.locator('[data-order-affectations] form').is_hidden();form.locator('button').click();page.wait_for_function("document.querySelector('[data-context-status]').textContent.includes('Registro en')");page.wait_for_selector('[data-order-affectations] form:visible');page.locator('[data-order-affectations] [name=cause]').select_option('NOVEDAD');page.locator('[data-order-affectations] [name=observation]').fill('borrador sintético');page.evaluate('controller.load({quiet:true})');page.wait_for_timeout(300);assert page.locator('[data-order-affectations] [name=observation]').input_value()=='borrador sintético'
   page.locator('[data-order-affectations] [name=quantity]').fill('1');page.locator('[data-order-affectations] button[type=submit]').click();page.wait_for_function("document.querySelector('[data-result]').textContent.includes('El turno ya no está abierto')");assert page.locator('[data-order-affectations] [name=observation]').input_value()=='borrador sintético'
   page.locator('#lp-tracking-drawer').screenshot(path=f'/tmp/b10-pending-detail-{width}.png');page.screenshot(path=f'/tmp/b10-pending-{width}.png',full_page=True);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');assert not errors,errors
   page.evaluate("window.denied=true;void controller.load({quiet:true})");page.wait_for_function("!document.querySelector('.lp-tracking-table')");page.close();print('PASS',width,'presence, linked, unknown, origins, turn, draft, revoked')
  browser.close()
finally:server.shutdown()
