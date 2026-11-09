"""Focused wheel regression using production CSS, synthetic rows, no network/data writes."""
from pathlib import Path
import json, os, shutil
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
css = (ROOT / 'styles.css').read_text()
results = []
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=None if os.environ.get('CI') else shutil.which('chromium'), args=['--no-sandbox'])
    for width in [1440, 390]:
        page = browser.new_page(viewport={'width': width, 'height': 700})
        rows = ''.join('<tr><td style="height:48px">Reserva sintética</td><td>Producción</td></tr>' for _ in range(30))
        page.set_content('<style>' + css + '</style><style>body{margin:0}table{min-width:1800px}</style>'
            '<section data-mach-panel="recepcion"><div class="table-wrap"><table>' + rows + '</table></div></section>')
        wrapper = page.locator('.table-wrap')
        assert wrapper.evaluate('(e)=>getComputedStyle(e).overscrollBehaviorY') == 'auto'
        page.mouse.move(width // 2, 220)
        page.mouse.wheel(0, 400)
        page.wait_for_function('scrollY > 0')
        vertical = page.evaluate('scrollY')
        page.mouse.wheel(300, 0)
        page.wait_for_function('document.querySelector(".table-wrap").scrollLeft > 0')
        horizontal = wrapper.evaluate('(e)=>e.scrollLeft')
        results.append({'width': width, 'pageScrollY': vertical, 'tableScrollX': horizontal})
        page.close()
    browser.close()
print(json.dumps(results, indent=2))
