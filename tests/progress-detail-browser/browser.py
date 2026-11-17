"""Isolated real detail renderer, production CSS, synthetic rows; no backend."""
from pathlib import Path
import json, mimetypes, os, re
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
OUT=Path(os.environ.get('DETAIL_QA_OUT','/tmp/progress-detail-qa')); OUT.mkdir(parents=True,exist_ok=True)
ORIGIN='http://detail.test/'
css=re.search(r'style.textContent=`(.*?)`;', (ROOT/'programacion-subtabs-v350.js').read_text(),re.S).group(1)
html='<html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/styles.css"><style>body{margin:0;padding:16px;background:white;color:#17334d}main{max-width:1300px;margin:auto;min-width:0}'+css+'</style><main><h2>Mecanizado · Programación</h2><p>Validación aislada · Datos ficticios</p><div id="detail"></div></main></html>'
setup='''async()=>{ const {progressDetailMarkup,bindProgressDetail}=await import('/src/modules/mecanizado-progress-detail.js');
window.calls=0;window.fail=false;window.qaClosed=false;window.canManage=true;window.filter='pending';
window.details=['CORTE','MECANIZADO','PROCESADO'].map((state,i)=>({system:'SISTEMA DEMO',production:'ORDEN DEMO '+i,reserve:'RES-DEMO-'+i,programmed:12,processed:state==='PROCESADO'?12:0,pending:state==='PROCESADO'?0:12,unassigned:0,warnings:[],editable:true,assignments:[{id_programacion:'PLAN-DEMO-'+i,produccion:'ORDEN DEMO '+i,reserva:'RES-DEMO-'+i,part:'PARTE '+(i+1),quantity:12,processed:state==='PROCESADO'?12:0,date:'2026-11-17',shift:'TURNO 1',state,editable:true}]}));
window.render=()=>{document.querySelector('#detail').innerHTML=progressDetailMarkup(details,'SISTEMA DEMO',{canManage,filter});bindProgressDetail(document.querySelector('#detail'),{save:async p=>{calls++;await new Promise(r=>setTimeout(r,80));if(fail)throw Error('Fallo simulado');const d=details.find(d=>d.production===p.production);d.assignments[0].state=p.state;d.assignments[0].processed=p.state==='PROCESADO'?12:0;d.processed=d.assignments[0].processed;d.pending=12-d.processed;},onSaved:async()=>render(),onFilter:f=>{filter=f;render()},onClose:()=>{qaClosed=true;document.querySelector('#detail').innerHTML=''}})};render();}'''
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('DETAIL_CHROMIUM','/usr/bin/chromium'),args=['--no-sandbox'])
 results=[]
 for width,height in [(1440,900),(390,844),(320,568)]:
  page=browser.new_page(viewport={'width':width,'height':height}); errors=[]; external=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  def route(r):
   if not r.request.url.startswith(ORIGIN) or r.request.method!='GET': external.append(r.request.url);r.abort();return
   name=r.request.url[len(ORIGIN):].split('?')[0];path=ROOT/name
   if not name:r.fulfill(content_type='text/html',body=html)
   elif path.is_file():r.fulfill(content_type=mimetypes.guess_type(name)[0] or 'text/plain',body=path.read_bytes())
   else:r.fulfill(status=404,body='Not found')
  page.route('**/*',route);page.goto(ORIGIN);page.evaluate(setup)
  assert page.locator('[data-progress-save]').count()==2
  page.locator('[data-progress-filter="all"]').click();assert page.locator('[data-progress-save]').count()==3
  page.screenshot(path=str(OUT/f'detail-{width}.png'),full_page=True)
  if width<500:
   page.locator('.sgp-progress-scroll').evaluate('(el)=>el.scrollLeft=el.scrollWidth')
   page.screenshot(path=str(OUT/f'detail-states-{width}.png'),full_page=True)
  assert page.evaluate('document.documentElement.scrollWidth <= innerWidth+1'), 'Document overflow'
  page.locator('[data-progress-state]').first.select_option('PROCESADO'); assert page.evaluate('calls')==0
  assert page.locator('[data-progress-state]').nth(1).is_disabled()
  assert page.locator('[data-progress-filter="pending"]').is_disabled()
  assert page.locator('[data-progress-close]').is_disabled()
  page.locator('[data-progress-cancel]').first.click();assert page.evaluate('calls')==0
  assert page.locator('[data-progress-filter="pending"]').is_enabled()
  assert page.locator('[data-progress-close]').is_enabled()
  page.locator('[data-progress-state]').first.select_option('PROCESADO')
  page.locator('[data-progress-save]').first.click(); page.wait_for_function('calls===1 && document.querySelector("[data-progress-state]").value==="PROCESADO" && !document.querySelector("[data-progress-state]").disabled')
  page.evaluate('fail=true');page.locator('[data-progress-state]').first.select_option('CORTE');page.locator('[data-progress-save]').first.click();page.get_by_text('Fallo simulado',exact=True).wait_for()
  page.evaluate('fail=false');page.locator('[data-progress-save]').first.click();page.wait_for_function('calls===3 && !document.querySelector("[data-progress-state]").disabled')
  page.evaluate('canManage=false;render()');assert page.locator('[data-progress-save]').count()==0
  page.locator('[data-progress-close]').click();assert page.evaluate('qaClosed && calls===3')
  assert not errors,errors;assert not external,external
  results.append({'width':width,'passed':True,'backendRequests':0,'simulatedSaves':3});page.close()
 browser.close();(OUT/'results.json').write_text(json.dumps(results,indent=2));print(json.dumps(results))
