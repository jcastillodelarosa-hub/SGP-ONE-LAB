"""Real PDT modules, synthetic transport, no production writes."""
import http.server,threading,pathlib,os
from playwright.sync_api import sync_playwright
root=pathlib.Path(__file__).resolve().parents[2]
class Files(http.server.SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(root),**kw)
 def log_message(self,*a):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Files);threading.Thread(target=server.serve_forever,daemon=True).start()
out=pathlib.Path(os.environ.get('SGP_VISUAL_OUTPUT','/tmp/pdt-table-design'));out.mkdir(parents=True,exist_ok=True)
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('RECEPTION_CHROMIUM','/usr/bin/chromium'),args=['--no-sandbox'])
  for width in [1440,768,390]:
   for manual in [False,True]:
    page=browser.new_page(viewport={'width':width,'height':950})
    page.route('https://**/*',lambda route:route.abort())
    page.goto(f'http://127.0.0.1:{server.server_port}/tests/pdt-table-design/fixture.html')
    page.wait_for_function('window.openFixture')
    page.evaluate('manual=>openFixture(manual)',manual)
    if manual:page.locator('[data-production]').select_option('QA|R')
    page.locator('[data-ref]').select_option('CODE1')
    selector='[data-group]' if manual else '[data-source-radio]'
    page.locator(selector).check()
    page.locator('[data-qty]').fill('2')
    nc='[data-nc-index]' if manual else '[data-nc]'
    page.locator(nc).fill('NC-1')
    page.locator('[data-obs]').fill('Detalle uno')
    page.locator('[data-add]').click()
    page.locator('[data-ref]').nth(1).select_option('CODE2')
    page.locator(selector).nth(1).check()
    page.locator('[data-qty]').nth(1).fill('3')
    page.locator(nc).nth(1).fill('NC-2')
    page.locator('[data-obs]').nth(1).fill('Detalle dos')
    assert page.locator('[data-qty]').nth(0).input_value()=='2'
    assert page.locator(nc).nth(0).input_value()=='NC-1'
    assert page.locator('tr[data-selected=true]').count()==2
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.locator('.repo-work-body').evaluate('e=>e.scrollTop=0')
    page.screenshot(path=str(out/f'{"manual" if manual else "ensamble"}-{width}.png'),full_page=True)
    page.locator('[data-save]').click()
    page.wait_for_function("calls.some(x=>['sgp_pdt_manual_registrar_v1','sgp_pdt_registrar_v4'].includes(x.name))")
    payload=page.evaluate("calls.filter(x=>['sgp_pdt_manual_registrar_v1','sgp_pdt_registrar_v4'].includes(x.name)).at(-1).args")
    rows=payload['p_detalles' if manual else 'p_piezas']
    assert len(rows)==2 and [r['cantidad'] for r in rows]==[2,3]
    assert [r['perfil'] for r in rows]==['CODE1','CODE2']
    assert [r['nc'] for r in rows]==['NC-1','NC-2']
    assert [r['observacion'] for r in rows]==['Detalle uno','Detalle dos']
    page.close()
  browser.close()
 print('PASS direct table 1440/768/390: manual and Ensamble, 2 independent source identities and payloads')
finally:server.shutdown()
