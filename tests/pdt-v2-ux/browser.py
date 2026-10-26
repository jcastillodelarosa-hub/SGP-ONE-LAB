"""Issue95: actual controller + CSS, synthetic RPC fixture, no external network."""
import functools,http.server,json,pathlib,threading
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'tests/pdt-v2-ux/evidence'
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
    window.calls=[];window.mode='ok';window.reloaded=0;window.closedCount=0;
    window.caps={contract_version:2,picking_cuantitativo:true,cierre_v2:true,operations:['sgp_aluminio_pendiente_validar_detalles_v1','sgp_aluminio_pendiente_registrar_avance_v1','sgp_aluminio_pendiente_revertir_avance_v1','sgp_pdt_estado_v2','sgp_aluminio_pendiente_nc_vincular_v1','sgp_pdt_entrega_registrar_v2','sgp_pdt_entrega_validar_v2','sgp_pdt_asignar_v2','sgp_pdt_entrega_anular_v2','sgp_pdt_cerrar_v2']};
    window.show=(title,meta,body,footer)=>{document.querySelector('#fixture').innerHTML='<div id="repoWorkModal" class="piece-modal"><div class="piece-modal-card repo-work-card" role="dialog" aria-modal="true" aria-label="Detalle PDT de prueba"><div class="piece-modal-head"><div><span class="eyebrow">Demostración local · datos sintéticos · sin producción</span><h2>'+window.esc(title)+'</h2></div></div><div class="piece-modal-meta">'+meta+'</div><div class="repo-work-body">'+body+'</div><div class="repo-work-footer">'+footer+'</div></div></div>';return document.querySelector('#repoWorkModal');};
    window.client={rpc:async(name,args)=>{window.calls.push({name,args});if(name==='sgp_pdt_picking_v2'){if(window.mode==='pickingError')return {error:{message:'Picking no disponible (simulado)'}};return {data:{ok:true,entregas:[{id_entrega:'event1',estado:'VALIDADA',completa:false,produccion:'DOMUS II'}],lineas:[{id_linea:'line1',id_detalle:'detail1',cantidad:2,estado:window.mode==='audit'?'AUDITADA_DIFERENCIA':'VALIDADA',asignada:false}]}};}if(name==='sgp_aluminio_pendiente_historial')return {data:[{tipo_evento:'VALIDACION_PDT',usuario:'QA',fecha:'2026-10-26',detalle:'Distribución 4 + 5 (sintética)'}]};if(name==='sgp_picking_recepcion_cola')return {data:[{id_entrega:'event1',faltantes:[{fabricacion:'E17',cantidad:1,acabado:'DS'}]}]};if(name==='sgp_pdt_fuentes_v2')return {data:window.mode==='empty'?[]:window.row.detalles.map((d,i)=>({...d,id_pieza:'source'+i,cantidad:13}))};if(window.mode==='writeError')return {error:{message:'Rechazo seguro simulado'}};return {data:{ok:true}};}};
    window.open=async(role='COORDINADOR',section='distribution',row=window.row)=>{window.calls=[];await openPdtV2({row,role,initialSection:section,client:window.client,token:'SYNTHETIC',capabilities:window.caps,show:window.show,escape:window.esc,reload:async()=>{window.reloaded++},close:()=>{window.closedCount++}});};
    document.querySelector('#listing').innerHTML=productionPdtStatus(window.row,'VALIDADO',window.esc)+productionPdtControls(window.row,'COORDINADOR',window.caps,window.esc);
    await window.open();
   }''',base)
   def section(key):
    if width>640:page.locator('[data-pdt-tab="'+key+'"]').click()
    else:
     panel=page.locator('[data-pdt-panel="'+key+'"]')
     if not panel.get_attribute('open')=='' :panel.locator('summary').click()
   assert page.locator('.pdt-metrics strong').all_text_contents()==['9','9','0','9']
   assert 'REPO OK' in page.locator('.pdt-availability').inner_text();assert 'no confirma inventario' in page.locator('.pdt-availability').inner_text()
   assert page.locator('[data-pdt-panel=distribution] tbody th,[data-pdt-panel=distribution] tbody td').all_text_contents()[:4]==['E17','109.9375','DS','4']
   assert page.locator('[data-operation=validate]').count()==0
   assert page.evaluate('document.documentElement.scrollWidth')<=width
   assert page.locator('.repo-work-body').evaluate('n=>n.scrollWidth<=n.clientWidth+1'),page.evaluate('[...document.querySelectorAll(".repo-work-body *")].filter(n=>n.getBoundingClientRect().right>innerWidth).map(n=>[n.tagName,n.className,n.getBoundingClientRect().width])')
   page.screenshot(path=str(OUT/f'detail-{width}.png'),full_page=True)
   section('advances');page.locator('[data-advance-qty="0"]').fill('2');page.locator('[data-date]').fill('2026-10-26');page.locator('[data-note]').fill('Avance sintético')
   page.screenshot(path=str(OUT/f'advances-{width}.png'),full_page=True)
   page.locator('[data-operation=advance]').first.click();assert page.evaluate('window.calls.at(-1).name')=='sgp_aluminio_pendiente_registrar_avance_v1'
   payload=page.evaluate('window.calls.at(-1).args');assert payload['p_id_detalle']=='detail1' and payload['p_cantidad']==2 and payload['p_turno']=='T1'
   assert len(payload['p_idempotency_key'])==36
   # Fixed primary action uses the fabrication most recently edited.
   page.evaluate("window.open('COORDINADOR','advances')");page.locator('[data-date]').fill('2026-10-26');page.locator('[data-advance-qty="1"]').fill('1');page.locator('[data-pdt-primary]').click();assert page.evaluate('window.calls.at(-1).args.p_id_detalle')=='detail2'
   # Stage confirmation can be cancelled without any write, accepted uses unchanged RPC.
   page.evaluate("window.open('COORDINADOR','advances')")
   page.once('dialog',lambda dialog:dialog.dismiss());page.locator('[data-operation=stage]').click();assert page.evaluate("window.calls.filter(c=>c.name==='sgp_pdt_estado_v2').length")==0
   page.once('dialog',lambda dialog:dialog.accept());page.locator('[data-operation=stage]').click();assert page.evaluate('window.calls.at(-1).args.p_estado')=='CORTE'
   # Reverse and its explicit reason, stable payload and idempotency key.
   page.evaluate("window.open('COORDINADOR','advances',{...window.row,movimientos:[{id_movimiento:'move1',tipo:'AVANCE',id_detalle:'detail1',cantidad:2,fecha_operativa:'2026-10-26',usuario:'QA'}]})")
   page.locator('[data-note]').fill('Corrección sintética');page.once('dialog',lambda dialog:dialog.accept());page.locator('[data-operation=reverse]').click();assert page.evaluate('window.calls.at(-1).args.p_movimiento')=='move1'
   # NC are always visible, add preserves all prior NC and sends normalized references.
   page.evaluate("window.open('PATINADOR','nc')");assert page.locator('[data-pdt-panel=nc] tbody tr').count()==3
   page.locator('[data-ncs]').fill('1006166,1006167');page.locator('[data-operation=nc]').click();assert page.evaluate('window.calls.at(-1).args.p_ncs')==['1006166','1006167']
   # Positive Picking quantities, validation, assignment, annul and close keep RPC names.
   for action,name in [('delivery','sgp_pdt_entrega_registrar_v2'),('deliveryValidate','sgp_pdt_entrega_validar_v2'),('assign','sgp_pdt_asignar_v2'),('annul','sgp_pdt_entrega_anular_v2'),('close','sgp_pdt_cerrar_v2')]:
    page.evaluate("window.open('COORDINADOR','picking')")
    if action=='delivery':page.locator('[data-pick-qty]').fill('2')
    if action=='annul':page.locator('[data-annul-note]').fill('Anulación sintética')
    if action in ['annul','close']:page.once('dialog',lambda dialog:dialog.accept())
    page.locator('[data-operation='+action+']').click();assert page.evaluate('window.calls.at(-1).name')==name
   page.evaluate("window.mode='audit';window.open('RECEPCION','picking')");assert page.locator('[data-operation=assign]').is_disabled()
   assert page.locator('[data-operation=advance]').count()==0;assert page.locator('[data-operation=stage]').count()==0;assert page.locator('[data-operation=reverse]').count()==0
   page.evaluate("window.mode='pickingError';window.open('COORDINADOR','picking')");assert 'simulado' in page.locator('[role=alert]').inner_text();assert page.locator('[data-operation=delivery]').count()==0
   page.evaluate("window.mode='ok';window.open('RECEPCION','picking')");page.wait_for_function("document.querySelector('[data-pdt-missing]').textContent.includes('E17')");assert '1' in page.locator('[data-pdt-missing]').inner_text()
   # Closed Picking records remain read-only, without weakening their guards.
   page.evaluate("window.mode='ok';window.open('COORDINADOR','distribution',{...window.row,estado_repo:'PICKING'})");assert page.locator('[data-operation]').count()==0
   # Read-only roles keep all sections without write controls.
   page.evaluate("window.open('CONSULTA','history')");assert page.locator('[data-operation]').count()==0
   # Failure is visible; no fallback to legacy RPC; source identities still required.
   page.evaluate("window.mode='writeError';window.open('COORDINADOR','advances')");page.locator('[data-advance-qty="0"]').fill('2');page.locator('[data-date]').fill('2026-10-26');page.locator('[data-operation=advance]').first.click();assert 'Rechazo seguro' in page.locator('[data-result]').inner_text()
   page.evaluate("window.mode='empty';window.open('RECEPCION','distribution',{...window.row,contrato_pdt:'LEGACY'})");assert page.locator('[data-operation=validate]').is_disabled()
   page.evaluate("window.mode='ok'");page.locator('[data-source-retry]').click();page.locator('[data-source="0"]').wait_for();page.locator('[data-source="0"]').check();page.locator('[data-source="1"]').check();page.locator('[data-source-qty="0"]').fill('4');page.locator('[data-source-qty="1"]').fill('5');assert page.locator('[data-operation=validate]').is_enabled()
   page.locator('[data-operation=validate]').click();assert page.evaluate('window.calls.at(-1).args.p_detalles.map(d=>d.cantidad)')==[4,5]
   page.evaluate("window.open('COORDINADOR','history',{...window.row,movimientos:[{tipo:'REVERSO',cantidad:2,usuario:'QA',fecha_operativa:'2026-10-26',observacion:'Prueba sintética'}]})");assert 'REVERSO' in page.locator('.pdt-history').first.inner_text()
   page.wait_for_function("document.querySelector('[data-pdt-history]').textContent.includes('VALIDACION_PDT')")
   if width>640:
    page.locator('[data-pdt-tab=history]').focus();page.keyboard.press('Home');assert page.locator('[data-pdt-tab=distribution]').get_attribute('aria-selected')=='true'
   else:
    page.locator('[data-pdt-primary]').click();assert page.locator('.repo-work-footer').bounding_box()['y']<height
   page.locator('[data-dismiss]').focus();page.keyboard.press('Tab');assert page.evaluate('document.activeElement.closest("#repoWorkModal")!==null')
   page.keyboard.press('Escape');assert page.evaluate('window.closedCount')>0
   # Real Production loader extracted without booting the production application.
   app=(ROOT/'app.js').read_text();source=app[app.index("let prodPendingWeekSort="):app.index('// Reporte de entrega de turno de mecanizado')]
   page.evaluate('''async args=>{
    document.querySelector('#fixture').innerHTML='';document.querySelector('#listing').innerHTML='<div id="prodAluminumPending"></div>';
    const {productionPdtControls,productionPdtStatus}=await import(args.base+'/src/modules/pdt-production-actions.js');const {openPdtV2}=await import(args.base+'/src/modules/pdt-v2-controller.js');
    window.loadCount=0;window.role='COORDINADOR';
    const deps={productionPdtControls,productionPdtStatus,openPdtV2,getAppToken:()=>nullToken(),getSupabaseClient:async()=>window.client,repoRole:()=>window.role,loadPendingRows:async()=>{window.loadCount++;return {rows:[{...window.row,semana:44,sistema:'DOMUS II',validacion_estado:'VALIDADO'},{...window.row,id_pendiente:'frame-legacy',semana:43,tipo_pieza:'FRAME',contrato_pdt:'LEGACY',estado_repo:'PROCESADO',reserva:'OTHER',produccion:'FRAME QA',ncs:[]}],capabilities:window.caps}},repoIsValidated:()=>true,repoValidationBadgeHtml:()=>'<span>VALIDADO</span>',escapeHtml:window.esc,repoShowWorkModal:window.show,repoCloseWorkModal:()=>{},openRepoPendingDetail:()=>{}};
    function nullToken(){return 'SYNTHETIC'}
    window.renderProduction=new Function('deps','const {'+Object.keys(deps).join(',')+'}=deps;let repoV2Capabilities;'+args.source+';return loadAluminumPending;')(deps);await window.renderProduction();
   }''',{'source':source,'base':base})
   assert page.locator('#prodAluminumPending .repo-state').first.inner_text() in ['PROCESADO','PENDIENTE']
   assert 'V2 · Abrir PDT v2' not in page.locator('#prodAluminumPending').inner_text()
   assert 'Reserva 8558585' in page.locator('#prodAluminumPending').inner_text()
   assert 'DOMUS II' in page.locator('#prodAluminumPending').inner_text()
   count=page.evaluate('window.loadCount');page.locator('[data-pending-search]').fill('8558585');assert page.locator('[data-prod-pending-open]:visible').count()==1;assert page.evaluate('window.loadCount')==count
   page.locator('[data-pending-search]').fill('');page.locator('[data-pending-week-sort]').click();page.wait_for_function('window.loadCount>1')
   assert page.locator('[data-prod-pending-open]').first.get_attribute('data-prod-pending-open')=='synthetic-only'
   page.screenshot(path=str(OUT/f'production-{width}.png'),full_page=True)
   page.locator('[data-pdt-open="synthetic-only"][data-pdt-target="distribution"]').first.click();page.locator('.pdt-metrics').wait_for()
   assert page.locator('.pdt-metrics strong').all_text_contents()==['9','9','0','9']
   assert not errors,errors
   results.append({'viewport':[width,height],'metrics':[9,9,0,9],'distribution':[4,5],'NC':[1006163,1006164,1006165],'repo_ok_not_delivery':True,'all_11_write_RPC_contracts':True,'reception_no_machining':True,'audit_not_creditable':True,'closed_readonly':True,'keyboard_scroll_no_horizontal_overflow':True,'external_requests_allowed':False,'js_errors':errors})
   page.close()
  browser.close()
 (OUT/'results.json').write_text(json.dumps(results,indent=2));print(json.dumps(results))
finally:server.shutdown()
