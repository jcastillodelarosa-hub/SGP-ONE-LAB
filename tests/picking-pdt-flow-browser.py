"""Synthetic isolated browser tests; no production or external requests."""
import functools,http.server,json,pathlib,threading,os
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1];OUT=pathlib.Path(os.environ.get('SGP_QA_OUT','/tmp/picking-pdt-flow-ui'));OUT.mkdir(exist_ok=True)
class H(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(H,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start();url='http://127.0.0.1:'+str(server.server_address[1])
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('SGP_QA_CHROMIUM','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
  for width,height in [(1440,1000),(390,844)]:
   page=browser.new_page(viewport={'width':width,'height':height});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.route('**/*',lambda r:r.continue_() if r.request.method=='GET' and r.request.url.startswith(url+'/') else r.abort())
   page.goto(url+'/styles.css');page.set_content(f'<link rel="stylesheet" href="{url}/styles.css"><link rel="stylesheet" href="{url}/picking-pdt-flow.css"><header id="alerts"></header><main style="padding:16px;min-width:0"><div id="delivery"><button id="legacy">Orden existente</button></div><div id="reception"><p>Recepción existente</p></div></main>')
   page.evaluate('''async base=>{const {mountPickingPdtFlow,filterPickingPdt}=await import(base+'/src/ui/picking-pdt-flow.js');window.token='synthetic';window.calls=[];window.failMove=false;window.failRead=false;window.row={id:'a',semana:47,produccion:'Orden sintética',reserva:'QA',perfil:'ES-QA',nc:'300',procesado:4,entregado:2,recibido:1,can_deliver:true,can_receive:true,estado:'ENTREGA_PARCIAL',movimientos:[{tipo:'ENTREGAR',cantidad:2,nombre:'Operador QA',fecha:'2026-11-18'}]};window.data=(params={})=>({ok:true,contract_version:1,has_more:false,next_cursor:null,unread_count:1,capabilities:{deliver:true,receive:true},rows:filterPickingPdt([window.row],{mode:params.p_modo,state:params.p_estado||'all',week:params.p_semana||'',query:params.p_busqueda||''}),notifications:[{id:'n',produccion:'Orden sintética',perfil:'ES-QA',cantidad:2}]});window.ui=mountPickingPdtFlow({deliveryPanel:document.querySelector('#delivery'),receptionPanel:document.querySelector('#reception'),notificationHost:document.querySelector('#alerts'),getToken:()=>window.token,getActor:()=>({id:'qa'}),api:{notices:async()=>window.data(),list:async params=>{if(window.failRead)throw Error('Offline');return window.data(params)},move:async payload=>{calls.push({...payload});await new Promise(r=>setTimeout(r,40));if(window.failMove)throw Error('Timeout');return {ok:true}},read:async()=>({ok:true})}});await ui.refresh();}''',url)
   assert page.locator('#legacy').is_visible();assert page.locator('#delivery .picking-pdt-attention').is_visible()
   page.locator('#delivery [data-pdt-kind="pdt"]').click();assert not page.locator('#legacy').is_visible();page.locator('#delivery [data-pdt-move]').click();page.locator('[data-pdt-quantity]').fill('1');page.locator('[data-pdt-save]').click();page.wait_for_function('window.calls.length===1');page.wait_for_timeout(100);assert not page.locator('.picking-pdt-modal').is_visible()
   assert not page.locator('[data-pdt-receipt-date]').is_visible()
   page.locator('#reception [data-pdt-kind="pdt"]').click();page.locator('#reception [data-pdt-move]').click()
   for attr in ['date','shift']:
    field=page.locator('[data-pdt-receipt-'+attr+']');assert field.is_visible()
    bounds=field.bounding_box();assert bounds['x']>=0 and bounds['x']+bounds['width']<=width
   page.locator('[data-pdt-receipt-date]').fill('2026-01-01');page.locator('[data-pdt-receipt-shift]').select_option('TURNO 2')
   page.screenshot(path=str(OUT/f'receipt-shift-{width}.png'),full_page=True)
   page.locator('[data-pdt-cancel]').click()
   page.evaluate('window.failMove=true');page.locator('#delivery [data-pdt-move]').click();page.locator('[data-pdt-save]').click();page.wait_for_timeout(100);assert 'No se confirmó' in page.locator('[data-pdt-error]').inner_text();page.locator('[data-pdt-cancel]').click()
   page.evaluate('window.row.entregado=4;window.row.recibido=4;window.row.estado="CERRADO";window.failMove=false;window.ui.refresh()');page.wait_for_timeout(80)
   assert page.locator('#delivery [data-pdt-move]').count()==0;page.locator('#delivery [data-pdt-pending-retry]').click();page.wait_for_timeout(100)
   calls=page.evaluate('window.calls');assert calls[1]['p_request_id']==calls[2]['p_request_id'];assert page.locator('#delivery [data-pdt-pending-retry]').count()==0
   page.locator('#reception [data-pdt-kind="pdt"]').click();page.locator('#reception [data-pdt-history]').click();page.wait_for_timeout(80);assert 'Cerrado' in page.locator('#reception tbody').inner_text()
   page.locator('#reception summary').click();assert 'Operador QA' in page.locator('#reception tbody').inner_text()
   page.screenshot(path=str(OUT/f'flow-{width}.png'),full_page=True)
   page.evaluate('window.token="";window.ui.reset()');assert not page.locator('#alerts .picking-pdt-notifications').is_visible();assert page.locator('[data-pdt-move]').count()==0
   assert page.evaluate('document.documentElement.scrollWidth')<=width;assert not errors,errors
   page.evaluate('window.ui.destroy()');assert page.locator('#legacy').is_visible();page.close()
  browser.close()
 print(json.dumps({'status':'PASS','viewports':[1440,390],'screenshots':str(OUT)}))
finally:server.shutdown()
