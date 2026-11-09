"""Approved compact NC warning + Export and explicit stage save, synthetic RPC only."""
from pathlib import Path
from functools import partial
import http.server,threading,json,os,shutil
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'test-artifacts'/'ncv-alert';OUT.mkdir(parents=True,exist_ok=True)
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),partial(http.server.SimpleHTTPRequestHandler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start();origin=f'http://127.0.0.1:{server.server_port}'
results=[]
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path=os.environ.get('CHROME_BIN') or shutil.which('chromium'),args=['--no-sandbox'])
  for width in [1440,390]:
   page=browser.new_page(viewport={'width':width,'height':900});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(origin) else r.abort())
   page.goto(origin+'/tests/fixtures/nc-glass-alert.html');row=page.locator('tr').filter(has=page.locator('[data-order-summary="QA3|PANELES_2"]'))
   page.locator('[data-order-summary="QA3|PANELES_2"] [data-nc-review-order]').wait_for()
   assert row.locator('[data-nc-order-name] [data-nc-review-order]').count()==1
   assert '1 × Tecno · Export' in row.inner_text();assert 'NC vidrio por revisar' in row.inner_text()
   assert '× NC V' not in row.inner_text();assert page.evaluate('alertState.commands.length')==0
   page.screenshot(path=str(OUT/f'compact-{width}.png'),full_page=True)
   row.locator('[data-nc-order-name] button').click();page.wait_for_selector('[data-order-type=NC_V][aria-pressed=true]')
   page.wait_for_function("document.querySelector('[data-nc-review-status]')?.textContent.includes('NC por revisar.')")
   assert page.locator('[data-nc-review-list] > li').count()==1
   ref=page.locator('[data-nc-review-reference]');stage=page.locator('[data-nc-review-stage]');confirm=page.locator('[data-nc-review-confirm]');prepare=page.locator('[data-nc-review-prepare]')
   assert ref.input_value()=='' and stage.input_value()=='' and prepare.is_disabled()
   ref.select_option('0');stage.select_option('EMPAQUE');assert prepare.is_disabled();confirm.check();prepare.click()
   form=page.locator('[data-type-pane=NC_V] [data-shared-form]');page.wait_for_function("document.querySelector('[data-shared-form] [name=ncReference]')?.value==='NC-1001'")
   assert 'EMPAQUE' in form.locator('[data-registration-stage]').inner_text();assert form.locator('[name=quantity]').input_value()=='1';assert form.locator('[name=quantity]').is_hidden();assert page.evaluate('alertState.commands.length')==0
   form.locator('[name=observation]').fill('Validación sintética expresa de una ventana')
   page.evaluate('controller.load({quiet:true})');page.wait_for_timeout(100);assert form.locator('[name=observation]').input_value()=='Validación sintética expresa de una ventana'
   page.screenshot(path=str(OUT/f'prepare-{width}.png'),full_page=True)
   form.get_by_role('button',name='Guardar afectación',exact=True).click();page.wait_for_function('alertState.commands.length===1')
   page.wait_for_function("document.querySelectorAll('[data-nc-review-order=\"QA3|PANELES_2\"]').length===0")
   saved=page.evaluate('alertState.commands[0]');assert saved['stage']=='EMPAQUE' and saved['key']=='QA3|PANELES_2';assert saved['cmd']['ncReference']=='NC-1001' and saved['cmd']['quantity']==1 and saved['cmd']['action']=='CREATE';assert page.evaluate('alertState.reports[0].nc_link') is None
   assert page.evaluate('qaSale.ids.length')==0;assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');assert not errors,errors
   results.append({'width':width,'compactNameWarning':True,'separateDetectedAndRecorded':True,'exportWindows':1,'explicitNcAndStage':True,'quantityFixedOnePerNc':True,'draftPreserved':True,'savedOriginStage':'EMPAQUE','verifiedLink':False,'syntheticWrites':1});page.close()
  browser.close()
 (OUT/'result.json').write_text(json.dumps(results,indent=2)+'\n');print(json.dumps(results))
finally:server.shutdown()
