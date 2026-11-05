"""Actual renderTracking and compact Disponible cell; synthetic data, no production or SQL."""
from pathlib import Path
import http.server,threading,json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
class Files(http.server.SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT),**kw)
 def log_message(self,*a):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Files);threading.Thread(target=server.serve_forever,daemon=True).start()
results=[]
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for width in (1440,390):
   page=browser.new_page(viewport={'width':width,'height':850});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(f'http://127.0.0.1:{server.server_port}/tests/lp01-order-sale/tracking-fixture.html')
   page.wait_for_function("document.querySelectorAll('[data-sale-edit]').length===2")
   assert page.locator('th').filter(has_text='Disponible').count()==1
   cells=page.locator('.lp-sale-row')
   assert '40' in cells.nth(0).inner_text() and 'Por definir' in cells.nth(1).inner_text()
   row=page.locator('.lp-tracking-table tbody tr').first
   before=row.evaluate('(e)=>e.getBoundingClientRect().height')
   cells.nth(0).locator('[data-sale-edit]').click()
   page.locator('.lp-sale-dialog:modal [name=quantity]').fill('42')
   page.locator('.lp-sale-dialog:modal [name=observation]').fill('Corrección de prueba')
   page.evaluate('qaChange()')
   assert page.locator('.lp-sale-dialog:modal').count()==1
   assert page.locator('.lp-sale-dialog:modal [name=quantity]').input_value()=='42'
   assert page.locator('.lp-sale-dialog:modal [name=observation]').input_value()=='Corrección de prueba'
   assert page.evaluate("document.activeElement===document.querySelector('.lp-sale-dialog:modal [name=observation]')")
   after=row.evaluate('(e)=>e.getBoundingClientRect().height');assert abs(after-before)<1,(before,after)
   page.locator('.lp-sale-dialog:modal [data-sale-cancel]').click()
   assert page.locator('.lp-sale-dialog:visible').count()==0
   assert abs(row.evaluate('(e)=>e.getBoundingClientRect().height')-before)<1
   page.locator('[data-tracking-status]').select_option('PENDIENTE_CONCILIACION')
   assert page.locator('.lp-tracking-table tbody tr').count()==0
   page.locator('[data-tracking-status]').select_option('')
   assert '40' in page.locator('.lp-sale-row').first.inner_text()
   assert not errors,errors
   results.append({'width':width,'header':'Disponible','rows':['40','Por definir'],'rowHeightBefore':before,'rowHeightAfterQuiet':after,'editorModalAfterQuiet':True,'focusPreserved':True,'filterAndCancel':True})
   page.close()
  browser.close()
 (Path(__file__).parent/'tracking-result.json').write_text(json.dumps(results,indent=2)+'\n')
 print(json.dumps(results))
finally:server.shutdown()
