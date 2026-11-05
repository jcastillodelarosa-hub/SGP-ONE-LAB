from pathlib import Path
import importlib.util,json,http.server,threading
from playwright.sync_api import sync_playwright
HERE=Path(__file__).parent;ROOT=HERE.parents[1]
spec=importlib.util.spec_from_file_location('affect_fixture',HERE/'postgres.py');f=importlib.util.module_from_spec(spec);spec.loader.exec_module(f)
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
    x.db.sql("UPDATE sgp_lp_afectaciones.config SET writes=true,physical=true;INSERT INTO sgp_lp_afectaciones.conciliacion SELECT key_produccion,e,sgp_lp_afectaciones.firma_legado(key_produccion,e),'QA synthetic reconciliation' FROM public.sgp_producciones CROSS JOIN unnest(ARRAY['ENSAMBLE','EMPAQUE']) e")
    page=browser.new_page(viewport={'width':width,'height':950});errors=[];calls=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(origin) else r.abort())
    def rpc(route):
     name=route.request.url.split('/rpc/')[-1];a=route.request.post_data_json;calls.append((name,a))
     try:
      if name=='sgp_lp_afectaciones_consultar_v1':data=x.read(a['p_token'],a['p_stage'])
      elif name=='sgp_lp_afectaciones_comando_v1':data=x.run(a['p_cmd'],user=a['p_token'],stage=a['p_stage'],date=a['p_date'],shift=a['p_shift'])
      elif name=='sgp_pdt_registro_fuentes_v4':
       assert a['p_token']=='ll' and a['p_origen']=='ENSAMBLE' and a['p_contexto']['key_produccion']==x.key
       data={'ok':True,'contract_version':4,'fuentes':[{'id_pieza':'qa-piece','key_produccion':x.key,'produccion':'TORRE NORTE','reserva':'R1','reserva_principal':'R1','codigo_sap':'AL-1','fabricacion':'FAB-70','longitud':70,'acabado':'BLANCO','tipo_pieza':'PANEL','id_linea':'PANELES_2','cantidad_referencia':10}]}
      else:raise ValueError('Unexpected RPC '+name)
      result={'data':data,'error':None}
     except Exception as e:result={'data':None,'error':{'message':str(e)}}
     route.fulfill(status=200,content_type='application/json',body=json.dumps(result))
    page.route('**/rpc/*',rpc);page.goto(origin+'/tests/lp01-afectaciones-rpc/fixture.html')
    page.locator('[name=cause]').select_option('NC_AL');page.wait_for_selector('[data-ref]');page.locator('[data-ref]').select_option('AL-1');page.locator('[data-source-radio]').check()
    assert 'FAB-70' in page.locator('[data-preview]').inner_text() and '70 in' in page.locator('[data-preview]').inner_text()
    assert page.get_by_role('button',name='Guardar',exact=True).is_disabled();assert len(x.read()['reports'])==0
    page.locator('[name=cause]').select_option('NOVEDAD')
    def submit(action,n,obs):
     page.locator('[name=action]').select_option(action);page.locator('[name=quantity]').fill(str(n));page.locator('[name=observation]').fill(obs);page.get_by_role('button',name='Guardar',exact=True).click();page.wait_for_function("document.querySelector('[data-result]').textContent && document.querySelector('[data-result]').textContent!=='Guardando…'");assert page.locator('[data-result]').inner_text()=='Guardado',page.locator('#panel').inner_text()
    submit('CREATE',5,'Novedad real en DB aislada');submit('SOLVE',3,'Solución parcial');submit('CONFIRM',2,'Recepción física dos ventanas')
    assert x.read()['reports'][0]['confirmed']==2 and x.read()['available'] is None
    page.evaluate("qaToken='COORDINADOR';mount()");page.wait_for_selector('[name=action] option[value=VALIDATE]',state='attached')
    submit('VALIDATE',3,'Unión de tres ventanas distintas');assert x.read()['available']==285
    page.get_by_text('Historial autorizado de la producción · contexto ENSAMBLE',exact=True).click()
    assert page.locator('details article').count()==4
    assert 'No disponible' in page.locator('.lp-affect-progress').inner_text()
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    (HERE/'evidence').mkdir(exist_ok=True);page.screenshot(path=str(HERE/f'evidence/rpc-{width}.png'),full_page=True)
    x.db.sql("UPDATE public.sgp_usuario_accesos SET permitido=false WHERE id_usuario=(SELECT id_usuario FROM public.sgp_usuarios WHERE usuario='COORDINADOR')")
    page.get_by_role('button',name='Actualizar datos').click();page.wait_for_function("document.querySelector('#panel').textContent.includes('Acceso revocado')")
    assert not errors,errors
    assert not any(n=='sgp_pdt_registrar_v4' for n,_ in calls)
    results.append({'width':width,'status':'PASS','flow':'real SQL read/create/solve/confirm/validate/history/revoke','PDT':'shared Picking editor, synthetic source-reader response, origin ENSAMBLE; save blocked; no PDT write'})
    page.close()
   finally:x.close()
  browser.close()
 (HERE/'browser-result.json').write_text(json.dumps(results,indent=2)+'\n');print(json.dumps(results))
finally:server.shutdown()
