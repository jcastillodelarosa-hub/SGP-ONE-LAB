"""Phase 3 visual smoke: production controller, synthetic RPC data, no external network."""
import functools
import http.server
import pathlib
import threading
from playwright.sync_api import sync_playwright

ROOT=pathlib.Path(__file__).resolve().parents[2]
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args): pass

server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_address[1]}'
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
  for width,height in [(1366,900),(390,844)]:
   page=browser.new_page(viewport={'width':width,'height':height})
   errors=[]
   page.on('pageerror',lambda err:errors.append(str(err)))
   page.route('https://**/*',lambda route:route.abort())
   page.goto(base+'/styles.css')
   page.set_content(f'<link rel="stylesheet" href="{base}/styles.css"><div id="fixture"></div>')
   page.evaluate('''async base=>{
    const {openPdtV2}=await import(base+'/src/modules/pdt-v2-controller.js');
    window.row={id_pendiente:'qa-manual',manual_pdt:true,contrato_pdt:'V2',estado:'PENDIENTE',estado_repo:'MECANIZADO',validacion_estado:'VALIDADO',produccion:'QA ORDER',reserva:'R',semana:44,perfil:'PANEL-REF',fabricacion_original:'E17',marca_original:'A',longitud_original:100,cantidad_original:2,observacion_general:'QA sintética',cantidad:2,cantidad_validada:2,avance_neto:1,saldo_mecanizado:1,nc:'NC-QA',detalles:[{id_detalle:'qa-detail',fabricacion:'E17',longitud:100,acabado:'DS',cantidad_validada:2,avance_neto:1,saldo:1}],ncs:[],movimientos:[]};
    window.calls=[];window.caps={contract_version:2,picking_cuantitativo:true,cierre_v2:true,operations:['sgp_aluminio_pendiente_registrar_avance_v1','sgp_aluminio_pendiente_revertir_avance_v1','sgp_pdt_estado_v2','sgp_aluminio_pendiente_nc_vincular_v1']};
    window.esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    window.show=(title,meta,body,footer)=>{document.querySelector('#fixture').innerHTML='<div id="repoWorkModal" class="piece-modal"><div class="piece-modal-card repo-work-card" role="dialog"><div class="piece-modal-head"><h2>'+window.esc(title)+'</h2></div><div class="piece-modal-meta">'+meta+'</div><div class="repo-work-body">'+body+'</div><div class="repo-work-footer">'+footer+'</div></div></div>';return document.querySelector('#repoWorkModal')};
    window.client={rpc:async(name,args)=>{window.calls.push({name,args});if(name==='sgp_pdt_manual_picking_v1')return {data:{ok:true,entregas:[{id_entrega:'qa-event',estado:'VALIDADA',completa:false,produccion:'QA ORDER'}],lineas:[{id_linea:'qa-line',id_detalle:'qa-detail',cantidad:1,estado:'VALIDADA',asignada:false}]}};if(name==='sgp_aluminio_pendientes_listar_v2')return {data:{ok:true,contract_version:2,pendientes:[{...window.row,cantidad_reportada:2}]}};if(name==='sgp_picking_recepcion_cola')return {data:[]};if(name==='sgp_aluminio_pendiente_historial')return {data:[]};return {data:{ok:true}}}};
    window.open=async(section='advances',role='COORDINADOR')=>openPdtV2({row:window.row,client:window.client,token:'SYNTHETIC',role,capabilities:window.caps,initialSection:section,show:window.show,escape:window.esc,reload:async()=>{},close:()=>{}});
    await window.open();
   }''',base)
   assert 'QA sintética' in page.locator('#repoWorkModal').text_content()
   assert 'PANEL-REF' in page.locator('#repoWorkModal').text_content()
   assert page.locator('[data-operation=advance]').count()==1
   assert page.locator('[data-operation=delivery]').count()==1
   assert page.locator('[data-operation=close]').count()==1
   assert page.evaluate('window.calls.some(c=>c.name==="sgp_pdt_manual_picking_v1")')
   assert page.evaluate('document.documentElement.scrollWidth')<=width
   page.screenshot(path=str(ROOT/f'tests/pdt-manual/phase3-{width}.png'),full_page=True)
   page.evaluate("window.open('advances','RECEPCION')")
   assert page.locator('[data-operation=advance]').count()==0
   assert not errors,errors
   page.close()
  browser.close()
finally:
 server.shutdown()
