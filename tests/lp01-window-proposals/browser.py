"""Directed UI test with synthetic transport; no backend changes or production writes."""
from pathlib import Path
import http.server,threading,json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
class Files(http.server.SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT),**kw)
 def log_message(self,*a):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Files);threading.Thread(target=server.serve_forever,daemon=True).start();origin=f'http://127.0.0.1:{server.server_port}';results=[]
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(**({'executable_path':'/usr/bin/chromium'} if Path('/usr/bin/chromium').exists() else {}),args=['--no-sandbox'])
  for width in [1440,390]:
   page=browser.new_page(viewport={'width':width,'height':950});page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(origin) else r.abort())
   page.route(origin+'/qa',lambda r:r.fulfill(content_type='text/html',body='<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/src/modules/lp01-followup.css"><main class="lp-followup"><div id="panel"></div></main>'));page.goto(origin+'/qa')
   page.evaluate('''async()=>{
    const {mountSharedAffectationsPanel}=await import('/src/modules/lp01-shared-affectations-panel.js');
    window.qa={commands:[],revision:0,reports:[],canReport:true};
    const pending={status:'AVAILABLE',rows:[{id:'p1',contract:'V2',reference:'PERFIL-1',pieceQuantity:4},{id:'old',contract:'LEGACY',reference:'PERFIL-ANTERIOR',pieceQuantity:2},{id:'missing',contract:'V2',reference:'SIN-CANTIDAD',pieceQuantity:null}]};
    window.qaMount=async cause=>mountSharedAffectationsPanel(document.querySelector('#panel'),{read:async()=>({reports:[],events:[],aluminumPending:pending}),shared:{read:async()=>({revision:qa.revision,reports:qa.reports,history:[],legacyReports:[],canReport:qa.canReport,stageBalance:20,accessories:[]}),command:async cmd=>{qa.commands.push(cmd);qa.revision++;qa.reports.push({id:cmd.id,cause:cmd.cause,quantity:cmd.quantity,solved:0,confirmed:0,observation:cmd.observation,nc_reference:cmd.ncReference});return {revision:qa.revision};}}},{fixedCause:cause});
    await qaMount('NC_AL');
   }''')
   form=page.locator('[data-shared-form]');assert form.locator(':scope > h4').inner_text()=='Definir ventanas afectadas'
   assert form.bounding_box()['y']<page.locator('.lp-aluminum-pending').bounding_box()['y']
   form.locator('[name=sourceRef]').select_option('p1');assert form.locator('[name=quantity]').input_value()=='4';assert 'tentativa: 4' in page.locator('[data-window-proposal-text]').inner_text();assert page.evaluate('qa.commands.length')==0
   form.locator('[name=quantity]').fill('3');form.locator('[name=observation]').fill('Revisadas por líder');form.locator('[name=sourceRef]').select_option('proposal:1');assert form.locator('[name=quantity]').input_value()=='3'
   page.locator('[data-use-window-proposal]').click();assert form.locator('[name=quantity]').input_value()=='2'
   form.locator('[name=sourceRef]').select_option('missing');assert page.locator('[data-window-proposal]').is_hidden();assert form.locator('[name=quantity]').input_value()==''
   form.locator('[name=quantity]').fill('5');form.locator('[name=sourceRef]').select_option('proposal:1');form.locator('button[type=submit]').click();page.wait_for_function("document.querySelector('[data-shared-status]').textContent==='Guardado.'")
   assert page.evaluate('qa.commands[0].quantity')==5 and page.evaluate("'sourceRef' in qa.commands[0]")==False
   page.evaluate("qaMount('NC_V')");form=page.locator('[data-shared-form]');form.locator('[name=ncReference]').fill('NC-1');assert form.locator('[name=quantity]').input_value()=='1'
   assert form.locator('[name=quantity]').is_hidden();form.locator('[name=quantity]').evaluate("el=>el.value='3'");form.locator('[name=ncReference]').fill('NC-2');assert form.locator('[name=quantity]').input_value()=='1'
   form.locator('[name=observation]').fill('Una NC corresponde a una ventana');form.locator('button[type=submit]').click();page.wait_for_function("document.querySelector('[data-shared-status]').textContent==='Guardado.'")
   page.evaluate("qaMount('NC_V')");assert '1 ventanas reportadas' in page.locator('[data-shared-report]').inner_text();assert page.evaluate('qa.commands[1].quantity')==1;assert 'por verificar' in page.locator('[data-shared-report]').inner_text();assert page.evaluate('qa.commands.length')==2
   page.screenshot(path=f'/tmp/window-proposals-{width}.png',full_page=True)
   page.evaluate("qa.canReport=false;qaMount('NC_AL')");assert page.locator('[type=submit]').is_disabled();assert page.locator('[name=quantity]').is_disabled()
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1');results.append({'width':width,'formVisibleBeforePending':True,'tentativePerSourceEditable':True,'noAutomaticWritesOrSum':True,'manualCorrectionSurvivesSourceChanges':True,'legacyNoInventedLink':True,'ncFixedOneSavedAndReloaded':True,'permissionsPreserved':True});page.close()
  browser.close()
 print(json.dumps(results));(Path(__file__).parent/'result.json').write_text(json.dumps(results,indent=2)+'\n')
finally:server.shutdown()
