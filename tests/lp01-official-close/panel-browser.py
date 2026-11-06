"""Local UI contract fixture only: no production RPC or parser certification."""
from pathlib import Path
import http.server, threading, json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
class Files(http.server.SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT),**kw)
 def log_message(self,*a):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Files)
threading.Thread(target=server.serve_forever,daemon=True).start()
origin=f'http://127.0.0.1:{server.server_port}'
results=[]
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for width in [1440,390]:
   page=browser.new_page(viewport={'width':width,'height':950});errors=[]
   page.on('pageerror',lambda e:errors.append(str(e)))
   page.route('**/fixture',lambda r:r.fulfill(content_type='text/html',body='<meta name="viewport" content="width=device-width,initial-scale=1"><main id="panel"></main>'))
   page.goto(origin+'/fixture')
   page.evaluate('''async()=>{
    const {mountOfficialClosePanel}=await import('/src/modules/lp01-official-close-panel.js');
    const {emptyOfficialClose}=await import('/src/domain/lp01-official-close.js');
    const context={stage:'EMPAQUE',line:'PANELES_2',date:'2026-11-03',shift:1};
    const state=emptyOfficialClose();window.calls=[];
    await mountOfficialClosePanel({host:document.querySelector('#panel'),context,isCurrent:()=>true,controller:{pending:()=>false,read:async()=>({state,revision:state.revision}),save:async(c,revision,input)=>{window.calls.push(input);state.revision++;if(input.action==='IMPORT')state.entries=[{...context,key:'QA|PANELES_2',quantity:7}];else state.closures.push({context,version:1,recordedAt:'2026-11-03T19:00:00-05:00',observation:input.observation,rows:[{key:'QA|PANELES_2',planned:10,realized:7,difference:-3}]});}}});
   }''')
   page.locator('[data-file]').set_input_files({'name':'qa.xlsx','mimeType':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','buffer':b'fixture'})
   page.locator('[data-import]').click();page.wait_for_function('window.calls.length===1')
   page.locator('[data-note]').fill('QA cierre');page.locator('[data-close]').click()
   page.wait_for_function('window.calls.length===2')
   assert page.locator('summary').inner_text().startswith('Cierre 1')
   assert 'definición y base acreditada pendientes' in page.locator('[data-history]').inner_text()
   assert not errors,errors
   results.append({'width':width,'upload_close_reload':True,'pageErrors':errors})
   page.close()
  browser.close()
 Path(__file__).with_name('panel-browser-result.json').write_text(json.dumps({'scope':'Local UI fixture; no production/backend save certification','results':results},indent=2)+'\n')
 print(json.dumps(results))
finally:server.shutdown()
