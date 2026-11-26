"""Full index.html + app.js integration, synthetic fixtures, all external traffic intercepted.
Run: SGP_QA_CHROMIUM=/path/to/chrome SGP_QA_OUT=/tmp/qa python tests/picking-pdt-full-app-browser.py
No fragments, mocked DOM, production credentials, or live service requests.
"""
import functools
import http.server
import json
import os
import pathlib
import threading
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = pathlib.Path(os.environ.get('SGP_QA_OUT', '/tmp/picking-pdt-full-app'))
OUT.mkdir(parents=True, exist_ok=True)
TOKEN = 'SYNTHETIC-QA-SESSION-NOT-A-CREDENTIAL'
ID = '00000000-0000-4000-8000-000000000001'
PDT = dict(id=ID,id_pendiente='00000000-0000-4000-8000-000000000002',contrato='V2',semana=47,
           produccion='QA-ORDEN-001',reserva='QA-RESERVA',perfil='QA-PERFIL',nc='QA-NC',
           fabricacion='Vertical',longitud=42.125,acabado='QA Blanco',procesado=4,entregado=2,
           recibido=1,disponible_entrega=2,saldo_recepcion=1,estado='ENTREGA_PARCIAL',
           can_deliver=True,can_receive=True,movimientos=[dict(tipo='ENTREGAR',cantidad=2,
           nombre='Operador sintético',fecha='2026-11-18T12:00:00Z',observacion='Fixture QA')])
CAPS = dict(deliver=True,receive=True)
ORDER = dict(id_programacion=ID,semana=47,reserva='QA-RESERVA',parte='1',prioridad='1',
             turno='TURNO 1',sistema='QA PANEL',acabado='QA Blanco',estado='PROCESADO',
             cantidad_ventanas=4,ordenes=[dict(produccion='QA-ORDEN-001',cantidad=4,
             estado_mecanizado='PROCESADO',novedades=0)],novedades=0)
# Same reserve/part, different physical programs: one delivered, one finalized
# without Picking record, and one legitimately pending old order.
PAST = dict(ORDER,id_programacion='past',semana=45,reserva='QA-PAST',parte='3',
            cantidad_ventanas=90,ordenes=[dict(produccion='QA-PAST-90',key_produccion='past',cantidad=90,
            entrega_estado='VALIDADA',fecha_entrega='2026-11-07',finalizada_sin_saldo=True)])
FINAL = dict(PAST,id_programacion='final',parte_id='final',identificador_parte='Lote P3',
             cantidad_ventanas=108,cantidad_entregada=0,ordenes=[dict(produccion='QA-FINAL-108',
             key_produccion='final',cantidad=108,finalizada_sin_saldo=True)])
OLD_OPEN = dict(PAST,id_programacion='old-open',cantidad_ventanas=4,ordenes=[dict(
                produccion='QA-OLD-OPEN',key_produccion='old',cantidad=4,finalizada_sin_saldo=False)])
MATERIAL = dict(PAST,id_programacion='material',parte_id='material',identificador_parte='Lote P2',
                cantidad_entregada=90,pdt_abiertos=1)
RECEIPT = dict(id_entrega=ID,id_programacion=ID,semana=47,reserva='QA-RESERVA',parte='1',
               sistema='QA PANEL',acabado='QA Blanco',produccion='QA-ORDEN-001',proyecto='Fixture QA',
               cantidad_ventanas=4,completa=True,fecha_entrega='2026-11-18',turno_entrega='TURNO 1',
               nombre_entrego='Operador sintético',areas=[])

class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args): pass

