"""Real manual form, mocked RPCs, synthetic data only; no external network."""
import functools,http.server,pathlib,threading,os
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2]
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args): pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_address[1]}'
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('SGP_QA_CHROMIUM','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
  for width,height in [(1366,900),(390,844)]:
   page=browser.new_page(viewport={'width':width,'height':height});errors=[]
   page.on('pageerror',lambda err:errors.append(str(err)))
   page.route('https://**/*',lambda route:route.abort())
   page.goto(base+'/styles.css');page.set_content(f'<link rel="stylesheet" href="{base}/styles.css">')
   page.evaluate('''async base=>{
    const {openManualPdt}=await import(base+'/src/modules/pdt-manual-form.js');
    window.calls=[];window.saved=false;
    const context={anio:2026,semana:47,key_produccion:'QA|PANELES_2',reserva:'R',produccion:'QA ORDER',sistema:'ES',acabado:'DS',linea:'PANELES_2'};
    window.client={rpc:async(name,args)=>{window.calls.push({name,args});
     if(name==='sgp_pdt_manual_catalogo_v1')return {data:{ok:true,producciones:[context]}};
     if(name==='sgp_pdt_manual_fuentes_v1')return {data:{ok:true,fuentes:[{...context,id_pieza:'P1',codigo_sap:'REF',tipo_pieza:'PANEL',id_linea:'PANELES_2',fabricacion:'E17',marca:'A',longitud:100,cantidad_referencia:5}]}};
     if(name==='sgp_pdt_manual_nc_consultar_v1')return {data:{ok:true,nc:{numero:'QA-NC',estado:'ABIERTA'}}};
     if(name==='sgp_pdt_manual_registrar_v1')return {data:{ok:true,id_reporte:'QA',ids_pendientes:['QA-PDT']}};
     throw Error('Unexpected RPC '+name);
    }};
    window.open=role=>openManualPdt({client:window.client,token:'synthetic-picker-token',role,onSaved:()=>{window.saved=true;}});
    await window.open('PICKING');
   }''',base)
   assert page.locator('[data-origin]').is_disabled()
   assert page.locator('[data-origin] option').all_text_contents()==['PICKING']
   page.locator('[data-production]').select_option('QA|PANELES_2|R')
   page.locator('[data-ref]').select_option('REF');page.locator('[data-group]').check()
   page.locator('[data-qty]').fill('6');assert page.locator('[data-save]').is_disabled()
   page.locator('[data-qty]').fill('2');page.locator('[data-nc-index]').fill('QA-NC');page.locator('[data-nc-index]').blur()
   page.locator('[data-save]').click();page.wait_for_function('window.saved')
   call=page.evaluate("calls.find(x=>x.name==='sgp_pdt_manual_registrar_v1')")
   assert call['args']['p_origen']=='PICKING'
   assert call['args']['p_detalles'][0]['cantidad']==2
   assert call['args']['p_detalles'][0]['ncs']==['QA-NC']
   assert page.locator('[data-save]').is_disabled()
   page.locator('[data-close]').click()
   page.evaluate("window.open('LIDER LINEA')")
   assert page.locator('[data-origin] option').all_text_contents()==['ENSAMBLE','EMPAQUE']
   page.locator('[data-close]').click()
   assert page.evaluate("window.open('RECEPCION').then(()=>false,()=>true)")
   assert not errors,errors
   page.close();print('PASS browser',width,height,'create + NC, quantity guard, locked origin, leaders, unauthorized')
  browser.close()
finally: server.shutdown()
