"""Actual shared editor + actual Picking delivery handlers. Synthetic RPC client.
Local HTML/CSS only; all external network blocked. No production writes.
"""
import functools,http.server,json,pathlib,threading
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'tests/pdt-multiorigin/evidence'
class H(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(H,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start();base='http://127.0.0.1:'+str(server.server_address[1])
app=(ROOT/'app.js').read_text();handlers=app[app.index('let pickDeliveryTarget='):app.index("document.querySelector('#pickRefresh')")]
results=[]
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
  for w,h in [(1440,1100),(768,1024),(390,844)]:
   page=browser.new_page(viewport={'width':w,'height':h},timezone_id='America/Bogota');errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.route('**/*',lambda route:route.continue_() if route.request.url.startswith(base) else route.abort())
   page.goto(base+'/styles.css');page.set_content('<link rel="stylesheet" href="'+base+'/styles.css"><main id="fixture"></main>')
   page.evaluate('''async a=>{
    const parsed=new DOMParser().parseFromString(a.html,'text/html');document.querySelector('#fixture').append(document.importNode(parsed.querySelector('#pickDeliveryModal'),true));
    window.mountPdtRegistration=(await import(a.base+'/src/modules/pdt-registration-form.js')).mountPdtRegistration;
    window.openPdtRegistration=(await import(a.base+'/src/modules/pdt-registration-form.js')).openPdtRegistration;
    window.saveRegistration=(await import(a.base+'/src/services/pdt-registration.js')).saveRegistration;
    window.escapeHtml=v=>String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
    window.pickingRows=[{id_programacion:'QA-PROGRAM',reserva:'PRIMARY',acabado:'DS',turno:'TURNO 1',ordenes:[{produccion:'PRODUCCIÓN QA · ES-EL4000',key_produccion:'QA|PANELES_2'}]}];
    window.sharedMetaFromEmbedded=()=>null;window.sharedReserveOptions=()=>[];window.sharedBadgeHtml=()=>'';window.sharedDetailsHtml=()=>'';
    window.getAppToken=()=> 'QA-SYNTHETIC';window.refreshes=0;window.loadPicking=async()=>{window.refreshes++;};window.alerts=[];window.alert=s=>window.alerts.push(s);
    window.calls=[];window.sourceMode='ok';window.saveMode='ok';
    const common={key_produccion:'QA|PANELES_2',produccion:'PRODUCCIÓN QA · ES-EL4000',codigo_sap:'REF-PANEL',tipo_pieza:'PANEL',id_linea:'PANELES_2',reserva:'SHARED',reserva_principal:'PRIMARY',acabado:'DS',fabricacion:'E17',longitud:109.9375,cantidad_referencia:9};
    window.sources=[{...common,id_pieza:'QA1'},{...common,id_pieza:'QA2',fabricacion:'E17-1',longitud:107.5}];
    window.client={rpc:async(name,args)=>{window.calls.push({name,args});await new Promise(r=>setTimeout(r,40));if(name==='sgp_pdt_registro_fuentes_v4'){if(window.sourceMode==='missing')return {error:{code:'PGRST202',message:'missing'}};return {data:{ok:true,contract_version:4,fuentes:window.sourceMode==='empty'?[]:window.sources}};}if(name==='sgp_pdt_registrar_v4'){if(window.saveMode==='error')return {error:{message:'Respuesta perdida; operación de prueba'}};return {data:{ok:true,ids_pendientes:['SYNTHETIC']}};}throw new Error('Unexpected RPC '+name);}};
    window.getSupabaseClient=async()=>window.client;
   }''',{'html':(ROOT/'index.html').read_text(),'base':base})
   page.add_script_tag(content=handlers)
   page.evaluate("deliverPickingOrder('QA-PROGRAM','PRODUCCIÓN QA · ES-EL4000')")
   page.locator('[data-pick-complete="false"]').click()
   page.wait_for_function("document.querySelector('[data-status]')?.textContent.includes('verificadas')")
   assert page.locator('#pickDeliverySave').is_disabled()
   page.locator('[data-ref]').select_option('REF-PANEL');page.locator('[data-source]').select_option(index=1);page.locator('[data-qty]').fill('2')
   assert 'NC PENDIENTE DE ASIGNAR' in page.locator('.pdt-registration').inner_text()
   assert not page.locator('#pickDeliverySave').is_disabled()
   page.locator('[data-add]').click();page.locator('[data-ref]').nth(1).select_option('REF-PANEL');page.locator('[data-source]').nth(1).select_option(index=2);page.locator('[data-qty]').nth(1).fill('1')
   page.locator('#pickDeliveryMeta').evaluate("e=>e.textContent+=' · DATOS SINTÉTICOS · sin conexión productiva'")
   page.locator('#pickDeliveryModal .rec-form').evaluate('e=>e.scrollTop=0')
   page.screenshot(path=str(OUT/f'picking-{w}.png'),full_page=True)
   assert page.evaluate("document.documentElement.scrollWidth<=innerWidth"),w
   page.evaluate("window.saveMode='error'");page.locator('#pickDeliverySave').click();page.wait_for_function('window.alerts.length===1')
   oldkey=page.evaluate("window.calls.filter(x=>x.name==='sgp_pdt_registrar_v4').at(-1).args.p_idempotency_key")
   page.evaluate("window.saveMode='ok'");page.locator('#pickDeliverySave').dblclick();page.wait_for_function('window.refreshes===1')
   saves=page.evaluate("window.calls.filter(x=>x.name==='sgp_pdt_registrar_v4')");assert len(saves)==2 and saves[-1]['args']['p_idempotency_key']==oldkey
   assert len(saves[-1]['args']['p_piezas'])==2 and saves[-1]['args']['p_piezas'][0]['nc']==''
   # Complete delivery calls the same event RPC with no fictitious missing rows.
   page.evaluate("deliverPickingOrder('QA-PROGRAM','PRODUCCIÓN QA · ES-EL4000')");page.locator('[data-pick-complete="true"]').click();page.locator('#pickDeliverySave').click();page.wait_for_function('window.refreshes===2')
   assert page.evaluate("window.calls.filter(x=>x.name==='sgp_pdt_registrar_v4').at(-1).args.p_piezas.length") ==0
   # Same component in ENSAMBLE/EMPAQUE, required NC + focus/keyboard.
   for origin in ['ENSAMBLE','EMPAQUE']:
    page.evaluate("async origin=>{window.form=await openPdtRegistration({client:window.client,token:'QA',origin,context:{produccion:'PRODUCCIÓN QA · ES-EL4000',key_produccion:'QA|PANELES_2',reserva:'SHARED',sistema:'ES-EL4000'}});}",origin)
    page.locator('[data-ref]').select_option('REF-PANEL');page.locator('[data-source]').select_option(index=1)
    assert page.locator('[data-save]').is_disabled();page.locator('[data-nc]').fill('  ');assert page.locator('[data-save]').is_disabled();page.locator('[data-nc]').fill('NC-QA-ONLY');assert not page.locator('[data-save]').is_disabled()
    page.locator('[data-result]').evaluate("e=>e.textContent='DATOS SINTÉTICOS · ninguna escritura productiva'")
    page.screenshot(path=str(OUT/f'{origin.lower()}-{w}.png'),full_page=True)
    page.locator('[data-save]').click();page.wait_for_function("document.querySelector('[data-result]').textContent.includes('registrado')");assert page.locator('[data-save]').is_disabled()
    page.locator('[data-close]').click()
   # Failed/missing/empty sources block registration, no legacy fallback.
   for mode in ['missing','empty']:
    page.evaluate("mode=>{window.sourceMode=mode;deliverPickingOrder('QA-PROGRAM','PRODUCCIÓN QA · ES-EL4000')}",mode);page.locator('[data-pick-complete="false"]').click()
    page.wait_for_function("document.querySelector('[data-status]')&&!document.querySelector('[data-status]').textContent.includes('Consultando')")
    assert page.locator('#pickDeliverySave').is_disabled()
    page.locator('#pickDeliveryClose').click()
   assert not errors,errors
   results.append({'viewport':[w,h],'actual_picking_handlers':True,'shared_editor_all_origins':True,'multiple_pieces':True,'optional_required_nc':True,'retry_same_id':True,'double_click_one_write':True,'complete_delivery_no_pdt':True,'empty_missing_sources_block':True,'no_horizontal_overflow':True,'external_network':'blocked','data':'synthetic','js_errors':errors})
   page.close()
  browser.close()
 (OUT/'browser.json').write_text(json.dumps(results,indent=2)+'\n');print(json.dumps(results,indent=2))
finally:server.shutdown()
