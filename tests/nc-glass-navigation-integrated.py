"""Real Seguimiento controller/tabs/editor, synthetic existing fixture, no production."""
from pathlib import Path
from functools import partial
import http.server,threading,json,os,shutil
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'test-artifacts'/'ncv-navigation';OUT.mkdir(parents=True,exist_ok=True)
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),partial(http.server.SimpleHTTPRequestHandler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start();origin=f'http://127.0.0.1:{server.server_port}'
results=[]
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path=os.environ.get('CHROME_BIN') or shutil.which('chromium'),args=['--no-sandbox'])
  for width in [1440,390]:
   page=browser.new_page(viewport={'width':width,'height':900});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(origin) else r.abort())
   page.goto(origin+'/tests/lp01-pending-ui/fixture.html');page.wait_for_selector('.lp-tracking-table');page.wait_for_selector('[data-sale-edit]')
   page.evaluate("""async()=>{
    const {openNcGlassTracking}=await import('/src/modules/nc-glass-tracking.js');
    window.navReads=[];window.navRole='COORDINADOR';window.navDelay=false;window.navResolvers=[];
    const original=window.payload;window.payload=args=>{const data=original(args);const second=data.productions.find(p=>p.key.startsWith('QA3|'));second.oficial.produccion='Producción 1';second.oficial.sistema='A';return data;};
    window.navSource={consecutivo:'NC-DEMO-17',orden:'Producción 1',sistema:'A',semana_maestro:45,linea_responsable:'PANELES 2'};
    window.openNav=()=>openNcGlassTracking({source:navSource,sourceSession:token,bridge:{getToken:()=>token,getRole:()=>navRole,getClient:async()=>({rpc:async(name,args)=>{navReads.push(name);if(navDelay)await new Promise(r=>navResolvers.push(r));return {data:name==='sgp_consultar_nc_vidrio'?{rows:[navSource]}:payload(args)};}}),openTarget:target=>controller.openOrder({...target,reveal:()=>document.querySelector('#productionTrackingTab').click()})}});
   }""")
   page.evaluate('openNav()');page.get_by_role('button',name='Buscar coincidencias').click();page.locator('.nc-tracking-dialog article').nth(1).wait_for();assert page.locator('#lp-tracking-drawer').is_hidden()
   page.screenshot(path=str(OUT/f'integrated-search-{width}.png'))
   page.locator('.nc-tracking-dialog article').nth(1).get_by_role('button').click();page.wait_for_selector('[data-order-type=NC_V][aria-pressed=true]');page.wait_for_selector('[data-type-pane=NC_V] form');assert page.locator('.nc-tracking-dialog').count()==0
   assert 'NC-DEMO-17' in page.locator('.nc-tracking-origin').inner_text();assert 'no vinculada' in page.locator('.nc-tracking-origin').inner_text();assert page.locator('[data-type-pane=NC_V] [name=ncReference]').input_value()==''
   form=page.locator('[data-type-pane=NC_V] form');form.locator('[name=observation]').fill('Borrador sintético sin guardar');page.evaluate('controller.load({quiet:true})');page.wait_for_timeout(150);assert form.locator('[name=observation]').input_value()=='Borrador sintético sin guardar'
   # Another attempt cannot replace a live draft; return to it unchanged.
   page.evaluate('openNav()');page.get_by_role('button',name='Buscar coincidencias').click();page.locator('.nc-tracking-dialog article').first.get_by_role('button').click();page.wait_for_function("document.querySelector('.nc-tracking-dialog [data-status]').textContent.includes('Cierra primero')");page.get_by_role('button',name='Cerrar búsqueda').click();assert form.locator('[name=observation]').input_value()=='Borrador sintético sin guardar'
   # Choosing another row must not attribute the original NC to it.
   page.locator('details[data-order-part]').filter(has_text='Producción 2').locator('summary').click();page.wait_for_selector('[data-order-affectations]');assert page.locator('.nc-tracking-origin').count()==0;page.locator('[data-tracking-close]').click()
   # Cancel final controller read; immediately load another LP stage without waiting for stale RPC.
   page.evaluate('openNav()');page.get_by_role('button',name='Buscar coincidencias').click();page.locator('.nc-tracking-dialog article').first.wait_for();page.evaluate('window.delay=true');page.locator('.nc-tracking-dialog article').first.get_by_role('button').click();page.wait_for_function('typeof window.release==="function"');page.keyboard.press('Escape');page.evaluate('window.delay=false;window.release()');page.locator('#productionTrackingTab').click();page.wait_for_selector('.lp-tracking-table');assert page.locator('#lp-tracking-drawer').is_hidden()
   # Logout/login clears the hidden-detail state, allowing a new explicit navigation.
   page.evaluate('openNav()');page.get_by_role('button',name='Buscar coincidencias').click();page.locator('.nc-tracking-dialog article').first.get_by_role('button').click();page.wait_for_selector('.nc-tracking-origin')
   page.evaluate("window.token='qa-next';document.dispatchEvent(new CustomEvent('sgp:lp-role',{detail:'COORDINADOR'}))")
   page.evaluate('openNav()');page.get_by_role('button',name='Buscar coincidencias').click();page.locator('.nc-tracking-dialog article').first.get_by_role('button').click();page.wait_for_selector('.nc-tracking-origin');assert page.locator('.nc-tracking-dialog').count()==0
   page.screenshot(path=str(OUT/f'integrated-detail-{width}.png'),full_page=True)
   assert set(page.evaluate('navReads'))=={'sgp_consultar_nc_vidrio','sgp_lp_seguimiento_consultar'};assert page.evaluate('qaSale.ids.length')==0;assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');assert not errors,errors
   results.append({'width':width,'realTrackingController':True,'realAffectationsEditor':True,'explicitChoice':True,'draftPreserved':True,'originScoped':True,'cancelLate':True,'newSession':True,'writes':0});page.close()
  browser.close()
 (OUT/'integrated-result.json').write_text(json.dumps(results,indent=2)+'\n');print(json.dumps(results))
finally:server.shutdown()
