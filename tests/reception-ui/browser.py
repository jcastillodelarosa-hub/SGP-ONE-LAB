"""Actual Reception app functions + HTML; simulated RPC transport, no production."""
from pathlib import Path
import http.server,threading,json,os,shutil
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];OUT=Path(os.environ.get('RECEPTION_QA_OUT',str(Path(__file__).parent/'evidence')));OUT.mkdir(parents=True,exist_ok=True)
class Files(http.server.SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT),**kw)
 def log_message(self,*a):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Files);threading.Thread(target=server.serve_forever,daemon=True).start();origin=f'http://127.0.0.1:{server.server_port}'
results=[]
with sync_playwright() as p:
 chromium=os.environ.get('RECEPTION_CHROMIUM') or shutil.which('chromium') or shutil.which('google-chrome')
 browser=p.chromium.launch(**({'executable_path':chromium} if chromium else {}),args=['--no-sandbox'])
 for width in [1440,390]:
  page=browser.new_page(viewport={'width':width,'height':900});errors=[];external=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  def route(r):
   if r.request.url.startswith(origin):r.continue_()
   else:external.append(r.request.url);r.abort()
  page.route('**/*',route);page.goto(origin+'/tests/reception-ui/fixture.html');page.wait_for_function('window.ready===true')
  pending=page.locator('#recTable');received=page.locator('#recReceivedBody').locator('..')
  count=lambda:page.locator('#recBody [data-receive]').count()
  def column(key,table=pending,section='filter'):
   table.locator('[data-rec-column="'+key+'"]').click()
   if section=='sort':page.locator('[data-menu-section="sort"] > summary').click()
  assert count()==29
  assert page.locator('[data-rec-state="PENDIENTE_BODEGA"] [data-rec-reservations]').inner_text()=='26'
  assert page.locator('[data-rec-state="PENDIENTE_BODEGA"] [data-rec-windows]').inner_text()=='34'
  assert '2 reservas sin estado' in page.locator('#recSummaryUnknown').inner_text()
  assert page.locator('#recTotalWindows').inner_text()=='Por confirmar'
  assert page.locator('#recReceivedWindows').inner_text()=='10'
  assert page.locator('#recPendingWindows').inner_text()=='Por confirmar'
  assert '2 reservas pendientes sin estado' in page.locator('#recQuantityNotice').inner_text()
  assert page.locator('#recPendingWindowsBreakdown').inner_text().startswith('Desglose parcial: ')
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  page.screenshot(path=str(OUT/f'reception-{width}.png'),full_page=True)
  # Draft selection is transactional: Cancel leaves existing rows/summary unchanged.
  column('system');page.locator('[data-column-none]').click();page.locator('[data-column-search]').fill('Sistema B')
  assert page.locator('[data-value-label]:visible').count()==1
  page.locator('[data-value-label]:visible input').check();page.locator('[data-column-cancel]').click();assert count()==29
  column('system');page.locator('[data-column-none]').click();page.locator('[data-column-search]').fill('Sistema A');page.locator('[data-value-label]:visible input').check();page.locator('[data-column-apply]').click();assert count()==3
  assert 'Resultados filtrados' in page.locator('#recSummaryScope').inner_text()
  assert 'filtro activo' in pending.locator('[data-rec-column="system"]').get_attribute('aria-label')
  column('quantity');page.locator('[data-column-none]').click();page.locator('[data-column-value="0"]').check();page.locator('[data-column-apply]').click();assert count()==1
  assert page.locator('#recBody [data-receive]').get_attribute('data-receive')=='R300'
  # Empty selection is not interpreted as all; other table remains visible.
  column('quantity');page.locator('[data-column-none]').click();page.locator('[data-column-apply]').click();assert count()==0
  assert page.locator('#recReceivedBody [data-receive]').count()==2
  column('quantity');page.locator('[data-column-reset]').click();page.locator('[data-column-apply]').click();assert count()==3
  page.locator('#recClearColumns').click();assert count()==29
  # Both numeric directions, null last, audit identity after sort.
  column('quantity',section='sort');page.locator('[data-column-order="desc"]').click()
  assert page.locator('#recBody [data-receive]').first.get_attribute('data-receive')=='R100'
  assert page.locator('#recBody [data-receive]').last.get_attribute('data-receive')=='R400'
  assert pending.locator('th[aria-sort="descending"]').count()==1
  page.locator('#recBody [data-receive]').first.click();assert page.locator('#recModal').is_visible();assert 'R100' in page.locator('#recModalTitle').inner_text();page.locator('#recClose').click()
  column('quantity',section='sort');page.locator('[data-column-order="asc"]').click();assert page.locator('#recBody [data-receive]').first.get_attribute('data-receive')=='R300'
  # Keyboard activation, focus loop, Escape return; long menu scroll and no overflow.
  pending.locator('[data-rec-column="system"]').focus();page.keyboard.press('Enter')
  page.locator('[data-menu-section="sort"] > summary').click()
  page.screenshot(path=str(OUT/f'menu-sort-{width}.png'))
  page.locator('[data-menu-section="filter"] > summary').click()
  box=page.locator('.rec-column-menu').bounding_box();assert box['x']>=0 and box['x']+box['width']<=width
  for _ in range(35):
   page.keyboard.press('Tab');assert page.evaluate("document.querySelector('.rec-column-menu').contains(document.activeElement)")
  page.locator('[data-column-close]').focus();page.keyboard.press('Shift+Tab');assert page.locator('[data-column-apply]').evaluate('(e)=>e===document.activeElement')
  page.locator('.rec-column-menu fieldset').evaluate('(e)=>e.scrollTop=200');assert page.locator('.rec-column-menu fieldset').evaluate('(e)=>e.scrollTop')>0
  page.locator('[data-column-search]').fill('Sistema largo');page.screenshot(path=str(OUT/f'menu-filter-{width}.png'))
  page.keyboard.press('Escape');assert page.locator('.rec-column-menu').count()==0
  assert pending.locator('[data-rec-column="system"]').evaluate('(e)=>e===document.activeElement')
  # Refresh preserves applied filters/order, horizontal position, closes stale drafts.
  column('system');page.locator('[data-column-none]').click();page.locator('[data-column-search]').fill('Sistema B');page.locator('[data-value-label]:visible input').check();page.locator('[data-column-apply]').click()
  page.locator('#recTable').locator('..').evaluate('(e)=>e.scrollLeft=200');before=page.locator('#recTable').locator('..').evaluate('(e)=>e.scrollLeft')
  page.evaluate('qa.loadReception()');assert count()==1
  assert page.locator('#recTable').locator('..').evaluate('(e)=>e.scrollLeft')==before
  assert pending.locator('th[aria-sort="ascending"]').count()==1
  column('system');page.evaluate('qa.loadReception()');assert page.locator('.rec-column-menu').count()==0;assert count()==1
  page.locator('#recClearColumns').click()
  # Received table filters legalisation and preserves review action.
  column('legal',received);page.locator('[data-column-none]').click();page.locator('[data-column-search]').fill('SIN LEGALIZAR');page.locator('[data-value-label]:visible input').check();page.locator('[data-column-apply]').click()
  assert page.locator('#recReceivedBody [data-receive]').count()==1;assert count()==29
  page.locator('#recReceivedBody [data-receive]').click();assert 'R600' in page.locator('#recModalTitle').inner_text();page.locator('#recClose').click()
  assert page.locator('#recIncomplete').inner_text()=='1' and page.locator('#recUnlegalized').inner_text()=='1'
  page.locator('#recSearch').fill('R200');assert count()==1;assert page.locator('#recReceivedBody [data-receive]').count()==0
  assert page.locator('#recTotalWindows').inner_text()=='2'
  assert page.locator('#recReceivedWindows').inner_text()=='0'
  assert page.locator('#recPendingWindows').inner_text()=='2'
  assert page.locator('#recPendingWindowsBreakdown').inner_text()=='Bodega 0 + Abastecimiento 2'
  page.locator('#recSearch').fill('');page.locator('#recClearColumns').click()
  # Changing week resets filters; obsolete asynchronous response cannot overwrite newer data.
  page.evaluate("qa.delay(45);document.querySelector('#recWeek').value=45;window.oldLoad=qa.loadReception();void 0")
  page.locator('#recWeek').fill('46');page.locator('#recWeek').press('Tab');page.wait_for_function("document.querySelector('#recSummaryScope').textContent.startsWith('Semana 46')")
  page.evaluate('qa.release();oldLoad');assert count()==29
  page.evaluate('qa.delay(null)');page.locator('#recWeek').fill('45');page.locator('#recWeek').press('Tab');page.wait_for_function("document.querySelector('#recBody [data-receive]')?.dataset.receive==='W45'")
  assert count()==1 and 'Semana 45' in page.locator('#recSummaryScope').inner_text()
  page.locator('#recWeek').fill('46');page.locator('#recWeek').press('Tab');page.wait_for_function("document.querySelectorAll('#recBody [data-receive]').length===29")
  # Failure of tracking leaves Reception usable and all aluminum states neutral.
  page.evaluate('qa.failTracking(true);qa.loadReception()');assert page.locator('#recTrackingStatus').is_visible()
  assert page.locator('[data-rec-state="ALUMINIO_ENTREGADO"] [data-rec-reservations]').inner_text()=='0'
  page.locator('#recBody [data-receive]').first.click();page.screenshot(path=str(OUT/f'audit-fallback-{width}.png'));assert page.locator('#recModal').is_visible(),page.locator('#recModal').evaluate('(e)=>({hidden:e.hidden,html:e.outerHTML.slice(0,200),title:document.querySelector("#recModalTitle").textContent,errors:window.calls})');page.locator('#recClose').click()
  page.evaluate('qa.failTracking(false);qa.loadReception()')
  # The new physical-level totals exclude stale received tracking exactly once.
  page.evaluate('qa.summaryCase(true);qa.loadReception()')
  assert page.locator('#recTotalWindows').inner_text()=='1.230'
  assert page.locator('#recReceivedWindows').inner_text()=='800'
  assert page.locator('#recPendingWindows').inner_text()=='430'
  assert page.locator('#recPendingWindowsBreakdown').inner_text()=='Bodega 30 + Abastecimiento 400'
  assert page.locator('[data-rec-state="PENDIENTE_BODEGA"] [data-rec-windows]').inner_text()=='330'
  assert page.locator('#recQuantityNotice').is_hidden()
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  page.locator('#recSummaryTitle').scroll_into_view_if_needed()
  page.screenshot(path=str(OUT/f'reception-physical-totals-{width}.png'),full_page=True)
  page.evaluate('qa.failTracking(true);qa.loadReception()')
  assert page.locator('#recTotalWindows').inner_text()=='1.230'
  assert page.locator('#recReceivedWindows').inner_text()=='800'
  assert page.locator('#recPendingWindows').inner_text()=='430'
  assert '2 reservas pendientes sin estado' in page.locator('#recQuantityNotice').inner_text()
  assert page.locator('#recPendingWindowsBreakdown').inner_text().startswith('Desglose parcial: ')
  assert not errors,errors
  assert not external,external
  results.append({'width':width,'synthetic_transport':True,'app_load_render_open_source':True,'external_requests':0,'cards_scope_and_unknowns':True,'combined_empty_cancel_reset_filters':True,'sort_numeric_null_audit_identity':True,'keyboard_escape_focus_scroll':True,'refresh_and_week_race':True,'tracking_failure_audit':True,'physical_totals_1230_800_430':True,'stale_received_tracking_excluded':True,'physical_totals_survive_tracking_failure':True});page.close()
 # Smoke-load the whole application unauthenticated, with all external traffic blocked.
 page=browser.new_page();smoke_errors=[];page.on('pageerror',lambda e:smoke_errors.append(str(e)))
 page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(origin) else r.abort())
 page.goto(origin+'/index.html');page.wait_for_function("typeof document.querySelector('#recClearColumns').onclick==='function'")
 assert not smoke_errors,smoke_errors
 results.append({'whole_app_unauthenticated_boot':True,'page_errors':smoke_errors,'production_calls_allowed':False})
 browser.close()
server.shutdown();(OUT/'browser.json').write_text(json.dumps(results,indent=2)+'\n');print(json.dumps(results))
