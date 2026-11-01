"""Actual browser → local RPC HTTP adapter → real PostgreSQL functions → reread.
Adapter only transports SQL. Glass also executes the proposed existing SQL RPC against synthetic source rows.
All external traffic blocked; no Supabase writes/connections.
"""
from pathlib import Path
import sys,json,http.server,threading,os
sys.path.insert(0,str(Path(__file__).parent))
from postgres import Database,ROOT,OUT
from playwright.sync_api import sync_playwright
os.chdir(ROOT)
class Handler(http.server.SimpleHTTPRequestHandler):
 db=None
 def log_message(self,*args):pass
 def do_POST(self):
  try:
   body=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
   name=body['name'];args=body['args']
   data=self.db.rpc(name,args)
   response={'data':data,'error':None}
  except Exception as e:response={'data':None,'error':{'message':str(e),'code':'QA_SQL_ERROR'}}
  encoded=json.dumps(response).encode();self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(encoded)));self.end_headers();self.wfile.write(encoded)
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start()
results=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,args=['--no-sandbox'])
 for width in [1440,390]:
  db=Database();Handler.db=db
  try:
   key='QA|PANELES_2';parts=db.seed();db.prepare_glass(key);db.sql('UPDATE sgp_lp_operacion.config SET formato_bi_aprobado=true WHERE id;')
   page=browser.new_page(viewport={'width':width,'height':950 if width>400 else 844});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.route('**/*',lambda r:r.continue_() if r.request.url.startswith('http://127.0.0.1:') else r.abort())
   page.goto('http://127.0.0.1:'+str(server.server_port)+'/')
   page.evaluate('''()=>{
    document.querySelector('[data-view-panel="ensamble"]').hidden=false;
    const b=document.createElement('p');b.textContent='QA AISLADO · PostgreSQL real · fuentes sintéticas · sin conexión productiva';document.querySelector('[data-view-panel="ensamble"]').prepend(b);
    window.qaRole='COORDINADOR';window.rpcCalls=[];
    window.SGPPlannerBridge.getToken=()=>window.qaRole;
    window.SGPPlannerBridge.getClient=async()=>({rpc:async(name,args)=>{window.rpcCalls.push({name,args});const result=await (await fetch('/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,args})})).json();if(window.dropNextReply&&name==='sgp_lp_operacion_comando'){window.dropNextReply=false;return {data:null,error:{code:'FETCH_ERROR',message:'QA respuesta perdida después de commit'}};}return result;}});
    const originalGlass=window.SGPPlannerBridge.openGlass;window.SGPPlannerBridge.openGlass=(...args)=>{window.glassContext=args;return originalGlass(...args);};
   }''')
   page.evaluate("document.querySelector('[data-op-date]').value='2026-11-01'");page.locator('#productionTrackingTab').click()
   page.wait_for_function("document.querySelector('[data-op-status]').textContent.includes('NO_ABIERTO')")
   page.locator('[data-open]').click();page.wait_for_selector('[data-live-operate]',state='attached')
   assert page.locator('[data-live-orders] .lp-followup-order').count()==4
   page.locator('[data-live-orders] .lp-followup-order summary').first.click();page.locator('[data-live-operate]').first.click()
   page.wait_for_selector('[data-sale]');page.locator('[data-sale]').fill('90');page.locator('[data-operation-note]').fill('QA capacidad revisada');page.locator('[data-sale-save]').click()
   page.wait_for_function("document.querySelector('[data-op-status]').textContent.includes('Guardado confirmado')")
   assert db.snapshot()['orders'][0]['sale']==90
   page.evaluate("window.qaRole='LIDER'");page.locator('#productionTrackingTab').click();page.wait_for_function("document.querySelector('[data-op-status]').textContent.includes('Contrato operativo')")
   page.locator('[data-live-orders] .lp-followup-order summary').first.click();page.locator('[data-live-operate]').first.click();page.wait_for_selector('[data-executed]')
   assert page.locator('[data-sale-save]').count()==0
   for q in ['30','50','40']:
    if q=='40':page.evaluate('window.dropNextReply=true')
    page.locator('[data-executed]').fill(q);page.locator('[data-operation-note]').fill('QA avance acumulado '+q);page.locator('[data-order-form] button[type=submit]').click()
    if q=='40':
     page.wait_for_function("document.querySelector('[data-save-status]').textContent.includes('respuesta perdida')");assert db.snapshot()['orders'][0]['ejecutado']==40;page.locator('[data-operation-pending-retry]').click()
    page.wait_for_function("document.querySelector('[data-op-status]').textContent.includes('Guardado confirmado')")
    assert db.snapshot()['orders'][0]['ejecutado']==int(q)
   assert db.sql("SELECT count(*) FROM sgp_lp_operacion.auditoria WHERE operacion='EJECUTAR'")=='3'
   page.reload();page.evaluate('''()=>{
    document.querySelector('[data-view-panel="ensamble"]').hidden=false;window.qaRole='LIDER';window.rpcCalls=[];
    window.SGPPlannerBridge.getToken=()=>window.qaRole;window.SGPPlannerBridge.getClient=async()=>({rpc:async(name,args)=>{window.rpcCalls.push({name,args});const result=await (await fetch('/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,args})})).json();if(window.dropNextReply&&name==='sgp_lp_operacion_comando'){window.dropNextReply=false;return {data:null,error:{code:'FETCH_ERROR',message:'QA respuesta perdida después de commit'}};}return result;}});
    const originalGlass=window.SGPPlannerBridge.openGlass;window.SGPPlannerBridge.openGlass=(...args)=>{window.glassContext=args;return originalGlass(...args);};
   }''')
   page.evaluate("document.querySelector('[data-op-date]').value='2026-11-01'");page.locator('#productionTrackingTab').click();page.wait_for_selector('[data-live-operate]',state='attached')
   assert 'Avance 40' in page.locator('[data-live-orders] .lp-followup-order').first.inner_text()
   page.locator('[data-live-orders] .lp-followup-order summary').first.click();page.locator('[data-live-operate]').first.click();page.wait_for_selector('[data-executed]')
   page.locator('[data-executed]').fill('91');page.locator('[data-operation-note]').fill('QA exceso rechazado');page.locator('[data-order-form] button[type=submit]').click();page.wait_for_function("document.querySelector('[data-save-status]').textContent.includes('SUPERA_')")
   assert db.snapshot()['orders'][0]['ejecutado']==40
   page.locator('[data-affectation="NC_AL"]').fill('12');page.locator('[data-affectation="NC_V"]').fill('8');page.locator('[data-operation-note]').fill('QA ventanas con superposición');page.locator('[data-affect-save]').click();page.wait_for_function("document.querySelector('[data-op-status]').textContent.includes('Guardado confirmado')")
   assert db.snapshot()['orders'][0]['afectaciones']['NC_AL']==12
   # Coordinator validates remaining SALEs before close. Actual engine, not page state mutation.
   for part,n in zip(parts[1:],[90,90,18]):db.execute(db.cmd('SALE',key=key,part=part,quantity=n,observation='QA cierre'))
   page.locator('#productionTrackingTab').click();page.wait_for_selector('[data-live-operate]',state='attached');page.locator('[data-live-orders] .lp-followup-order summary').first.click();page.locator('[data-live-operate]').first.click();page.wait_for_selector('[data-bi-file]')
   csv='etapa;fecha;turno;key_produccion;parte;cantidad\n'+'\n'.join('ENSAMBLE;2026-11-01;1;'+key+';'+part+';'+str(39 if i==0 else 0) for i,part in enumerate(parts))
   page.locator('[data-bi-file]').set_input_files({'name':'QA-synthetic-powerbi.csv','mimeType':'text/csv','buffer':csv.encode()})
   page.wait_for_selector('[data-import]');page.locator('[data-import]').click();page.wait_for_function("document.querySelector('[data-op-status]').textContent.includes('Guardado confirmado')")
   for el in page.locator('[data-close-reason]').all():el.fill('QA diferencia o pendiente justificado')
   page.locator('[data-close-note]').fill('QA cierre sintético con evidencia');page.locator('[data-close]').click();page.wait_for_function("document.querySelector('[data-op-status]').textContent.includes('Guardado confirmado')")
   assert db.snapshot()['turn']['estado']=='CERRADO'
   page.locator('#productionReportsTab').click();page.wait_for_selector('[data-report]',state='attached');page.locator('#productionReportsPanel details summary').click()
   with page.expect_download() as info:page.locator('[data-report]').click()
   download=info.value;download.save_as(OUT/f'close-{width}.csv');assert '39' in (OUT/f'close-{width}.csv').read_text()
   page.locator('#productionReportsPanel').screenshot(path=str(OUT/f'reports-{width}.png'))
   page.locator('#productionTrackingTab').click();page.wait_for_selector('[data-live-operate]',state='attached');page.locator('[data-live-orders] .lp-followup-order summary').first.click();page.locator('#productionTrackingPanel').screenshot(path=str(OUT/f'tracking-{width}.png'))
   page.locator('[data-glass]').first.click();page.wait_for_selector('[data-glass-category]');page.locator('[data-glass-category="PREPARADO"]').click();assert page.evaluate('window.glassContext[0]')==key;page.wait_for_selector('.glass-detail-row');assert page.locator('.glass-detail-group').count()==1;assert '32' in page.locator('#glassDetailBody').inner_text();page.locator('#closeGlassDetail').click();assert page.locator('#productionOperationPanel').is_visible()
   page.locator('#productionOperationPanel').screenshot(path=str(OUT/f'operation-{width}.png'))
   page.locator('#productionDashboardTab').click();page.wait_for_function("document.querySelector('#productionDashboardPanel').textContent.includes('Últimos avances')")
   page.locator('#productionLocationsTab').click();assert page.locator('#assemblyLocationReportPanel').is_visible()
   page.locator('#productionPlannerTab').click();assert page.locator('#productionPlannerPanel').is_visible()
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   assert not errors,errors
   results.append({'viewport':width,'persistence':'browser→HTTP→real PostgreSQL RPC→reload 40 (not 30+50+40)','closure':'actual immutable SQL report and CSV download','roles':'real captured auth; synthetic coordinator/leader sessions','glass':'real captured auth + proposed existing RPC correction + synthetic location rows; actual modal filtered PREPARADO=32, return context preserved','lost_commit_reply':'actual committed SQL request retried with same UUID; exactly three execution audit events','glass_rollback':'captured function restored and proposal reapplied in isolated PostgreSQL','external_network':'blocked','page_errors':errors});page.close()
  except Exception:
   (OUT/f'failure-{width}.json').write_text(json.dumps({'status':page.locator('[data-op-status]').inner_text(),'text':page.locator('#productionOperationPanel').inner_text(),'errors':errors,'calls':page.evaluate('window.rpcCalls')},indent=2))
   raise
  finally:db.close()
 browser.close()
server.shutdown();(OUT/'browser.json').write_text(json.dumps({'results':results,'limits':['No real Power BI file supplied; CSV-v1 QA adapter only','No productive Supabase installation or plant verification','Glass tested only with synthetic source data; no plant browser/session verification']},indent=2)+'\n');print(json.dumps(results,indent=2))
