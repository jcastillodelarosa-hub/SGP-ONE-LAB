"""Isolated LP-01/LP-02 browser checks with synthetic RPC results only."""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "evidence" / "linea-produccion-e2"
OUT.mkdir(parents=True, exist_ok=True)


def exercise(page, label):
    page.goto("http://127.0.0.1:8765/", wait_until="domcontentloaded")
    page.evaluate("""() => {
      document.querySelector('[data-view-panel="ensamble"]').hidden = false;
      const marker=document.createElement('p');marker.textContent='EVIDENCIA VISUAL LOCAL · DATOS SINTÉTICOS · SIN CONEXIÓN PRODUCTIVA';marker.style='padding:10px;background:#fff1cc;color:#563900;font-weight:700';document.querySelector('[data-view-panel="ensamble"]').prepend(marker);
      window.SGPPlannerBridge = {
        getRows: () => [{key_produccion:'P1',produccion:'TORRE NORTE',sistema:'ES7100',reserva:'8707142',saldo_ensamble:20}],
        getToken: () => 'synthetic-session',
        getClient: async () => ({rpc: async (name) => ({data: name === 'sgp_linea_plan_consultar' ? [
          {id:'A1',fecha:'2026-10-26',turno:1,prioridad:1,produccion:'TORRE NORTE',sistema:'ES7100',cantidad:12,ejecutado:8,estado:'ABIERTA'},
          {id:'A2',fecha:'2026-10-26',turno:2,prioridad:2,produccion:'BAHÍA',sistema:'ES9500',cantidad:8,ejecutado:0,estado:'ABIERTA'}
        ] : null,error:null})})
      };
      document.querySelector('#sgpPlanDate').value='2026-10-26';
      document.querySelector('#sgpPlanDate').dispatchEvent(new Event('change'));
    }""")
    page.locator("#sgpPlanLoad").click()
    page.get_by_role("button", name="Tabla", exact=True).click()
    assert page.locator(".sgp-line-table-wrap tbody tr").count() == 2
    assert page.locator(".sgp-line-table-wrap").get_by_text("TORRE NORTE").count() == 1
    page.locator('[data-view-panel="ensamble"]').screenshot(path=str(OUT / f"{label}-lp01-tabla.png"))
    page.get_by_role("button", name="Kanban", exact=True).click()
    assert page.locator(".sgp-line-kanban-column").count() == 3
    assert page.locator(".sgp-line-kanban-card").count() == 2
    page.locator('[data-view-panel="ensamble"]').screenshot(path=str(OUT / f"{label}-lp01-kanban.png"))
    page.locator("#productionPackingTab").click()
    assert page.locator("#productionPackingPanel").is_visible()
    assert page.locator("#productionLocationsTab").count() == 1
    page.locator('[data-view-panel="ensamble"]').screenshot(path=str(OUT / f"{label}-lp02-empaque.png"))
    page.locator("#productionAssemblyTab").click()
    assert page.locator("#assemblySheetPanel").is_visible()
    page.locator('[data-view-panel="ensamble"]').screenshot(path=str(OUT / f"{label}-lp02-ensamble.png"))


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path="/usr/bin/chromium", headless=True, args=["--no-sandbox"])
    for label, width, height in [("pc", 1440, 900), ("movil", 390, 844)]:
        page = browser.new_page(viewport={"width": width, "height": height}, device_scale_factor=1)
        exercise(page, label)
        page.close()
    browser.close()
print("LP-01/LP-02: navegación, datos sintéticos, tabla, Kanban y vistas PC/móvil correctas")
