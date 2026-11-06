from pathlib import Path
import http.server, threading
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
class Files(http.server.SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw): super().__init__(*a,directory=str(ROOT),**kw)
 def log_message(self,*a): pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Files); threading.Thread(target=server.serve_forever,daemon=True).start(); origin=f'http://127.0.0.1:{server.server_port}'
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for width in (1440,390):
  page=browser.new_page(viewport={'width':width,'height':900}); errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(origin) else r.abort())
  page.goto(origin+'/tests/lp01-b10-correction/fixture.html');page.wait_for_selector('[data-order-summary="QA1|PANELES_2"] [data-summary-cause]')
  row=page.locator('tr').filter(has=page.locator('[data-order-summary="QA1|PANELES_2"]'))
  row.locator('summary').click();page.wait_for_selector('.lp-affect-cause-tabs')
  assert page.locator('[data-tracking-tab="Afectaciones"]').get_attribute('aria-pressed')=='true'
  assert page.locator('[data-shared-legacy] article:visible').count()==1
  assert page.locator('#lp-tracking-drawer').evaluate('(e)=>getComputedStyle(e).position')!='fixed'
  if width<700: assert row.locator('#lp-tracking-drawer').count()==1
  else: assert page.locator('#lp-tracking-drawer').evaluate('(e)=>e.getBoundingClientRect().width')>900
  nav=page.locator('.lp-order-type-tabs');top=nav.evaluate('(e)=>e.offsetTop')
  assert page.locator('[data-order-type]').count()==5 and page.locator('[data-order-type=ALUMINIO]').count()==0
  for cause in ['NC_AL','NC_V','NOVEDAD']:
   row.locator('[data-summary-cause="'+cause+'"]').click();page.wait_for_selector('[data-order-type="'+cause+'"][aria-pressed="true"]')
   assert page.locator('[data-shared-legacy] article:visible').count()==1
   assert page.locator('[data-shared-legacy] article:visible').locator('b').inner_text()=={'NC_AL':'PDT Aluminio','NC_V':'NC Vidrio','NOVEDAD':'Novedades'}[cause]
   assert page.locator('[data-report-context]').count()==0
   assert abs(nav.evaluate('(e)=>e.offsetTop')-top)<2
  page.locator('[data-order-type=NC_AL]').click();assert all(x in page.locator('.lp-aluminum-pending:visible').inner_text() for x in ['PICKING','PRODUCCION','LEGACY','ENSAMBLE','EMPAQUE'])
  row.locator('[data-summary-cause=TECNO]').click();page.wait_for_selector('[data-order-type=TECNO][aria-pressed=true]');assert page.locator('.lp-glass-estimate').is_visible()
  assert page.locator('[data-report-context]').is_hidden()
  page.locator('[data-tracking-close]').click();assert page.locator('#lp-tracking-drawer').is_hidden()
  page.locator('tr').filter(has=page.locator('[data-order-summary="QA2|PANELES_2"]')).locator('summary').click();page.wait_for_selector('[data-shared-list]:visible');assert 'No se devolvieron reportes' in page.locator('[data-shared-list]:visible').inner_text();assert 'Sin pendientes devueltos' in page.locator('.lp-aluminum-pending:visible').inner_text()
  page.locator('[data-tracking-close]').click();row.locator('summary').click();page.wait_for_selector('.lp-affect-cause-tabs');form=page.locator('[data-shared-form]:visible');form.locator('[name=observation]').fill('borrador sin turno');page.evaluate('controller.load({quiet:true})');page.wait_for_timeout(300);assert form.locator('[name=observation]').input_value()=='borrador sin turno';assert page.locator('[data-affect-context]').count()==0
  page.locator('[data-tracking-close]').click();row.locator('summary').focus();page.keyboard.press('Enter');page.wait_for_selector('.lp-affect-cause-tabs');page.locator('[data-tracking-close]').focus();page.keyboard.press('Escape');assert page.locator('#lp-tracking-drawer').is_hidden();assert page.evaluate("document.activeElement.matches('details[data-order-part] > summary')")
  row.locator('[data-summary-cause="NOVEDAD"]').click();page.wait_for_selector('[data-order-type="NOVEDAD"][aria-pressed="true"]');page.locator('#lp-tracking-drawer').screenshot(path=f'/tmp/b10-detail-{width}.png');page.screenshot(path=f'/tmp/b10-page-{width}.png',full_page=True)
  page.evaluate('window.delayAffect=true');page.locator('tr').filter(has=page.locator('[data-order-summary="QA2|PANELES_2"]')).locator('summary').click();page.wait_for_function('!!window.releaseAffect');page.locator('[data-tracking-close]').click();page.evaluate('window.delayAffect=false;window.releaseAffect()');page.wait_for_timeout(100);assert page.locator('#lp-tracking-drawer').is_hidden()
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');assert not errors,errors
  print('PASS',width,'order, four causes, empty, keyboard, close, layout');page.close()
 browser.close()
server.shutdown()
