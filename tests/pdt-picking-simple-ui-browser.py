"""Real PDT controller, synthetic RPC only. No production reads or writes."""
import functools, http.server, json, os, pathlib, threading
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = pathlib.Path(os.environ.get('SGP_QA_OUT', '/tmp/pdt-picking-simple-evidence'))
OUT.mkdir(parents=True, exist_ok=True)

class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args): pass

server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
base = 'http://127.0.0.1:' + str(server.server_address[1])
results = []
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get('SGP_QA_CHROMIUM','/usr/bin/chromium'), headless=True, args=['--no-sandbox'])
        for width, height in [(1366, 900), (390, 844)]:
            page = browser.new_page(viewport={'width': width, 'height': height})
            errors = []
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.on('dialog', lambda d: d.accept())
            page.route('**/*', lambda route: route.continue_() if route.request.url.startswith(base+'/') else route.abort())
            page.goto(base + '/styles.css')
            page.set_content('<link rel="stylesheet" href="' + base + '/styles.css"><main id="fixture"></main>')
            page.evaluate('''async base => {
              const {openPdtV2} = await import(base+'/src/modules/pdt-v2-controller.js');
              const esc = x => String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
              window.setup = async (mode='ok', role='PICKING') => {
                window.mode=mode; window.reloaded=[]; window.eventLog=[]; window.closeCount=0; window.writeCount=0; window.keys=[]; window.delivered=0; window.rpcNames=[]; window.oldLines=[]; window.releaseWrite=null; window.releaseRead=null;
                window.fresh={id_pendiente:'synthetic-pdt',produccion:'Orden sintética',reserva:'QA',perfil:'PANEL QA',estado:'PENDIENTE',estado_repo:'PROCESADO',contrato_pdt:'V2',validacion_estado:'VALIDADO',cantidad_reportada:1,ncs:[],detalles:[{id_detalle:'synthetic-detail',fabricacion:'E17',longitud:90,acabado:'BLACK',cantidad_validada:1,avance_neto:1,saldo:0}]};
                window.deliveries={};
                if(mode==='historicalPendingManual')window.fresh.manual_pdt=true;
                if(mode==='unvalidated')window.fresh.validacion_estado='PENDIENTE';
                if(mode==='historical'||mode==='historicalManual'){window.deliveries['synthetic-detail']=1;window.fresh.manual_pdt=mode==='historicalManual';}
                if(mode==='partial'||mode==='unprocessed'){window.fresh.detalles[0].cantidad_validada=3;window.fresh.detalles[0].avance_neto=mode==='unprocessed'?0:2;window.fresh.detalles[0].saldo=mode==='unprocessed'?3:1;window.fresh.cantidad_reportada=3;}
                if(mode==='multi'){window.fresh.detalles.push({...window.fresh.detalles[0],id_detalle:'second-detail',fabricacion:'E18'});window.fresh.cantidad_reportada=2;}
                const client={rpc:async(name,args)=>{
                  window.rpcNames.push(name);
                  if(name==='sgp_pdt_manual_listar_v1')return {data:{ok:true,contract_version:'pdt-manual-3',pendientes:[window.fresh]}};
                  if(name==='sgp_pdt_picking_v2'||name==='sgp_pdt_manual_picking_v1'){
                    if(name!==(window.fresh.manual_pdt?'sgp_pdt_manual_picking_v1':'sgp_pdt_picking_v2'))throw new Error('Wrong legacy reader');
                    return {data:{ok:true,entregas:[{id_entrega:'old-event',estado:'VALIDADA',produccion:'Orden sintética'}],lineas:window.oldLines}};
                  }
                  if(name==='sgp_pdt_entrega_registrar_v2'||name==='sgp_pdt_manual_entrega_registrar_v1'){
                    if(name!==(window.fresh.manual_pdt?'sgp_pdt_manual_entrega_registrar_v1':'sgp_pdt_entrega_registrar_v2'))throw new Error('Wrong legacy writer');
                    window.oldLines.push({id_linea:'old-line',id_detalle:args.p_detalle,cantidad:args.p_cantidad,estado:'VALIDADA',asignada:true});return {data:{ok:true}};
                  }
                  if(name==='sgp_pdt_picking_simple_estado_v1'){
                    if(['historicalPending','historicalPendingManual'].includes(window.mode)&&window.fresh.estado!=='RESUELTO')return {data:{ok:true,contract_version:1,modo:'ANTERIOR_PENDIENTE',finalizado:false,detalles:[],entregas:[]}};
                    if(window.mode==='readerError')return {error:{message:'Reader unavailable'}};
                    return {data:{ok:true,contract_version:1,modo:window.fresh.estado==='RESUELTO'&&window.oldLines.length?'ANTERIOR_COMPLETA':'DIRECTO',finalizado:window.fresh.estado==='RESUELTO',detalles:window.fresh.detalles.map(d=>({...d,procesada:d.avance_neto,entregada:window.deliveries[d.id_detalle]||0,saldo_entrega:d.cantidad_validada-(window.deliveries[d.id_detalle]||0),disponible_entrega:d.avance_neto-(window.deliveries[d.id_detalle]||0)})),entregas:window.eventLog}};
                  }
                  if(name==='sgp_pdt_corte_operativo_v1')return {data:{ok:true,contract_version:1,desde:null}};
                  if(name==='sgp_pdt_proceso_simple_estado_v1')return {data:{ok:true,detalles:[{id_detalle:'synthetic-detail',en_proceso:0}]}};
                  if(name==='sgp_aluminio_pendientes_listar_v2'){
                    if(window.mode==='delayRead')await new Promise(r=>window.releaseRead=r);
                    if(window.mode==='readError')return {error:{message:'Lectura fallida simulada'}};
                    return {data:{ok:true,contract_version:2,pendientes:[window.fresh]}};
                  }
                  if(name==='sgp_aluminio_pendiente_historial')return {data:window.eventLog};
                  if(name==='sgp_picking_recepcion_cola')return {data:[]};
                  if(name==='sgp_pdt_cerrar_v2'||name==='sgp_pdt_manual_cerrar_v1'){
                    if(name!==(window.fresh.manual_pdt?'sgp_pdt_manual_cerrar_v1':'sgp_pdt_cerrar_v2'))throw new Error('Wrong historical close');
                    window.deliveries['synthetic-detail']=1;window.writeCount++;window.keys.push(args.p_clave);window.fresh.estado='RESUELTO';window.fresh.estado_repo='PICKING';return {data:{ok:true}};
                  }
                  if(name==='sgp_pdt_picking_simple_v1'){
                    window.writeCount++;window.keys.push(args.p_idempotency_key);if(Object.keys(args).sort().join(',')!=='p_cantidad,p_id_detalle,p_idempotency_key,p_observacion,p_token')throw new Error('Wrong write contract');
                    if(['delayWrite','delayWriteTimeout'].includes(window.mode))await new Promise(r=>window.releaseWrite=r);
                    if(window.mode==='rejected')return {error:{code:'P0001',message:'Cobertura Picking incompleta'}};
                    if(!window.eventLog.some(e=>e.key===args.p_idempotency_key)){
                      window.deliveries[args.p_id_detalle]=(window.deliveries[args.p_id_detalle]||0)+args.p_cantidad;
                      window.eventLog.push({key:args.p_idempotency_key,id_entrega:'synthetic-'+window.eventLog.length,id_detalle:args.p_id_detalle,cantidad:args.p_cantidad,creado_en:'2026-11-10',usuario:'QA',tipo_evento:'ENTREGA_PDT'});
                      if(window.fresh.detalles.every(d=>window.deliveries[d.id_detalle]===d.cantidad_validada)){window.fresh.estado='RESUELTO';window.fresh.estado_repo='PICKING';}
                    }
                    if(['timeout','delayWriteTimeout'].includes(window.mode)){window.mode='ok';throw new Error('Respuesta interrumpida simulada');}
                    return {data:{ok:true,finalizado:window.fresh.estado==='RESUELTO'}};
                  }
                  throw new Error('Unexpected RPC '+name);
                }};
                const caps={contract_version:2,picking_cuantitativo:true,cierre_v2:true,operations:['sgp_pdt_cerrar_v2','sgp_pdt_entrega_registrar_v2']};
                await openPdtV2({row:structuredClone(window.fresh),client,token:'SYNTHETIC',role,capabilities:caps,initialSection:'picking',escape:esc,
                  show:(title,meta,body,footer)=>{document.querySelector('#fixture').innerHTML='<div id="repoWorkModal" class="piece-modal"><div class="piece-modal-card repo-work-card" role="dialog" aria-modal="true"><div class="piece-modal-head"><h2>'+esc(title)+'</h2></div><div class="piece-modal-meta">'+meta+'</div><div class="repo-work-body">'+body+'</div><div class="repo-work-footer">'+footer+'</div></div></div>';return document.querySelector('#repoWorkModal');},
                  reload:async row=>{window.reloaded.push(structuredClone(row));},
                  close:()=>{window.closeCount++;document.querySelector('#repoWorkModal').hidden=true;}
                });
              };
            }''', base)
            for mode in ['ok', 'historicalPending', 'historicalPendingManual', 'historical', 'historicalManual', 'partial', 'multi', 'unprocessed', 'unvalidated', 'closeIdle', 'readerError', 'readonly', 'invalid', 'doubleClick', 'delayWrite', 'delayWriteTimeout', 'delayRead', 'readError', 'timeout', 'rejected']:
                page.evaluate("mode => window.setup(mode,mode==='readonly'?'RECEPCION':'PICKING')", mode)
                if mode in ['historicalPending','historicalPendingManual']:
                    assert page.locator('[data-pick-event]').count()==1
                    assert page.locator('[data-pick-help]').count()==0
                    page.locator('[data-pick-qty]').fill('1')
                    page.locator('[data-operation=delivery]').click()
                    page.wait_for_function('window.reloaded.length===1')
                    assert page.evaluate('window.oldLines.length')==1
                    page.locator('[data-operation=close]').click()
                    page.wait_for_function('window.reloaded.length===2')
                    assert page.evaluate('window.reloaded[1].estado')=='RESUELTO'
                    assert page.evaluate("!window.rpcNames.includes('sgp_pdt_picking_simple_v1')")
                    assert page.locator('[data-operation=delivery],[data-operation=close]').count()==0
                    results.append({'width':width,'case':mode,'passed':True})
                    continue
                assert page.locator('[data-operation=register],[data-operation=assign],[data-operation=validatePick]').count() == 0
                if mode in ['historical','historicalManual']:
                    assert page.locator('[data-operation=delivery]').count() == 0
                    page.locator('[data-operation=close]').click()
                    page.wait_for_function('window.reloaded.length===1')
                    assert page.evaluate('window.reloaded[0].estado')=='RESUELTO'
                    assert page.evaluate('window.writeCount')==1
                    assert page.evaluate('window.eventLog.length')==0
                    results.append({'width':width,'case':mode,'passed':True})
                    continue
                assert page.locator('[data-operation=close]').count() == 0
                if mode=='closeIdle':
                    page.keyboard.press('Escape')
                    assert page.locator('#repoWorkModal').is_hidden()
                    assert page.evaluate('window.writeCount')==0
                    assert page.evaluate('window.reloaded.length')==0
                    results.append({'width':width,'case':mode,'passed':True})
                    continue
                if mode in ['readerError','readonly','unvalidated']:
                    if mode=='readerError': assert page.evaluate("!window.rpcNames.includes('sgp_pdt_picking_v2')&&!window.rpcNames.includes('sgp_pdt_manual_picking_v1')")
                    assert page.locator('[data-operation=delivery]').count() == 0
                    results.append({'width':width,'case':mode,'passed':True})
                    continue
                button=page.locator('[data-operation=delivery]')
                qty=page.locator('[data-pick-qty]')
                assert button.is_disabled()
                if mode in ['invalid','unprocessed']:
                    for value in ['0','-1','1.5','2' if mode=='invalid' else '1']:
                        qty.fill(value)
                        assert button.is_disabled(),value
                    assert page.evaluate('window.writeCount') == 0
                    results.append({'width':width,'case':mode,'passed':True})
                    continue
                qty.fill('1')
                if mode=='doubleClick':
                    button.evaluate('(b)=>{b.click();b.click();}')
                else: button.click()
                if mode in ['delayWrite','delayWriteTimeout']:
                    page.wait_for_function('typeof window.releaseWrite === "function"')
                    page.keyboard.press('Escape')
                    page.evaluate('window.releaseWrite()')
                if mode == 'delayRead':
                    page.wait_for_function('typeof window.releaseRead === "function"')
                    page.keyboard.press('Escape')
                    page.evaluate("window.mode='ok';window.releaseRead()")
                if mode == 'readError':
                    page.wait_for_function("document.querySelector('[data-pdt-feedback]').textContent.includes('No se pudo actualizar')")
                    assert page.evaluate('window.reloaded.length') == 0
                    assert page.evaluate('window.eventLog.length') == 1
                    page.evaluate("window.mode='ok'")
                    page.locator('[data-refresh-pdt]').click()
                if mode == 'timeout':
                    page.wait_for_function("!document.querySelector('[data-repeat-pdt]').hidden")
                    assert page.evaluate('window.reloaded.length') == 0
                    page.locator('[data-repeat-pdt]').click()
                if mode == 'rejected':
                    page.wait_for_function("document.querySelector('[data-pdt-feedback]').textContent.includes('Cobertura Picking incompleta')")
                    assert page.evaluate('window.reloaded.length') == 0
                    assert page.evaluate('window.eventLog.length') == 0
                    assert page.evaluate('window.fresh.estado') == 'PENDIENTE'
                else:
                    page.wait_for_function('window.reloaded.length === 1')
                    assert page.evaluate('window.reloaded[0].estado') == ('PENDIENTE' if mode in ['partial','multi'] else 'RESUELTO')
                    assert page.evaluate('window.reloaded[0].estado_repo') == ('PROCESADO' if mode in ['partial','multi'] else 'PICKING')
                    assert page.evaluate('window.eventLog.length') == 1
                    assert page.evaluate('window.writeCount') == (2 if mode == 'timeout' else 1)
                if mode=='timeout': assert page.evaluate('new Set(window.keys).size') == 1
                if mode in ['partial','multi']:
                    assert page.locator('[data-pick-qty]').input_value() == ''
                    assert page.locator('[data-operation=delivery]').is_disabled()
                    page.locator('[data-pdt-section=picking] details').evaluate('(d)=>d.open=true')
                    assert 'QA' in page.locator('[data-pdt-section=picking]').inner_text()
                    page.screenshot(path=str(OUT/('partial-'+str(width)+'.png')),full_page=True)
                if mode=='multi':
                    page.locator('[data-pick-detail]').select_option('second-detail')
                    page.locator('[data-pick-qty]').fill('1')
                    page.locator('[data-operation=delivery]').click()
                    page.wait_for_function('window.reloaded.length===2')
                    assert page.evaluate('window.reloaded[1].estado')=='RESUELTO'
                    assert page.evaluate('window.eventLog.length')==2
                    assert page.evaluate('new Set(window.keys).size')==2
                if mode in ['delayWrite','delayWriteTimeout','delayRead']:
                    assert page.locator('#repoWorkModal').is_hidden()
                    assert page.evaluate('window.closeCount') == 1
                results.append({'width': width, 'case': mode, 'passed': True})
            assert not errors, errors
            page.close()
        browser.close()
    (OUT/'results.json').write_text(json.dumps(results, indent=2))
    print(json.dumps(results))
finally:
    server.shutdown()
