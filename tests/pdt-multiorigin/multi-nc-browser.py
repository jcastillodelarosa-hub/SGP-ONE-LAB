"""Picking multi-NC editor on PC/mobile with synthetic RPCs and blocked external traffic."""
import functools
import http.server
import json
import pathlib
import threading
from playwright.sync_api import sync_playwright

ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=ROOT/'tests/pdt-multiorigin/evidence'
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args): pass

server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
base='http://127.0.0.1:'+str(server.server_address[1])
results=[]
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
  for width,height in ((1366,900),(390,844)):
   page=browser.new_page(viewport={'width':width,'height':height})
   errors=[]
   page.on('pageerror',lambda error:errors.append(str(error)))
   page.route('**/*',lambda route:route.continue_() if route.request.url.startswith(base) else route.abort())
   page.goto(base+'/styles.css')
   page.set_content('<link rel="stylesheet" href="'+base+'/styles.css"><main id="qa-host"></main>')
   page.evaluate("""async base=>{
    const {mountPdtRegistration}=await import(base+'/src/modules/pdt-registration-form.js');
    const source={id_pieza:'QA-1',key_produccion:'QA|PANELES_2',produccion:'QA ORDER',codigo_sap:'QA-REF',tipo_pieza:'PANEL',id_linea:'PANELES_2',reserva:'QA-SHARED',reserva_principal:'QA-MAIN',acabado:'AZUL',fabricacion:'QA-FAB',longitud:100,cantidad_referencia:4};
    const client={rpc:async name=>{if(name!=='sgp_pdt_registro_fuentes_v4')throw Error('unexpected RPC');return {data:{ok:true,contract_version:4,fuentes:[source]}}}};
    window.editor=await mountPdtRegistration(document.querySelector('#qa-host'),{client,token:'synthetic',origin:'PICKING',context:{produccion:'QA ORDER'},onChange:valid=>window.canSave=valid});
   }""",base)
   page.locator('[data-ref]').select_option('QA-REF')
   page.locator('[data-source-radio]').check()
   assert page.evaluate('window.canSave')
   assert page.evaluate('window.editor.value()[0].nc')==''
   page.locator('[data-nc]').fill('QA-NC-1')
   page.locator('[data-add-extra]').click()
   page.locator('[data-extra-nc]').fill('QA-NC-2')
   value=page.evaluate('window.editor.value()[0]')
   assert value['ncs']==['QA-NC-1','QA-NC-2'] and value['cantidad']==1
   page.locator('[data-add-extra]').click()
   page.locator('[data-extra-nc]').nth(1).fill('QA-NC-2')
   assert not page.evaluate('window.canSave')
   page.locator('[data-extra-nc]').nth(1).fill('QA-NC-3')
   assert page.evaluate('window.canSave')
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   assert not errors,errors
   page.screenshot(path=str(OUT/('multi-nc-pc.png' if width>500 else 'multi-nc-mobile.png')),full_page=True)
   results.append({'viewport':[width,height],'two_nc_one_piece':True,'duplicate_blocked':True,'optional_nc':True,'no_horizontal_overflow':True,'external_network':'blocked','data':'synthetic','js_errors':errors})
   page.close()
  browser.close()
 (OUT/'multi-nc-browser.json').write_text(json.dumps(results,indent=2)+'\n')
 print(json.dumps(results))
finally:
 server.shutdown()
