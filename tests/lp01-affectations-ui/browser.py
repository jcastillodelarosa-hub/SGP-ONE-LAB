import functools, http.server, threading
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[2]
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(root)))
threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for width in [1440,390]:
  page=browser.new_page(viewport={'width':width,'height':900});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(f'http://127.0.0.1:{server.server_port}/tests/lp01-affectations-ui/fixture.html')
  def submit(action,n,obs):
   page.locator('[name=action]').select_option(action);page.locator('[name=quantity]').fill(str(n));page.locator('[name=observation]').fill(obs);page.get_by_role('button',name='Guardar',exact=True).click();page.wait_for_function("document.querySelector('[data-result]').textContent==='Guardado'")
  page.locator('[name=cause]').select_option('NOVEDAD')
  submit('CREATE',5,'Novedad de orden');assert page.locator('.lp-affect-reports article').count()==1
  submit('SOLVE',3,'Origen reporta solución parcial');assert '0 confirmadas' in page.locator('.lp-affect-reports').inner_text()
  assert 'No disponible' in page.locator('#panel').inner_text()
  submit('CONFIRM',2,'Recibidas físicamente dos ventanas');assert '2 confirmadas' in page.locator('.lp-affect-reports').inner_text()
  assert page.locator('[name=action] option[value=VALIDATE]').count()==0
  page.locator('#role').select_option('COORDINADOR');page.wait_for_selector('[name=action] option[value=VALIDATE]',state='attached')
  submit('VALIDATE',3,'Tres ventanas distintas siguen afectadas');assert 'Disponibles: 17' in page.locator('#panel').inner_text()
  page.get_by_text('Historial autorizado de la producción · contexto ENSAMBLE',exact=True).click();assert page.locator('details article').count()==4
  assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
  page.screenshot(path=f'/tmp/lp-affectations-{width}.png',full_page=True)
  page.evaluate('window.revoked=true');page.get_by_role('button',name='Actualizar datos').click();page.wait_for_function("document.querySelector('#panel').textContent.includes('Acceso revocado')");assert page.locator('.lp-affect-reports').count()==0
  assert not errors,errors
  page.close();print(f'PASS panel {width}: report, partial solution, physical confirmation, coordinator validation, history')
 browser.close()
server.shutdown()
