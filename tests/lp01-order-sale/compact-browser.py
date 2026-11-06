"""Visible compact order definition and safe editing in desktop/mobile Chromium, synthetic transport."""
from pathlib import Path
import http.server,json,threading
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
class Files(http.server.SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT),**kw)
 def log_message(self,*a):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Files);threading.Thread(target=server.serve_forever,daemon=True).start()
results=[]
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for width in (1440,390):
   page=browser.new_page(viewport={'width':width,'height':850})
   errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(f'http://127.0.0.1:{server.server_port}/tests/lp01-order-sale/compact-fixture.html')
   page.evaluate("""async () => {
    const {retainOrderSaleRows}=await import('/src/modules/lp01-order-sale-rows.js');
    document.body.innerHTML='<div id="qa"></div>';
    window.qa={balance:20,quantity:null,history:[],revision:0,calls:0,saves:[],unknown:false,current:true,active:0,max:0};
    const provider=key=>({isCurrent:()=>qa.current,read:async()=>{qa.active++;qa.max=Math.max(qa.max,qa.active);await new Promise(r=>setTimeout(r,10));qa.active--;qa.calls++;return {quantity:qa.quantity,history:qa.history,revision:qa.revision,capabilities:['READ','DEFINE'],source:{available:null,exportBalance:qa.balance,fingerprint:'qa'}};},save:async c=>{qa.saves.push(c);if(qa.unknown){qa.unknown=false;qa.quantity=c.quantity;qa.revision++;qa.history.push({quantity:c.quantity,observation:c.observation});throw Error('NETWORK_UNCERTAIN');}if(qa.revision===c.revision){qa.quantity=c.quantity;qa.revision++;qa.history.push({quantity:c.quantity,observation:c.observation});}}});
    window.qaRender=(keys=['A','B','C','D','E','F'])=>{const host=document.querySelector('#qa'),attach=retainOrderSaleRows(host,provider,keys);host.innerHTML=keys.map(k=>'<div data-sale-order-key="'+k+'"></div>').join('');attach();};
    qaRender();
   }""")
   page.wait_for_function("document.querySelectorAll('[data-sale-edit]').length===6")
   assert page.locator('.lp-sale-row').first.inner_text().strip().startswith('Por definir')
   assert page.locator('.lp-sale-dialog').first.is_hidden()
   assert page.evaluate('qa.max')<=4
   cell=page.locator('.lp-sale-row').first
   cell.locator('[data-sale-edit]').click()
   cell.locator('[name=quantity]').fill('21');cell.locator('[name=observation]').fill('Motivo de prueba')
   cell.locator('[data-sale-save]').click()
   assert 'supera el saldo real' in cell.locator('[data-sale-status]').inner_text()
   assert not page.evaluate('qa.saves.length')
   cell.locator('[name=quantity]').fill('8')
   page.evaluate('qaRender()')
   assert cell.locator('.lp-sale-dialog:modal').count()==1
   assert cell.locator('[name=observation]').input_value()=='Motivo de prueba'
   cell.locator('[data-sale-cancel]').click()
   assert cell.locator('.lp-sale-dialog').is_hidden()
   assert not page.evaluate('qa.saves.length')
   cell.locator('[data-sale-edit]').click()
   cell.locator('[name=quantity]').fill('8');cell.locator('[name=observation]').fill('Motivo de prueba')
   cell.locator('[data-sale-save]').click()
   page.wait_for_function("document.querySelector('.lp-sale-value').textContent.includes('8')")
   assert page.evaluate('qa.quantity')==8
   assert cell.locator('.lp-sale-dialog').is_hidden()
   page.evaluate('qaRender()')
   assert cell.locator('.lp-sale-value').inner_text().strip().startswith('8')
   page.evaluate('qa.unknown=true')
   cell.locator('[data-sale-edit]').click()
   cell.locator('[name=quantity]').fill('10');cell.locator('[name=observation]').fill('Segundo motivo')
   cell.locator('[data-sale-save]').click()
   page.wait_for_function("document.querySelector('[data-sale-status]').textContent.includes('Resultado sin confirmar')")
   cell.locator('[data-sale-cancel]').click()
   assert cell.locator('.lp-sale-dialog').is_hidden()
   cell.locator('[data-sale-edit]').click()
   cell.locator('[data-sale-retry]').click()
   page.wait_for_function("document.querySelector('.lp-sale-value').textContent.includes('10')")
   assert page.evaluate('qa.saves.at(-1).id===qa.saves.at(-2).id && qa.history.length===2')
   page.screenshot(path=f'/tmp/v392-{width}.png')
   page.evaluate('qa.current=false;qaRender([])')
   assert page.locator('.lp-sale-row').count()==0
   assert not errors,errors
   results.append({'width':width,'compact':True,'boundedReads':True,'saveCancelRetry':True,'quietRender':True,'revocation':True})
   page.close()
  browser.close()
 print(json.dumps(results))
finally:server.shutdown()
