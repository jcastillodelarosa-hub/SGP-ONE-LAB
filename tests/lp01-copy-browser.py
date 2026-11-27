"""Read-only browser navigation smoke for the production-line microcopy."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import os
import threading
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
class Files(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass

server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Files, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
origin = f'http://127.0.0.1:{server.server_port}'
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get('LP_CHROMIUM'))
        for width in (1440, 390):
            page = browser.new_page(viewport={'width':width,'height':900})
            errors = []
            page.on('pageerror',lambda e: errors.append(str(e)))
            page.route('**/*', lambda r: r.continue_() if r.request.url.startswith(origin+'/') else r.abort())
            page.goto(origin + '/')
            page.evaluate("""() => {
                document.querySelector('[data-view-panel="ensamble"]').hidden=false;
                document.dispatchEvent(new CustomEvent('sgp:lp-role',{detail:'COORDINADOR'}));
            }""")
            area = page.locator('[data-view-panel="ensamble"]')
            tabs = area.locator('.production-line-tabs')
            expected = ['Programación','Seguimiento','Ensamble','Empaque','Reporte de ubicaciones']
            assert tabs.locator('button:not([hidden])').all_inner_texts() == expected
            assert 'Seguimiento operativo de ensamble y empaque' not in area.inner_text()
            planner = area.locator('#productionPlannerPanel')
            assert planner.locator('#sgpPlanWeek').is_visible()
            assert not planner.locator('.lp-week-legend').count()
            for state in ['table','kanban','pending','tracking','calendar']:
                option = planner.locator(f'.sgp-line-view-tabs [data-view="{state}"]')
                option.click()
                assert option.get_attribute('aria-pressed') == 'true'
            tabs.get_by_role('tab',name='Seguimiento').click()
            assert tabs.get_by_role('tab',name='Seguimiento').get_attribute('aria-selected') == 'true'
            assert area.locator('#productionTrackingPanel [data-tracking-stages]').is_visible()
            assert 'Asignaciones consultadas y saldos oficiales separados por fuente' not in area.inner_text()
            for stage in ['Ensamble','Empaque']:
                tabs.get_by_role('tab',name=stage,exact=True).click()
                assert area.get_by_role('button',name='Operación del turno').is_visible()
                assert area.get_by_role('button',name='Cierres del turno').is_visible()
            tabs.get_by_role('tab',name='Reporte de ubicaciones').click()
            assert area.get_by_role('tab',name='Ubicaciones',exact=True).is_visible()
            area.get_by_role('tab',name='Árbol',exact=True).click()
            assert area.locator('#glassTreeTab').get_attribute('aria-selected') == 'true'
            area.get_by_role('tab',name='Tabla',exact=True).click()
            assert area.locator('#glassTableTab').get_attribute('aria-selected') == 'true'
            assert area.get_by_role('button',name='Exportar',exact=True).is_visible()
            area.get_by_role('tab',name='Fechas de preparación').click()
            assert area.get_by_role('columnheader',name='Fecha solicitada').is_visible()
            assert area.get_by_role('button',name='Guardar',exact=True).is_visible()
            assert area.get_by_role('button',name='Exportar Excel').is_visible()
            assert not errors,errors
            page.close()
            print(f'PASS Línea de Producción a {width}px (sin producción)')
        browser.close()
finally:
    server.shutdown()
