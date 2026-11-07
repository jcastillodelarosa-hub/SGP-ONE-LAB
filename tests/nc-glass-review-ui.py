"""Focused real Chromium coverage. No production account or database is used."""
from playwright.sync_api import sync_playwright
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import os, shutil, threading

root = Path(__file__).resolve().parents[1]
out = Path(os.environ.get('NCV_REVIEW_UI_OUTPUT', '/tmp/ncv-review-ui'))
out.mkdir(parents=True, exist_ok=True)
server = ThreadingHTTPServer(('127.0.0.1', 0), partial(SimpleHTTPRequestHandler, directory=str(root)))
threading.Thread(target=server.serve_forever, daemon=True).start()
url = f'http://127.0.0.1:{server.server_port}/tests/fixtures/nc-glass-review.html'

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROME_BIN') or shutil.which('chromium'), headless=True, args=['--no-sandbox'])
    for label, viewport in [('pc', {'width': 1440, 'height': 900}), ('mobile', {'width': 390, 'height': 844})]:
        page = browser.new_page(viewport=viewport)
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(url)
        page.wait_for_function('window.fixtureReady && reviewState.calls.length === 1')
        status = page.locator('[data-nc-review-status]')
        reference = page.locator('[data-nc-review-reference]')
        stage = page.locator('[data-nc-review-stage]')
        confirm = page.locator('[data-nc-review-confirm]')
        prepare = page.get_by_role('button', name='Preparar afectación')

        def ready():
            page.wait_for_function('document.querySelector("[data-nc-review-status]").textContent.includes("NC por revisar.")')

        def restart(mode='normal'):
            page.evaluate('(mode) => { reviewState.mode=mode; reviewState.current=true; reviewState.calls=[]; reviewState.prepared=[]; window.mountReview(); }', mode)

        def choose():
            reference.select_option('0')
            stage.select_option('EMPAQUE')
            confirm.check()

        ready()
        assert reference.input_value() == '' and stage.input_value() == '' and not confirm.is_checked()
        assert prepare.is_disabled() and page.evaluate('reviewState.prepared.length') == 0
        assert '1314100|PANELES_2' not in page.locator('[data-nc-review-order]').inner_text()
        assert 'PANELES_2' in page.locator('[data-nc-review-order]').inner_text()
        assert 'NC-DEMO-17' in page.locator('[data-nc-review-list]').inner_text()
        assert 'Posible relación · Sin afectación registrada para esta NC' in page.locator('[data-nc-review-list]').inner_text()
        assert not page.locator('[data-nc-review-list] details').get_attribute('open')
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        page.screenshot(path=str(out / f'ncv-review-{label}.png'), full_page=True)
        page.get_by_text('Ver detalle de la NC').click()
        assert '1314100|PANELES_2' in page.locator('[data-nc-review-list]').inner_text()
        page.get_by_text('Ver detalle de la NC').click()
        reference.select_option('0')
        assert prepare.is_disabled()
        stage.select_option('EMPAQUE')
        assert prepare.is_disabled()
        confirm.check()
        prepare.click()
        page.wait_for_function('reviewState.prepared.length === 1')
        assert page.evaluate('reviewState.calls') == [{'force': False}, {'force': True}]
        assert page.evaluate('Object.keys(reviewState.prepared[0])') == ['reference', 'stage', 'source']
        assert page.evaluate('reviewState.prepared[0].stage') == 'EMPAQUE'
        assert page.locator('input[type=number]').count() == 0
        assert prepare.is_disabled()

        restart('multiple')
        ready()
        assert page.locator('[data-nc-review-list] > li').count() == 2
        assert reference.input_value() == ''
        choose()
        stage.select_option('ENSAMBLE')
        assert not confirm.is_checked() and prepare.is_disabled()
        confirm.check()
        reference.select_option('1')
        assert not confirm.is_checked() and prepare.is_disabled()

        for mode in ['changed', 'inactive', 'empty', 'denied', 'unavailable', 'throw']:
            restart()
            ready()
            choose()
            page.evaluate('(mode) => { reviewState.mode=mode; }', mode)
            prepare.click()
            page.wait_for_function('reviewState.calls.length===2 && document.querySelector(".lp-nc-review").getAttribute("aria-busy")==="false"')
            assert page.evaluate('reviewState.prepared.length') == 0
            assert reference.input_value() == '' and not confirm.is_checked()
            assert prepare.is_disabled() and page.locator('[data-nc-review-list] > li').count() == 0
            assert '0 NC' not in status.inner_text()

        for mode in ['denied', 'unavailable', 'throw']:
            restart(mode)
            page.wait_for_function('document.querySelector(".lp-nc-review").getAttribute("aria-busy")==="false"')
            assert 'Sin candidatas' not in status.inner_text() and '0 NC' not in status.inner_text()
            assert prepare.is_disabled()
        restart('empty')
        page.wait_for_function('document.querySelector("[data-nc-review-status]").textContent.includes("Sin candidatas")')
        assert prepare.is_disabled()
        page.evaluate('reviewState.mode="normal"')
        page.get_by_role('button', name='Actualizar candidatas').click()
        ready()
        assert reference.input_value() == '' and stage.input_value() == ''

        # Repeated clicks coalesce while a forced read is unresolved.
        restart()
        ready()
        choose()
        page.evaluate('reviewState.mode="delay"')
        prepare.click()
        page.evaluate('document.querySelector("[data-nc-review-prepare]").click()')
        assert page.evaluate('reviewState.calls.length') == 2
        assert prepare.is_disabled()
        page.evaluate('reviewState.current=false; reviewState.pending.splice(0).forEach(resolve=>resolve())')
        page.wait_for_function('document.querySelector("[data-nc-review-status]").textContent.includes("sesión cambió")')
        assert page.evaluate('reviewState.prepared.length') == 0

        # Disposal and a newer mount must ignore the previous read's result.
        restart('delay')
        page.wait_for_function('reviewState.pending.length > 0')
        page.evaluate('window.disposeReview(); reviewState.mode="normal"; window.mountReview(); reviewState.pending.splice(0).forEach(resolve=>resolve())')
        ready()
        assert page.locator('.lp-nc-review').count() == 1
        assert page.evaluate('reviewState.prepared.length') == 0

        # Mutating the row's exact key invalidates even a formerly matching NC.
        choose()
        page.evaluate('reviewState.row.key="another-key"')
        prepare.click()
        assert page.evaluate('reviewState.prepared.length') == 0 and prepare.is_disabled()
        assert 'sesión cambió' in status.inner_text()

        restart('hostile')
        ready()
        assert page.locator('.lp-nc-review img, .lp-nc-review svg').count() == 0
        assert page.evaluate('window.xss === undefined')
        assert '<img src=x' in page.locator('[data-nc-review-list]').inner_text()
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        assert not errors, errors
        print(label + ': PASS explicit selection/forced recheck/changed source/denied/error/empty/stale/dispose/repeated clicks/XSS/viewport')
        page.close()
    browser.close()
server.shutdown()
