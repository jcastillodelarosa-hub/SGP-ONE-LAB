from pathlib import Path
import json,http.server,threading,uuid
from playwright.sync_api import sync_playwright
from fixture import setup,ROOT,f
HERE=Path(__file__).parent
class Files(http.server.SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT),**kw)
 def log_message(self,*a):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Files);threading.Thread(target=server.serve_forever,daemon=True).start();origin=f'http://127.0.0.1:{server.server_port}'
results=[];(HERE/'evidence').mkdir(exist_ok=True)
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(**({'executable_path':'/usr/bin/chromium'} if Path('/usr/bin/chromium').exists() else {}),args=['--no-sandbox'])
  for width in [1440,390]:
   x,_=setup();db=x.db
   try:
    db.sql("CREATE TABLE public.sgp_accesorios(id_accesorio text PRIMARY KEY,key_produccion text,codigo_sap text,descripcion text,cantidad numeric,unidad text);INSERT INTO public.sgp_accesorios VALUES('A1','QA|PANELES_2','ACC-1','Accesorio',20,'piezas');ALTER TABLE public.sgp_producciones ADD COLUMN IF NOT EXISTS porc_vidrio numeric;UPDATE public.sgp_producciones SET cantidad=3,porc_vidrio=50;UPDATE sgp_lp_operacion.turnos SET estado='CERRADO'")
    before=db.sql('SELECT jsonb_agg(to_jsonb(t)) FROM sgp_lp_operacion.turnos t')
    db.sql('GRANT EXECUTE ON FUNCTION public.sgp_lp_order_details_read_v1(text,text,text),public.sgp_lp_order_note_save_v1(text,text,text,jsonb) TO anon')
    page=browser.new_page(viewport={'width':width,'height':1000});page.set_default_timeout(12000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)));lost=[False];ids=[];calls=[]
    page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(origin) else r.abort())
    def rpc(route):
     name=route.request.url.split('/rpc/')[-1];a=route.request.post_data_json;calls.append(name)
     assert name in ['sgp_lp_afectaciones_consultar_v2','sgp_lp_order_details_read_v1','sgp_lp_order_note_save_v1','sgp_lp_shared_order_read_v1','sgp_lp_shared_order_command_v1','sgp_lp_shared_nc_lookup_v1']
     args=[]
     for k,v in a.items():
      assert k in ['p_token','p_key','p_stage','p_reference','p_cmd']
      args.append(k+'=>'+(f.lit(json.dumps(v))+'::jsonb' if isinstance(v,dict) else f.lit(v)))
     try:response={'data':json.loads(db.sql('SET ROLE anon;SELECT public.'+name+'('+','.join(args)+')'))}
     except Exception as e:response={'error':{'message':str(e).splitlines()[0],'code':'42883' if 'does not exist' in str(e) else 'P0001'}}
     if name=='sgp_lp_shared_order_command_v1':
      ids.append(a['p_cmd']['id'])
      if lost[0]:lost[0]=False;route.abort();return
     route.fulfill(status=200,content_type='application/json',body=json.dumps(response))
    page.route('**/rpc/*',rpc);url=origin+'/tests/lp01-shared-order/fixture.html';page.goto(url)
    page.wait_for_selector('[data-shared-form]');assert page.locator('[data-shared-form] button[type=submit]').is_disabled()
    assert 'Reportes anteriores' in page.locator('[data-shared-legacy]').inner_text()
    db.sql((ROOT/'docs/sql-proposals/lp01-shared-order/01_definition_REVIEW.sql').read_text());db.sql((ROOT/'docs/sql-proposals/lp01-shared-order/02_activate_REVIEW.sql').read_text())
    page.reload();page.wait_for_selector('[data-shared-form]');form=page.locator('[data-shared-form]');form.locator('[name=ncReference]').fill('NC-123');form.locator('[name=quantity]').fill('2');form.locator('[name=observation]').fill('Dos ventanas informadas por Ensamble');lost[0]=True;form.locator('button[type=submit]').click()
    page.wait_for_function("document.querySelector('[data-shared-status]')?.textContent.includes('Reintenta')")
    assert form.locator('[name=quantity]').is_disabled();form.locator('button[type=submit]').click();page.wait_for_function("document.querySelector('[data-shared-status]')?.textContent==='Guardado.'")
    assert ids[-1]==ids[-2]
    form=page.locator('[data-shared-form]');form.locator('[name=action]').select_option('LINK_NC');page.locator('[data-shared-search]').click();page.wait_for_function("document.querySelector('[data-shared-source]')?.textContent.includes('FINALIZADA')")
    form.locator('[name=observation]').fill('Cotejo explícito NC con esta orden');form.locator('[name=confirmLink]').check();form.locator('button[type=submit]').click();page.wait_for_function("document.querySelector('[data-shared-status]')?.textContent==='Guardado.'")
    page.locator('[data-order-note]').fill('Observación general compartida');page.locator('[data-order-note-save]').click();page.wait_for_function("document.querySelector('[data-order-note-status]')?.textContent.includes('guardada')")
    page.goto(url+'?stage=EMPAQUE&user=sp');page.wait_for_selector('[data-shared-report]');assert 'Vinculada por se' in page.locator('[data-shared-report]').inner_text();assert '0 confirmadas físicamente' in page.locator('[data-shared-report]').inner_text();assert page.locator('[data-order-note]').input_value()=='Observación general compartida'
    form=page.locator('[data-shared-form]');form.locator('[name=action]').select_option('CORRECT');form.locator('[name=quantity]').fill('3');form.locator('[name=observation]').fill('Corrección compartida desde Empaque');form.locator('button[type=submit]').click();page.wait_for_function("document.querySelector('[data-shared-status]')?.textContent==='Guardado.'")
    page.locator('[data-order-type=ACCESORIOS]').click();form=page.locator('[data-type-pane=ACCESORIOS] [data-shared-form]');form.locator('[name=sourceRef]').select_option('A1');form.locator('[name=quantity]').fill('1');form.locator('[name=observation]').fill('Una ventana, veinte piezas en fuente');form.locator('button[type=submit]').click();page.wait_for_function("document.querySelector('[data-type-pane=ACCESORIOS] [data-shared-status]')?.textContent==='Guardado.'")
    page.locator('[data-order-type=TECNO]').click();page.wait_for_function("document.querySelector('[data-type-pane=TECNO]')?.textContent.includes('Resultado exacto: 1.5')");assert 'redondeo hacia arriba' in page.locator('[data-type-pane=TECNO]').inner_text()
    page.goto(url);page.wait_for_selector('[data-shared-report]');assert '3 ventanas reportadas' in page.locator('[data-shared-report]').inner_text();assert page.locator('[data-order-type]').count()==5;assert page.locator('[data-affect-context]').count()==0
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1');page.screenshot(path=str(HERE/f'evidence/shared-{width}.png'),full_page=True)
    assert db.sql('SELECT jsonb_agg(to_jsonb(t)) FROM sgp_lp_operacion.turnos t')==before
    assert not errors,errors;results.append({'width':width,'status':'PASS','checks':['missing backend disables writes while legacy remains visible','closed-turn shared create and uncertain replay','explicit NC link, no physical credit','note and report persist across stage-specific leaders','accessory windows independent from pieces','Tecno ceiling 1.5 to 2','five tabs, no shift selector, reload and mobile no overflow']});page.close()
   finally:x.close()
  browser.close()
finally:server.shutdown()
(HERE/'browser-result.json').write_text(json.dumps(results,indent=2)+'\n');print(json.dumps(results))
