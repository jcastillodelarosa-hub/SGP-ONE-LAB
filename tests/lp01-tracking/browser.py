"""Actual native login + LP SQL10 read RPC + B08–B11 UI; entirely synthetic/local.
Before images serve the real previous source; no production requests or write stubs.
"""
from pathlib import Path
import importlib.util,json,http.server,threading,subprocess,urllib.parse,hashlib
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];HERE=Path(__file__).parent;OUT=HERE/'evidence'
spec=importlib.util.spec_from_file_location('roles_fixture',ROOT/'tests/lp01-roles/postgres.py');f=importlib.util.module_from_spec(spec);spec.loader.exec_module(f)
BASE='35bb6ad4c13859f387a2deb8bd10137af53b9c97'
before={p:subprocess.check_output(['git','show',BASE+':'+p],cwd=ROOT) for p in ['src/modules/lp01-operation.js','src/modules/lp01-followup.css']}
class Files(http.server.SimpleHTTPRequestHandler):
 baseline=False
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT),**kw)
 def log_message(self,*a):pass
 def do_GET(self):
  path=urllib.parse.urlsplit(self.path).path.lstrip('/')
  if self.baseline and path in before:
   raw=before[path];self.send_response(200);self.send_header('Content-Type','text/css' if path.endswith('.css') else 'text/javascript');self.end_headers();self.wfile.write(raw)
  else:super().do_GET()
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Files);threading.Thread(target=server.serve_forever,daemon=True).start();origin=f'http://127.0.0.1:{server.server_port}'
db=f.Database();results=[];calls=[]
try:
 key,parts=f.setup(db)
 second='QA-SECOND|PANELES_2';db.seed(second,parts=(20,));unknown='QA-UNKNOWN|PANELES_2';db.seed(unknown,parts=(10,))
 db.sql("ALTER TABLE public.sgp_producciones ADD COLUMN semana_base integer,ADD COLUMN anio integer;UPDATE public.sgp_producciones SET semana_base=42,anio=2026,saldo_ensamble=20,saldo_empaque=12,produccion='QA TORRE NORTE' WHERE id_linea='PANELES_2';UPDATE public.sgp_producciones SET semana_base=43,saldo_ensamble=0,saldo_empaque=8,produccion='QA VILLA SUR' WHERE key_produccion="+f.lit(second)+";UPDATE public.sgp_producciones SET semana_base=44,presente_ultimo_export=false,produccion='QA SIN EXPORT VALIDADO' WHERE key_produccion="+f.lit(unknown))
 for stage in ['ENSAMBLE','EMPAQUE']:
  db.execute(db.cmd('ABRIR',stage=stage))
  db.execute(db.cmd('SALE',stage=stage,key=key,part=parts[0],quantity=8,observation='QA decisión explícita'))
  db.execute(db.cmd('EJECUTAR',stage=stage,key=key,part=parts[0],quantity=6,observation='QA avance del turno'))
  db.execute(db.cmd('AFECTAR',stage=stage,key=key,part=parts[0],affectations={'NC_AL':2,'NC_V':2,'TECNO':3,'NOVEDAD':1},observation='QA afectaciones superpuestas'))
  db.sql("UPDATE sgp_lp_operacion.ordenes SET origen_fecha='2026-10-20',origen_turno=1,antiguedad_fecha='2026-10-20',antiguedad_turno=1,consolidado=3 WHERE key="+f.lit(key)+" AND etapa="+f.lit(stage))
 audit=db.sql('SELECT count(*) FROM sgp_lp_operacion.auditoria');source=db.sql('SELECT jsonb_agg(to_jsonb(p) ORDER BY key_produccion) FROM public.sgp_producciones p');plan=db.sql('SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM public.sgp_linea_plan_asignaciones p')
 def read_rpc(name,a):
  if name=='sgp_sesion_actual':return json.loads(db.sql('SELECT public.sgp_sesion_actual('+f.lit(a['p_token'])+')'))
  if name=='sgp_mis_accesos':return json.loads(db.sql("SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM public.sgp_mis_accesos("+f.lit(a['p_token'])+') x'))
  if name=='sgp_lp_operacion_consultar':return db.rpc(name,a)
  raise ValueError('RPC outside this read-only test: '+name)
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,args=['--no-sandbox'])
  for width in [1440,390]:
   for stage in ['ENSAMBLE','EMPAQUE']:
    for baseline in [True,False]:
     Files.baseline=baseline;page=browser.new_page(viewport={'width':width,'height':950 if width>700 else 844});errors=[]
     page.on('pageerror',lambda e:errors.append(str(e)))
     page.add_init_script("sessionStorage.setItem('sgp_one_session','COORDINADOR')")
     def intercept(route):
      name=route.request.url.split('/rpc/')[-1];calls.append(name)
      try:answer=read_rpc(name,route.request.post_data_json);route.fulfill(status=200,content_type='application/json',body=json.dumps(answer))
      except Exception as e:route.fulfill(status=400,content_type='application/json',body=json.dumps({'code':'QA_READ_DENIED','message':str(e)}))
     page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(origin) else r.abort());page.route('**/rest/v1/rpc/*',intercept)
     page.goto(origin+'/');page.wait_for_function("document.querySelector('#authStatus').textContent.includes('COORDINADOR')")
     if page.locator('#mobileMenuToggle').is_visible():page.locator('#mobileMenuToggle').click()
     page.locator('.nav [data-view="ensamble"]').click();page.locator('#productionTrackingTab').click();page.wait_for_selector('[data-op-date]')
     page.locator('[data-op-stage]').select_option(stage);page.locator('[data-op-date]').fill('2026-11-01');page.locator('[data-op-date]').dispatch_event('change')
     page.wait_for_function("document.querySelector('[data-op-status]').textContent.includes('Turno ABIERTO') && document.querySelector('[data-order-part]')")
     page.evaluate("()=>{const b=document.createElement('p');b.textContent='QA · DATOS SINTÉTICOS · POSTGRESQL AISLADO · SIN ESCRITURAS DE LA VISTA';b.style.cssText='background:#fff2ca;padding:10px;color:#533b00;font-weight:bold';document.querySelector('#productionTrackingPanel').prepend(b)}")
     if baseline:
      page.locator('[data-order-part="'+parts[0]+'"] > summary').click()
      page.locator('#productionTrackingPanel').screenshot(path=str(OUT/f'before-{stage.lower()}-{width}.png'));page.close();continue
     page.wait_for_selector('.lp-tracking-table');page.locator('[data-tracking-status]').select_option('ABIERTA');assert page.locator('.lp-tracking-table tbody tr').count()==4;page.locator('[data-tracking-status]').select_option('');row=page.locator('tr').filter(has=page.locator('[data-order-part="'+parts[0]+'"]'))
     assert row.locator('td').nth(3).inner_text().strip()=='20';assert row.locator('td').nth(4).inner_text().strip()=='12'
     assert row.locator('td').nth(5).inner_text().strip()=='8';assert row.locator('td').nth(6).inner_text().strip()=='6'
     page.locator('[data-tracking-week]').select_option('2026-W42');assert page.locator('.lp-tracking-table tbody tr').count()==4
     page.locator('.lp-tracking-list').scroll_into_view_if_needed();page.screenshot(path=str(OUT/f'list-{stage.lower()}-{width}.png'))
     page.locator('[data-order-part="'+parts[0]+'"] > summary').click();drawer=page.locator('#lp-tracking-drawer');assert drawer.is_visible()
     assert drawer.locator('[data-tracking-content]').inner_text().count('20')==1
     page.locator('#productionTrackingPanel').screenshot(path=str(OUT/f'after-{stage.lower()}-{width}.png'))
     if width<700:
      assert page.locator('.lp-tracking-list').bounding_box()['x']+16>page.locator('#mobileMenuToggle').bounding_box()['width']
      page.screenshot(path=str(OUT/f'detail-{stage.lower()}-{width}.png'))
      assert drawer.evaluate('(e)=>e.contains(document.elementFromPoint(10,130))')
      box=drawer.bounding_box();assert box['x']==0 and box['width']<=width+1
      drawer.locator('button').last.focus();page.keyboard.press('Tab');assert drawer.locator('[data-tracking-close]').evaluate('(e)=>e===document.activeElement')
     else:assert drawer.bounding_box()['x']>page.locator('.lp-tracking-list').bounding_box()['x']
     drawer.locator('[data-tracking-tab="Novedades"]').click();assert 'no sumar' in drawer.inner_text().lower() or 'no se calcula' in drawer.inner_text().lower()
     drawer.locator('[data-tracking-tab="Historial"]').click();assert 'AFECTAR' in drawer.inner_text() and 'QA afectaciones' in drawer.inner_text()
     drawer.locator('[data-tracking-tab="Materiales"]').click();assert drawer.locator('button[disabled]').count()>=1
     if stage=='EMPAQUE':assert not drawer.locator('h5',has_text='Mecanizado').count()
     drawer.press('Escape');assert drawer.is_hidden();assert page.locator('[data-tracking-week]').input_value()=='2026-W42'
     # Scroll, selection and detail tab survive a real read refresh and round trip.
     page.locator('[data-order-part="'+parts[0]+'"] > summary').click();drawer.locator('[data-tracking-tab="Novedades"]').click()
     page.evaluate("()=>{const w=document.querySelector('.lp-tracking-table-wrap');w.scrollLeft=100;w.dispatchEvent(new Event('scroll'))}")
     drawer.locator('[data-live-operate]').click();assert page.locator('[data-order-form]').is_visible()
     page.locator('[data-back]').click();page.wait_for_selector('#lp-tracking-drawer:not([hidden])')
     assert page.locator('[data-tracking-week]').input_value()=='2026-W42'
     assert page.locator('[data-tracking-tab="Novedades"]').get_attribute('aria-pressed')=='true'
     if width>700:assert page.locator('.lp-tracking-table-wrap').evaluate('(e)=>e.scrollLeft')>0
     page.locator('#lp-tracking-drawer').press('Escape');page.locator('[data-tracking-week]').select_option('')
     if stage=='EMPAQUE':
      assert 'Ensamble completo' in page.locator('tr').filter(has_text='QA VILLA SUR').inner_text()
      assert 'Sin confirmar' in page.locator('tr').filter(has_text='QA SIN EXPORT').inner_text()
     page.locator('[data-search]').fill('VILLA');assert page.locator('.lp-tracking-table tbody tr').count()==1;page.locator('[data-search]').fill('')
     assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
     # Existing stage tabs retain their original operation cards/form.
     page.locator('#'+('productionAssemblyTab' if stage=='ENSAMBLE' else 'productionPackingTab')).click()
     page.wait_for_function("!document.querySelector('.lp-tracking-table') && [...document.querySelectorAll('[data-order-part]')].some(e=>e.getClientRects().length)")
     assert page.locator('[data-order-part]:visible').count()>0
     assert not errors,errors
     results.append({'stage':stage,'viewport':width,'native_session_sql10_reads':True,'independent_export_balances':True,'week_search_filters':True,'affectations_and_history':True,'mobile_dialog_or_pc_sidebar':True,'selection_filter_return_scroll':True,'existing_stage_cards_preserved':True,'write_calls':0})
     page.close()
  browser.close()
 assert audit==db.sql('SELECT count(*) FROM sgp_lp_operacion.auditoria')
 assert source==db.sql('SELECT jsonb_agg(to_jsonb(p) ORDER BY key_produccion) FROM public.sgp_producciones p')
 assert plan==db.sql('SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM public.sgp_linea_plan_asignaciones p')
 assert 'sgp_lp_operacion_comando' not in calls
 out={'status':'PASS','synthetic':True,'base_source':BASE,'results':results,'unchanged_audit_export_planning':True,'limits':['Local transport to actual PostgreSQL17.11 SQL10 and native session/access RPCs; synthetic identities and source data','No production requests, actual human acceptance or physical PDT release verified','PDF master and chat19 unavailable; references are the original B08–B11 embedded pages and approved DOCX']}
 (OUT/'browser.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
finally:db.close();server.shutdown()