server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
BASE = 'http://127.0.0.1:' + str(server.server_address[1])
report = dict(status='NOT_RUN',production_writes=0,external_network_requests_allowed=0,viewports=[])
page = None
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get('SGP_QA_CHROMIUM','/usr/bin/chromium'),
                                    headless=True,args=['--no-sandbox'])
        for width,height in [(1440,1000),(390,844)]:
            context = browser.new_context(viewport=dict(width=width,height=height),service_workers='block')
            page = context.new_page()
            errors, unexpected, calls, loaded, consoles = [], [], [], set(), []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.on('console', lambda msg: consoles.append(dict(type=msg.type,text=msg.text)) if msg.type=='error' else None)
            def intercept(route):
                req = route.request
                parsed = urlparse(req.url)
                headers = {'Access-Control-Allow-Origin':BASE,'Access-Control-Allow-Headers':'apikey, authorization, content-type, x-client-info, prefer, accept-profile, content-profile, x-supabase-api-version','Access-Control-Allow-Methods':'POST,GET,OPTIONS'}
                def result(value,status=200):
                    route.fulfill(status=status,content_type='application/json',headers=headers,body=json.dumps(value))
                if req.url.startswith(BASE+'/') and req.method=='GET':
                    loaded.add(parsed.path)
                    if parsed.path=='/config.js':
                        route.fulfill(content_type='application/javascript',body='window.SGP_CONFIG=Object.freeze('+json.dumps(dict(supabaseUrl='https://sgp-qa.invalid',supabasePublishableKey='sb_publishable_synthetic_qa',optRetailMode='paused'))+');')
                    else:
                        route.continue_()
                    return
                if parsed.hostname=='sgp-qa.invalid' and req.method=='OPTIONS':
                    route.fulfill(status=204,headers=headers,body='');return
                if parsed.hostname=='sgp-qa.invalid' and '/rest/v1/rpc/' in parsed.path and req.method=='POST':
                    name=parsed.path.rsplit('/',1)[-1]
                    body=req.post_data_json or {}
                    calls.append(dict(name=name,args=body))
                    if name=='sgp_login':
                        assert body==dict(p_usuario='qa.synthetic',p_password='synthetic-only')
                        result(dict(token=TOKEN));return
                    assert body.get('p_token')==TOKEN, 'Missing synthetic auth on '+name
                    if name=='sgp_sesion_actual':
                        result(dict(valida=True,usuario='qa.synthetic',nombre='Usuario de pruebas',rol='SUPERVISOR DE PICKING',id_usuario=ID));return
                    if name=='sgp_mis_accesos':
                        result([dict(ventana=x) for x in ['inicio','picking.entrega','picking.recepcion']]);return
                    if name=='sgp_pdt_picking_cola_v1':
                        assert body.get('p_modo') in ['delivery','reception']
                        result(dict(ok=True,contract_version=1,capabilities=CAPS,rows=[] if body.get('p_estado')=='closed' else [PDT],has_more=False,next_cursor=None));return
                    if name=='sgp_pdt_picking_avisos_v1':
                        result(dict(ok=True,contract_version=1,capabilities=CAPS,notifications=[dict(id=ID,produccion='QA-ORDEN-001',reserva='QA-RESERVA',perfil='QA-PERFIL',cantidad=2,fecha='2026-11-18T12:00:00Z',read_at=None)],unread_count=1,has_more=False,next_cursor=None));return
                    if name=='sgp_picking_cola':result([ORDER,PAST,FINAL,OLD_OPEN,MATERIAL]);return
                    if name=='sgp_picking_recepcion_cola':result([RECEIPT]);return
                    if name=='sgp_picking_semanas':result([45,47]);return
                    if name=='sgp_resumen_saldos_portada':result(dict(filas=[]));return
                    if name in ['sgp_configuracion_general_obtener','sgp_picking_auditoria_areas_configuracion','sgp_reservas_asociadas_listar']:
                        result([]);return
                    unexpected.append(dict(method=req.method,url=req.url,rpc=name))
                    result(dict(code='QA_UNEXPECTED_RPC',message='No fixture: '+name),501);return
                unexpected.append(dict(method=req.method,url=req.url))
                route.abort('blockedbyclient')
            context.route('**/*',intercept)
            page.goto(BASE+'/index.html',wait_until='networkidle')
            expect(page.locator('#authStatus')).to_have_text('Sin sesión')
            page.locator('#authUser').fill('qa.synthetic')
            page.locator('#authPassword').fill('synthetic-only')
            page.locator('#authLogin').click()
            expect(page.locator('#authStatus')).to_contain_text('Usuario de pruebas')
            expect(page.locator('#pickingPdtNotifications [data-pdt-unread]')).to_have_text('1')
            if width<640:
                page.locator('#mobileMenuToggle').click()
                page.screenshot(path=str(OUT/f'full-sidebar-{width}.png'),full_page=True)
            page.locator('.nav [data-view="picking"]').click()
            expect(page.locator('[data-view-panel="picking"]')).to_be_visible()
            expect(page.locator('#pickBoard')).to_contain_text('QA-RESERVA')
            expect(page.locator('#pickBoard').get_by_text('Finalizadas por conciliar · 1')).to_be_visible()
            expect(page.locator('#pickBoard .pick-card').filter(has_text='QA-FINAL-108')).to_have_count(0)
            expect(page.locator('#pickOpenBoard [data-open-delivery="final"]')).to_have_count(0)
            expect(page.locator('#pickOpenBoard [data-open-delivery="old-open"]')).to_have_count(1)
            expect(page.locator('#pickBoard [data-pick-order-delivery="material"]')).to_have_count(1)
            page.locator('#pickBoard').get_by_text('Finalizadas por conciliar · 1').click()
            expect(page.locator('#pickBoard').get_by_text('QA-FINAL-108')).to_be_visible()
            expect(page.locator('#pickBoard [data-pick-order-delivery="final"]')).to_have_count(0)

            expect(page.locator('#pickDeliveryPanel .picking-pdt-orders')).to_be_visible()
            expect(page.locator('#pickDeliveryPanel [data-pdt-see-ready]')).to_be_visible()
            page.locator('#pickDeliveryPanel [data-pdt-kind="pdt"]').click()
            expect(page.locator('#pickDeliveryPanel tbody')).to_contain_text('QA-PERFIL')
            expect(page.locator('#pickDeliveryPanel .picking-pdt-orders')).to_be_hidden()
            expect(page.locator('#pickDeliveryPanel tbody')).to_contain_text('42.125 in')
            page.screenshot(path=str(OUT/f'full-delivery-{width}.png'),full_page=True)
            page.locator('#pickDeliveryPanel [data-pdt-move]').scroll_into_view_if_needed()
            before_modal_scroll=page.evaluate('window.scrollY')
            page.locator('#pickDeliveryPanel [data-pdt-move]').click()
            expect(page.locator('.picking-pdt-modal')).to_be_visible()
            expect(page.locator('.picking-pdt-modal [data-pdt-meta]')).to_contain_text('42.125 in')
            expect(page.locator('.picking-pdt-modal [data-pdt-quantity]')).to_have_value('2')
            modal_box=page.locator('.picking-pdt-modal > .modal-card').bounding_box()
            assert modal_box and modal_box['x']>=0 and modal_box['y']>=0 and modal_box['x']+modal_box['width']<=width+1 and modal_box['y']+modal_box['height']<=height+1, modal_box
            assert abs(page.evaluate('window.scrollY')-before_modal_scroll)<2, 'Opening modal scrolled the page'
            assert page.locator('.picking-pdt-modal').evaluate("el=>getComputedStyle(el).position")=='fixed'
            page.screenshot(path=str(OUT/f'full-delivery-modal-{width}.png'),full_page=True)
            page.locator('.picking-pdt-modal [data-pdt-cancel]').click()
            expect(page.locator('.picking-pdt-modal')).to_be_hidden()
            page.locator('#pickDeliveryPanel [data-pdt-kind="orders"]').click()
            expect(page.locator('#pickBoard')).to_contain_text('QA-RESERVA')
            expect(page.locator('#pickDeliveryPanel .picking-pdt-orders')).to_be_visible()
            page.locator('#pickReceptionTab').click()
            expect(page.locator('#pickReceptionBoard')).to_contain_text('Operador sintético')
            page.locator('#pickReceptionPanel [data-pdt-kind="pdt"]').click()
            expect(page.locator('#pickReceptionPanel tbody')).to_contain_text('QA-PERFIL')
            page.screenshot(path=str(OUT/f'full-reception-{width}.png'),full_page=True)
            page.locator('#pickReceptionPanel [data-pdt-move]').click()
            expect(page.locator('.picking-pdt-modal [data-pdt-quantity]')).to_have_value('1')
            expect(page.locator('#pickingPdtTitle')).to_have_text('Recibir PDT aluminio')
            page.locator('.picking-pdt-modal [data-pdt-close]').click()
            expect(page.locator('.picking-pdt-modal')).to_be_hidden()
            page.locator('#pickingPdtNotifications [data-pdt-bell]').click()
            notice_box=page.locator('.picking-pdt-notice-popover').bounding_box()
            assert notice_box and notice_box['x']>=0 and notice_box['y']>=0 and notice_box['x']+notice_box['width']<=width+1 and notice_box['y']+notice_box['height']<=height+1, notice_box
            notice_button=page.locator('.picking-pdt-notice-popover [data-pdt-go]').first
            assert notice_button.evaluate("el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}"), 'Notice action is covered by other content'
            page.screenshot(path=str(OUT/f'full-notices-{width}.png'),full_page=True)
            assert '/index.html' in loaded and '/app.js' in loaded and '/src/ui/picking-pdt-flow.js' in loaded
            assert '/vendor/supabase.js' in loaded, 'Real local SDK must load'
            assert not errors, errors
            assert not unexpected, unexpected
            assert not any(x['name']=='sgp_pdt_picking_movimiento_v1' for x in calls), 'Modal open/close must not mutate'
            report['viewports'].append(dict(width=width,height=height,rpc_calls=[x['name'] for x in calls],pageerrors=errors,unexpected=unexpected,console_errors=consoles,loaded_files=len(loaded)))
            context.close()
        browser.close()
    report['status']='PASS'
except Exception as error:
    report['status']='FAIL';report['error']=str(error)
    if 'errors' in locals():report.update(pageerrors=errors,unexpected=unexpected,console_errors=consoles,rpc_calls=[x['name'] for x in calls])
    try:page.screenshot(path=str(OUT/'full-failure.png'),full_page=True)
    except Exception:pass
    raise
finally:
    (OUT/'full-app-report.json').write_text(json.dumps(report,indent=2))
    print(json.dumps(report))
    server.shutdown()
