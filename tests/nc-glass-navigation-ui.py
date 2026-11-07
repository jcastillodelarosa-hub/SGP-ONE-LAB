from playwright.sync_api import sync_playwright
from pathlib import Path
import json, os, shutil, threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
root=Path(__file__).resolve().parents[1]
out=Path(os.environ.get('NCV_UI_OUTPUT',str(root/'test-artifacts'/'ncv-navigation')));out.mkdir(parents=True,exist_ok=True)
server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(root)))
threading.Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/tests/fixtures/nc-glass-navigation.html'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROME_BIN') or shutil.which('chromium'),headless=True,args=['--no-sandbox'])
 for label,viewport in [('pc',{'width':1440,'height':900}),('mobile',{'width':390,'height':844})]:
  page=b.new_page(viewport=viewport); errors=[];page.on('pageerror',lambda e: errors.append(str(e)))
  page.goto(url);page.wait_for_function('window.fixtureReady===true')
  page.locator('#start').click();page.get_by_role('button',name='Buscar coincidencias').click();page.locator('[data-results] article').nth(1).wait_for()
  assert page.evaluate('testState.opened.length')==0
  rect=page.locator('dialog').bounding_box();assert rect['x']>=0 and rect['x']+rect['width']<=viewport['width']+1
  assert page.evaluate('document.querySelector("dialog").scrollHeight >= document.querySelector("dialog").clientHeight')
  page.screenshot(path=str(out/f'ncv-search-{label}.png'),full_page=True)
  page.locator('[data-results] article').nth(1).get_by_role('button').click();page.wait_for_function('testState.opened.length===1');assert page.locator('dialog').count()==0
  assert page.evaluate('testState.opened[0].key')=='1314101|PANELES_2'
  assert 'no vinculada' in page.locator('#destination').inner_text()
  assert set(page.evaluate('testState.calls'))=={'sgp_consultar_nc_vidrio','sgp_lp_seguimiento_consultar'}
  page.locator('#start').click();page.locator('select[name=stage]').select_option('EMPAQUE');page.get_by_role('button',name='Buscar coincidencias').click();page.locator('[data-results] article').first.wait_for();page.get_by_role('button',name='Cerrar búsqueda').click();assert page.evaluate('testState.opened.length')==1
  page.evaluate('testState.mode="delay"');page.locator('#start').click();page.get_by_role('button',name='Buscar coincidencias').click();page.wait_for_function('testState.pending.length>0');page.keyboard.press('Escape');page.evaluate('testState.mode="normal";testState.pending.splice(0).forEach(f=>f())');page.wait_for_timeout(100);assert page.locator('dialog').count()==0;assert page.evaluate('testState.opened.length')==1
  page.evaluate('testState.mode="deny"');page.locator('#start').click();page.get_by_role('button',name='Buscar coincidencias').click();page.wait_for_function('document.querySelector("[data-status]").textContent.includes("NO_AUTORIZADO")');assert page.locator('[data-results] article').count()==0;page.get_by_role('button',name='Cerrar búsqueda').click()
  page.evaluate('testState.mode="empty"');page.locator('#start').click();page.get_by_role('button',name='Buscar coincidencias').click();page.wait_for_function('document.querySelector("[data-status]").textContent.includes("Sin coincidencias")');page.get_by_role('button',name='Cerrar búsqueda').click()
  page.evaluate('testState.mode="normal"');page.locator('#start').click();page.evaluate('testState.token="B";document.dispatchEvent(new CustomEvent("sgp:lp-role",{detail:"COORDINADOR"}))');assert page.locator('dialog').count()==0
  assert not errors,errors
  print(label+': PASS search/explicit choice/cancel/delayed/denied/empty/session/viewport/read-only')
  page.close()
 b.close()

server.shutdown()
