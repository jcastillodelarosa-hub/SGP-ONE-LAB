from pathlib import Path
import http.server,threading,json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
class Files(http.server.SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT),**kw)
 def log_message(self,*a):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Files);threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
 browser=p.chromium.launch(args=['--no-sandbox'])
 for width in [1440,390]:
  page=browser.new_page(viewport={'width':width,'height':950});page.goto(f'http://127.0.0.1:{server.server_port}/tests/lp01-pdt-registration/fixture.html')
  page.locator('[data-register-order-pdt]').click();page.locator('[data-ref]').select_option('PROFILE');page.locator('[data-source-radio]').check();page.locator('[data-nc]').fill('123456')
  page.locator('[data-save]').click();page.get_by_text('PDT registrado. Puedes cerrar esta ventana.').wait_for();assert page.evaluate("calls.filter(x=>x[0]==='sgp_pdt_registrar_v4').length")==1
  page.screenshot(path=f'/tmp/pdt-ensamble-{width}.png',full_page=True);page.locator('[data-close]').click();page.get_by_text('PDT registrado. Selecciona el pendiente nuevo para indicar sus ventanas afectadas.').wait_for();page.goto(f'http://127.0.0.1:{server.server_port}/tests/ncv-finalizada/fixture.html')
  page.locator('#compact .lp-ncv-finalized').wait_for();page.locator('#panel .lp-ncv-finalized').wait_for()
  assert page.locator('#compact .lp-ncv-finalized').evaluate("e=>getComputedStyle(e).color")=='rgb(22, 101, 52)'
  assert '0 solucionadas' in page.locator('#panel').inner_text() and '0 confirmadas físicamente' in page.locator('#panel').inner_text()
  assert 'Número informado · por verificar' in page.locator('#panel').inner_text()
  page.screenshot(path=f'/tmp/ncv-finalizada-{width}.png',full_page=True)
  page.locator('#reopen').click();page.wait_for_function("document.querySelectorAll('.lp-ncv-finalized').length===0")
  assert '1 ventanas reportadas' in page.locator('#panel').inner_text();page.close()
 browser.close()
server.shutdown();print('PASS PC1440/mobile390: verified profile, NC save, close/refresh, green NCV without physical receipt and reopened source (synthetic backend)')
