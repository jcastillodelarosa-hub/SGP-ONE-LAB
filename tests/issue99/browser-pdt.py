"""Actual PDT controller, stateful synthetic RPC server. No external traffic or plant operations."""
import functools,http.server,json,pathlib,re,threading
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'tests/issue99/evidence'
class H(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_GET(self):
  if self.path=='/__issue99':
   self.send_response(200);self.send_header('Content-Type','text/html; charset=utf-8');self.end_headers();self.wfile.write(b'<!doctype html><meta charset=utf-8>');return
  super().do_GET()
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(H,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start();base='http://127.0.0.1:'+str(server.server_address[1])
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);results=[]
  for width,height in [(1366,1000),(390,844)]:
   page=browser.new_page(viewport={'width':width,'height':height});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.route('https://**/*',lambda route:route.abort())
   page.goto(base+'/__issue99');release=re.search(r'<span[^>]+id="releaseVersion"[^>]*>[^<]+</span>',(ROOT/'index.html').read_text()).group()
   page.set_content('<link rel="stylesheet" href="'+base+'/styles.css">'+release+'<button id="opener">PDT de prueba</button><div id="host"></div>')
   page.evaluate('''async base=>{
    const {openPdtV2}=await import(base+'/src/modules/pdt-v2-controller.js');
    window.state={id_pendiente:'QA99',contrato_pdt:'V2',estado:'PENDIENTE',estado_repo:'PENDIENTE',reserva:'8558585 (sintética)',produccion:'DOMUS II · prueba local sin Supabase',perfil:'QA PANEL',cantidad:9,cantidad_reportada:9,detalles:[{id_detalle:'d1',fabricacion:'E17',longitud:100,acabado:'DS',cantidad_validada:4,avance_neto:0,saldo:4},{id_detalle:'d2',fabricacion:'E17-1',longitud:100,acabado:'DS',cantidad_validada:5,avance_neto:0,saldo:5}],movimientos:[],ncs:[]};
    window.historyRows=[];window.lines=[];window.writes=[];window.reads=[];window.applied=new Set();window.showCount=0;window.closeCount=0;window.reloadCount=0;window.failRead=false;window.mode='ok';
    const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const show=(title,meta,body,footer)=>{window.showCount++;document.querySelector('#host').innerHTML='<div id="repoWorkModal" class="piece-modal"><div class="piece-modal-card repo-work-card" role="dialog" aria-modal="true" aria-label="PDT sintético"><div class="piece-modal-head"><h2>'+esc(title)+'</h2></div><div class="piece-modal-meta">'+meta+'</div><div class="repo-work-body">'+body+'</div><div class="repo-work-footer">'+footer+'</div></div></div>';window.originalModal=document.querySelector('#repoWorkModal');return window.originalModal;};
    const client={rpc:async(name,args)=>{
     if(name==='sgp_aluminio_pendientes_listar_v2'){window.reads.push(name);if(window.failRead)return {error:{message:'Fallo de refresco simulado'}};return {data:{ok:true,contract_version:2,pendientes:[structuredClone(window.state)]}};}
     if(name==='sgp_pdt_picking_v2')return {data:{ok:true,entregas:[{id_entrega:'event',produccion:'QA',estado:'VALIDADA',completa:false}],lineas:structuredClone(window.lines)}};
     if(name==='sgp_aluminio_pendiente_historial')return {data:structuredClone(window.historyRows)};
     if(name==='sgp_picking_recepcion_cola')return {data:[]};
     window.writes.push({name,args:structuredClone(args)});await new Promise(resolve=>setTimeout(resolve,35));
     if(window.mode==='denied')return {error:{code:'42501',message:'Rol rechazado (simulado)'}};
     const key=args.p_idempotency_key||args.p_clave;if(key&&window.applied.has(key))return {data:{ok:true,duplicado:true}};
     if(key)window.applied.add(key);
     if(name==='sgp_aluminio_pendiente_registrar_avance_v1'){const d=window.state.detalles.find(d=>d.id_detalle===args.p_id_detalle);d.avance_neto+=args.p_cantidad;d.saldo-=args.p_cantidad;window.state.movimientos.push({id_movimiento:key,id_detalle:d.id_detalle,idempotency_key:key,tipo:'AVANCE',cantidad:args.p_cantidad,turno:args.p_turno,fecha_operativa:args.p_fecha_operativa,usuario:'QA'});}
     if(name==='sgp_aluminio_pendiente_revertir_avance_v1'){const m=window.state.movimientos.find(m=>m.id_movimiento===args.p_movimiento);const d=window.state.detalles.find(d=>d.id_detalle===m.id_detalle);d.avance_neto-=m.cantidad;d.saldo+=m.cantidad;window.state.movimientos.push({id_movimiento:key,id_movimiento_revertido:m.id_movimiento,id_detalle:d.id_detalle,tipo:'REVERSO',cantidad:m.cantidad});if(window.state.estado_repo==='PROCESADO')window.state.estado_repo='MECANIZADO';}
     if(name==='sgp_pdt_estado_v2')window.state.estado_repo=args.p_estado;
     if(name==='sgp_pdt_entrega_registrar_v2')window.lines.push({id_linea:'line'+window.lines.length,id_detalle:args.p_detalle,cantidad:args.p_cantidad,estado:'REGISTRADA',asignada:false});
     if(name==='sgp_pdt_entrega_validar_v2')window.lines.find(l=>l.id_linea===args.p_linea).estado='VALIDADA';
     if(name==='sgp_pdt_asignar_v2')window.lines.find(l=>l.id_linea===args.p_linea).asignada=true;
     window.historyRows.push({tipo_evento:name,estado_nuevo:window.state.estado_repo,usuario:'QA',fecha:'2026-10-26'});
     if(window.mode==='unknown'){window.mode='ok';return {error:{message:'Respuesta perdida tras commit simulado'}};}
     return {data:{ok:true}};
    }};
    document.querySelector('#opener').focus();await openPdtV2({row:{...window.state,cantidad_validada:9,avance_neto:0,saldo_mecanizado:9},client,token:'SYNTHETIC',role:'COORDINADOR',capabilities:{contract_version:2,picking_cuantitativo:true,cierre_v2:true,operations:['sgp_aluminio_pendiente_registrar_avance_v1','sgp_aluminio_pendiente_revertir_avance_v1','sgp_pdt_estado_v2','sgp_pdt_entrega_registrar_v2','sgp_pdt_entrega_validar_v2','sgp_pdt_asignar_v2']},show,escape:esc,initialSection:'advances',reload:async()=>window.reloadCount++,close:()=>{window.closeCount++;window.originalModal.hidden=true;}});
   }''',base)
   def ready():page.wait_for_function("!document.querySelector('[data-refresh-pdt]').disabled&&document.querySelector('#repoWorkModal').getAttribute('aria-busy')!=='true'")
   def section(key):
    if width>640:page.locator('[data-pdt-tab='+key+']').click()
    else:
     panel=page.locator('[data-pdt-panel='+key+']')
     if panel.get_attribute('open') is None:panel.locator('summary').click()
   def advance(index,quantity):
    section('advances');page.locator('[data-advance-qty="'+str(index)+'"]').fill(str(quantity));page.locator('[data-operation=advance][data-detail-index="'+str(index)+'"]').click();ready()
   def stage(expected):
    section('advances');assert page.locator('[data-stage]').input_value()==expected;page.once('dialog',lambda dialog:dialog.accept());page.locator('[data-operation=stage]').click();ready();page.wait_for_function('(state)=>document.querySelector(".pdt-detail-header").textContent.includes(state)',arg=expected)
   assert page.locator('[data-pdt-primary]').is_disabled();page.locator('[data-advance-qty="0"]').fill('2');assert page.locator('[data-pdt-primary]').is_disabled()
   page.locator('[data-date]').fill('2026-10-26');page.locator('[data-shift]').select_option('T2');page.locator('[data-advance-qty="1"]').fill('1');page.locator('[data-advance-qty="0"]').focus()
   page.locator('.repo-work-body').evaluate('node=>node.scrollTop=150');scroll=page.locator('.repo-work-body').evaluate('node=>node.scrollTop')
   page.evaluate("document.querySelector('[data-operation=advance][data-detail-index=\"0\"]').onclick();document.querySelector('[data-operation=advance][data-detail-index=\"0\"]').onclick()")
   page.wait_for_function("document.querySelectorAll('.pdt-metrics strong')[2].textContent==='2'");ready()
   assert page.evaluate('window.writes.length')==1;assert page.evaluate('window.closeCount')==0;assert page.evaluate('window.showCount')==1;assert page.evaluate('window.reloadCount')==0
   assert page.evaluate("window.originalModal===document.querySelector('#repoWorkModal')")
   assert page.locator('[data-date]').input_value()=='2026-10-26';assert page.locator('[data-shift]').input_value()=='T2'
   assert page.locator('[data-advance-qty="0"]').input_value()=='';assert page.locator('[data-advance-qty="1"]').input_value()=='1'
   assert abs(page.locator('.repo-work-body').evaluate('node=>node.scrollTop')-scroll)<=2
   assert page.evaluate("document.activeElement.hasAttribute('data-advance-qty')")
   assert page.locator('.pdt-metrics strong').all_text_contents()==['9','9','2','7'];assert 'guardado' in page.locator('[data-pdt-feedback]').inner_text()
   page.screenshot(path=str(OUT/f'pdt-refreshed-{width}.png'))
   stage('CORTE');stage('MECANIZADO');assert page.locator('[data-operation=stage]').is_disabled()
   advance(0,2);advance(1,5);stage('PROCESADO')
   section('history');assert 'sgp_pdt_estado_v2' in page.locator('[data-pdt-history]').inner_text();section('advances')
   last=page.evaluate("window.state.movimientos.filter(m=>m.tipo==='AVANCE').at(-1).id_movimiento");page.locator('[data-movement]').select_option(last);page.locator('[data-note]').fill('Reverso sintético');page.once('dialog',lambda dialog:dialog.accept());page.locator('[data-operation=reverse]').click();ready()
   assert 'MECANIZADO' in page.locator('.pdt-detail-header').inner_text();assert page.locator('.pdt-metrics strong').all_text_contents()[-1]=='5'
   assert page.locator('[data-date]').input_value()=='2026-10-26';assert page.locator('[data-shift]').input_value()=='T2'
   section('picking');page.locator('[data-pick-detail]').select_option('d1');page.locator('[data-pick-qty]').fill('2');page.locator('[data-operation=delivery]').click();ready()
   assert 'REGISTRADA' in page.locator('[data-pdt-panel=picking]').inner_text();page.locator('[data-operation=deliveryValidate]').click();ready();assert 'VALIDADA' in page.locator('[data-pdt-panel=picking]').inner_text()
   page.locator('[data-operation=assign]').click();ready();assert page.locator('[data-operation=assign]').is_disabled();assert 'Acreditada' in page.locator('[data-pdt-panel=picking]').inner_text()
   # Commit confirmed/read failed: no resubmit and clear the submitted quantity after read-only retry.
   section('advances');page.evaluate('window.failRead=true');before=page.evaluate('window.writes.length');page.locator('[data-advance-qty="1"]').fill('1');page.locator('[data-operation=advance][data-detail-index="1"]').click();page.wait_for_function("document.querySelector('[data-pdt-feedback]').textContent.includes('No la repitas')")
   assert page.evaluate('window.writes.length')==before+1;assert page.locator('[data-operation=advance]').first.is_disabled()
   page.evaluate('window.failRead=false');page.locator('[data-refresh-pdt]').click();ready();assert page.evaluate('window.writes.length')==before+1;assert page.locator('[data-advance-qty="1"]').input_value()==''
   # Lost response is retried using the same UUID, so server counts only one movement.
   page.evaluate("window.mode='unknown'");moves=page.evaluate("window.state.movimientos.length");page.locator('[data-advance-qty="1"]').fill('1');page.locator('[data-operation=advance][data-detail-index="1"]').click();page.locator('[data-repeat-pdt]').wait_for(state='visible');before=page.evaluate('window.writes.at(-1).args.p_idempotency_key');page.locator('[data-repeat-pdt]').click();ready()
   assert page.evaluate('window.writes.at(-1).args.p_idempotency_key')==before;assert page.evaluate('window.state.movimientos.length')==moves+1
   assert page.locator('[data-date]').input_value()=='2026-10-26';assert page.locator('[data-shift]').input_value()=='T2'
   assert page.evaluate('window.showCount')==1;assert page.evaluate('window.closeCount')==0
   page.screenshot(path=str(OUT/f'pdt-stages-{width}.png'))
   page.locator('[data-dismiss]').click();assert page.evaluate('window.closeCount')==1;assert page.evaluate('window.reloadCount')==1
   assert not errors,errors
   results.append({'viewport':[width,height],'initial_show_calls':1,'automatic_close':False,'fresh_E17_advance':2,'fresh_E17_saldo':2,'same_dialog':True,'stages_without_reopen':['CORTE','MECANIZADO','PROCESADO'],'date_shift_scroll_focus_preserved':True,'picking_register_validate_assign':True,'double_click_single_write':True,'committed_write_read_failure_no_resubmit':True,'uncertain_retry_same_uuid_once':True,'parent_refresh_only_on_explicit_close':True,'external_network':False,'errors':errors})
   page.close()
  browser.close()
 (OUT/'pdt-browser.json').write_text(json.dumps(results,indent=2));print(json.dumps(results))
finally:server.shutdown()
