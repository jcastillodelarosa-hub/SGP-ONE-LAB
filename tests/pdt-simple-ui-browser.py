"""Issue95: actual controller + CSS, synthetic RPC fixture, no external network."""
import functools,http.server,json,pathlib,threading,os
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1];OUT=pathlib.Path(os.environ.get('SGP_QA_OUT',pathlib.Path('/tmp/pdt-simple-ui-evidence')));OUT.mkdir(parents=True,exist_ok=True)
class H(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(H,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start();base='http://127.0.0.1:'+str(server.server_address[1])
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);results=[]
  for width,height in [(1366,1000),(390,844)]:
   page=browser.new_page(viewport={'width':width,'height':height});errors=[]
   page.on('pageerror',lambda e:errors.append(str(e)));page.route('https://**/*',lambda route:route.abort())
   page.goto(base+'/styles.css');page.set_content('<link rel="stylesheet" href="'+base+'/styles.css"><div id="listing"></div><div id="fixture"></div>')
   page.evaluate('''async base=>{
    const {openPdtV2}=await import(base+'/src/modules/pdt-v2-controller.js');
    const {productionPdtControls,productionPdtStatus}=await import(base+'/src/modules/pdt-production-actions.js');
    window.esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    window.row={id_pendiente:'synthetic-only',estado:'PENDIENTE',tipo_pieza:'PANEL',contrato_pdt:'V2',produccion:'172539 - 1039864 - DOMUS II - LEVEL 23',reserva:'8558585',perfil:'ES-EL400-011',cantidad:9,cantidad_validada:9,avance_neto:0,saldo_mecanizado:9,estado_repo:'PENDIENTE',detalles:[{id_detalle:'detail1',fabricacion:'E17',longitud:109.9375,acabado:'DS',cantidad_validada:4,avance_neto:0,saldo:4},{id_detalle:'detail2',fabricacion:'E17-1',longitud:109.9375,acabado:'DS',cantidad_validada:5,avance_neto:0,saldo:5}],ncs:[1006163,1006164,1006165].map(referencia=>({referencia,estado:'FINALIZADA'})),movimientos:[]};
    window.calls=[];window.writeCalls=[];window.mode='ok';window.reloaded=0;window.closedCount=0;
    window.caps={contract_version:2,picking_cuantitativo:true,cierre_v2:true,operations:['sgp_aluminio_pendiente_validar_detalles_v1','sgp_aluminio_pendiente_registrar_avance_v1','sgp_aluminio_pendiente_revertir_avance_v1','sgp_pdt_estado_v2','sgp_aluminio_pendiente_nc_vincular_v1','sgp_pdt_entrega_registrar_v2','sgp_pdt_entrega_validar_v2','sgp_pdt_asignar_v2','sgp_pdt_entrega_anular_v2','sgp_pdt_cerrar_v2']};
    window.show=(title,meta,body,footer)=>{document.querySelector('#fixture').innerHTML='<div id="repoWorkModal" class="piece-modal"><div class="piece-modal-card repo-work-card" role="dialog" aria-modal="true" aria-label="Detalle PDT de prueba"><div class="piece-modal-head"><div><span class="eyebrow">Demostración local · datos sintéticos · sin producción</span><h2>'+window.esc(title)+'</h2></div></div><div class="piece-modal-meta">'+meta+'</div><div class="repo-work-body">'+body+'</div><div class="repo-work-footer">'+footer+'</div></div></div>';return document.querySelector('#repoWorkModal');};
    window.client={rpc:async(name,args)=>{window.calls.push({name,args});if(name==='sgp_pdt_picking_v2'){if(window.mode==='pickingError')return {error:{message:'Picking no disponible (simulado)'}};return {data:{ok:true,entregas:[{id_entrega:'event1',estado:'VALIDADA',completa:false,produccion:'DOMUS II'}],lineas:[{id_linea:'line1',id_detalle:'detail1',cantidad:2,estado:window.mode==='audit'?'AUDITADA_DIFERENCIA':'VALIDADA',asignada:false}]}};}if(name==='sgp_aluminio_pendientes_listar_v2')return {data:{ok:true,contract_version:2,pendientes:[{...window.currentRow,cantidad_reportada:window.currentRow.cantidad,ncs:window.currentRow.ncs||[],detalles:window.currentRow.detalles||[]}]}};if(name==='sgp_aluminio_pendiente_historial')return {data:[{tipo_evento:'VALIDACION_PDT',usuario:'QA',fecha:'2026-10-26',detalle:'Distribución 4 + 5 (sintética)'}]};if(name==='sgp_picking_recepcion_cola')return {data:[{id_entrega:'event1',faltantes:[{fabricacion:'E17',cantidad:1,acabado:'DS'}]}]};if(name==='sgp_pdt_fuentes_v2')return {data:window.mode==='empty'?[]:window.row.detalles.map((d,i)=>({...d,id_pieza:'source'+i,cantidad:13}))};window.writeCalls.push({name,args});if(window.mode==='writeError')return {error:{code:'42501',message:'Rechazo seguro simulado'}};return {data:{ok:true}};}};
    window.open=async(role='COORDINADOR',section='distribution',row=window.row)=>{window.calls=[];window.writeCalls=[];window.currentRow=structuredClone(row);await openPdtV2({row,role,initialSection:section,client:window.client,token:'SYNTHETIC',capabilities:window.caps,show:window.show,escape:window.esc,reload:async()=>{window.reloaded++},close:()=>{window.closedCount++}});};
    document.querySelector('#listing').innerHTML=productionPdtStatus(window.row,'VALIDADO',window.esc)+productionPdtControls(window.row,'COORDINADOR',window.caps,window.esc);
    await window.open();
   }''',base)
   page.evaluate("""async()=>{
    const old=window.client.rpc;
    window.processed=new Set();window.enProceso={detail1:0,detail2:0};window.fail=null;
    window.client.rpc=async(name,args)=>{
     if(name==='sgp_pdt_proceso_simple_estado_v1')return window.fail==='read'?{error:{message:'lectura simulada'}}:{data:{ok:true,detalles:window.currentRow.detalles.map(d=>({id_detalle:d.id_detalle,en_proceso:window.enProceso[d.id_detalle]}))}};
     if(name==='sgp_pdt_corte_operativo_v1')return {data:{ok:true,contract_version:1,desde:null}};
     if(name==='sgp_pdt_proceso_simple_v1'){
      window.writeCalls.push({name,args});
      if(window.fail==='known')return {error:{code:'22023',message:'Cantidad rechazada'}};
      if(window.processed.has(args.p_idempotency_key))return {data:{ok:true,duplicado:true}};
      window.processed.add(args.p_idempotency_key);
      if(args.p_accion==='INICIAR')window.enProceso[args.p_id_detalle]+=args.p_cantidad;
      else {const d=window.currentRow.detalles.find(d=>d.id_detalle===args.p_id_detalle);d.saldo-=args.p_cantidad;d.avance_neto+=args.p_cantidad;window.enProceso[d.id_detalle]=Math.max(0,window.enProceso[d.id_detalle]-args.p_cantidad);}
      if(window.fail==='timeout'){window.fail=null;throw new Error('timeout simulado');}
      return {data:{ok:true}};
     }
     return old(name,args);
    };
    window.caps.operations.push('sgp_pdt_proceso_simple_v1');window.row.validacion_estado='VALIDADO';
    await window.open('COORDINADOR','advances');
   }""")
   assert page.locator('[data-date]').input_value()
   assert page.locator('[data-stage]').count()==0
   qty=page.locator('[data-advance-qty="0"]');qty.fill('2')
   page.locator('[data-operation=start]').first.click()
   page.wait_for_function("!document.querySelector('#repoWorkModal').getAttribute('aria-busy') || document.querySelector('#repoWorkModal').getAttribute('aria-busy')==='false'")
   assert page.evaluate('window.enProceso.detail1')==2
   qty.fill('1');page.locator('[data-operation=advance]').first.click()
   page.wait_for_function("document.querySelector('#repoWorkModal').getAttribute('aria-busy')==='false'")
   assert page.evaluate('window.enProceso.detail1')==1
   assert page.evaluate('window.currentRow.detalles[0].avance_neto')==1
   qty.fill('99');assert page.locator('[data-operation=advance]').first.is_disabled()
   qty.fill('1');page.evaluate("window.fail='known'");page.locator('[data-operation=advance]').first.click()
   assert 'Cantidad rechazada' in page.locator('[data-pdt-feedback]').inner_text()
   assert page.locator('[data-operation=advance]').first.is_enabled()
   page.evaluate("window.fail='timeout'");page.locator('[data-operation=advance]').first.click()
   assert page.locator('[data-repeat-pdt]').is_visible()
   before=page.evaluate('window.writeCalls.at(-1).args.p_idempotency_key')
   page.locator('[data-repeat-pdt]').click();page.wait_for_function("document.querySelector('#repoWorkModal').getAttribute('aria-busy')==='false'")
   assert page.evaluate('window.writeCalls.at(-1).args.p_idempotency_key')==before
   assert page.evaluate('window.currentRow.detalles[0].avance_neto')==2
   page.screenshot(path=str(OUT/f'simple-{width}.png'),full_page=True)
   page.evaluate("window.fail='read'");page.locator('[data-refresh-pdt]').click();page.wait_for_function("document.querySelector('#repoWorkModal').getAttribute('aria-busy')==='false'")
   assert page.locator('[data-operation=start]').first.is_disabled()
   assert 'lectura simulada' in page.locator('[data-advance-help]').inner_text()
   assert not errors,errors
   results.append({'width':width,'partial_flow':True,'known_error_unblocks':True,'timeout_same_uuid':True,'read_error_no_invented_counts':True})
   page.close()
  browser.close()
 print(json.dumps(results))
finally:server.shutdown()
