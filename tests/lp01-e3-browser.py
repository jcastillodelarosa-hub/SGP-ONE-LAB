"""LP-01 weekly grid and drop regression with synthetic RPC responses only."""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs' / 'evidence' / 'lp01-week-grid'
OUT.mkdir(parents=True, exist_ok=True)


def run(page, label):
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto('http://127.0.0.1:8769/', wait_until='domcontentloaded')
    page.evaluate("""() => {
      const section=document.querySelector('[data-view-panel="ensamble"]');section.hidden=false;
      const marker=document.createElement('p');marker.textContent='PRUEBA VISUAL LOCAL · DATOS SINTÉTICOS · SIN CONEXIÓN PRODUCTIVA';marker.style='padding:10px;background:#fff1cc;color:#563900;font-weight:700';section.prepend(marker);
      const orders=[{key_produccion:'KEY1',produccion:'TORRE NORTE',sistema:'ES7100',reserva_al:'8707142',acabado:'NEGRO',tipo:'ORDEN',cantidad:20,saldo_ensamble:12,estado_mecanizado:'CORTE'}];
      window.__lpCalls=[];
      const builder={select:()=>builder,in:()=>builder,neq:()=>Promise.resolve({data:[],error:null})};
      window.SGPPlannerBridge={getRows:()=>orders,getToken:()=> 'synthetic-session',loadAssembly:async()=>{},getClient:async()=>({
        from:()=>builder,
        rpc:async(name,args)=>{window.__lpCalls.push({name,args});return {error:null,data:name==='sgp_linea_plan_consultar' ? [
          {id:'A1',key_produccion:'KEY1',fecha:args.p_desde,turno:1,prioridad:1,produccion:'TORRE NORTE',sistema:'ES7100',cantidad:12,ejecutado:0,estado:'ABIERTA'}
        ] : name==='sgp_linea_plan_explorador_v327' ? [
          {key_produccion:'KEY1',parte:'1.1',vidrio_preparado:14,vidrio_novedad:2,vidrio_traslado:1}
        ] : []}}}
      )};
      const week=document.querySelector('#assemblyWeek');week.replaceChildren(new Option('Semana 44','44'));week.value='44';
      document.querySelector('#assemblyStatus').textContent='Datos sintéticos cargados';
    }""")
    week = page.locator('#sgpPlanWeek')
    week.fill('2026-W44')
    week.dispatch_event('change')
    page.wait_for_function("window.__lpCalls.some(x=>x.name==='sgp_linea_plan_consultar' && x.args.p_desde==='2026-10-26')")
    assert page.locator('.lp-week-cell').count() == 14
    assert page.locator('[data-lp-date="2026-10-26"][data-lp-shift="1"]').count() == 1
    assert page.locator('[data-lp-date="2026-11-01"][data-lp-shift="2"]').count() == 1
    assert page.locator('#sgpPendingAssemblyQueue').is_hidden()
    assert page.locator('.lp-week-assignment').count() == 1
    page.locator('#lp01Capacity').fill('10')
    assert 'Sobrecupo' in page.locator('[data-lp-date="2026-10-26"][data-lp-shift="1"]').inner_text()
    page.locator('#lp01Capacity').fill('90')
    page.locator('[data-view-panel="ensamble"]').screenshot(path=str(OUT / f'{label}-semana.png'))
    page.locator('[data-week-action="next"]').click()
    page.wait_for_function("window.__lpCalls.some(x=>x.name==='sgp_linea_plan_consultar' && x.args.p_desde==='2026-11-02' && x.args.p_hasta==='2026-11-08')")
    assert page.locator('[data-lp-date="2026-11-02"]').count() == 2
    page.locator('[data-week-action="prev"]').click()
    page.wait_for_function("document.querySelector('#sgpPlanWeek')?.value==='2026-W44'")
    page.locator('.sgp-explorer-reservation > summary').click()
    source = page.locator('.sgp-explorer-order[data-lp-key="KEY1"]')
    if label == 'pc':
        target = page.locator('[data-lp-date="2026-10-26"][data-lp-shift="1"]')
        source.drag_to(target)
        assert page.locator('.lp01-drop-dialog').is_visible()
        assert '2026-10-26 · Turno 1' in page.locator('#lp01DropContext').inner_text()
        page.screenshot(path=str(OUT / 'pc-arrastre-confirmacion.png'), full_page=False)
        page.locator('#lp01DropCancel').click()
        assert not page.locator('.lp01-drop-dialog').is_visible()
        assert page.locator('#sgpPlanPriority').input_value() == '1'
        assert not page.evaluate("window.__lpCalls.some(x=>x.name==='sgp_linea_plan_programar')")
        target = page.locator('[data-lp-date="2026-10-29"][data-lp-shift="2"]')
        source.drag_to(target)
        assert page.locator('.lp01-drop-dialog').is_visible()
        page.locator('#lp01DropQuantity').fill('3')
        page.locator('#lp01DropPriority').fill('2')
        page.locator('.lp01-drop-dialog button[type="submit"]').click()
        assert page.locator('#sgpPlanDate').input_value() == '2026-10-29'
        assert page.locator('#sgpPlanShift').input_value() == '2'
        assert page.locator('#sgpPlanQuantity').input_value() == '3'
        assert page.locator('#sgpPlanPriority').input_value() == '2'
    else:
        # Real Chromium touch stream: hold, move while the page/calendar scrolls, release.
        source.scroll_into_view_if_needed()
        box = source.bounding_box()
        session = page.context.new_cdp_session(page)
        session.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': box['x'] + 30, 'y': min(box['y'] + 35, 800), 'id': 1}]})
        page.wait_for_timeout(500)
        assert page.locator('.lp01-touch-ghost').is_visible()
        session.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': 350, 'y': 800, 'id': 1}]})
        touch_target = page.locator('[data-lp-date="2026-10-29"][data-lp-shift="2"]')
        for _ in range(30):
            page.wait_for_timeout(120)
            box = touch_target.bounding_box()
            if box and 0 < box['x'] < 300 and 120 < box['y'] < 620:
                break
        assert box and 0 < box['x'] < 300 and 120 < box['y'] < 620, 'La celda no fue alcanzable durante el arrastre táctil'
        session.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': box['x'] + 30, 'y': box['y'] + 40, 'id': 1}]})
        page.wait_for_timeout(100)
        page.screenshot(path=str(OUT / 'movil-arrastre-en-curso.png'), full_page=False)
        session.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
        assert page.locator('.lp01-drop-dialog').is_visible()
        assert '2026-10-29 · Turno 2' in page.locator('#lp01DropContext').inner_text()
        page.screenshot(path=str(OUT / 'movil-arrastre-tactil.png'), full_page=False)
        page.locator('#lp01DropCancel').click()
        assert page.locator('#sgpPlanPriority').input_value() == '1'
        assert not page.evaluate("window.__lpCalls.some(x=>x.name==='sgp_linea_plan_programar')")
        source.click()
        assert page.locator('.lp01-card-selected').count() == 1
        assert page.locator('#sgpPlanProduction').input_value() != 'KEY1'
        page.locator('[data-lp-date="2026-10-29"][data-lp-shift="2"]').click()
        assert page.locator('.lp01-drop-dialog').is_visible()
        page.screenshot(path=str(OUT / 'movil-seleccion-toque.png'), full_page=False)
        page.locator('#lp01DropCancel').click()
        assert not page.evaluate("window.__lpCalls.some(x=>x.name==='sgp_linea_plan_programar')")
    assert not page.evaluate("window.__lpCalls.some(x=>x.name==='sgp_linea_plan_programar')")
    page.locator('.sgp-line-view-tabs [data-view="table"]').click()
    assert page.locator('.sgp-line-table-wrap tbody tr').count() >= 1
    page.locator('.sgp-line-view-tabs [data-view="kanban"]').click()
    assert page.locator('.sgp-line-kanban-card').count() >= 1
    assert not errors, errors


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for name, width, height in [('pc', 1440, 900), ('movil', 390, 844)]:
        page = browser.new_page(viewport={'width': width, 'height': height}, has_touch=name == 'movil', is_mobile=name == 'movil')
        run(page, name)
        page.close()
    browser.close()
print('LP-01: 14 celdas, navegación con RPC, capacidad, arrastre sin escritura, Tabla/Kanban PC/móvil correctos')
