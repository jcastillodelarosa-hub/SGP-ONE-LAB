from pathlib import Path
import http.server,threading,json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];OUT=Path(__file__).parent/'evidence'
class Files(http.server.SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT),**kw)
 def log_message(self,*a):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Files);threading.Thread(target=server.serve_forever,daemon=True).start();origin=f'http://127.0.0.1:{server.server_port}';results=[]
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,args=['--no-sandbox'])
  for width in [1440,390]:
   page=browser.new_page(viewport={'width':width,'height':950});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(origin) else r.abort());page.clock.install();page.goto(origin+'/tests/lp01-summary-ui/fixture.html')
   row=page.locator('[data-order-summary="QA0|PANELES_2"]');page.wait_for_function("document.querySelector('[data-order-summary=\"QA0|PANELES_2\"]').textContent.includes('Total distinto: 12')")
   assert '10 × NC AL' in row.inner_text() and '8 × NC V' in row.inner_text() and 'Disponibles: 8' in row.inner_text()
   assert 'No disponible' not in row.inner_text() and 'Accesorios' not in row.inner_text()
   if width==1440:assert row.locator('xpath=ancestor::tr').bounding_box()['height']<140
   assert page.locator('[data-order-sale-draft]').count()==0
   assert 'No disponible por orden' in page.locator('tbody tr').first.inner_text()
   assert 'week-' in page.locator('.lp-tracking-week-cell .lp-week-label').first.get_attribute('class')
   page.screenshot(path=str(OUT/f'summary-list-{width}.png'))
   legacy=page.locator('[data-order-summary="QA1|PANELES_2"]');assert 'Pendiente de validar' in legacy.inner_text();legacy.locator('[data-summary-cause=NC_AL]').click()
   card=page.locator('.lp-pdt-compact');card.wait_for();page.wait_for_function("document.querySelector('[data-pdt-nc]').textContent==='SOLUCIONADA'")
   summary=card.locator('summary');text=summary.inner_text();assert all(s in text for s in ['ES-EL400-004','19 piezas','NC1','SOLUCIONADA','PRODUCCION']);assert 'synthetic-legacy-id' not in text
   assert 'Ventanas distintas afectadas: Pendiente de validar' in page.locator('[data-order-affectations]').inner_text();assert not card.get_attribute('open');summary.focus();page.keyboard.press('Enter');assert card.get_attribute('open') is not None;assert 'synthetic-legacy-id' in card.inner_text();page.keyboard.press('Enter')
   page.evaluate("window.panelNode=document.querySelector('.lp-pdt-compact')");page.clock.fast_forward(20000);page.wait_for_timeout(100);assert page.evaluate("panelNode===document.querySelector('.lp-pdt-compact')")
   assert 'Pendiente de validar' in legacy.inner_text();assert '10 × NC AL' in legacy.inner_text(),'NC solution must not release windows'
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.screenshot(path=str(OUT/f'compact-{width}.png'),full_page=True)
   page.locator('[data-tracking-close]').click();page.locator('details[data-order-part] summary').filter(has_text='Producción 0').first.click()
   assert 'Consultando ventanas' not in page.locator('#lp-tracking-drawer').inner_text()
   page.locator('[data-tracking-close]').click()
   page.evaluate("window.holdSummary=true;void controller.load({quiet:true})");page.wait_for_function('window.summaryActive===3')
   page.evaluate("window.delay=true;void controller.load({quiet:true})");page.wait_for_function('window.inflight===1')
   page.clock.fast_forward(40000);assert page.evaluate('window.summaryActive===3 && window.maxSummaryActive<=3')
   page.evaluate("window.denySummary=true;window.summaryReleases.forEach(fn=>fn())");page.wait_for_function("document.querySelectorAll('.lp-tracking-table').length===0")
   page.evaluate("window.delay=false;window.release()");page.wait_for_function('window.inflight===0')
   assert page.locator('.lp-tracking-table').count()==0,'Old global response must not restore revoked data'
   assert not errors,errors;results.append({'width':width,'categories10and8Union12':True,'legacy19PiecesUnknownWindows':True,'ncStateIndependent':True,'detailKeyboard':True,'quiet20sPreserved':True,'scopeRevocationClears':True,'staleGlobalAfterRevocationRejected':True,'maxSummaryConcurrency':3,'drawerSummaryCurrent':True,'compactChips':True,'weekColorAndText':True,'noSaleDraftEditor':True});page.close()
  browser.close()
 (OUT.parent/'result.json').write_text(json.dumps(results,indent=2)+'\n');print(json.dumps(results))
finally:server.shutdown()
