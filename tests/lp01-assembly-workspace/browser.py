"""New sheet/detail/report layout only, real frontend modules with synthetic RPC.
No production access or writes. For the permitted isolated CI browser environment.
"""
from pathlib import Path
import http.server,threading,json,os
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];OUT=Path(__file__).parent/'evidence';OUT.mkdir(exist_ok=True)
class Files(http.server.SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT),**kw)
 def log_message(self,*a):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Files);threading.Thread(target=server.serve_forever,daemon=True).start();origin=f'http://127.0.0.1:{server.server_port}';results=[]
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(**({"executable_path":os.environ["LP_CHROMIUM"]} if os.environ.get("LP_CHROMIUM") else {}))
  for width in [1440,390]:
   page=browser.new_page(viewport={'width':width,'height':900});errors=[];external=[];page.on('pageerror',lambda e:errors.append(str(e)))
   def route(r):
    if r.request.url.startswith(origin):r.continue_()
    else:external.append(r.request.url);r.abort()
   page.route('**/*',route);page.goto(origin+'/tests/lp01-assembly-workspace/fixture.html');page.wait_for_selector('[data-assembly-group=OTRAS]')
   assert page.locator('[data-assembly-key]').count()==3
   for group in ['ABIERTAS','PROGRAMADAS','OTRAS']:assert page.locator('[data-assembly-group='+group+']').is_visible()
   assert page.locator('[data-executed],[data-open]').count()==0
   page.locator('[data-note-order-key="A|PANELES_2"]').scroll_into_view_if_needed()
   page.wait_for_function("document.querySelector('[data-note-order-key=\"A|PANELES_2\"] [data-order-note-preview]')?.textContent.startsWith('Observación compartida')")
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   page.screenshot(path=str(OUT/f'sheet-{width}.png'),full_page=True)
   if width<=700:
    assert page.locator('[data-assembly-key]').first.evaluate("row=>{const w=row.querySelector('.lp-assembly-week').getBoundingClientRect(),p=row.querySelector('.lp-assembly-identity').getBoundingClientRect();return w.x<p.x&&Math.abs(w.y-p.y)<2;}"),'Week must be left of Production in mobile card'
   # Same headers/menu vocabulary as Seguimiento, local-only filter and cancel/reset.
   origin_selector='[data-column-origin="mobile"]' if width<=700 else '[data-assembly-group="ABIERTAS"] [data-column-origin="table"]'
   page.locator(origin_selector+'[data-column-menu="week"]').click()
   menu=page.locator('dialog.lp-column-menu');menu.wait_for(state='visible')
   menu.locator('[data-menu-section="filter"] summary').click()
   menu.locator('[data-column-none]').click()
   menu.locator('[data-column-value]').first.check()
   page.screenshot(path=str(OUT/f'column-filter-{width}.png'))
   menu.locator('[data-column-apply]').click()
   assert page.locator('[data-assembly-key]').count()>=1
   page.locator('[data-columns-reset]').click()
   assert page.locator('[data-assembly-key]').count()==3
   page.locator(origin_selector+'[data-column-menu="reservation"]').click()
   menu=page.locator('dialog.lp-column-menu');menu.locator('[data-menu-section="sort"] summary').click()
   menu.locator('[data-column-order="desc"]').click()
   assert page.locator('th[aria-sort="descending"]').count()==3
   page.locator(origin_selector+'[data-column-menu="week"]').click()
   menu=page.locator('dialog.lp-column-menu');menu.locator('[data-menu-section="filter"] summary').click()
   menu.locator('[data-column-none]').click();menu.locator('[data-column-cancel]').click()
   assert page.locator('[data-assembly-key]').count()==3
   page.locator(origin_selector+'[data-column-menu="week"]').click();page.keyboard.press('Escape')
   assert page.locator('dialog[open]').count()==0
   page.locator('[data-columns-reset]').click()
   glass_button=page.locator('[data-assembly-key="A|PANELES_2"] [data-assembly-glass]');glass_button.click();glass=page.locator('#glassDetailModal');glass.wait_for(state='visible')
   assert 'OVES-QA-1' in glass.locator('#glassDetailTitle').inner_text() and 'LAMINADO' in glass.locator('#glassDetailMeta').inner_text()
   burro=glass.locator('details.glass-burro');assert burro.count()==1 and burro.get_attribute('open') is None
   burro.locator('summary').click();burro.locator('table').wait_for(state='visible')
   assert burro.locator('tbody tr').count()==2 and '100 × 200' in burro.inner_text() and 'MARCA-QA-A' in burro.inner_text()
   assert page.locator('.modal:not([hidden]),dialog[open]').count()==1,'Expanding a burro must not stack another modal'
   assert burro.locator('table').evaluate("table=>{const wrap=table.parentElement,r=wrap.getBoundingClientRect();return wrap.scrollWidth<=wrap.clientWidth+1&&Array.from(table.querySelectorAll('th')).every(th=>{const b=th.getBoundingClientRect();return b.left>=r.left&&b.right<=r.right+1&&b.right<=innerWidth;});}"),'Cantidad, Dimensiones and Marca must fit without horizontal scrolling'
   assert glass.locator('.modal-card').evaluate("card=>{const r=card.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;}"),'Glass modal must remain inside the viewport'
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');glass.screenshot(path=str(OUT/f'glass-inline-{width}.png'))
   burro.locator('summary').press('Enter');assert burro.get_attribute('open') is None
   burro.locator('summary').press('Enter');burro.locator('table').wait_for(state='visible')
   glass.locator('#closeGlassDetail').click();assert not glass.is_visible();glass_button.click();assert glass.is_visible() and glass.locator('details').get_attribute('open') is None;glass.locator('#closeGlassDetail').click()

   note=page.locator('[data-note-order-key="A|PANELES_2"]');note.locator('button').click();dialog=page.locator('dialog[open]');field=dialog.locator('[data-order-note]');page.wait_for_function("!document.querySelector('dialog textarea').disabled");field.fill('Borrador conservado en Ensamble');page.evaluate('window.refresh()')
   assert field.input_value()=='Borrador conservado en Ensamble';assert dialog.evaluate('(el)=>el.matches(":modal")');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');dialog.screenshot(path=str(OUT/f'note-{width}.png'))
   dialog.locator('[data-order-note-save]').click();page.wait_for_function("document.querySelector('dialog [data-order-note-status]').textContent.includes('guardada') && !document.querySelector('dialog [data-order-note-cancel]').disabled");dialog.locator('[data-order-note-cancel]').click();assert 'Borrador conservado' in note.inner_text();assert page.evaluate('window.noteWrites.length')==1
   page.locator('[data-assembly-key="A|PANELES_2"] [data-assembly-detail]').first.click();page.wait_for_selector('section[data-assembly-detail]');assert page.locator('[data-assembly-order-note], [data-order-note-section], [data-order-note]').count()>0
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.screenshot(path=str(OUT/f'detail-{width}.png'),full_page=True)
   page.locator('[data-assembly-back]').click();page.locator('[data-assembly-reports]').click();page.wait_for_selector('[data-assembly-report-content]');latest=page.locator('[data-assembly-report-index="0"]');assert 'valor anterior conservado' in latest.inner_text();assert 'Disponible o estado sin evidencia del turno: Por validar' in latest.inner_text();assert latest.locator('[data-original]').count()==2
   latest.locator('[data-report-section=all] > summary').click()
   assert 'valor anterior conservado' in latest.locator('[data-report-section=all]').inner_text()
   if width<=700:
    assert latest.locator('[data-report-section=all] .lp-assembly-report-orders tbody tr').evaluate_all("rows=>rows.length>0&&rows.every(row=>row.getBoundingClientRect().width<=row.closest('.lp-assembly-report-table-wrap').clientWidth+1)"),'Mobile production cards must fit their container without hiding Realizado to the right'
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.screenshot(path=str(OUT/f'report-{width}.png'),full_page=True)
   page.evaluate('window.showPlanReport()');page.wait_for_function("document.querySelector('#reports').textContent.includes('Disponible coordinador')")
   plan_report=page.locator('#reports [data-assembly-report-index="0"]')
   if plan_report.get_attribute('open') is None:plan_report.locator('summary').click()
   plan_report.locator('[data-assembly-report-content]').wait_for(state='visible')
   assert 'excluidas del porcentaje' in page.locator('#reports').inner_text();assert 'Por validar' in page.locator('#reports').inner_text()
   assert '70 %' not in page.locator('#reports').inner_text();assert page.locator('#reports [data-report]').count()==1
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.screenshot(path=str(OUT/f'report-plan-v4-{width}.png'),full_page=True)
   page.evaluate('window.showPacking()');page.wait_for_function("document.querySelector('#workspace').textContent.includes('Hoja de Empaque')")
   assert page.locator('[data-assembly-key]').count()==3 and page.locator('[data-assembly-group]').count()==3
   assert page.locator('#workspace [data-assembly-glass],[data-assembly-incorporate]').count()==0
   page.locator(origin_selector+'[data-column-menu="reservation"]').click();page.locator('dialog.lp-column-menu [data-menu-section="sort"] summary').click();page.locator('[data-column-order="desc"]').click()
   assert page.locator('th[aria-sort="descending"]').count()==3
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.screenshot(path=str(OUT/f'packing-{width}.png'),full_page=True)
   page.locator('[data-assembly-key="A|PANELES_2"] [data-assembly-detail]').first.click();page.wait_for_selector('section[data-assembly-detail]')
   assert 'Saldo Empaque' in page.locator('[data-assembly-detail]').inner_text() and page.locator('[data-assembly-balance]').inner_text()=='5'
   assert page.locator('#workspace [data-assembly-glass],[data-assembly-incorporate]').count()==0
   page.screenshot(path=str(OUT/f'packing-detail-{width}.png'),full_page=True)
   assert not errors,errors;assert not external,external;results.append({'width':width,'groups':3,'bodyOverflow':False,'noteDraftRefreshSave':True,'detail':True,'historicalReportOwnSources':True,'planV4FromSQL':True,'glassInlineExpandKeyboardReopen':True,'mobileWeekLeft':width<=700,'externalRequests':0,'productionCalls':0,'packingStageNoGlass':True});page.close()
  browser.close()
finally:server.shutdown()
(OUT/'browser-results.json').write_text(json.dumps({'status':'PASS','type':'Isolated real browser with synthetic RPC, not plant verification','results':results},indent=2)+'\n')
print(json.dumps(results))
