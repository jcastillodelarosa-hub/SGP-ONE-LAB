"""Actual Production PDT list/helpers, synthetic reads, no production traffic.
Controller dispatch is observed here; modal operations have their own browser suite.
"""
import functools
import http.server
import json
import os
import pathlib
import threading
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = pathlib.Path(os.environ.get('SGP_QA_OUT', '/tmp/pdt-production-queue-browser'))
OUT.mkdir(parents=True, exist_ok=True)
app = (ROOT / 'app.js').read_text()
start = app.index('async function loadAluminumPending(){')
end = app.index('\n// Reporte de entrega de turno de mecanizado', start)
source = app[start:end]


class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
base = 'http://127.0.0.1:' + str(server.server_address[1])
results = []
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get('SGP_QA_CHROMIUM', '/usr/bin/chromium'), headless=True, args=['--no-sandbox'])
        for width, height in [(1366, 900), (900, 900), (390, 844)]:
            page = browser.new_page(viewport={'width': width, 'height': height})
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.route('**/*', lambda route: route.continue_() if route.request.method == 'GET' and route.request.url.startswith(base + '/') else route.abort())
            page.goto(base + '/styles.css')
            page.set_content('<link rel="stylesheet" href="' + base + '/styles.css"><main style="padding:12px"><p>VISTA PREVIA AISLADA · datos sintéticos · sin escrituras</p><div id="prodAluminumPending"></div></main>')
            page.evaluate('''async ({base, source}) => {
              const {productionPdtControls, productionPdtStatus, productionPdtGroup, productionPdtVisible, productionPdtDeliveryStatus} = await import(base+'/src/modules/pdt-production-actions.js');
              const {loadProductionPdtDeliveries} = await import(base+'/src/services/pdt-production-deliveries.js');
              const escapeHtml = x => String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
              let prodPendingWeekSort='asc', prodPendingSearch='', prodPendingRequestSeq=0, repoV2Capabilities;
              let role='COORDINADOR';
              const caps={contract_version:2,picking_cuantitativo:true,cierre_v2:true,operations:[]};
              const make=(id,week,state='PROCESADO',contract='V2')=>({id_pendiente:id,semana:week,produccion:'Orden '+id,reserva:'QA',sistema:'QA',perfil:'PANEL',tipo_pieza:'PANEL',cantidad:9,cantidad_reportada:9,cantidad_validada:9,avance_neto:state==='MECANIZADO'?4:9,estado:'PENDIENTE',estado_repo:state,contrato_pdt:contract,validacion_estado:'VALIDADO',detalles:[{id_detalle:id+'-detail',cantidad_validada:9,avance_neto:state==='MECANIZADO'?4:9,saldo:state==='MECANIZADO'?5:0}],ncs:[]});
              window.rpcCalls=[];window.opened=[];window.mode='ok';window.delivered=3;
              const client={rpc:async(name,args)=>{
                window.rpcCalls.push({name,args});
                if(name!=='sgp_pdt_picking_simple_estado_v1')throw new Error('Unexpected RPC '+name);
                if(window.mode==='readerError')return {error:{message:'Synthetic reader failure'}};
                if(window.mode==='compatibility')return {data:{ok:true,contract_version:1,modo:'ANTERIOR_PENDIENTE',finalizado:false,detalles:[],entregas:[]}};
                const row=window.rows.find(r=>r.id_pendiente===args.p_id);
                const delivered=row.id_pendiente==='delivery-partial'?window.delivered:0;
                return {data:{ok:true,contract_version:1,modo:'DIRECTO',finalizado:false,detalles:row.detalles.map(d=>({...d,procesada:d.avance_neto,entregada:delivered,saldo_entrega:d.cantidad_validada-delivered,disponible_entrega:d.avance_neto-delivered})),entregas:[]}};
              }};
              const getSupabaseClient=async()=>client,getAppToken=()=> 'SYNTHETIC';
              const loadPendingRows=async()=>({rows:structuredClone(window.rows),capabilities:caps});
              const repoRole=()=>role,repoIsValidated=row=>row.validacion_estado==='VALIDADO',repoValidationBadgeHtml=()=>'<span>VALIDADO</span>';
              const repoShowWorkModal=()=>{},repoCloseWorkModal=()=>{};
              const openPdtV2=async args=>window.opened.push({id:args.row.id_pendiente,role:args.role,section:args.initialSection||'distribution'});
              const openRepoPendingDetail=row=>window.opened.push({id:row.id_pendiente,legacy:true});
              const refreshProductionPending=()=>loadAluminumPending();
              eval(source+'\\nwindow.renderQueue=loadAluminumPending;');
              window.setup=async (mode='ok',newRole='COORDINADOR')=>{
                role=newRole;window.mode=mode;window.rpcCalls=[];window.opened=[];window.delivered=3;prodPendingWeekSort='asc';prodPendingSearch='';
                window.rows=[make('processing-late',48,'MECANIZADO'),make('delivery-late',47),make('delivery-partial',44),make('processing-early',42,'PENDIENTE'),make('delivery-compat',45,'PICKING'),make('legacy-delivery',46,'PROCESADO','LEGACY'),{...make('finished',41,'PICKING'),estado:'RESUELTO'},make('legacy-finished',40,'PICKING','LEGACY')];
                await window.renderQueue();
              };
            }''', {'base': base, 'source': source})

            def ids(group):
                return page.locator('[data-pdt-group="' + group + '"] [data-prod-pending-open]:visible').evaluate_all('(nodes)=>nodes.map(n=>n.dataset.prodPendingOpen)')

            def count(group, expected):
                text = page.locator('[data-pdt-group="' + group + '"] [data-pdt-group-count]').text_content()
                assert int(text.split()[0]) == expected, (group, text, expected)

            page.evaluate('window.setup()')
            assert page.locator('[data-pdt-group]').evaluate_all('(nodes)=>nodes.map(n=>n.dataset.pdtGroup)') == ['delivery', 'processing']
            assert ids('delivery') == ['delivery-partial', 'delivery-compat', 'legacy-delivery', 'delivery-late']
            assert ids('processing') == ['processing-early', 'processing-late']
            count('delivery', 4)
            count('processing', 2)
            assert page.locator('[data-prod-pending-open="finished"],[data-prod-pending-open="legacy-finished"]').count() == 0
            partial = page.locator('[data-prod-pending-open="delivery-partial"]')
            assert '3 entregadas · 6 por entregar' in partial.locator('[data-pdt-delivery]').inner_text()
            assert 'entreg' in partial.inner_text().lower()
            # Actual read adapter and actual list retain partial deliveries after refresh.
            page.evaluate('window.delivered=5;window.renderQueue()')
            assert '5 entregadas · 4 por entregar' in partial.locator('[data-pdt-delivery]').inner_text()
            assert 'delivery-partial' in ids('delivery')
            page.screenshot(path=str(OUT / ('queue-partial-' + str(width) + '.png')), full_page=True)
            assert page.evaluate('document.documentElement.scrollWidth') <= width
            results.append({'width': width, 'case': 'group_order_partial_refresh_no_overflow', 'passed': True})

            page.locator('[data-pending-week-sort]').click()
            page.wait_for_function("document.querySelector('[data-pdt-group=delivery] [data-prod-pending-open]').dataset.prodPendingOpen==='delivery-late'")
            assert ids('delivery') == ['delivery-late', 'legacy-delivery', 'delivery-compat', 'delivery-partial']
            assert ids('processing') == ['processing-late', 'processing-early']
            search = page.locator('[data-pending-search]')
            search.fill('delivery-partial')
            count('delivery', 1)
            count('processing', 0)
            assert ids('processing') == []
            search.fill('no matching synthetic order')
            count('delivery', 0)
            count('processing', 0)
            assert ids('delivery') == ids('processing') == []
            assert page.locator('[data-pending-empty]').is_visible()
            page.locator('[data-pending-clear]').click()
            assert search.input_value() == ''
            count('delivery', 4)
            count('processing', 2)
            results.append({'width': width, 'case': 'sort_search_empty_counts', 'passed': True})

            partial.locator('.pdt-list-menu summary').click()
            partial.locator('[data-pdt-target="history"]').click()
            assert page.evaluate('window.opened.at(-1)') == {'id': 'delivery-partial', 'role': 'COORDINADOR', 'section': 'history'}
            page.evaluate("window.setup('ok','CONSULTA')")
            page.locator('[data-prod-pending-open="delivery-partial"] > div').first.click()
            assert page.evaluate('window.opened.at(-1)') == {'id': 'delivery-partial', 'role': 'CONSULTA', 'section': 'distribution'}
            assert page.locator('[data-prod-pending-open="delivery-partial"] [data-pdt-target="advances"]').count() == 0
            page.evaluate("window.setup('ok','UNAUTHORIZED')")
            assert page.locator('[data-pdt-open]').count() == 0
            results.append({'width': width, 'case': 'history_dispatch_consulta_role_controls', 'passed': True})

            for mode in ['readerError', 'compatibility']:
                page.evaluate('mode=>window.setup(mode)', mode)
                assert len(ids('delivery')) == 4
                text = page.locator('[data-pdt-delivery="delivery-partial"]').inner_text().lower()
                assert '0 entregadas' not in text and '0 por entregar' not in text
                assert any(word in text for word in ['verificar', 'disponible', 'anterior', 'historial', 'conciliar']), text
                page.screenshot(path=str(OUT / (mode + '-' + str(width) + '.png')), full_page=True)
                results.append({'width': width, 'case': mode + '_retains_rows_without_zero', 'passed': True})
            page.evaluate("window.setup();")
            page.evaluate("window.rows.find(r=>r.id_pendiente==='delivery-partial').estado='RESUELTO';window.renderQueue()")
            assert 'delivery-partial' not in ids('delivery')
            count('delivery', 3)
            page.evaluate('window.rows=[];window.renderQueue()')
            assert page.locator('[data-prod-pending-open]').count() == 0
            assert 'sin pendientes' in page.locator('#prodAluminumPending').inner_text().lower()
            assert page.evaluate("window.rpcCalls.every(c=>c.name==='sgp_pdt_picking_simple_estado_v1'&&c.args.p_token==='SYNTHETIC')")
            assert not errors, errors
            results.append({'width': width, 'case': 'resolved_removed_empty_queue_read_only', 'passed': True})
            page.close()
        browser.close()
    (OUT / 'results.json').write_text(json.dumps(results, indent=2))
    print(json.dumps(results))
finally:
    server.shutdown()
