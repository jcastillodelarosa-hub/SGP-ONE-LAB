"""Real controller/rendering with synthetic read-only transport. No production calls."""
from pathlib import Path
import http.server,threading,json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];OUT=Path(__file__).parent/'evidence';OUT.mkdir(exist_ok=True)
class Files(http.server.SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT),**kw)
 def log_message(self,*a):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Files);threading.Thread(target=server.serve_forever,daemon=True).start();origin=f'http://127.0.0.1:{server.server_port}'
results=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,args=['--no-sandbox'])
 for width in [1440,390]:
  page=browser.new_page(viewport={'width':width,'height':900});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(origin) else r.abort())
  page.clock.install();page.goto(origin+'/tests/lp01-tracking-ui/fixture.html');page.wait_for_selector('.lp-tracking-table')
  assert page.locator('#tracking .lp-followup-heading').is_hidden()
  assert page.locator('#tracking .lp-followup-filters').is_hidden()
  assert page.locator('[data-op-load]').is_hidden()
  assert page.locator('[data-turn-operation]').is_hidden()
  assert page.locator('[data-stage-reports]').is_hidden()
  page.evaluate("document.querySelector('[data-search]').value='unmatched old operation search'")
  page.evaluate('controller.load()');assert page.locator('tbody tr').count()==30
  def column(key,section='filter'):
   page.locator('[data-column-origin="'+('mobile' if width<700 else 'table')+'"][data-column-menu="'+key+'"]').click()
   page.locator('[data-menu-section="'+section+'"] > summary').click()
  assert page.locator('thead th').all_text_contents()[:2]==['Semana ▾','Producción / asignación ▾']
  if width<700:assert page.locator('.lp-tracking-mobile-week').first.is_visible()
  page.evaluate("window.node=document.querySelector('.lp-tracking-table');window.observer=new MutationObserver(()=>window.mutations++);window.mutations=0;observer.observe(document.querySelector('[data-live-orders]'),{childList:true,subtree:true})")
  for _ in range(3):page.clock.fast_forward(20000);page.wait_for_function('window.inflight===0')
  assert page.evaluate("window.node===document.querySelector('.lp-tracking-table') && window.mutations===0")
  column('system');page.locator('[data-column-none]').click();page.locator('[data-column-value]').nth(0).check();assert page.locator('tbody tr').count()==30;page.locator('[data-column-apply]').click();assert page.locator('tbody tr').count()==15
  column('week','sort');page.locator('[data-column-order="desc"]').click();column('week')
  page.locator('[data-column-value]').first.focus();page.evaluate("window.version++;window.beforeFocus=document.activeElement.dataset.columnValue")
  page.clock.fast_forward(20000);page.wait_for_function('window.inflight===0')
  assert page.locator('tbody tr').count()==15
  assert page.evaluate('document.activeElement.dataset.columnValue===window.beforeFocus'),page.evaluate('({active:document.activeElement.outerHTML,expected:window.beforeFocus,details:[...document.querySelectorAll("[data-menu-section]")].map(x=>[x.dataset.menuSection,x.open])})')
  page.locator('[data-column-close]').click();page.locator('tbody summary').first.click();page.locator('[data-tracking-tab="Historial"]').click()
  page.evaluate("window.version++;document.querySelector('.lp-tracking-table-wrap').scrollTop=100")
  page.clock.fast_forward(20000);page.wait_for_function('window.inflight===0')
  assert page.locator('[data-tracking-tab="Historial"]').get_attribute('aria-pressed')=='true'
  assert page.locator('#lp-tracking-drawer').is_visible()
  assert page.locator('.lp-tracking-timeline tbody tr').count()==2
  assert page.locator('.lp-tracking-timeline tbody tr').first.locator('[data-label="Cantidad registrada"]').inner_text()=='2'
  page.locator('#lp-tracking-drawer').screenshot(path=str(OUT/f'timeline-{width}.png'))
  page.locator('[data-tracking-close]').click();page.locator('[data-columns-reset]').click();assert page.locator('tbody tr').count()==30
  column('assembly','sort');page.locator('[data-column-order="desc"]').click();assert page.locator('tbody tr').last.locator('[data-label="Saldo Ensamble"]').inner_text()=='Por confirmar'
  assert 'Saldo Empaque' not in page.locator('#tracking').inner_text()
  assert page.locator('.lp-tracking-heading').count()==0
  column('system');page.locator('[data-column-none]').click();page.locator('[data-column-search]').fill('B');assert page.locator('[data-value-label]:visible').count()==1
  page.screenshot(path=str(OUT/f'menu-{width}.png'),full_page=True)
  for _ in range(12):
   page.keyboard.press('Tab');assert page.evaluate("document.querySelector('.lp-column-menu').contains(document.activeElement)")
  page.locator('[data-column-cancel]').click();assert page.locator('tbody tr').count()==30
  column('week');page.keyboard.press('Escape');assert page.locator('.lp-column-menu').count()==0
  assert page.evaluate("document.activeElement.dataset.columnMenu==='week'")
  page.screenshot(path=str(OUT/f'tracking-{width}.png'),full_page=True)
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  page.evaluate('window.delay=true;void controller.load({quiet:true})');page.wait_for_function('window.inflight===1')
  page.clock.fast_forward(40000);assert page.evaluate('window.inflight')==1
  page.locator('[data-tracking-stage="EMPAQUE"]').click();assert page.locator('tbody tr').count()==0
  page.evaluate('window.delay=false;window.release()');page.wait_for_function("window.inflight===0 && document.querySelector('[data-tracking-stage=EMPAQUE]').getAttribute('aria-pressed')==='true'")
  assert page.evaluate('window.maxInflight')==1
  assert 'Saldo Ensamble' not in page.locator('#tracking').inner_text()
  assert 'Saldo Empaque' in page.locator('#tracking').inner_text()
  page.evaluate("window.token='new';document.dispatchEvent(new CustomEvent('sgp:lp-role',{detail:'COORDINADOR'}))")
  assert page.locator('tbody tr').count()==0
  page.evaluate('controller.load()');page.wait_for_selector('tbody tr')
  page.evaluate('window.delay=true;void controller.load({quiet:true})');page.wait_for_function('window.inflight===1')
  page.evaluate("document.dispatchEvent(new CustomEvent('sgp:lp-role',{detail:'CONSULTA'}))")
  page.evaluate('window.delay=false;window.release()');page.wait_for_function('window.inflight===0')
  assert page.locator('tbody tr').count()==0
  page.evaluate('controller.load()');assert page.locator('tbody tr').count()==0
  page.evaluate("document.dispatchEvent(new CustomEvent('sgp:lp-role',{detail:'COORDINADOR'}));document.querySelector('#productionTrackingTab').click()");page.wait_for_selector('tbody tr')
  page.evaluate('window.fail=true;void controller.load({quiet:true})');page.wait_for_function("document.querySelector('[data-op-status]').textContent.includes('QA permiso revocado')")
  assert page.locator('tbody tr').count()==0
  page.evaluate('window.fail=false')
  page.locator('#productionAssemblyTab').click()
  assert page.locator('#tracking .lp-followup-heading').is_visible()
  assert page.locator('[data-line]').is_visible()
  assert page.locator('[data-search]').is_visible()
  assert page.locator('[data-op-load]').is_visible()
  assert page.locator('[data-turn-operation]').is_visible()
  assert page.locator('[data-stage-reports]').is_visible()
  page.locator('[data-stage-reports]').click();assert page.locator('#productionReportsPanel').is_visible()
  page.locator('#productionPackingTab').click();assert page.locator('[data-stage-reports]').is_visible()
  page.locator('#productionTrackingTab').click();page.wait_for_selector('tbody tr')
  assert page.locator('tbody tr').count()==30
  assert page.locator('[data-stage-reports]').is_hidden()
  assert page.locator('[data-turn-operation]').is_hidden()
  assert not errors,errors
  results.append({'width':width,'unchanged_20s_cycles':3,'filters_sort_focus_panel':True,'no_overlap':True,'scope_session_role_clear':True,'external_requests':0,'single_stage_balance':True,'header_menu_search_apply_cancel_escape_focus':True,'approved_header_removed_in_tracking':True,'operation_and_closure_navigation_preserved':True});page.close()
 browser.close()
server.shutdown();(OUT/'browser.json').write_text(json.dumps(results,indent=2)+'\n');print(json.dumps(results))
