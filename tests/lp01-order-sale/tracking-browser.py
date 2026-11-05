"""Full application controller + actual native RPC in isolated PostgreSQL; explicit test-only flag."""
from pathlib import Path
import sys,json,http.server,threading,uuid
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];HERE=Path(__file__).parent;sys.path.insert(0,str(ROOT/'tests/lp01-afectaciones-rpc'));import atomic as f
class Files(http.server.SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT),**kw)
 def log_message(self,*a):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Files);threading.Thread(target=server.serve_forever,daemon=True).start();origin=f'http://127.0.0.1:{server.server_port}'
results=[]
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for width in [1440,390]:
   x=f.Fixture()
   try:
    db=x.db
    for stage in ['ENSAMBLE','EMPAQUE']:db.execute(db.cmd('SALE',stage=stage,key=x.key,part=x.parts[0],quantity=5,observation='QA existing SALE'))
    if width==390:db.sql('DELETE FROM sgp_lp_operacion.ordenes;DELETE FROM public.sgp_linea_plan_asignaciones')
    def existing():return db.sql("SELECT jsonb_build_object('orders',(SELECT jsonb_agg(to_jsonb(o) ORDER BY to_jsonb(o)::text) FROM sgp_lp_operacion.ordenes o),'audit',(SELECT jsonb_agg(to_jsonb(o) ORDER BY to_jsonb(o)::text) FROM sgp_lp_operacion.auditoria o),'assignments',(SELECT jsonb_agg(to_jsonb(o) ORDER BY to_jsonb(o)::text) FROM public.sgp_linea_plan_asignaciones o))")
    before=existing()
    db.sql((ROOT/'docs/sql-proposals/lp01-afectaciones/13_all_origins_read_REVIEW.sql').read_text());db.sql((ROOT/'docs/sql-proposals/lp01-order-sale/01_definition_REVIEW.sql').read_text())
    db.sql('GRANT EXECUTE ON FUNCTION public.sgp_lp_seguimiento_consultar(text,text,text),public.sgp_lp_sale_orden_consultar_v1(text,text,text),public.sgp_lp_sale_orden_definir_v1(text,text,text,jsonb) TO anon;UPDATE sgp_lp_sale_orden.config SET definitions_enabled=true;UPDATE sgp_lp_afectaciones.config SET writes=true')
    legacy=json.loads(db.sql("SET ROLE anon;SELECT public.sgp_lp_afectaciones_legado_v1('COORDINADOR','QA|PANELES_2','ENSAMBLE')"))
    db.sql("SET ROLE anon;SELECT public.sgp_lp_afectaciones_conciliar_v1('COORDINADOR','QA|PANELES_2','ENSAMBLE',"+f.lit(str(uuid.uuid4()))+","+f.lit(legacy['fingerprint'])+","+str(legacy['revision'])+",'[]'::jsonb,'QA reconciliation')")
    x.run(x.command('VALIDATE',0,user='COORDINADOR'),user='COORDINADOR')
    page=browser.new_page(viewport={'width':width,'height':950});page.clock.install();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.add_init_script("sessionStorage.setItem('sgp_one_session','COORDINADOR')");calls=[];lost=[False];ids=[]
    page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(origin) else r.abort())
    def rpc(route):
     name=route.request.url.split('/rpc/')[-1];a=route.request.post_data_json;calls.append(name)
     try:
      if name=='sgp_sesion_actual':data=json.loads(db.sql('SELECT public.sgp_sesion_actual('+f.lit(a['p_token'])+')'))
      elif name=='sgp_mis_accesos':data=json.loads(db.sql("SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM public.sgp_mis_accesos("+f.lit(a['p_token'])+') x'))
      elif name=='sgp_lp_operacion_consultar':data=db.rpc(name,a)
      elif name=='sgp_lp_seguimiento_consultar':data=json.loads(db.sql('SET ROLE anon;SELECT public.'+name+'('+','.join(f.lit(a[k]) for k in ['p_token','p_etapa','p_linea'])+')'))
      elif name=='sgp_lp_afectaciones_consultar_v2':data=x.read2(a['p_token'],a['p_stage'])
      elif name in ['sgp_lp_sale_orden_consultar_v1','sgp_lp_sale_orden_definir_v1']:
       args=[f.lit(a[k]) for k in ['p_token','p_key','p_stage']]
       if 'p_cmd' in a:args.append(f.lit(json.dumps(a['p_cmd']))+'::jsonb');ids.append(a['p_cmd']['id'])
       data=json.loads(db.sql('SET ROLE anon;SELECT public.'+name+'('+','.join(args)+')'))
      else:raise ValueError('QA RPC unavailable '+name)
      if 'p_cmd' in a and lost[0]:lost[0]=False;route.abort();return
      route.fulfill(content_type='application/json',body=json.dumps(data))
     except Exception as e:route.fulfill(status=400,content_type='application/json',body=json.dumps({'code':'P0001','message':str(e)}))
    page.route('**/rest/v1/rpc/*',rpc)
    def open_tracking():
     page.goto(origin+'/');page.wait_for_function("document.querySelector('#authStatus').textContent.length>3")
     if page.locator('#mobileMenuToggle').is_visible():page.locator('#mobileMenuToggle').click()
     page.locator('.nav [data-view="ensamble"]').click();page.locator('#productionTrackingTab').click();page.wait_for_selector('.lp-tracking-table')
     page.get_by_role('button',name='Consultar o definir SALE por orden').first.click();page.wait_for_selector('.lp-sale-row [name=quantity]')
    open_tracking();page.locator('.lp-tracking-table tbody summary').first.click();assert 'SALE se consulta por orden' in page.locator('[data-sale-context]').inner_text();assert 'edición actual aún exige' not in page.locator('#lp-tracking-drawer').inner_text();assert page.locator('[data-live-operate]').inner_text()=='Avance · requiere asignación';page.locator('[data-tracking-close]').click();cell=page.locator('.lp-sale-row').first
    cell.locator('[name=quantity]').fill('8');cell.locator('[name=observation]').fill('Definición conservada');cell.locator('[name=observation]').focus()
    page.evaluate("window.qaInput=document.querySelector('.lp-sale-row [name=observation]');qaInput.setSelectionRange(4,9)")
    for balance in [287,288]:
     prev=calls.count('sgp_lp_seguimiento_consultar');db.sql('UPDATE public.sgp_producciones SET saldo_ensamble='+str(balance)+' WHERE key_produccion='+f.lit(x.key));page.clock.fast_forward(20000)
     page.wait_for_function('window.qaInput===document.querySelector(".lp-sale-row [name=observation]")')
     page.wait_for_timeout(300);assert calls.count('sgp_lp_seguimiento_consultar')>prev
     assert cell.locator('[name=observation]').input_value()=='Definición conservada';assert page.evaluate('document.activeElement===qaInput&&qaInput.selectionStart===4&&qaInput.selectionEnd===9')
    page.locator('[data-tracking-status]').select_option('PENDIENTE_CONCILIACION');assert not page.evaluate('document.querySelector(".lp-tracking-table").contains(qaInput)')
    page.locator('[data-tracking-status]').select_option('');assert cell.locator('[name=quantity]').input_value()=='8'
    page.locator('.lp-tracking-table tbody summary').first.click();page.locator('[data-tracking-close]').click();assert cell.locator('[name=observation]').input_value()=='Definición conservada'
    cell.get_by_role('button',name='Guardar definición',exact=True).click();page.wait_for_function("document.querySelector('[data-sale-message]').textContent.includes('Definición guardada.')")
    open_tracking();cell=page.locator('.lp-sale-row').first;assert cell.locator('[name=quantity]').input_value()=='8'
    cell.locator('[name=quantity]').fill('10');cell.locator('[name=observation]').fill('Segundo valor');lost[0]=True;cell.get_by_role('button',name='Guardar definición',exact=True).click();page.wait_for_function("document.querySelector('[data-sale-message]').textContent.includes('Resultado sin confirmar')")
    page.locator('[data-tracking-status]').select_option('PENDIENTE_CONCILIACION');page.locator('[data-tracking-status]').select_option('');cell.get_by_role('button',name='Reintentar mismo guardado').click();page.wait_for_function("document.querySelector('[data-sale-message]').textContent.includes('Definición guardada.')")
    assert ids[-1]==ids[-2] and db.sql('SELECT count(*) FROM sgp_lp_sale_orden.eventos')=='2';assert existing()==before
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    (HERE/'evidence').mkdir(exist_ok=True);page.screenshot(path=str(HERE/f'evidence/tracking-{width}.png'),full_page=True)
    db.sql("UPDATE public.sgp_usuario_accesos SET permitido=false WHERE id_usuario=(SELECT id_usuario FROM public.sgp_usuarios WHERE usuario='COORDINADOR')");page.clock.fast_forward(20000);page.wait_for_function("!document.querySelector('.lp-sale-row')")
    assert not errors,errors
    results.append({'width':width,'status':'PASS','fullApplication':True,'nativeSql':True,'unassigned':width==390,'quietRefreshFocusAndSelection':True,'filterAndDrawerPreserveDraft':True,'reloadPersistence':True,'uncertainRetryAcrossFilterSameId':True,'originalOperationUnchanged':True,'revocationClears':True});page.close()
   finally:x.close()
  browser.close()
 (HERE/'tracking-result.json').write_text(json.dumps(results,indent=2)+'\n');print(json.dumps(results))
finally:server.shutdown()
