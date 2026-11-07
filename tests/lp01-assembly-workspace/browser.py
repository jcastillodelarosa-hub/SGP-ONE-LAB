"""New sheet/detail/report layout only, real frontend modules with synthetic RPC.
No production access or writes. For the permitted isolated CI browser environment.
"""
from pathlib import Path
import http.server,threading,json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];OUT=Path(__file__).parent/'evidence';OUT.mkdir(exist_ok=True)
class Files(http.server.SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT),**kw)
 def log_message(self,*a):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Files);threading.Thread(target=server.serve_forever,daemon=True).start();origin=f'http://127.0.0.1:{server.server_port}';results=[]
try:
 with sync_playwright() as p:
  browser=p.chromium.launch()
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
   note=page.locator('[data-note-order-key="A|PANELES_2"]');note.locator('button').click();dialog=page.locator('dialog[open]');field=dialog.locator('[data-order-note]');page.wait_for_function("!document.querySelector('dialog textarea').disabled");field.fill('Borrador conservado en Ensamble');page.evaluate('window.refresh()')
   assert field.input_value()=='Borrador conservado en Ensamble';assert dialog.evaluate('(el)=>el.matches(":modal")');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');dialog.screenshot(path=str(OUT/f'note-{width}.png'))
   dialog.locator('[data-order-note-save]').click();page.wait_for_function("document.querySelector('dialog [data-order-note-status]').textContent.includes('guardada') && !document.querySelector('dialog [data-order-note-cancel]').disabled");dialog.locator('[data-order-note-cancel]').click();assert 'Borrador conservado' in note.inner_text();assert page.evaluate('window.noteWrites.length')==1
   page.locator('[data-assembly-key="A|PANELES_2"] [data-assembly-detail]').first.click();page.wait_for_selector('section[data-assembly-detail]');assert page.locator('[data-assembly-order-note], [data-order-note-section], [data-order-note]').count()>0
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.screenshot(path=str(OUT/f'detail-{width}.png'),full_page=True)
   page.locator('[data-assembly-back]').click();page.locator('[data-assembly-reports]').click();page.wait_for_selector('[data-assembly-report-content]');latest=page.locator('[data-assembly-report-index="0"]');assert 'valor anterior conservado' in latest.inner_text();assert 'Plan y cumplimiento: Por validar' in latest.inner_text();assert latest.locator('[data-original]').count()==2
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.screenshot(path=str(OUT/f'report-{width}.png'),full_page=True)
   assert not errors,errors;assert not external,external;results.append({'width':width,'groups':3,'bodyOverflow':False,'noteDraftRefreshSave':True,'detail':True,'historicalReportOwnSources':True,'externalRequests':0,'productionCalls':0});page.close()
  browser.close()
finally:server.shutdown()
(OUT/'browser-results.json').write_text(json.dumps({'status':'PASS','type':'Isolated real browser with synthetic RPC, not plant verification','results':results},indent=2)+'\n')
print(json.dumps(results))
