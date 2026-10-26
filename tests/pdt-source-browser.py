"""Directed source/distribution UI tests. All RPCs mocked, network writes blocked."""
import functools,http.server,json,pathlib,threading
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1];OUT=ROOT/'tests/pdt-sources/evidence';OUT.mkdir(parents=True,exist_ok=True)
class H(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(H,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start();url='http://127.0.0.1:'+str(server.server_address[1])
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
  reports=[]
  for width,height in [(1440,1000),(390,844)]:
   page=browser.new_page(viewport={'width':width,'height':height});errors=[]
   page.on('pageerror',lambda e:errors.append(e.name));page.route('https://**/*',lambda r:r.abort())
   page.goto(url+'/styles.css');page.set_content('<link rel="stylesheet" href="'+url+'/styles.css"><main id="host"></main>')
   page.evaluate('''async base=>{
    const {openPdtV2}=await import(base+'/src/modules/pdt-v2-controller.js');
    const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    window.row={id_pendiente:'fixture-only',produccion:'172539 - 1039864 - DOMUS II - LEVEL 23',reserva:'8558585',perfil:'ES-EL400-011',cantidad:9,contrato_pdt:'LEGACY',ncs:[{referencia:'NC fixture conservada',estado:'PENDIENTE'}]};
    window.sources=[{id_pieza:'fixture:P:3739',fabricacion:'E17-1',longitud:109.9375,acabado:'DS SILVERSTORM',cantidad:13},{id_pieza:'fixture:P:3743',fabricacion:'E17',longitud:109.9375,acabado:'DS SILVERSTORM',cantidad:13},{id_pieza:'fixture:P:3764',fabricacion:'E17',longitud:109.9375,acabado:'DS SILVERSTORM',cantidad:8},{id_pieza:'fixture:P:3768',fabricacion:'E17-1',longitud:109.9375,acabado:'DS SILVERSTORM',cantidad:8}];
    window.mode='empty';window.calls=[];
    const client={rpc:async(name,args)=>{window.calls.push({name,args});if(name==='sgp_pdt_fuentes_v2'){if(window.mode==='empty')return {data:[]};if(window.mode==='error')return {error:{message:'Fallo de consulta simulado'}};if(window.mode==='missingId')return {data:[{...window.sources[0],id_pieza:null}]};return {data:window.sources};}if(name==='sgp_aluminio_pendiente_validar_detalles_v1'){if(window.holdWrite)await new Promise(resolve=>window.releaseWrite=resolve);return {data:{ok:true}};}throw new Error('Unexpected RPC');}};
    const show=(title,meta,body,footer)=>{const host=document.querySelector('#host');host.innerHTML='<div id="repoWorkModal" class="piece-modal"><div class="piece-modal-card repo-work-card" role="dialog" aria-modal="true"><div class="piece-modal-head"><div><span class="eyebrow">Vista local · fuentes de prueba · sin operaciones productivas</span><h2>'+esc(title)+'</h2></div></div><div class="piece-modal-meta">'+meta+'</div><div class="repo-work-body">'+body+'</div><div class="repo-work-footer">'+footer+'</div></div></div>';return host.querySelector('#repoWorkModal');};
    window.open=()=>openPdtV2({row:window.row,client,token:null,role:'COORDINADOR',capabilities:{contract_version:2,operations:['sgp_aluminio_pendiente_validar_detalles_v1'],cierre_v2:true},show,escape:esc,reload:async()=>{},close:()=>{}});
    await window.open();
   }''',url)
   button=page.locator('[data-operation=validate]')
   assert button.is_disabled();assert page.locator('[data-source-status]').inner_text()
   page.screenshot(path=str(OUT/('fuentes-vacias-'+str(width)+'.png')),full_page=True)
   page.evaluate("window.mode='populated'");page.locator('[data-source-retry]').click()
   page.locator('[data-source="0"]').wait_for();assert button.is_disabled()
   page.locator('[data-source="0"]').check();assert button.is_disabled()
   page.locator('[data-source-qty="0"]').fill('5');page.locator('[data-source="1"]').check();page.locator('[data-source-qty="1"]').fill('4')
   assert button.is_enabled();assert page.locator('[data-assigned-total]').inner_text()=='9'
   assert page.evaluate('document.documentElement.scrollWidth')<=width
   colors=page.locator('.pdt-source-head span').evaluate_all('(nodes)=>nodes.map(n=>getComputedStyle(n).color)');assert all(c=='rgb(23, 62, 94)' for c in colors)
   if width==1440:page.screenshot(path=str(OUT/'distribucion-pc.png'),full_page=True)
   else:
    page.locator('.pdt-source-row').first.evaluate('n=>n.scrollIntoView({block:"start"})');page.screenshot(path=str(OUT/'distribucion-movil.png'),full_page=True)
   page.locator('[data-source-qty="1"]').fill('3');assert button.is_disabled();assert page.locator('[data-assigned-total]').inner_text()=='8'
   page.locator('[data-note]').fill('Corrección justificada en fixture');assert button.is_enabled()
   page.locator('[data-source-qty="1"]').fill('1.5');assert button.is_disabled()
   page.locator('[data-source-qty="1"]').fill('3');page.evaluate('window.holdWrite=true');button.click()
   page.locator('[data-source-qty="0"]').fill('6');assert button.is_disabled();assert page.locator('[data-source-retry]').is_disabled()
   page.evaluate('window.releaseWrite();window.holdWrite=false')
   call=page.evaluate('window.calls.at(-1)');assert call['name']=='sgp_aluminio_pendiente_validar_detalles_v1'
   assert sum(d['cantidad'] for d in call['args']['p_detalles'])==8
   assert all(d['id_pieza'].startswith('fixture:') for d in call['args']['p_detalles'])
   assert page.evaluate('window.row.cantidad')==9
   assert page.evaluate('window.row.ncs[0].referencia')=='NC fixture conservada'
   page.evaluate("window.mode='missingId';window.open()")
   assert page.locator('[data-operation=validate]').is_disabled();assert page.locator('[data-source="0"]').is_disabled()
   page.evaluate("window.mode='error';window.open()")
   assert page.locator('[data-operation=validate]').is_disabled();assert 'Fallo de consulta simulado' in page.locator('[role=alert]').inner_text()
   assert not page.evaluate("window.calls.some(c=>c.name==='sgp_aluminio_pendiente_piezas')")
   assert not errors,errors
   reports.append({'viewport':[width,height],'empty_disabled':True,'retry':True,'9_equals_5_plus_4':True,'9_to_8_requires_reason':True,'invalid_identity_or_quantity_disabled':True,'legacy_fallback':False,'pending_request_stays_disabled':True,'original_and_ncs_unchanged':True,'uncaught_errors':0})
   page.close()
  browser.close()
 (OUT/'browser-report.json').write_text(json.dumps(reports,indent=2));print(json.dumps(reports))
finally:server.shutdown()
