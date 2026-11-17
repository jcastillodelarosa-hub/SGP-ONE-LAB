"""Actual dashboard markup/functions, synthetic rows, local static assets only."""
import functools,http.server,json,pathlib,re,threading,os
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=pathlib.Path(os.environ.get('SGP_QA_OUT','/tmp/sgp-pdt-desktop-zoom'));OUT.mkdir(parents=True,exist_ok=True)
app=(ROOT/'app.js').read_text(); html=(ROOT/'index.html').read_text()
markup=html[html.index('<section class="view pdt-dashboard"'):html.index('<section class="view pdt-dashboard"')+len(html.split('<section class="view pdt-dashboard"')[1].split('\n')[0])+len('<section class="view pdt-dashboard"')]
markup=markup.replace(' hidden','',1)
names=['repoIsActive','repoIsValidated','repoValidationBadgeHtml','repoRowHtml','repoStateControlHtml','repoActionMenuHtml','repoDashboardGroups','repoSetTab','repoBindTabs','renderRepoPending','loadRepoPending']
source='\n'.join(next(l for l in app.splitlines() if l.startswith('function '+n+'(') or l.startswith('async function '+n+'(')) for n in names)
class H(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(H,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start();url='http://127.0.0.1:'+str(server.server_address[1])
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('SGP_QA_CHROMIUM','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
  for width,height in [(2866,1000),(1920,1000),(1536,1000),(1280,1000),(960,1000),(390,844)]:
   page=browser.new_page(viewport={'width':width,'height':height});errors=[]
   page.on('pageerror',lambda e:errors.append(str(e)))
   page.route('**/*',lambda route:route.continue_() if route.request.method=='GET' and route.request.url.startswith(url+'/') else route.abort())
   page.goto(url+'/styles.css')
   page.set_content('<link rel="stylesheet" href="'+url+'/styles.css"><header style="padding:12px">LAB v441 · Vista local aislada · datos sintéticos · sin escrituras</header><div class="workspace"><main>'+markup+'</main></div>')
   page.evaluate('''async ({source,base})=>{
    const {pendingFlowGuidance}=await import(base+'/src/modules/pdt-flow-guidance.js');
    const {filterPdtRegistrations,ncAssignment}=await import(base+'/src/domain/pdt-registration.js');
    const escapeHtml=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    let repoRows=[],repoVisibleRows=[],repoV2Capabilities={},repoWeekSort='asc';
    const repoRole=()=> 'COORDINADOR',repoCanState=()=>true,repoCloseActionPortal=()=>{},repoOpenActionPortal=()=>{},repoRunAction=()=>{},openRepoPendingDetail=()=>{};
    const getAppToken=()=> 'SYNTHETIC',getSupabaseClient=async()=>({}),ensureSharedReservations=async()=>{},registrationMetadata=async()=>[];
    let fail=false;const loadPendingRows=async()=>{if(fail)throw Error('Fallo sintético de lectura');return {rows:repoRows,capabilities:{}}};
    eval(source+'\\nwindow.render=renderRepoPending;window.bind=repoBindTabs;window.load=loadRepoPending;window.fail=()=>{fail=true};window.rows=rows=>repoRows=rows;window.visible=()=>repoVisibleRows;');
    window.bind();
   }''',{'source':source,'base':url})
   page.locator('#repoTabValidated').click();assert page.locator('#repoPanelValidated').is_visible()
   def row(id,**kw):return dict(id_pendiente=id,produccion='Orden sintética con descripción extensa y varias palabras '+id,reserva='QA-1234567890',semana=45,cantidad=9,estado='PENDIENTE',estado_repo='PENDIENTE',validacion_estado='POR_VALIDAR',contrato_pdt='LEGACY',**kw)
   rows=[row('pending'),row('progress'),row('partial'),row('delivered'),row('historical')]
   rows[1].update(validacion_estado='VALIDADO',estado_repo='MECANIZADO');rows[2].update(validacion_estado='VALIDADO',estado_repo='PROCESADO',cantidad_entregada=2);rows[3].update(validacion_estado='VALIDADO',estado='RESUELTO',estado_repo='PICKING');rows[4].update(estado='RESUELTO')
   page.evaluate('(rows)=>{window.rows(rows);window.render()}',rows)
   assert page.locator('#repoPendingCount').inner_text()=='1';assert page.locator('#repoValidatedCount').inner_text()=='3'
   assert page.locator('#repoBody .repo-row').count()==1;assert page.locator('#repoDeliveredBody .repo-row').count()==4
   assert 'HISTÓRICO' in page.locator('[data-repo-id="historical"].repo-row').inner_text()
   assert page.locator('[data-repo-id="partial"].repo-row [data-repo-action-toggle]').get_attribute('data-repo-resolved')=='0'
   page.screenshot(path=str(OUT/f'validated-{width}.png'),full_page=True,animations='disabled')
   page.locator('[data-repo-group="processed"]').click();assert page.locator('#repoDeliveredBody .repo-row').count()==1
   page.locator('[data-repo-group="historical"]').click();assert page.locator('#repoDeliveredBody .repo-row').count()==1
   page.locator('#repoTabPending').click();assert page.locator('#repoTabPending').get_attribute('aria-selected')=='true';assert page.locator('#repoTabValidated').get_attribute('aria-selected')=='false';page.screenshot(path=str(OUT/f'pending-{width}.png'),full_page=True,animations='disabled')
   metrics=page.evaluate('''()=>{const w=document.querySelector('#repoPanelPending .table-wrap'),t=w.querySelector('table');return {wrap:w.clientWidth,table:t.getBoundingClientRect().width,min:getComputedStyle(t).minWidth,main:document.querySelector('main').getBoundingClientRect().width}}''')
   if width>=1280:
    assert metrics['table']<=metrics['wrap']+2,metrics
   if width==2866:assert metrics['main']>2500,metrics
   if width==390:assert metrics['min']=='1450px',metrics
   # Server response (not an optimistic click) moves the row.
   rows[0]['validacion_estado']='VALIDADO';page.evaluate('(rows)=>{window.rows(rows);window.render()}',rows)
   assert page.locator('#repoBody .repo-row').count()==0;assert page.locator('#repoValidatedCount').inner_text()=='4'
   assert len(page.evaluate('window.visible()'))==5
   page.locator('#repoTabPending').focus();page.keyboard.press('ArrowRight');assert page.locator('#repoTabValidated').get_attribute('aria-selected')=='true'
   page.evaluate('async()=>{window.fail();await window.load()}');assert 'Fallo sintético' in page.locator('#repoDeliveredBody').inner_text();assert page.locator('#repoValidatedCount').inner_text()=='—'
   assert page.evaluate('document.documentElement.scrollWidth')<=width
   assert not errors,errors
   page.close()
  browser.close()
 report={'status':'PASS','viewports':[2866,1920,1536,1280,960,390],'evidence':str(OUT),'writes':0}
 (OUT/'report.json').write_text(json.dumps(report,indent=2))
 print(json.dumps(report))
except Exception as error:
 (OUT/'report.json').write_text(json.dumps({'status':'FAIL','error':str(error),'writes':0},indent=2))
 try:page.screenshot(path=str(OUT/'failure.png'),full_page=True,animations='disabled')
 except Exception:pass
 raise
finally:server.shutdown()
