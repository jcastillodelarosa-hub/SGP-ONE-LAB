"""Real Chromium DOM/layout at representative synthetic volumes. No backend calls."""
from pathlib import Path
import http.server,threading,json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];OUT=Path(__file__).parent
class Files(http.server.SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT),**kw)
 def log_message(self,*a):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Files);threading.Thread(target=server.serve_forever,daemon=True).start();origin=f'http://127.0.0.1:{server.server_port}'
results=[]
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,args=['--no-sandbox'])
  for width in [1440,390]:
   page=browser.new_page(viewport={'width':width,'height':950})
   page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(origin) else r.abort())
   page.route('**/qa-dom',lambda r:r.fulfill(content_type='text/html',body='<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/src/modules/lp01-followup.css"><main class="lp-followup" id="orders" style="margin:12px;max-width:100%"></main>'))
   page.goto(origin+'/qa-dom')
   for count in [50,200,500]:
    result=page.evaluate('''async count=>{const {operationOrders}=await import('/src/domain/lp01-operation-orders.js');const {operationOrderList}=await import('/src/modules/lp01-operation-orders.js');const data={contract:'LP-OPERACION-1',orders:Array.from({length:count*2},(_,i)=>({key:'QA'+Math.floor(i/2),parte:'P'+i,produccion:'QA '+Math.floor(i/2),linea:'L',etapa:'ENSAMBLE',fecha:'2026-11-05',turno:1,prioridad:i,sale:10,ejecutado:0,programada:20,total_etapa_parte:0,afectaciones:{},oficial:{id_linea:'L',semana_base:42,anio:2026,sistema:'ES7100'}}))};const host=document.querySelector('#orders'),samples=[];for(let i=0;i<5;i++){const t=performance.now();host.innerHTML=operationOrderList(operationOrders(data),'ENSAMBLE');void host.offsetHeight;samples.push(performance.now()-t);}return {orders:count,assignments:count*2,samplesMs:samples.map(x=>+x.toFixed(2)),cards:host.querySelectorAll('[data-order-key]').length,overflow:document.documentElement.scrollWidth>innerWidth+1};}''',count)
    assert result['cards']==count and not result['overflow'],result
    assert max(result['samplesMs'])<2000,result
    results.append({'width':width,**result})
   page.close()
  browser.close()
 (OUT/'dom-performance-result.json').write_text(json.dumps({'environment':'Local Chromium actual DOM/layout, synthetic 50/200/500 orders, no backend/network latency','scenarios':results},indent=2)+'\n');print(json.dumps(results))
finally:server.shutdown()
