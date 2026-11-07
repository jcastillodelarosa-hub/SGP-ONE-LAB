"""Seguimiento and the current Ensamble workspace against isolated native SQL."""
from pathlib import Path
import importlib.util,json,http.server,threading,uuid
from playwright.sync_api import sync_playwright
HERE=Path(__file__).parent;ROOT=HERE.parents[1]
shared_spec=importlib.util.spec_from_file_location('shared_test_helpers',ROOT/'tests/lp01-shared-order/testing.py');shared=importlib.util.module_from_spec(shared_spec);shared_spec.loader.exec_module(shared)
spec=importlib.util.spec_from_file_location('atomic_app_fixture',HERE/'atomic.py');f=importlib.util.module_from_spec(spec);spec.loader.exec_module(f)
class Files(http.server.SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT),**kw)
 def log_message(self,*a):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Files);threading.Thread(target=server.serve_forever,daemon=True).start();origin=f'http://127.0.0.1:{server.server_port}'
results=[]
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,args=['--no-sandbox'])
  for width in [1440,390]:
   x=f.Fixture()
   try:
    db=x.db;db.sql('GRANT EXECUTE ON FUNCTION public.sgp_lp_seguimiento_consultar(text,text,text) TO anon;UPDATE sgp_lp_afectaciones.config SET writes=true,physical=true,atomic_pdt=true,pdt_links=true')
    shared.install(db)
    ctx={'id_programacion':'00000000-0000-0000-0000-000000000001','produccion':'QA ORDER','completa':False,'fecha_entrega':'2026-11-01','turno':'TURNO 1'}
    original=json.loads(db.sql('SET ROLE anon;SELECT public.sgp_pdt_registrar_v4('+','.join([f.lit('COORDINADOR'),f.lit('PICKING'),f.lit(json.dumps(ctx))+'::jsonb',f.lit(json.dumps(x.pieces()))+'::jsonb',f.lit(str(uuid.uuid4()))])+')'))['ids_pendientes'][0]
    for user in ['COORDINADOR','ll']:
     page=browser.new_page(viewport={'width':width,'height':950});page.clock.install();reads=[0];errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.add_init_script("sessionStorage.setItem('sgp_one_session',"+json.dumps(user)+")")
     page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(origin) else r.abort())
     def rpc(route):
      name=route.request.url.split('/rpc/')[-1];a=route.request.post_data_json
      try:
       if name in shared.RPCS:data=shared.rpc(db,name,a)
       elif name=='sgp_sesion_actual':data=json.loads(db.sql('SELECT public.sgp_sesion_actual('+f.lit(a['p_token'])+')'))
       elif name=='sgp_mis_accesos':data=json.loads(db.sql("SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM public.sgp_mis_accesos("+f.lit(a['p_token'])+') x'))
       elif name=='sgp_lp_operacion_consultar':data=db.rpc(name,a)
       elif name=='sgp_lp_seguimiento_consultar':reads[0]+=1;data=json.loads(db.sql('SET ROLE anon;SELECT public.sgp_lp_seguimiento_consultar('+','.join(f.lit(a[k]) for k in ['p_token','p_etapa','p_linea'])+')'))
       elif name=='sgp_lp_afectaciones_consultar_v2':data=x.read2(a['p_token'],a['p_stage'])
       elif name=='sgp_pdt_registro_fuentes_v4':data=json.loads(db.sql('SET ROLE anon;SELECT public.sgp_pdt_registro_fuentes_v4('+','.join([f.lit(a['p_token']),f.lit(a['p_origen']),f.lit(json.dumps(a['p_contexto']))+'::jsonb'])+')'))
       else:raise ValueError('QA RPC not enabled '+name)
       route.fulfill(status=200,content_type='application/json',body=json.dumps(data))
      except Exception as e:route.fulfill(status=400,content_type='application/json',body=json.dumps({'code':'QA_ERROR','message':str(e)}))
     page.route('**/rest/v1/rpc/*',rpc);page.goto(origin+'/');page.wait_for_function("document.querySelector('#authStatus').textContent.length>3")
     if page.locator('#mobileMenuToggle').is_visible():page.locator('#mobileMenuToggle').click()
     page.locator('.nav [data-view="ensamble"]').click()
     if user=='COORDINADOR':
      page.locator('#productionTrackingTab').click();
      page.wait_for_selector('.lp-tracking-table');page.locator('.lp-tracking-table tbody summary').first.click();page.locator('[data-tracking-tab=Afectaciones]').click();page.wait_for_selector('.lp-pdt-compact');assert any(r['id']==original for r in (x.read2(user).get('aluminumPending') or x.read2(user)['pickingPending'])['rows']);assert page.locator('.lp-aluminum-pending').is_visible()
      assert page.locator('[data-affect-content=NC_AL] form button[type=submit]').is_enabled();assert page.locator('[data-affect-context]').count()==0
      page.locator('[data-order-type=NOVEDAD]').click();page.wait_for_selector('[data-affect-content=NOVEDAD] form:visible')
      page.locator('[data-order-type=NOVEDAD]').click();page.locator('[data-type-pane=NOVEDAD] [name=observation]').fill('Borrador que debe conservarse')
      page.evaluate("window.qaPanel=document.querySelector('[data-affect-content=NOVEDAD] form')");prior_reads=reads[0]
      db.sql("UPDATE public.sgp_producciones SET saldo_ensamble=287 WHERE key_produccion="+f.lit(x.key));page.clock.fast_forward(20000)
      page.wait_for_timeout(200);assert reads[0]>prior_reads,'Expected actual quiet RPC';assert page.evaluate("window.qaPanel===document.querySelector('[data-affect-content=NOVEDAD] form')");assert page.locator('[data-type-pane=NOVEDAD] [name=observation]').input_value()=='Borrador que debe conservarse'
      page.screenshot(path=str(HERE/f'evidence/app-tracking-{width}.png'),full_page=True)
      db.sql("UPDATE public.sgp_usuario_accesos SET permitido=false WHERE id_usuario=(SELECT id_usuario FROM public.sgp_usuarios WHERE usuario='COORDINADOR')")
      page.clock.fast_forward(20000);page.wait_for_function("!document.querySelector('.lp-aluminum-pending')")
     else:
      assert page.locator('#productionTrackingTab').is_hidden();page.locator('#productionAssemblyTab').click();page.locator('[data-op-date]').fill('2026-11-01');page.locator('[data-op-date]').dispatch_event('change');page.wait_for_selector('[data-assembly-key]:visible')
      assert page.locator('[data-live-orders] [data-assembly-key]').count()==1
      assert page.locator('[data-live-orders] [data-assembly-key]').first.get_attribute('data-assembly-key')==x.key
      page.locator('[data-live-orders] [data-assembly-detail]').first.click();page.wait_for_selector('section[data-assembly-detail]')
      page.wait_for_selector('.lp-pdt-compact');assert any(r['id']==original for r in (x.read2(user).get('aluminumPending') or x.read2(user)['pickingPending'])['rows']);assert page.locator('.lp-aluminum-pending').is_visible()
      assert page.locator('[data-executed],[data-order-form],[data-affect-save],[data-open],[data-bi-file],[data-close]').count()==0
      assert page.locator('[data-affect-content=NC_AL] [data-shared-form] button[type=submit]').is_enabled()
      assert page.locator('[data-affect-context]').count()==0
      page.screenshot(path=str(HERE/f'evidence/app-operation-{width}.png'),full_page=True)
     assert not errors,errors;results.append({'width':width,'role':user,'originalPickingVisible':True,'existingController':True,'externalRequests':0});page.close()
   finally:x.close()
  browser.close()
 (HERE/'native-app-result.json').write_text(json.dumps(results,indent=2)+'\n');print(json.dumps(results))
finally:server.shutdown()
