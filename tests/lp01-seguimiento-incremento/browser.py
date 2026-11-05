"""Native application and real SQL contracts. Local transport, synthetic DB, no external requests."""
from pathlib import Path
import importlib.util,json,http.server,threading,os
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];HERE=Path(__file__).parent
spec=importlib.util.spec_from_file_location('roles_fixture',ROOT/'tests/lp01-roles/postgres.py');f=importlib.util.module_from_spec(spec);spec.loader.exec_module(f)
class Files(http.server.SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT),**kw)
 def log_message(self,*a):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Files);threading.Thread(target=server.serve_forever,daemon=True).start();origin=f'http://127.0.0.1:{server.server_port}'
db=f.Database();results=[];calls=[]
try:
 key,parts=f.setup(db)
 for name,count in [('OLD',(5,)),('UNASSIGNED',()),('UNKNOWN',()),('ZERO-PENDING',(5,)),('ZERO-CLEAR',())]:db.seed(name+'|PANELES_2',parts=count,date='2025-01-01')
 db.sql("ALTER TABLE public.sgp_producciones ADD COLUMN semana_base integer,ADD COLUMN anio integer;UPDATE public.sgp_producciones SET semana_base=42,anio=2026,produccion=key_produccion;UPDATE public.sgp_producciones SET anio=2025,semana_base=1 WHERE key_produccion='OLD|PANELES_2';UPDATE public.sgp_producciones SET saldo_ensamble=0,saldo_empaque=0 WHERE key_produccion LIKE 'ZERO-%';UPDATE public.sgp_producciones SET presente_ultimo_export=false WHERE key_produccion='UNKNOWN|PANELES_2'")
 for stage in ['ENSAMBLE','EMPAQUE']:
  db.execute(db.cmd('ABRIR',stage=stage));db.execute(db.cmd('SALE',stage=stage,key=key,part=parts[0],quantity=8,observation='QA'))
 db.sql((ROOT/'docs/sql-proposals/lp01-seguimiento/INSTALL_REVIEW.sql').read_text());db.sql((ROOT/'docs/sql-proposals/lp01-seguimiento/ENABLE_API_REVIEW.sql').read_text())
 def snapshot():return [db.sql('SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),\'[]\') FROM '+t+' x') for t in ['public.sgp_producciones','public.sgp_linea_plan_asignaciones','sgp_lp_operacion.ordenes','sgp_lp_operacion.auditoria']]
 before=snapshot()
 def rpc(name,a):
  if name=='sgp_sesion_actual':return json.loads(db.sql('SELECT public.sgp_sesion_actual('+f.lit(a['p_token'])+')'))
  if name=='sgp_mis_accesos':return json.loads(db.sql("SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM public.sgp_mis_accesos("+f.lit(a['p_token'])+') x'))
  if name=='sgp_lp_operacion_consultar':return db.rpc(name,a)
  if name=='sgp_lp_seguimiento_consultar':return json.loads(db.sql('SET ROLE anon;SELECT public.sgp_lp_seguimiento_consultar('+','.join(f.lit(a[k]) for k in ['p_token','p_etapa','p_linea'])+')'))
  raise ValueError('QA_READ_DENIED '+name)
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,args=['--no-sandbox'])
  for width in json.loads(os.environ.get('SGP_QA_WIDTHS','[1440,390]')):
   for token in json.loads(os.environ.get('SGP_QA_ROLES','["COORDINADOR","QAADMIN","se","sp","ll"]')):
    page=browser.new_page(viewport={'width':width,'height':950 if width>700 else 844});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.add_init_script("sessionStorage.setItem('sgp_one_session',"+json.dumps(token)+")")
    def intercept(route):
     name=route.request.url.split('/rpc/')[-1];calls.append(name)
     try:route.fulfill(status=200,content_type='application/json',body=json.dumps(rpc(name,route.request.post_data_json)))
     except Exception as e:route.fulfill(status=400,content_type='application/json',body=json.dumps({'code':'QA_READ_DENIED','message':str(e)}))
    page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(origin) else r.abort());page.route('**/rest/v1/rpc/*',intercept)
    page.goto(origin+'/');page.wait_for_function("document.querySelector('#authStatus').textContent.includes('COORDINADOR')" if token=='COORDINADOR' else "!document.querySelector('#loginModal') || document.querySelector('#authStatus').textContent.length>3")
    if page.locator('#mobileMenuToggle').is_visible():page.locator('#mobileMenuToggle').click()
    page.locator('.nav [data-view="ensamble"]').click()
    if token in ['COORDINADOR','QAADMIN']:
     page.locator('#productionTrackingTab').click();page.wait_for_selector('.lp-tracking-table')
     for stage in ['ENSAMBLE','EMPAQUE']:
      page.locator('[data-tracking-stage="'+stage+'"]').click();page.wait_for_function("document.querySelector('[data-tracking-stage][aria-pressed=true]').dataset.trackingStage.includes("+json.dumps(stage)+") && !!document.querySelector('.lp-tracking-table')")
      rows=page.locator('.lp-tracking-table tbody tr');assert rows.count()==5,rows.all_inner_texts()
      zero=rows.filter(has_text='ZERO-PENDING');assert 'Pendiente de conciliación' in zero.inner_text();assert zero.locator('td').nth(3).inner_text()=='0'
      unknown=rows.filter(has_text='UNKNOWN');assert 'Pendiente de conciliación' in unknown.inner_text() and unknown.locator('td').nth(3).inner_text()=='Por confirmar'
      unassigned=rows.filter(has_text='UNASSIGNED');assert 'Sin asignación' in unassigned.inner_text();unassigned.locator('summary').click();drawer=page.locator('#lp-tracking-drawer');assert drawer.locator('[data-live-operate]').is_disabled();drawer.press('Escape')
      page.locator('[data-column-menu=week]:visible').click();page.locator('[data-menu-section=filter] > summary').click();page.locator('[data-column-none]').click();page.locator('[data-column-value]').first.check();page.locator('[data-column-apply]').click();assert rows.count()==1;page.locator('[data-columns-reset]').click()
      qa=rows.filter(has_text='QA|PANELES_2');qa.locator('summary').click();drawer=page.locator('#lp-tracking-drawer');assert drawer.locator('[data-live-operate]').is_disabled()
      options=drawer.locator('[data-tracking-context] option');value=options.nth(1).get_attribute('value');drawer.locator('[data-tracking-context]').select_option(value)
      assert drawer.locator('[data-live-operate]').is_enabled();
      if width<700:
       rect=drawer.locator('[data-tracking-context]').bounding_box();assert rect['x']+rect['width']<=width
      if token=='COORDINADOR':page.screenshot(path='/tmp/sgp-global-'+str(width)+'-'+stage+'.png')
      drawer.locator('[data-live-operate]').click();page.wait_for_selector('[data-order-form]');assert page.locator('[data-op-date]').input_value()=='2026-11-01'
      assert page.locator('[data-validate-save]').count()==(1 if token=='COORDINADOR' else 0)
      page.locator('[data-back]').click();page.wait_for_selector('#lp-tracking-drawer:not([hidden])');assert page.locator('[data-tracking-context]').input_value()==value;page.locator('#lp-tracking-drawer').press('Escape')
      assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
     results.append({'width':width,'role':token,'global_stages':True,'unknown_and_zero_pending':True,'unassigned_no_action':True,'exact_context_return':True})
    else:
     assert page.locator('#productionTrackingTab').is_hidden()
     page.evaluate("document.querySelector('#productionTrackingTab').click()")
     assert page.locator('#productionTrackingTab').get_attribute('aria-selected')!='true'
     page.locator('#productionPackingTab' if token=='sp' else '#productionAssemblyTab').click();page.locator('[data-op-date]').fill('2026-11-01');page.locator('[data-op-date]').dispatch_event('change');page.wait_for_selector('[data-order-part]:visible')
     page.locator('[data-order-part]').first.locator('summary').click();page.locator('[data-live-operate]').first.click();page.wait_for_selector('[data-order-form]');assert not page.locator('[data-validate-save]').count();page.locator('[data-back]').click();page.wait_for_selector('[data-order-part]:visible')
     results.append({'width':width,'role':token,'tracking_denied':True,'operation_return_preserved':True})
    assert not errors,errors
    page.close()
  browser.close()
 assert snapshot()==before;assert 'sgp_lp_operacion_comando' not in calls
 (HERE/('browser-result.json' if 'SGP_QA_WIDTHS' not in os.environ else 'browser-visual-result.json')).write_text(json.dumps({'status':'PASS','results':results,'source_assignment_operation_audit_unchanged':True,'transport':'local SET ROLE anon facade after separately enabled isolated grant; synthetic DB, no productive endpoints','screenshots_published':False},indent=2)+'\n');print(json.dumps(results))
finally:db.close();server.shutdown()
