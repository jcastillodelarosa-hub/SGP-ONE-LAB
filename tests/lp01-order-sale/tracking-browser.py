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
   # Full mountOperation path: a synthetic persisted order definition survives reload,
   # a quiet global refresh preserves focus/selection, and a lost reply retries the
   # same command after filtering the row out and back in.
   app=browser.new_page(viewport={'width':width,'height':850});app_errors=[];app.on('pageerror',lambda e:app_errors.append(str(e)))
   app.goto(f'http://127.0.0.1:{server.server_port}/tests/lp01-pending-ui/fixture.html')
   cell=app.locator('[data-sale-order-key="QA1|PANELES_2"] .lp-sale-row')
   cell.scroll_into_view_if_needed();cell.locator('[data-sale-edit]').wait_for(state='visible')
   cell.locator('[data-sale-edit]').click()
   cell.locator('.lp-sale-dialog:modal [name=quantity]').fill('8')
   note=cell.locator('.lp-sale-dialog:modal [name=observation]');note.fill('Definición QA');note.focus()
   app.evaluate("document.querySelector('[data-sale-order-key=\"QA1|PANELES_2\"] [name=observation]').setSelectionRange(4,9)")
   app.evaluate('window.version++;void controller.load({quiet:true})')
   app.wait_for_function("document.querySelector('[data-sale-order-key=\"QA1|PANELES_2\"] .lp-sale-dialog:modal')!==null")
   assert note.input_value()=='Definición QA'
   assert app.evaluate("document.activeElement===document.querySelector('[data-sale-order-key=\"QA1|PANELES_2\"] [name=observation]') && document.activeElement.selectionStart===4 && document.activeElement.selectionEnd===9")
   cell.locator('.lp-sale-dialog:modal [data-sale-save]').click()
   app.wait_for_function("document.querySelector('[data-sale-order-key=\"QA1|PANELES_2\"] [data-sale-edit]')?.textContent.includes('8')")
   app.reload();cell.scroll_into_view_if_needed();cell.locator('[data-sale-edit]').wait_for(state='visible')
   assert '8' in cell.locator('[data-sale-edit]').inner_text()
   cell.locator('[data-sale-edit]').click()
   cell.locator('.lp-sale-dialog:modal [name=quantity]').fill('10')
   cell.locator('.lp-sale-dialog:modal [name=observation]').fill('Segundo valor')
   app.evaluate('qaSale.lost=true')
   cell.locator('.lp-sale-dialog:modal [data-sale-save]').click()
   app.wait_for_function("document.querySelector('[data-sale-order-key=\"QA1|PANELES_2\"] [data-sale-status]')?.textContent.includes('Resultado sin confirmar')")
   cell.locator('[data-sale-cancel]').click()
   app.locator('[data-tracking-status]').select_option('PENDIENTE_CONCILIACION')
   assert app.locator('[data-sale-order-key="QA1|PANELES_2"]').count()==0
   app.locator('[data-tracking-status]').select_option('')
   cell.scroll_into_view_if_needed();cell.locator('[data-sale-edit]').click()
   cell.locator('.lp-sale-dialog:modal [data-sale-retry]').click()
   app.wait_for_function("document.querySelector('[data-sale-order-key=\"QA1|PANELES_2\"] [data-sale-edit]')?.textContent.includes('10')")
   assert app.evaluate("qaSale.ids.at(-1)===qaSale.ids.at(-2) && qaSale.records['QA1|PANELES_2'].history.length===2")
   assert not app_errors,app_errors
   results[-1].update({'controllerQuietFocusAndSelection':True,'reloadPersistence':True,'uncertainRetryAcrossFilterSameId':True})
   app.close()
  browser.close()
 (Path(__file__).parent/'tracking-result.json').write_text(json.dumps(results,indent=2)+'\n')
 print(json.dumps(results))
finally:server.shutdown()
