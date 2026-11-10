"""Real modal markup, CSS and app functions; synthetic inputs and no backend."""
from pathlib import Path
import json, mimetypes, os, re
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(os.environ.get('SCROLL_QA_OUT', '/tmp/programming-scroll-qa'))
OUT.mkdir(parents=True, exist_ok=True)
ORIGIN = 'http://programming.test/'
html = re.sub(r'<script\b[^>]*>.*?</script>', '', (ROOT / 'index.html').read_text(), flags=re.S)
source = (ROOT / 'app.js').read_text()
functions = source[source.index('function renderProgParts('):source.index('async function saveProgramming(')]
results = []

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('SCROLL_CHROMIUM', '/usr/bin/chromium'), args=['--no-sandbox'])
    for width, height in [(1440, 900), (1366, 600), (390, 844), (320, 568), (844, 390), (390, 360)]:
        page = browser.new_page(viewport={'width': width, 'height': height}, has_touch=True, is_mobile=width < 500)
        errors, external = [], []
        page.on('pageerror', lambda e: errors.append(str(e)))

        def route(r):
            if not r.request.url.startswith(ORIGIN) or r.request.method != 'GET':
                external.append(r.request.url)
                r.abort()
                return
            name = r.request.url[len(ORIGIN):].split('?')[0]
            if not name:
                r.fulfill(content_type='text/html', body=html)
            else:
                path = ROOT / name
                if path.is_file():
                    r.fulfill(content_type=mimetypes.guess_type(name)[0] or 'text/plain', body=path.read_bytes())
                else:
                    r.fulfill(status=404, body='Not found')

        page.route('**/*', route)
        page.goto(ORIGIN)
        page.evaluate('''async source => {
          const {coverageAmount} = await import('/src/domain/mecanizado-partes.js');
          const {programmingPartState,programmingPartsPlan,validateProgrammingDestination} = await import('/src/domain/programming-part-selection.js');
          const {saveProgrammingParts} = await import('/src/services/programming-part-selection.js');
          let progWriteBusy=false,progWriteControls=[];
          const escapeHtml = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
          const parts = Array.from({length: 8}, (_, i) => ({prioridad: '14.' + (i + 1), cantidad: 8, vidrio_pct: 75,
            ordenes: Array.from({length: 3}, (_, j) => ({produccion: 'ORDEN SINTÉTICA ' + i + '-' + j, key_produccion: 'QA|' + i + '-' + j, cantidad: j === 2 ? 2 : 3, tipo_vidrio: 'LAMINADO'}))}));
          let progRows = [{reserva: 'QA-SCROLL', partes: parts}], progSchedule = [], progOrderCoverage = [], progCoverage = [], progSelection = null;
          window.backendCalls = 0;
          const getSupabaseClient = async () => {window.backendCalls++; throw Error('Backend forbidden');};
          eval(source + '\\nwindow.openCase = () => openProgModal("QA-SCROLL", null, 64); document.querySelector("#progCancel").onclick = closeProgModal; document.querySelector("#progModalClose").onclick = closeProgModal;');
          document.querySelectorAll('.view').forEach(el => {el.hidden = true; el.classList.remove('active');});
          const view = document.querySelector('[data-view-panel="mecanizado"]');
          view.hidden = false; view.classList.add('active'); view.style.minHeight = '1800px';
          view.style.transform = 'translateX(0px)'; // persisted end-state of navigation slide/zoom
          document.querySelectorAll('[data-mach-panel]').forEach(el => el.hidden = el.dataset.machPanel !== 'programacion');
          document.documentElement.style.setProperty('--sgp-ui-scale', '1.20');
          window.openCase();
        }''', functions)
        form = page.locator('#progModal .rec-form')

        def check_bounds():
            for selector in ['#progModal .prog-card', '#progModal .modal-header', '#progModal .modal-actions', '#progModalClose', '#progSave']:
                r = page.locator(selector).bounding_box()
                assert r and r['x'] >= -1 and r['y'] >= -1 and r['x'] + r['width'] <= width + 1 and r['y'] + r['height'] <= height + 1, (selector, r, width, height)
            assert form.evaluate('(e) => e.scrollHeight > e.clientHeight + 50')
            assert page.locator('#progModal').evaluate('(e) => !e.closest(".view") && !!e.closest(".workspace")')
            assert page.evaluate('''() => {
              const toggle=document.querySelector('#mobileMenuToggle');
              const r=toggle.getBoundingClientRect();
              return !r.width || !!document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('#progModal');
            }'''), 'Mobile menu must remain behind the modal'

        check_bounds()
        # Negative control: the former nesting under a transformed view clips the dialog.
        page.evaluate('''() => {const modal=document.querySelector('#progModal'); window.modalHost=modal.parentElement; document.querySelector('[data-mach-panel="programacion"]').append(modal);}''')
        old = page.locator('#progModal .prog-card').bounding_box()
        assert old['y'] < 0 or old['y'] + old['height'] > height, old
        page.evaluate('window.modalHost.append(document.querySelector("#progModal"))')
        check_bounds()
        for scale in ['0.90', '1', '1.10', '1.20']:
            page.evaluate('(s) => document.documentElement.style.setProperty("--sgp-ui-scale", s)', scale)
            check_bounds()
        # Wheel and keyboard move the form, not the page or fixed controls.
        y = page.evaluate('scrollY')
        form.evaluate('(e) => e.scrollTop = 0')
        form.hover()
        page.mouse.wheel(0, 650)
        page.wait_for_function('document.querySelector("#progModal .rec-form").scrollTop > 0')
        assert page.evaluate('scrollY') == y
        form.evaluate('(e) => e.scrollTop = 0')
        form.focus()
        page.keyboard.press('PageDown')
        page.wait_for_function('document.querySelector("#progModal .rec-form").scrollTop > 0')
        check_bounds()
        # Expand the first part, retain entered notes through scroll, and reach the bottom.
        form.evaluate('(e) => e.scrollTop = 0')
        page.locator('#progPartsBox details').first.evaluate('(e) => e.open = true')
        page.locator('#progObs').fill('Observación QA conservada')
        page.locator('#progOrderObs').fill('Último campo accesible')
        assert page.locator('#progObs').input_value() == 'Observación QA conservada'
        check_bounds()
        # Real touch gestures on the scrollable region (mobile emulation, not a physical phone).
        form.evaluate('(e) => e.scrollTop = 0')
        r = form.bounding_box()
        client = page.context.new_cdp_session(page)
        x, start = r['x'] + r['width'] / 2, r['y'] + r['height'] * .8
        client.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x, 'y': start}]})
        for step in range(1, 7):
            client.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x, 'y': start - r['height'] * .6 * step / 6}]})
        client.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
        page.wait_for_function('document.querySelector("#progModal .rec-form").scrollTop > 0')
        client.detach()
        check_bounds()
        history = page.evaluate('history.length')
        page.screenshot(path=str(OUT / f'scroll-{width}x{height}.png'))
        page.locator('#progCancel').click()
        assert page.locator('#progModal').is_hidden()
        page.evaluate('window.openCase()')
        check_bounds()
        page.locator('#progModalClose').click()
        assert page.locator('#progModal').is_hidden()
        assert page.evaluate('history.length') == history
        assert page.evaluate('backendCalls') == 0
        assert not errors, errors
        assert not external, external
        results.append({'viewport': [width, height], 'status': 'PASS', 'checks': ['old nesting rejected', 'all four UI scales', 'fixed header/footer', 'wheel', 'keyboard', 'touch emulation', 'expanded parts', 'last fields', 'cancel and reopen', 'close', 'no backend']})
        page.close()
    browser.close()
(OUT / 'results.json').write_text(json.dumps(results, indent=2))
print(json.dumps(results, indent=2))
