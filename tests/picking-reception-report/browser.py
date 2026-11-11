"""PC/mobile test of actual report markup and controllers with synthetic RPCs only.
Requires a local browser-enabled executor; never contacts Supabase or writes production.
"""
import functools,http.server,json,pathlib,threading,os
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=pathlib.Path('/tmp/sgp-reception-report-browser');OUT.mkdir(exist_ok=True)
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args): pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
url='http://127.0.0.1:'+str(server.server_address[1])
html=(ROOT/'index.html').read_text();section=html[html.index('<section class="view" data-view-panel="picking"'):html.index('<section class="view sgp-home"')].replace('data-view-panel="picking" hidden','data-view-panel="picking"')
try:
 with sync_playwright() as playwright:
  browser=playwright.chromium.launch(executable_path=os.environ.get('SGP_CHROME_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
  checks=[]
  for width,height in [(1746,1168),(390,844)]:
   page=browser.new_page(viewport={'width':width,'height':height});errors=[]
   page.on('pageerror',lambda error:errors.append(str(error)))
   page.route('**/*',lambda route:route.continue_() if route.request.method=='GET' and route.request.url.startswith(url+'/') else route.abort())
   page.goto(url+'/styles.css')
   page.set_content('<base href="'+url+'/"><link rel="stylesheet" href="styles.css"><link rel="stylesheet" href="picking-delivery-report.css"><header style="padding:12px;background:#103b73;color:white">VISTA PREVIA LOCAL · DATOS FICTICIOS · NO PUBLICADO</header><main style="padding:16px;min-width:0">'+section+'</main>')
   page.evaluate('''async()=>{
    const {initPickingDeliveryReport}=await import('./src/modules/picking-delivery-report-controller.js');
    const {initPickingReceptionReport}=await import('./src/modules/picking-reception-report-controller.js');
    window.calls=[];
    const rows=Array.from({length:6},(_,i)=>({id_recepcion:'demo-'+i,id_entrega:'demo-'+i,id_programacion:'p'+i,produccion:'DEMO-00'+(i+1),reserva:'R-DEMO-10'+i,sistema:['EL400','SGD2020','MX4000'][i%3],fecha_recepcion:'2026-11-'+String(11-Math.floor(i/2)).padStart(2,'0'),turno_recepcion:i%2?'TURNO 2':'TURNO 1',registrado_en:'2026-11-11T14:30:00Z',nombre_entrego:i%2?'Ana Demo':'Carlos Demo',nombre_recibio:i%2?'María Demo':'Luis Demo',completa_al_recibir:i%2===0,pendientes_al_recibir:i%2?[{cantidad:2,perfil:'ES-SGD2020-088',observacion:'Falta mecanizado',fabricacion:'Marco Demo'}]:[],cantidad_ventanas_recibidas:null}));
    const client={rpc:async(name,args)=>{window.calls.push(name);if(name!=='sgp_picking_reporte_recepciones_v1')throw Error('Unexpected RPC');return {data:{ok:true,contract_version:1,rows,total_rows:rows.length,coverage:{recepciones_sin_fecha_operativa:0},warnings:['VENTANAS_RECIBIDAS_NO_CONSTAN']}};}};
    const options={getSupabaseClient:async()=>client,getAppToken:()=> 'synthetic-only'};initPickingDeliveryReport(options);initPickingReceptionReport(options);
   }''')
   page.locator('#pickReportTab').click();page.locator('#pickReportReceptionTab').click();page.locator('#pickReceptionReportWeek').fill('2026-W46');page.locator('#pickReceptionReportWeek').dispatch_event('change');page.locator('#pickReceptionReportRun').click()
   page.locator('#pickReceptionReportRows tbody tr').first.wait_for();assert page.locator('#pickReceptionReportRows tbody tr').count()==6
   assert page.evaluate('document.documentElement.scrollWidth')<=width
   page.screenshot(path=str(OUT/f'reception-{width}.png'),full_page=True)
   page.locator('#pickReceptionReportRows summary').first.click();assert page.locator('#pickReceptionReportRows details').first.get_attribute('open') is not None
   page.locator('#pickReceptionReportSearch').fill('DEMO-002');assert page.locator('#pickReceptionReportRows tbody tr').count()==1
   page.locator('#pickReceptionReportState').select_option('completa');assert page.locator('#pickReceptionReportRows tbody tr').count()==0
   page.locator('#pickReportDeliveryTab').click();page.locator('#pickReportReceptionTab').click();assert page.locator('#pickReceptionReportSearch').input_value()=='DEMO-002'
   page.locator('#pickDeliveryTab').click();page.locator('#pickDirectReport').click();assert page.locator('#pickReportDeliveryPanel').is_visible();page.keyboard.press('Escape');assert page.locator('.pick-report-modal-overlay').count()==0
   assert not errors,errors;assert set(page.evaluate('window.calls'))=={'sgp_picking_reporte_recepciones_v1'}
   checks.append({'viewport':width,'passed':True,'source':'synthetic read-only fixture'});page.close()
  browser.close();(OUT/'result.json').write_text(json.dumps(checks,indent=2))
finally:server.shutdown()
