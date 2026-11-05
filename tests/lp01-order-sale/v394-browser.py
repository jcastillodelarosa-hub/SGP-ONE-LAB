"""Compact timeout, retry and removed global advance, with synthetic data only."""
from pathlib import Path
import http.server, threading
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[2]
class Files(http.server.SimpleHTTPRequestHandler):
 def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(ROOT),**kwargs)
 def log_message(self,*args):pass

server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Files)
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for width in (1440,390):
   page=browser.new_page(viewport={'width':width,'height':850})
   errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
   page.goto(f'http://127.0.0.1:{server.server_port}/tests/lp01-order-sale/tracking-fixture.html?fail')
   retry=page.locator('[data-sale-load]')
   retry.wait_for(state='attached')
   assert retry.inner_text()=='Error · ↻'
   assert 'No se pudo consultar Disponible' in retry.get_attribute('aria-label')
   assert 'Por definir' in page.locator('.lp-sale-row').nth(1).inner_text()
   assert page.locator('th').filter(has_text='Avance').count()==0
   assert page.locator('td[data-label^="Avance"]').count()==0
   assert page.locator('td[data-label="Disponible"]').count()==2
   row=page.locator('.lp-tracking-table tbody tr').first
   before=row.bounding_box()['height']
   retry.click()
   page.locator('[data-sale-edit]').first.wait_for(state='visible')
   assert '40' in page.locator('.lp-sale-row').first.inner_text()
   assert row.bounding_box()['height']<=before+2
   page.evaluate('qaChange()')
   assert '40' in page.locator('.lp-sale-row').first.inner_text()
   assert not errors,errors
   page.close()
  browser.close()
 print('PASS v394 compact timeout, retry, quiet render and no global advance: PC/mobile')
finally:
 server.shutdown()
