"""Focused browser acceptance of the fresh local demo, real QA RPCs, no production."""
import json,pathlib,sys
from playwright.sync_api import sync_playwright,expect
ROOT=pathlib.Path(__file__).resolve().parents[2]
offline='--offline' in sys.argv
shots=ROOT/('tests/pdt-demo/offline-screenshots' if offline else 'tests/pdt-demo/screenshots');shots.mkdir(exist_ok=True)
url=(ROOT/'tests/pdt-demo/PDT_V2_DEMO_AUTOCONTENIDA.html').as_uri() if offline else 'http://localhost:8765'
loaded='Simulación local lista' if offline else 'QA conectado'
network=[];errors=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1280,'height':960})
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('request',lambda r:network.append(r.url) if r.url.startswith(('http:','https:')) else None)
 if offline:page.context.set_offline(True)
 (page.set_content((ROOT/'tests/pdt-demo/PDT_V2_DEMO_AUTOCONTENIDA.html').read_text()) if offline else page.goto(url));expect(page.locator('[data-card]')).to_have_count(2)
 page.screenshot(path=str(shots/'desktop.png'),full_page=True)
 mobile=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
 mobile.on('pageerror',lambda e:errors.append(str(e)))
 mobile.on('request',lambda r:network.append(r.url) if r.url.startswith(('http:','https:')) else None)
 if offline:mobile.context.set_offline(True)
 (mobile.set_content((ROOT/'tests/pdt-demo/PDT_V2_DEMO_AUTOCONTENIDA.html').read_text()) if offline else mobile.goto(url));expect(mobile.locator('[data-card]')).to_have_count(2)
 assert mobile.evaluate('document.documentElement.scrollWidth<=window.innerWidth')
 mobile.screenshot(path=str(shots/'mobile.png'),full_page=True)
 # Same controller/visible flow. Offline mode explicitly simulates writes; QA mode uses real RPCs.
 card=page.locator('[data-card="DEMO-A"]')
 card.get_by_role('button').click()
 page.locator('[data-source="0"]').check();page.locator('[data-source="1"]').check()
 page.locator('[data-operation="validate"]').click();expect(page.locator('#modal')).to_be_hidden()
 expect(card).to_contain_text('Contrato V2')
 card.get_by_role('button').click();page.locator('[data-qty]').fill('2');page.locator('[data-date]').fill('2026-10-25')
 page.locator('[data-operation="advance"]').click();expect(page.locator('#modal')).to_be_hidden()
 expect(card.locator('.demo-metrics')).to_contain_text('7')
 card.get_by_role('button').click();page.locator('[data-note]').fill('Corrección de demostración, sin pérdida de trazabilidad')
 page.locator('[data-operation="reverse"]').click();expect(page.locator('#modal')).to_be_hidden()
 expect(card.locator('.demo-details')).to_contain_text('E17-1')
 card.get_by_role('button').click();page.locator('[data-ncs]').fill('DEMO-NC-1, DEMO-NC-2')
 page.locator('[data-operation="nc"]').click();expect(page.locator('#modal')).to_be_hidden()
 expect(card).to_contain_text('DEMO-NC-1');expect(card).to_contain_text('DEMO-NC-2')
 page.select_option('#role','RECEPCION');expect(page.locator('#notice')).to_contain_text(loaded)
 card.get_by_role('button').click();expect(page.locator('#modal')).to_be_visible();assert page.locator('[data-operation="advance"]').count()==0
 page.keyboard.press('Escape')
 page.select_option('#role','COORDINADOR');expect(page.locator('#finish')).to_be_enabled()
 # Early close is rejected by the backend; UI can recover and complete.
 page.click('#finish');expect(page.locator('#notice')).to_have_class('error')
 page.click('#record');expect(page.locator('#notice')).to_contain_text('Paso completado')
 page.click('#audit');expect(page.locator('#delivery-state')).to_contain_text('VALIDADA')
 page.click('#credit');expect(page.locator('#notice')).to_contain_text('Paso completado')
 page.click('#finish');expect(page.locator('[data-card="DEMO-B"] .demo-tag')).to_have_text('RESUELTO')
 expect(page.locator('#delivery-state')).to_contain_text('otras piezas pendientes: 1')
 page.screenshot(path=str(shots/'closed-pdt.png'),full_page=True)
 # Real mobile modal, usable internal scrolling and dismiss button.
 if not offline:mobile.reload()
 expect(mobile.locator('[data-card]')).to_have_count(2)
 mobile.locator('[data-card="DEMO-A"] button').click()
 mobile.locator('[data-dismiss]').scroll_into_view_if_needed();expect(mobile.locator('[data-dismiss]')).to_be_visible()
 mobile.screenshot(path=str(shots/'mobile-modal.png'),full_page=True)
 mobile.locator('[data-dismiss]').click();expect(mobile.locator('#modal')).to_be_hidden()
 assert not errors,errors
 if offline:assert not network,network
 browser.close()
print(json.dumps({'backend':'SIMULATED in-memory operations; no backend' if offline else 'Real QA RPCs via PostgREST; synthetic data only','offline':offline,'network_requests':len(network),'javascript_errors':errors,'passed':['PANEL distribution 5+4','partial advance','controlled reversal','two NC links','Reception UI restrictions','early close rejected','quantitative 5+4 delivery','Reception VALIDADA','quantity accreditation','PDT closed within partial order','390px mobile layout and modal dismissal'],'production_access':False},indent=2))
