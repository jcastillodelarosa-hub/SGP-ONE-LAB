from pathlib import Path
import importlib.util,json,http.server,threading,uuid
from playwright.sync_api import sync_playwright
HERE=Path(__file__).parent;ROOT=HERE.parents[1]
spec=importlib.util.spec_from_file_location('atomic_fixture',HERE/'atomic.py');f=importlib.util.module_from_spec(spec);spec.loader.exec_module(f)
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
    db=x.db;db.sql('UPDATE sgp_lp_afectaciones.config SET writes=true,physical=true,atomic_pdt=true,pdt_links=true')
    pieces=x.pieces();ctx={'id_programacion':'00000000-0000-0000-0000-000000000001','produccion':'QA ORDER','completa':False,'fecha_entrega':'2026-11-01','turno':'TURNO 1'}
    original=json.loads(db.sql('SET ROLE anon;SELECT public.sgp_pdt_registrar_v4('+','.join([f.lit('COORDINADOR'),f.lit('PICKING'),f.lit(json.dumps(ctx))+'::jsonb',f.lit(json.dumps(pieces))+'::jsonb',f.lit(str(uuid.uuid4()))])+')'))['ids_pendientes'][0]
    page=browser.new_page(viewport={'width':width,'height':950});errors=[];calls=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(origin) else r.abort())
    rpc_args={
     'sgp_lp_afectaciones_consultar_v2':['p_token','p_key','p_stage'],
     'sgp_pdt_registro_fuentes_v4':['p_token','p_origen','p_contexto'],
     'sgp_lp_afectaciones_aluminio_v1':['p_token','p_key','p_stage','p_date','p_shift','p_cmd','p_pieces'],
     'sgp_lp_afectaciones_desde_picking_v1':['p_token','p_key','p_stage','p_date','p_shift','p_cmd','p_source'],
     'sgp_lp_afectaciones_comando_v1':['p_token','p_key','p_stage','p_date','p_shift','p_cmd'],
     'sgp_lp_afectaciones_legado_v1':['p_token','p_key','p_stage'],
     'sgp_lp_afectaciones_conciliar_v1':['p_token','p_key','p_stage','p_id','p_fingerprint','p_revision','p_mappings','p_observation']}
    def rpc(route):
     name=route.request.url.split('/rpc/')[-1];a=route.request.post_data_json;calls.append(name)
     try:
      args=[]
      for key in rpc_args[name]:
       v=a[key];args.append(f.lit(json.dumps(v))+'::jsonb' if isinstance(v,(dict,list)) else str(v) if isinstance(v,int) else f.lit(v))
      data=json.loads(db.sql('SET ROLE anon;SELECT public.'+name+'('+','.join(args)+')'));result={'data':data,'error':None}
     except Exception as e:result={'data':None,'error':{'message':str(e)}}
     route.fulfill(status=200,content_type='application/json',body=json.dumps(result))
    page.route('**/rpc/*',rpc);page.goto(origin+'/tests/lp01-afectaciones-rpc/native-fixture.html')
    page.wait_for_selector('.lp-picking-pending article');assert original in page.locator('.lp-picking-pending').inner_text();assert 'E17' in page.locator('.lp-picking-pending').inner_text()
    page.locator('[name=cause]').select_option('NC_AL');page.locator('[name=aluminumSource]').select_option('new');page.locator('[data-ref]').select_option('PANEL-REF')
    index=page.evaluate("[...document.querySelectorAll('[data-source-radio]')].findIndex(n=>{const a=JSON.parse(n.dataset.sourceRadio);return a[2]==='P1'&&a[1]==='R'})")
    assert index>=0;page.locator('[data-source-radio]').nth(index).check();page.locator('[data-qty]').fill('2');page.locator('[data-nc]').fill('QA-NC')
    def save(n,obs):
     page.locator('[name=quantity]').fill(str(n));page.locator('[name=observation]').first.fill(obs);page.get_by_role('button',name='Guardar',exact=True).click();page.wait_for_function("document.querySelector('[data-result]').textContent && document.querySelector('[data-result]').textContent!=='Guardando…'");assert page.locator('[data-result]').inner_text()=='Guardado',page.locator('#panel').inner_text()
    save(5,'NC aluminio nueva: cinco ventanas');assert db.sql('SELECT count(*) FROM sgp_aluminio_pendientes')=='2'
    first=x.read2()['reports'][0]['id'];assert x.read2()['reports'][0]['quantity']==5
    page.locator('[name=cause]').select_option('NC_AL');page.locator('[name=aluminumSource]').select_option(original);save(4,'Cuatro ventanas afectadas por pendiente original de Picking')
    assert db.sql('SELECT count(*) FROM sgp_aluminio_pendientes')=='2' and len(x.read2()['reports'])==2
    page.locator('[name=action]').select_option('SOLVE');page.locator('[name=reportId]').select_option(first);save(2,'Solución parcial en origen')
    page.locator('[name=action]').select_option('CONFIRM');page.locator('[name=reportId]').select_option(first);save(1,'Una ventana confirmada físicamente')
    page.evaluate("qaToken='COORDINADOR';mount()");page.get_by_role('button',name='Conciliar historial anterior').click();page.locator('[data-legacy-form] [name=observation]').fill('Cotejo: no hay cantidades legacy pendientes sin relación');page.get_by_role('button',name='Guardar conciliación').click();page.wait_for_selector('[name=action] option[value=VALIDATE]',state='attached')
    page.locator('[name=action]').select_option('VALIDATE');save(6,'Seis ventanas distintas: dos causas se solapan');assert x.read2()['available']==282
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.get_by_text('Historial autorizado de la producción · contexto ENSAMBLE',exact=True).click()
    (HERE/'evidence').mkdir(exist_ok=True);page.screenshot(path=str(HERE/f'evidence/native-{width}.png'),full_page=True)
    page.evaluate("qaToken='se';mount()");page.wait_for_function("document.querySelector('.lp-picking-pending').textContent.includes('Consulta no autorizada')")
    assert page.locator('[name=action] option[value=CONFIRM]').count()==0
    page.locator('[name=cause]').select_option('NC_AL');assert page.get_by_role('button',name='Guardar',exact=True).is_disabled()
    assert not errors,errors
    results.append({'width':width,'status':'PASS','nativePdt':True,'originalPickingPreserved':True,'pieceQuantity':2,'windowQuantity':5,'combinedPendingUnion':6,'supervisorPdtAndPhysicalDenied':True})
    page.close()
   finally:x.close()
  browser.close()
 (HERE/'native-browser-result.json').write_text(json.dumps(results,indent=2)+'\n');print(json.dumps(results))
finally:server.shutdown()
