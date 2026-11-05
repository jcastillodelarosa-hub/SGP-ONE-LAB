"""Directed history presentation, synthetic existing read payloads only."""
from pathlib import Path
import http.server,threading,json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];HERE=Path(__file__).parent
class Files(http.server.SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT),**kw)
 def log_message(self,*a):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Files);threading.Thread(target=server.serve_forever,daemon=True).start();origin=f'http://127.0.0.1:{server.server_port}';results=[]
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(**({'executable_path':'/usr/bin/chromium'} if Path('/usr/bin/chromium').exists() else {}),args=['--no-sandbox'])
  for width in [1440,390]:
   page=browser.new_page(viewport={'width':width,'height':1000});page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(origin) else r.abort());errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(origin+'/tests/lp01-summary-ui/fixture.html');page.wait_for_selector('.lp-tracking-table')
   page.evaluate("()=>{const original=window.payload;window.payload=args=>{const d=original(args);if(args.p_etapa==='EMPAQUE')for(const p of d.productions)for(const o of p.operations)o.ejecutado=10+o.turno;return d;};}")
   for stage,title,quantities in [('ENSAMBLE','Ensambles',['2','3']),('EMPAQUE','Empaques',['11','12'])]:
    page.locator('[data-tracking-stage='+stage+']').click();page.wait_for_selector('.lp-tracking-table');page.locator('details[data-order-part] summary').first.click();drawer=page.locator('#lp-tracking-drawer')
    assert drawer.locator('[data-advance-context]').is_hidden();assert drawer.locator('[data-live-operate]').is_hidden()
    drawer.locator('[data-tracking-tab=Historial]').click();timeline=drawer.locator('.lp-tracking-timeline');assert title+' por día y turno' in timeline.inner_text()
    rows=timeline.locator('tbody tr');assert rows.count()==2
    assert [r.locator('td').nth(2).inner_text() for r in rows.all()]==quantities
    assert [r.locator('td').nth(1).inner_text() for r in rows.all()]==['1','2']
    assert all(r.locator('td').nth(0).inner_text()=='2026-11-02' for r in rows.all())
    assert 'Cantidades registradas en Operación' in timeline.inner_text() and 'no modifican el saldo oficial' in timeline.inner_text();assert '20' not in [r.locator('td').nth(2).inner_text() for r in rows.all()]
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    for cell in rows.locator('td').all():
     cell.scroll_into_view_if_needed();rect=cell.bounding_box();assert rect['x']>=0 and rect['x']+rect['width']<=width
     assert cell.evaluate('(el)=>el.scrollWidth<=el.clientWidth')
    # Selecting an operational record must not hide the rest of the order history.
    drawer.locator('[data-advance-context] summary').click();options=drawer.locator('[data-tracking-context] option');drawer.locator('[data-tracking-context]').select_option(options.nth(1).get_attribute('value'));assert drawer.locator('[data-turn-history] tbody tr').count()==2
    drawer.screenshot(path=str(HERE/f'evidence/history-{stage.lower()}-{width}.png'))
    drawer.locator('[data-tracking-close]').click()
   assert not errors,errors;results.append({'width':width,'stageScopedQuantities':True,'dateAndShift':True,'noExportBalanceAsProgress':True,'sourceLimitExplicit':True,'usualDetailNoAdvanceContext':True,'contextSelectionKeepsWholeHistory':True});page.close()
  browser.close()
 (HERE/'history-focus-result.json').write_text(json.dumps(results,indent=2)+'\n');print(json.dumps(results))
finally:server.shutdown()
