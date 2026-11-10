"""Actual modal/functions with synthetic RPC transport. No live data or external requests."""
from pathlib import Path
import json, mimetypes, os, re
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
OUT=Path(os.environ.get('PARTS_QA_OUT','/tmp/programming-parts-qa'));OUT.mkdir(parents=True,exist_ok=True)
ORIGIN='http://programming.test/'
html=re.sub(r'<script\b[^>]*>.*?</script>','',(ROOT/'index.html').read_text(),flags=re.S)
app=(ROOT/'app.js').read_text()
source=app[app.index('function renderProgParts('):app.index("document.querySelector('#progRefresh')")]
results=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('SCROLL_CHROMIUM','/usr/bin/chromium'),args=['--no-sandbox'])
 for width,height in [(1440,900),(390,844),(320,568)]:
  page=browser.new_page(viewport={'width':width,'height':height},is_mobile=width<500,has_touch=True)
  errors=[];external=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  def route(r):
   if not r.request.url.startswith(ORIGIN) or r.request.method!='GET':external.append(r.request.url);r.abort();return
   name=r.request.url[len(ORIGIN):].split('?')[0]
   if not name:r.fulfill(content_type='text/html',body=html);return
   file=ROOT/name
   if file.is_file():r.fulfill(content_type=mimetypes.guess_type(name)[0] or 'text/plain',body=file.read_bytes())
   else:r.fulfill(status=404,body='Not found')
  page.route('**/*',route);page.goto(ORIGIN)
  page.evaluate('''async source=>{
   const {coverageAmount}=await import('/src/domain/mecanizado-partes.js');
   const {programmingPartState,programmingPartsPlan,validateProgrammingDestination}=await import('/src/domain/programming-part-selection.js');
   const {saveProgrammingParts}=await import('/src/services/programming-part-selection.js');
   const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
   const parts=Array.from({length:6},(_,i)=>({prioridad:'14.'+(i+1),cantidad:i===0?8:5,vidrio_pct:80,ordenes:[{key_produccion:'QA-'+i,produccion:'ORDEN '+i,cantidad:i===0?8:5,tipo_vidrio:'LAMINADO'}]}));
   parts[5].ordenes=[{key_produccion:'QA-5A',produccion:'ORDEN 5A',cantidad:2},{key_produccion:'QA-5B',produccion:'ORDEN 5B',cantidad:3}];
   const coverage=parts.flatMap(part=>part.ordenes.map(o=>({...o,reserva:'QA-RES',prioridad_semanal:part.prioridad,estado_orden:'PENDIENTE',cantidad_programada:0})));
   Object.assign(coverage[2],{estado_orden:'PROGRAMADA',cantidad_programada:5});
   Object.assign(coverage[3],{estado_orden:'PARCIAL',cantidad_programada:2});
   Object.assign(coverage[4],{estado_orden:'REVISAR',id_programacion_legacy:'qa-legacy'});
   Object.assign(coverage[5],{estado_orden:'PROGRAMADA',cantidad_programada:2});
   let progRows=[{reserva:'QA-RES',partes:parts}],progSchedule=[],progOrderCoverage=coverage,progCoverage=[{reserva:'QA-RES',prioridad_semanal:'14.5',cantidad_cubierta:2}],progSelection=null,progWriteBusy=false,progWriteControls=[];
   let token='SYNTHETIC';window.alerts=[];window.calls=[];window.reloads=0;window.confirmAllowed=true;window.mode='success';window.writes=0;
   const alert=m=>window.alerts.push(m),confirm=()=>window.confirmAllowed,getAppToken=()=>token;
   const client={rpc:async(name,args)=>{
    window.calls.push({name,args});
    if(name==='sgp_mecanizado_disponibles'){const data=structuredClone(progRows);if(window.mode==='stale')data[0].partes[0].ordenes[0].produccion='CHANGED';return {data};}
    if(name==='sgp_mecanizado_cobertura_ordenes')return {data:structuredClone(coverage)};
    if(name!=='sgp_mecanizado_programar')throw Error('Unexpected RPC '+name);
    window.writes++;
    if(window.mode==='hold'&&window.writes===1)await new Promise(resolve=>window.releaseWrite=resolve);
    if(window.mode==='failure'&&window.writes===2)return {error:{code:'P0001',message:'Saldo cambió'}};
    if(window.mode==='timeout')throw Error('Network timeout');
    return {data:'qa-id-'+window.writes};
   }};
   const getSupabaseClient=async()=>client,loadProgramming=async()=>{window.reloads++};
   const openPartialProgramming=()=>{window.partialOpened=true};const currentAuth={rol:'COORDINADOR'};
   eval(source+'\\nwindow.openCase=()=>openProgModal("QA-RES",null,23);window.closeCase=closeProgModal;window.saveCase=saveProgramming;');
   window.reset=mode=>{window.mode=mode;window.calls=[];window.alerts=[];window.writes=0;window.confirmAllowed=true;window.openCase()};
   document.querySelector('#progSave').onclick=window.saveCase;document.querySelector('#progCancel').onclick=window.closeCase;document.querySelector('#progModalClose').onclick=window.closeCase;
   document.querySelectorAll('.view').forEach(el=>{el.hidden=true;el.classList.remove('active')});
   const view=document.querySelector('[data-view-panel="mecanizado"]');view.hidden=false;view.classList.add('active');
   window.openCase();
  }''',source)
  def select_all():page.locator('[data-parts-select-all]').click()
  def save():page.locator('#progSave').click()
  def wait_alert():page.wait_for_function('alerts.length > 0')
  assert page.locator('#progSave').is_disabled()
  assert page.locator('input[name=progPartChoice]:disabled').count()==3
  select_all();assert page.locator('input[name=progPartChoice]:checked').count()==3
  assert page.locator('#progQty').input_value()=='16'
  assert page.locator('#progQty').get_attribute('readonly') is not None
  page.locator('input[value="14.6"]+.part-radio-ui').click();assert page.locator('#progQty').input_value()=='13'
  page.locator('[data-parts-clear]').click();assert page.locator('#progSave').is_disabled()
  select_all();page.locator('#progDate').fill('2026-11-11');page.locator('#progShift').select_option('TURNO 2');page.locator('#progPriority').fill('10')
  page.screenshot(path=str(OUT/f'selection-{width}.png'))
  # Cancel confirmation performs no reads/writes, and preserves selection.
  page.evaluate('confirmAllowed=false');save();assert page.evaluate('calls.length')==0
  page.evaluate('confirmAllowed=true;mode="hold"');save();page.wait_for_function('typeof releaseWrite === "function"')
  assert page.locator('#progModal').get_attribute('aria-busy')=='true'
  assert page.locator('#progCancel').is_disabled();assert page.locator('#progDate').is_disabled()
  page.evaluate('window.saveCase();window.closeCase();window.openCase();')
  assert page.locator('#progModal').is_visible();assert page.evaluate('writes')==1
  page.evaluate('releaseWrite()');wait_alert();assert page.evaluate('writes')==3
  assert page.locator('#progModal').is_hidden()
  actual=page.evaluate('calls.filter(c=>c.name==="sgp_mecanizado_programar").map(c=>[c.args.p_prioridad_semanal,c.args.p_cantidad,c.args.p_prioridad,c.args.p_fecha,c.args.p_turno])')
  assert actual==[['14.1',8,10,'2026-11-11','TURNO 2'],['14.2',5,11,'2026-11-11','TURNO 2'],['14.6',3,12,'2026-11-11','TURNO 2']],actual
  # Mixed failure retains first part, names failed and never-attempted parts exactly.
  page.evaluate('reset("failure")');select_all();save();wait_alert()
  msg=page.evaluate('alerts[0]');assert 'confirmadas: 14.1.' in msg and 'No guardada: parte 14.2.' in msg and 'Sin intentar: 14.6.' in msg,msg
  assert page.evaluate('writes')==2
  # Unknown write outcome never claims failed or rolls back the completed work.
  page.evaluate('reset("timeout")');select_all();save();wait_alert()
  assert 'Resultado incierto: parte 14.1.' in page.evaluate('alerts[0]');assert page.evaluate('writes')==1
  # Fresh coverage preflight rejects stale composition before touching any record.
  page.evaluate('reset("stale")');select_all();save();wait_alert()
  assert page.evaluate('writes')==0;assert page.locator('#progModal').is_visible();assert not page.locator('#progSave').is_disabled()
  page.locator('#progCancel').click();page.evaluate('reset("success")');assert page.locator('input[name=progPartChoice]:checked').count()==0
  # Keyboard focus remains visible for hidden native checkbox and close/reopen resets selection.
  page.locator('input[name=progPartChoice]').first.focus();page.keyboard.press('Space');assert page.locator('#progQty').input_value()=='8'
  page.locator('#progModalClose').click();assert page.locator('#progModal').is_hidden()
  assert not errors,errors;assert not external,external
  results.append({'viewport':[width,height],'status':'PASS','checks':['multiple selection','select/clear eligible','partial/history excluded','common date/shift','per-part priority','double-click/close blocked','explicit partial result','timeout no retry','stale preflight','cancel/reopen','keyboard','no external backend']})
  page.close()
 browser.close()
(OUT/'results.json').write_text(json.dumps(results,indent=2));print(json.dumps(results,indent=2))
