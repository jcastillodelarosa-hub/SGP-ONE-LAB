"""Actual Seguimiento controller and RPC SQL, synthetic local PostgreSQL only."""
from pathlib import Path
import json,sys,http.server,threading,uuid
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];HERE=Path(__file__).parent;sys.path.insert(0,str(ROOT/'tests/lp01-afectaciones-rpc'));import atomic as f
class Files(http.server.SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT),**kw)
 def log_message(self,*a):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Files);threading.Thread(target=server.serve_forever,daemon=True).start();origin=f'http://127.0.0.1:{server.server_port}'
results=[];(HERE/'evidence').mkdir(exist_ok=True)
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(**({'executable_path':'/usr/bin/chromium'} if Path('/usr/bin/chromium').exists() else {}),args=['--no-sandbox'])
  for width in [1440,390]:
   x=f.Fixture()
   try:
    db=x.db;db.sql((ROOT/'docs/sql-proposals/lp01-afectaciones/13_all_origins_read_REVIEW.sql').read_text());db.sql('GRANT EXECUTE ON FUNCTION public.sgp_lp_seguimiento_consultar(text,text,text) TO anon;UPDATE sgp_lp_afectaciones.config SET writes=true,physical=true,atomic_pdt=true,pdt_links=true;ALTER TABLE public.sgp_producciones ADD COLUMN IF NOT EXISTS porc_vidrio numeric;UPDATE public.sgp_producciones SET cantidad=3,porc_vidrio=50')
    before=db.sql('SELECT jsonb_agg(to_jsonb(o) ORDER BY parte) FROM sgp_lp_operacion.ordenes o')
    page=browser.new_page(viewport={'width':width,'height':1000});page.set_default_timeout(12000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)));calls=[];ids=[];lost=[False]
    page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(origin) else r.abort())
    def rpc(route):
     name=route.request.url.split('/rpc/')[-1];a=route.request.post_data_json;calls.append(name)
     assert name in ['sgp_lp_shared_order_read_v1','sgp_lp_seguimiento_consultar','sgp_lp_afectaciones_consultar_v2','sgp_lp_order_details_read_v1','sgp_lp_order_note_save_v1','sgp_lp_glass_nc_read_v1','sgp_lp_glass_nc_report_v1','sgp_lp_operacion_consultar','sgp_lp_afectaciones_comando_v1','sgp_lp_afectaciones_legado_v1','sgp_pdt_manual_nc_consultar_v1']
     args=[]
     for key,value in a.items():
      assert key in ['p_token','p_key','p_stage','p_etapa','p_linea','p_fecha','p_turno','p_date','p_shift','p_cmd','p_nc','p_referencia']
      args.append(key+'=>'+('NULL' if value is None else f.lit(json.dumps(value))+'::jsonb' if isinstance(value,dict) else str(value) if isinstance(value,int) else f.lit(value)))
     if name=='sgp_lp_order_note_save_v1':ids.append(a['p_cmd']['id'])
     try:response={'data':json.loads(db.sql('SET ROLE anon;SELECT public.'+name+'('+','.join(args)+')'))}
     except Exception as e:response={'error':{'message':str(e).splitlines()[0].removeprefix('ERROR:').strip(),'code':'42883' if 'does not exist' in str(e) else 'P0001'}}
     if name=='sgp_lp_order_note_save_v1' and lost[0]:lost[0]=False;route.abort();return
     route.fulfill(status=200,content_type='application/json',body=json.dumps(response))
    page.route('**/rpc/*',rpc);page.goto(origin+'/tests/lp01-order-details/fixture.html');page.wait_for_selector('[data-register-order]')
    assert not page.locator('.lp-tracking-disclosure').first.get_attribute('open')
    page.screenshot(path=str(HERE/f'evidence/contracted-{width}.png'),full_page=True)
    page.locator('[data-register-order]').first.click();page.wait_for_selector('[data-order-type]');page.wait_for_function("document.querySelector('[data-order-note-status]').textContent.includes('todavía no')")
    assert page.locator('[data-order-note-save]').is_disabled();assert page.locator('[data-order-type]').count()==5
    # Install/enable only in the synthetic DB after observing honest missing backend.
    for file in ['01_definition_REVIEW.sql','02_glass_nc_REVIEW.sql']:db.sql((ROOT/'docs/sql-proposals/lp01-order-details'/file).read_text())
    db.sql('GRANT EXECUTE ON FUNCTION public.sgp_lp_order_details_read_v1(text,text,text),public.sgp_lp_order_note_save_v1(text,text,text,jsonb),public.sgp_lp_glass_nc_read_v1(text,text,text),public.sgp_lp_glass_nc_report_v1(text,text,text,date,integer,jsonb,text) TO anon;UPDATE sgp_lp_order_details.config SET writes=true')
    page.locator('[data-order-note-refresh]').click();page.wait_for_function("!document.querySelector('[data-order-note]').disabled")
    page.locator('[data-order-note]').fill('Borrador general');page.locator('[data-order-type=TECNO]').click();page.wait_for_selector('.lp-glass-estimate');assert '2' in page.locator('.lp-glass-estimate').inner_text();assert 'Resultado exacto: 1.5' in page.locator('[data-type-pane=TECNO]').inner_text()
    page.locator('[data-order-type=NOVEDAD]').click();page.locator('[data-order-type=NC_V]').click();page.wait_for_selector('[data-type-pane=NC_V] [data-shared-form]');assert page.locator('[data-order-note]').input_value()=='Borrador general'
    assert page.locator('[data-type-pane=NC_V] [data-shared-form] button[type=submit]').is_disabled()
    page.locator('[data-order-note-save]').click();page.wait_for_function("document.querySelector('[data-order-note-status]').textContent.includes('guardada')")
    assert db.sql('SELECT observation FROM sgp_lp_order_details.notes')=='Borrador general'
    # A's draft must not adopt B's newer revision after refresh.
    page.locator('[data-order-note]').fill('Edición A');cmd={'id':str(uuid.uuid4()),'revision':1,'observation':'Edición B'};db.sql("SET ROLE anon;SELECT public.sgp_lp_order_note_save_v1('COORDINADOR','QA|PANELES_2','ENSAMBLE',"+f.lit(json.dumps(cmd))+'::jsonb)')
    page.locator('[data-order-note-refresh]').click();page.wait_for_function("!document.querySelector('[data-order-note-current]').hidden");page.locator('[data-order-note-save]').click();page.wait_for_function("document.querySelector('[data-order-note-status]').textContent.includes('Otra persona')");assert db.sql('SELECT observation FROM sgp_lp_order_details.notes')=='Edición B'
    page.locator('[data-order-note-refresh]').click();page.wait_for_function("!document.querySelector('[data-order-note-refresh]').disabled");page.locator('[data-order-note-discard]').click();page.locator('[data-order-note]').fill('Reintento exacto');lost[0]=True;page.locator('[data-order-note-save]').click();page.wait_for_function("document.querySelector('[data-order-note-status]').textContent.includes('sin confirmar')");page.locator('[data-order-note-save]').click();page.wait_for_function("document.querySelector('[data-order-note-status]').textContent.includes('guardada')");assert ids[-1]==ids[-2]
    assert page.locator('[data-affect-context]').count()==0
    assert page.locator('[data-type-pane=NC_V] [data-shared-form] button[type=submit]').is_disabled() # shared backend absent, no legacy write fallback
    page.locator('[data-order-type=ACCESORIOS]').click();assert page.locator('[data-type-pane=ACCESORIOS] [data-shared-form] button[type=submit]').is_disabled()
    page.locator('[data-order-type=TECNO]').click();page.locator('#lp-tracking-drawer').screenshot(path=str(HERE/f'evidence/tecno-note-{width}.png'))
    if width==1440:assert page.locator('#lp-tracking-drawer').bounding_box()['y']>=page.locator('.lp-tracking-table').bounding_box()['y']+page.locator('.lp-tracking-table').bounding_box()['height']
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.locator('[data-order-type=NC_V]').click();page.locator('#lp-tracking-drawer').screenshot(path=str(HERE/f'evidence/nc-{width}.png'))
    assert db.sql('SELECT jsonb_agg(to_jsonb(o) ORDER BY parte) FROM sgp_lp_operacion.ordenes o')==before
    assert not errors,errors
    results.append({'width':width,'status':'PASS','nativeSQL':True,'missingBackendHonest':True,'fiveTabs':True,'exactFraction':True,'draftSurvivesTabs':True,'conflictNotOverwritten':True,'uncertainRetrySameUUID':True,'notePersistence':True,'missingSharedBackendNoWriteFallback':True,'unsupportedActionsDisabled':True,'B10GeometryAndNoOverflow':True});page.close()
   finally:x.close()
  browser.close()
 (HERE/'browser-result.json').write_text(json.dumps(results,indent=2)+'\n');print(json.dumps(results))
finally:server.shutdown()
