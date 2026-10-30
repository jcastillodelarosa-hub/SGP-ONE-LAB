"""LP-01 E3 browser regression with synthetic RPC responses, never production data."""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs' / 'evidence' / 'lp01-e3'
OUT.mkdir(parents=True, exist_ok=True)


def run(page, label):
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto('http://127.0.0.1:8766/', wait_until='domcontentloaded')
    page.evaluate("""() => {
      const section=document.querySelector('[data-view-panel="ensamble"]');section.hidden=false;
      const marker=document.createElement('p');marker.textContent='PRUEBA VISUAL LOCAL · DATOS SINTÉTICOS · SIN CONEXIÓN PRODUCTIVA';marker.style='padding:10px;background:#fff1cc;color:#563900;font-weight:700';section.prepend(marker);
      const orders=[
        {key_produccion:'KEY1',produccion:'TORRE NORTE',sistema:'ES7100',reserva_al:'8707142',acabado:'NEGRO',tipo:'ORDEN',cantidad:20,saldo_ensamble:12,estado_mecanizado:'CORTE'},
        {key_produccion:'KEY2',produccion:'BAHÍA',sistema:'ES7100',reserva_al:'8707142',acabado:'NEGRO',tipo:'ORDEN',cantidad:8,saldo_ensamble:8,estado_mecanizado:'PROCESADO'}
      ];
      window.__lpCalls=[];
      const builder={select:()=>builder,in:()=>builder,neq:()=>Promise.resolve({data:[],error:null})};
      window.SGPPlannerBridge={getRows:()=>orders,getToken:()=> 'synthetic-session',loadAssembly:async()=>{},getClient:async()=>({
        from:()=>builder,
        rpc:async(name,args)=>{window.__lpCalls.push(name);return {error:null,data:name==='sgp_linea_plan_consultar' ? [
          {id:'A1',key_produccion:'KEY1',fecha:'2026-10-26',turno:1,prioridad:1,produccion:'TORRE NORTE',sistema:'ES7100',cantidad:12,ejecutado:0,estado:'ABIERTA'},
          {id:'A2',key_produccion:'KEY2',fecha:'2026-10-26',turno:2,prioridad:2,produccion:'BAHÍA',sistema:'ES7100',cantidad:8,ejecutado:0,estado:'ABIERTA'}
        ] : name==='sgp_linea_plan_explorador_v327' ? [
          {key_produccion:'KEY1',parte:'1.1',vidrio_preparado:14,vidrio_novedad:2,vidrio_traslado:1},
          {key_produccion:'KEY2',parte:'1.1',vidrio_preparado:8,vidrio_novedad:0,vidrio_traslado:0}
        ] : []}}}
      )};
      const week=document.querySelector('#assemblyWeek');week.replaceChildren(new Option('Semana 44','44'));week.value='44';
      document.querySelector('#sgpPlanDate').value='2026-10-26';document.querySelector('#sgpPlanDate').dispatchEvent(new Event('change'));
      document.querySelector('#assemblyStatus').textContent='Datos sintéticos cargados';
    }""")
    page.locator('#sgpPlanLoad').click()
    page.wait_for_function("document.querySelectorAll('.sgp-line-day').length===7")
    page.wait_for_function("document.querySelectorAll('.sgp-explorer-reservation').length===1")
    assert page.locator('.lp01-workspace').count() == 1
    assert page.locator('.lp01-splitter').count() == 1
    assert page.locator('#sgpExplorerResults').get_by_text('MIXTO').count() >= 1
    assert page.locator('#sgpExplorerResults').get_by_text('REC.').count() >= 1
    assert page.locator('#sgpLineDayDetail [data-lp-shift]').count() == 2
    assert '12/90' in page.locator('#sgpLineDayDetail').inner_text()
    page.locator('#lp01Capacity').fill('10')
    assert 'Sobrecupo' in page.locator('#sgpLineDayDetail').inner_text()
    page.locator('#lp01Capacity').fill('90')
    page.evaluate("window.SGPLinePlanner.selectProduction('KEY1')")
    before = page.evaluate("window.__lpCalls.filter(x=>x==='sgp_linea_plan_programar').length")
    page.once('dialog', lambda dialog: dialog.dismiss())
    page.locator('#sgpPlanSave').click()
    assert page.evaluate("window.__lpCalls.filter(x=>x==='sgp_linea_plan_programar').length") == before
    page.locator('[data-view-panel="ensamble"]').screenshot(path=str(OUT / f'{label}-calendario.png'))
    page.locator('.sgp-explorer-reservation').first.locator('summary').first.click()
    assert page.locator('.sgp-explorer-order').count() == 2
    page.locator('#sgpPlannerExplorer').screenshot(path=str(OUT / f'{label}-explorador.png'))
    page.once('dialog', lambda dialog: dialog.dismiss())
    page.locator('[data-plan-key="KEY1"]').drag_to(page.locator('[data-lp-shift="1"]'))
    assert page.evaluate("window.__lpCalls.filter(x=>x==='sgp_linea_plan_programar').length") == before
    page.locator('.sgp-line-view-tabs [data-view="table"]').click()
    assert page.locator('.sgp-line-table-wrap tbody tr').count() >= 2
    page.locator('[data-view-panel="ensamble"]').screenshot(path=str(OUT / f'{label}-tabla.png'))
    page.locator('.sgp-line-view-tabs [data-view="kanban"]').click()
    assert page.locator('.sgp-line-kanban-card').count() == 2
    page.locator('[data-view-panel="ensamble"]').screenshot(path=str(OUT / f'{label}-kanban.png'))
    assert not errors, errors


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for name, width, height in [('pc', 1440, 900), ('movil', 390, 844)]:
        page = browser.new_page(viewport={'width': width, 'height': height})
        run(page, name)
        page.close()
    browser.close()
print('LP-01 E3: explorador, MIXTO, REC., calendario, tabla y Kanban PC/móvil aprobados con datos sintéticos')
