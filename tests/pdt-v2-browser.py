"""PDT controller browser tests, synthetic RPCs only. No production app/session."""
import pathlib,http.server,threading,functools,json
from playwright.sync_api import sync_playwright
root=pathlib.Path(__file__).resolve().parents[1]
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(root)))
threading.Thread(target=server.serve_forever,daemon=True).start()
url='http://127.0.0.1:'+str(server.server_address[1])
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
  for width,height in [(1280,900),(390,844)]:
   page=browser.new_page(viewport={'width':width,'height':height})
   page.goto(url+'/styles.css')
   page.set_content('<link rel="stylesheet" href="'+url+'/styles.css"><div id="host"></div>')
   page.evaluate('''async base=>{
    const {openPdtV2}=await import(base+'/src/modules/pdt-v2-controller.js');
    window.calls=[];window.closed=false;window.reloaded=false;
    window.show=(title,meta,body,footer)=>{const host=document.querySelector('#host');host.className='piece-modal';host.innerHTML='<div class="piece-modal-card repo-work-card" role="dialog" aria-modal="true"><div class="piece-modal-head"><h2></h2></div><div class="repo-work-body">'+body+'</div><div class="repo-work-footer">'+footer+'</div></div>';host.querySelector('h2').textContent=title;return host;};
    window.esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    window.openPdt=async(role,row,extra={})=>{window.writeCalls=[];return openPdtV2({row,role,client:{rpc:async(name,args)=>{
      window.calls.push({name,args});
      if(['sgp_aluminio_pendiente_historial','sgp_picking_recepcion_cola'].includes(name))return {data:[]};
      if(name==='sgp_aluminio_pendientes_listar_v2')return {data:{ok:true,contract_version:2,pendientes:[{...row,cantidad_reportada:row.cantidad,ncs:row.ncs||[],detalles:(row.detalles||[]).map(d=>({...d,cantidad_validada:d.cantidad_validada||d.saldo||5,avance_neto:d.avance_neto||0,saldo:d.saldo??5}))}]}};
      if(name==='sgp_pdt_fuentes_v2')return {data:[{id_pieza:'qa:1',fabricacion:'E17',longitud:'109.9375',acabado:'DS',cantidad:5},{id_pieza:'qa:2',fabricacion:'E17-1',longitud:'109.9375',acabado:'DS',cantidad:4}]};
      if(name==='sgp_pdt_picking_v2')return {data:{ok:true,entregas:[{id_entrega:'qa-event',produccion:'QA',estado:'VALIDADA',completa:false}],lineas:[]}};
      window.writeCalls.push({name,args});return {data:{ok:true}};
    }},token:'SYNTHETIC_ONLY',initialSection:role==='LIDER MECANIZADO'?'advances':role==='PICKING'?'picking':'distribution',capabilities:{contract_version:2,operations:['sgp_aluminio_pendiente_validar_detalles_v1','sgp_aluminio_pendiente_registrar_avance_v1','sgp_aluminio_pendiente_nc_vincular_v1','sgp_pdt_entrega_registrar_v2'],...extra},show:window.show,escape:window.esc,reload:async()=>{window.reloaded=true;},close:()=>{window.closed=true;}});};
    await window.openPdt('RECEPCION',{id_pendiente:'qa',cantidad:9,reserva:'QA',perfil:'QA',produccion:'QA'});
   }''',url)
   page.locator('[data-source="0"]').check();page.locator('[data-source="1"]').check()
   page.locator('[data-source-qty="0"]').fill('5');page.locator('[data-source-qty="1"]').fill('4')
   page.locator('[data-operation="validate"]').click();page.wait_for_function("document.querySelector('#host').getAttribute('aria-busy')!=='true'")
   call=page.evaluate('window.writeCalls.at(-1)');assert call['name']=='sgp_aluminio_pendiente_validar_detalles_v1'
   assert sum(int(d['cantidad']) for d in call['args']['p_detalles'])==9
   page.evaluate('''async()=>{window.calls=[];window.reloaded=false;await window.openPdt('LIDER MECANIZADO',{id_pendiente:'qa',contrato_pdt:'V2',cantidad:9,cantidad_validada:9,saldo_mecanizado:9,estado_repo:'MECANIZADO',detalles:[{id_detalle:'qa-detail',fabricacion:'E17',saldo:5}],movimientos:[]});}''')
   page.locator('[data-advance-qty="0"]').fill('2');page.locator('[data-date]').fill('2026-10-25')
   page.locator('[data-operation="advance"]').click();page.wait_for_function("document.querySelector('#host').getAttribute('aria-busy')!=='true'")
   assert page.evaluate('window.writeCalls.at(-1).args.p_cantidad')==2
   assert page.locator('[data-operation="reverse"]').is_disabled()
   page.evaluate('''async()=>{window.calls=[];window.reloaded=false;await window.openPdt('PICKING',{id_pendiente:'qa',contrato_pdt:'V2',cantidad:9,estado_repo:'PROCESADO',detalles:[{id_detalle:'qa-detail',fabricacion:'E17',longitud:'109.9375',acabado:'DS'}]}, {picking_cuantitativo:true,cierre_v2:true});}''')
   page.locator('[data-pick-qty]').fill('3');page.locator('[data-operation="delivery"]').click();page.wait_for_function("document.querySelector('#host').getAttribute('aria-busy')!=='true'")
   assert page.evaluate('window.writeCalls.at(-1).name')=='sgp_pdt_entrega_registrar_v2'
   assert page.evaluate('window.writeCalls.at(-1).args.p_cantidad')==3
   # Touch-sized viewport can reach the operation and close controls via scroll.
   page.locator('[data-dismiss]').scroll_into_view_if_needed();assert page.locator('[data-dismiss]').is_visible()
   print(json.dumps({'viewport':[width,height],'validation':True,'partial_advance':True,'positive_picking':True,'dismiss_reachable':True}))
   page.close()
  browser.close()
finally:server.shutdown();server.server_close()
