"""Novelty identity UI with actual modal markup and mocked read-only origins. No Supabase."""
import functools,http.server,json,pathlib,threading
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'tests/pdt-identity/evidence';OUT.mkdir(exist_ok=True)
class H(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(H,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start();base='http://127.0.0.1:'+str(server.server_address[1])
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
  results=[]
  for width,height in [(1440,1100),(390,844)]:
   page=browser.new_page(viewport={'width':width,'height':height});errors=[]
   page.on('pageerror',lambda e:errors.append(e.name));page.route('https://**/*',lambda r:r.abort())
   page.goto(base+'/styles.css');page.set_content('<link rel="stylesheet" href="'+base+'/styles.css"><main id="fixture"></main>')
   page.evaluate('''async args=>{
    const markup=new DOMParser().parseFromString(args.html,'text/html');const root=document.importNode(markup.querySelector('#prodNoveltyModal'),true);document.querySelector('#fixture').append(root);root.hidden=false;
    root.querySelector('#prodNoveltyContext').textContent='Prueba local · maestro/orígenes simulados · ninguna operación productiva';
    root.querySelector('#prodNoveltyReserve').innerHTML='<option value="SHARED" data-finish="DS">SHARED · asociada · DS</option><option value="PRIMARY" data-finish="DS">PRIMARY · principal · DS</option>';
    root.querySelector('#prodNoveltyFinish').value='DS';root.querySelector('#prodNoveltyQty').value='9';
    const {attachNoveltyIdentity}=await import(args.base+'/src/modules/production-novelty-identity.js');
    window.calls=[];window.mode='ok';
    const rows=[{id_pieza:'QA:PANEL',codigo_sap:'PANEL-REF',tipo_pieza:'PANEL',destino_productivo:'PANEL',activo:'SI',id_linea:'PANELES_2',key_produccion:'QA|PANELES_2',produccion:'MISMO NOMBRE QA',reserva:'SHARED',reserva_principal:'PRIMARY',acabado:'DS',longitud:100,fabricacion:'E17',reservas:[]},{id_pieza:'QA:FRAME',codigo_sap:'FRAME-REF',tipo_pieza:'FRAME',destino_productivo:'FRAME',activo:'SI',id_linea:'FRAMES_2',key_produccion:'QA|FRAMES_2',produccion:'MISMO NOMBRE QA',reserva:'SHARED',reserva_principal:'PRIMARY',acabado:'DS',longitud:100,fabricacion:'F17',reservas:[]}];
    window.manager=attachNoveltyIdentity({root,token:null,production:null,client:{rpc:async(name,args)=>{window.calls.push({name,args});if(window.mode==='missing')return {error:{code:'PGRST202',message:'missing'}};if(window.mode==='empty')return {data:[]};return {data:rows.filter(r=>r.codigo_sap.includes(args.p_buscar.toUpperCase())).map(r=>({...r,reserva:args.p_reserva}))};}}});
    await window.manager.refresh();
   }''',{'html':(ROOT/'index.html').read_text(),'base':base})
   page.locator('#prodNoveltyProfile').fill('PANEL');page.locator('#prodNoveltyPiece option[value="0"]').wait_for(state='attached')
   assert page.locator('#prodNoveltySave').is_disabled()
   page.locator('#prodNoveltyPiece').select_option('0');assert not page.locator('#prodNoveltySave').is_disabled()
   assert 'PANEL → PANELES_2' in page.locator('#prodNoveltyLine').inner_text();assert page.evaluate('window.manager.getIdentity().key_produccion')=='QA|PANELES_2'
   if width==390:page.locator('#prodNoveltyLine').scroll_into_view_if_needed()
   page.screenshot(path=str(OUT/('panel-'+str(width)+'.png')),full_page=True)
   page.locator('#prodNoveltyProfile').fill('FRAME');page.wait_for_function("document.querySelector('#prodNoveltyPiece').options[1]?.textContent.includes('FRAME → FRAMES_2')")
   page.locator('#prodNoveltyPiece').select_option('0');assert page.evaluate('window.manager.getIdentity().key_produccion')=='QA|FRAMES_2'
   assert 'FRAME → FRAMES_2' in page.locator('#prodNoveltyLine').inner_text()
   if width==390:page.locator('#prodNoveltyLine').scroll_into_view_if_needed()
   page.screenshot(path=str(OUT/('frame-'+str(width)+'.png')),full_page=True)
   page.locator('#prodNoveltyReserve').select_option('PRIMARY');assert page.locator('#prodNoveltySave').is_disabled()
   page.wait_for_function("!document.querySelector('#prodNoveltyPiece').disabled");page.locator('#prodNoveltyPiece').select_option('0')
   assert page.evaluate('window.manager.getIdentity().reserva')=='PRIMARY'
   page.evaluate('window.manager.setSaving(true)');page.locator('#prodNoveltyProfile').fill('PANEL');assert page.locator('#prodNoveltySave').is_disabled()
   page.wait_for_function("!document.querySelector('#prodNoveltyPiece').disabled");page.locator('#prodNoveltyPiece').select_option('0');assert page.locator('#prodNoveltySave').is_disabled()
   page.evaluate('window.manager.setSaving(false)');assert not page.locator('#prodNoveltySave').is_disabled()
   page.evaluate("window.mode='empty';window.manager.refresh()");page.wait_for_function("document.querySelector('#prodNoveltyIdentityStatus').textContent.includes('No hay pieza')");assert page.locator('#prodNoveltySave').is_disabled()
   page.evaluate("window.mode='missing';window.manager.refresh()");page.wait_for_function("document.querySelector('#prodNoveltyIdentityStatus').textContent.includes('servidor aún no')");assert page.locator('#prodNoveltySave').is_disabled()
   assert page.evaluate("window.calls.every(x=>x.name==='sgp_pdt_origenes_novedad_v3')")
   assert not errors,errors
   results.append({'viewport':[width,height],'PANEL':'PANELES_2','FRAME':'FRAMES_2','same_production_name':True,'shared_reserve_revalidation':True,'unknown_classification_blocks_save':True,'missing_backend_blocks_without_legacy_fallback':True,'busy_stays_disabled':True,'writes':0,'js_errors':0})
   page.close()
  browser.close()
 (OUT/'browser-results.json').write_text(json.dumps(results,indent=2));print(json.dumps(results))
finally:server.shutdown()
