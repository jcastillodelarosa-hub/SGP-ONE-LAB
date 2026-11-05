"""Existing SGP Seguimiento and Operation controllers against isolated native SQL."""
from pathlib import Path
import importlib.util,json,http.server,threading,uuid
from playwright.sync_api import sync_playwright
HERE=Path(__file__).parent;ROOT=HERE.parents[1]
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
    ctx={'id_programacion':'00000000-0000-0000-0000-000000000001','produccion':'QA ORDER','completa':False,'fecha_entrega':'2026-11-01','turno':'TURNO 1'}
    original=json.loads(db.sql('SET ROLE anon;SELECT public.sgp_pdt_registrar_v4('+','.join([f.lit('COORDINADOR'),f.lit('PICKING'),f.lit(json.dumps(ctx))+'::jsonb',f.lit(json.dumps(x.pieces()))+'::jsonb',f.lit(str(uuid.uuid4()))])+')'))['ids_pendientes'][0]
    db.sql('DELETE FROM sgp_lp_operacion.ordenes;DELETE FROM public.sgp_linea_plan_asignaciones')
    for user in ['COORDINADOR']:
     page=browser.new_page(viewport={'width':width,'height':950});page.clock.install();reads=[0];errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.add_init_script("sessionStorage.setItem('sgp_one_session',"+json.dumps(user)+")")
     page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(origin) else r.abort())
     def rpc(route):
      name=route.request.url.split('/rpc/')[-1];a=route.request.post_data_json
      try:
       if name=='sgp_sesion_actual':data=json.loads(db.sql('SELECT public.sgp_sesion_actual('+f.lit(a['p_token'])+')'))
       elif name=='sgp_mis_accesos':data=json.loads(db.sql("SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM public.sgp_mis_accesos("+f.lit(a['p_token'])+') x'))
       elif name=='sgp_lp_operacion_consultar':data=db.rpc(name,a)
       elif name=='sgp_lp_afectaciones_comando_v1':data=x.run(a['p_cmd'],user=a['p_token'],stage=a['p_stage'],date=a['p_date'],shift=a['p_shift'])
       elif name=='sgp_lp_afectaciones_aluminio_v1':data=x.atomic(a['p_cmd'],a['p_pieces'],user=a['p_token'],stage=a['p_stage'])
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
      page.locator('#productionTrackingTab').click();page.wait_for_selector('.lp-tracking-table');page.locator('.lp-tracking-table tbody summary').first.click();assert page.locator('[data-tracking-tab=Afectaciones]').get_attribute('aria-pressed')=='true';page.wait_for_selector('.lp-pdt-compact');assert page.locator('.lp-aluminum-pending').evaluate('(el,id)=>el.textContent.includes(id)',original)
      assert page.locator('[data-order-affectations] form').is_hidden()
      assert page.locator('[data-tracking-context] option').count()==1
      assert 'corregir esa dependencia está pendiente' in page.locator('[data-sale-context]').inner_text()
      page.locator('[data-register-affectation] summary').click();form=page.locator('[data-affect-context]');form.locator('[name=date]').fill('2026-11-01');form.locator('[name=shift]').select_option('2');form.locator('button').click()
      page.wait_for_function("document.querySelector('[data-context-status]').textContent.includes('No hay un turno')")
      assert page.locator('[data-order-affectations] form').is_hidden()
      form.locator('[name=shift]').select_option('1');form.locator('button').click()
      report=page.locator('[data-order-affectations] form');report.wait_for(state='visible')
      report.locator('[name=cause]').select_option('NOVEDAD');report.locator('[name=quantity]').fill('3');report.locator('[name=observation]').fill('QA sin asignación');report.locator('button[type=submit]').click()
      page.wait_for_function("document.querySelector('[data-result]').textContent==='Guardado'")
      assert x.read2('COORDINADOR')['reports'][0]['quantity']==3
      assert db.sql('SELECT count(*) FROM sgp_lp_operacion.ordenes')=='0'
      assert db.sql('SELECT count(*) FROM public.sgp_linea_plan_asignaciones')=='0'
      report=page.locator('[data-order-affectations] form');report.locator('[name=cause]').select_option('NC_AL');report.locator('[name=aluminumSource]').select_option('new')
      page.wait_for_selector('[data-pdt-draft] table')
      assert 'fabricación' in page.locator('[data-pdt-draft]').inner_text().lower()
      report.locator('[name=cause]').select_option('NOVEDAD');report.locator('[name=observation]').fill('Borrador que debe conservarse')
      page.evaluate("window.qaPanel=document.querySelector('[data-order-affectations] form')");prior_reads=reads[0]
      db.sql("UPDATE public.sgp_producciones SET saldo_ensamble=287 WHERE key_produccion="+f.lit(x.key));page.clock.fast_forward(20000)
      page.wait_for_timeout(200);assert reads[0]>prior_reads,'Expected actual quiet RPC';assert page.evaluate("window.qaPanel===document.querySelector('[data-order-affectations] form')");assert page.locator('[data-tracking-content] [name=observation]').input_value()=='Borrador que debe conservarse'
      page.screenshot(path=str(HERE/f'evidence/unassigned-{width}.png'),full_page=True)
      before=int(db.sql('SELECT count(*) FROM public.sgp_aluminio_pendientes'))
      command=x.command('CREATE',2,user='COORDINADOR',cause='NC_AL');pieces=[{**p,'nc':''} for p in x.pieces('COORDINADOR')]
      saved=x.atomic(command,pieces,user='COORDINADOR');assert x.atomic(command,pieces,user='COORDINADOR')['duplicate']
      assert int(db.sql('SELECT count(*) FROM public.sgp_aluminio_pendientes'))==before+1
      assert db.sql('SELECT count(*) FROM sgp_lp_operacion.ordenes')=='0'
      assert db.sql('SELECT count(*) FROM public.sgp_linea_plan_asignaciones')=='0'
      db.sql("UPDATE public.sgp_usuario_accesos SET permitido=false WHERE id_usuario=(SELECT id_usuario FROM public.sgp_usuarios WHERE usuario='COORDINADOR')")
      page.clock.fast_forward(20000);page.wait_for_function("!document.querySelector('.lp-aluminum-pending')")
     else:
      assert page.locator('#productionTrackingTab').is_hidden();page.locator('#productionAssemblyTab').click();page.locator('[data-op-date]').fill('2026-11-01');page.locator('[data-op-date]').dispatch_event('change');page.wait_for_selector('[data-order-part]:visible')
      page.locator('[data-live-orders] [data-live-operate]').first.click();page.wait_for_selector('[data-order-form]')
      page.locator('[data-individual-affects] > summary').click();page.wait_for_selector('.lp-pdt-compact');assert page.locator('.lp-aluminum-pending').evaluate('(el,id)=>el.textContent.includes(id)',original)
      assert page.locator('[data-affect-save]').is_disabled()
      page.screenshot(path=str(HERE/f'evidence/app-operation-{width}.png'),full_page=True)
     assert not errors,errors;results.append({'width':width,'role':user,'originalPickingVisible':True,'unassignedReportSaved':True,'atomicPdtWithoutNC':True,'retryNoDuplicate':True,'assignmentsCreated':0,'closedTurnDenied':True,'draft20sPreserved':True,'existingController':True,'externalRequests':0});page.close()
   finally:x.close()
  browser.close()
 (HERE/'unassigned-app-result.json').write_text(json.dumps(results,indent=2)+'\n');print(json.dumps(results))
finally:server.shutdown()
