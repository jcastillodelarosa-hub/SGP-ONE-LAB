"""Real isolated PostgreSQL with native existing operation SALE + browser cell; no production."""
from pathlib import Path
import json,sys,http.server,threading,uuid
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
    # Existing turn SALE is written through its real API before installing the new contract.
    for stage in ['ENSAMBLE','EMPAQUE']:db.execute(db.cmd('SALE',stage=stage,key=x.key,part=x.parts[0],quantity=5,observation='QA existing turn SALE'))
    def legacy_snapshot():return db.sql("SELECT jsonb_build_object('orders',(SELECT jsonb_agg(to_jsonb(o) ORDER BY to_jsonb(o)::text) FROM sgp_lp_operacion.ordenes o),'history',(SELECT jsonb_agg(to_jsonb(a) ORDER BY to_jsonb(a)::text) FROM sgp_lp_operacion.auditoria a))")
    before=legacy_snapshot()
    db.sql((ROOT/'docs/sql-proposals/lp01-afectaciones/13_all_origins_read_REVIEW.sql').read_text());db.sql((ROOT/'docs/sql-proposals/lp01-order-sale/01_definition_REVIEW.sql').read_text())
    db.sql('GRANT EXECUTE ON FUNCTION public.sgp_lp_sale_orden_consultar_v1(text,text,text),public.sgp_lp_sale_orden_definir_v1(text,text,text,jsonb) TO anon;UPDATE sgp_lp_sale_orden.config SET definitions_enabled=true;UPDATE sgp_lp_afectaciones.config SET writes=true')
    legacy=json.loads(db.sql("SET ROLE anon;SELECT public.sgp_lp_afectaciones_legado_v1('COORDINADOR','QA|PANELES_2','ENSAMBLE')"))
    db.sql("SET ROLE anon;SELECT public.sgp_lp_afectaciones_conciliar_v1('COORDINADOR','QA|PANELES_2','ENSAMBLE',"+f.lit(str(uuid.uuid4()))+","+f.lit(legacy['fingerprint'])+","+str(legacy['revision'])+",'[]'::jsonb,'QA native empty legacy')")
    x.run(x.command('VALIDATE',0,user='COORDINADOR'),user='COORDINADOR')
    page=browser.new_page(viewport={'width':width,'height':950});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));lost=[False];ids=[]
    page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(origin) else r.abort())
    def rpc(route):
     name=route.request.url.split('/rpc/')[-1];a=route.request.post_data_json
     assert name in ['sgp_lp_sale_orden_consultar_v1','sgp_lp_sale_orden_definir_v1']
     args=[f.lit(a[k]) for k in ['p_token','p_key','p_stage']]
     if 'p_cmd' in a:args.append(f.lit(json.dumps(a['p_cmd']))+'::jsonb');ids.append(a['p_cmd']['id'])
     try:data=json.loads(db.sql('SET ROLE anon;SELECT public.'+name+'('+','.join(args)+')'));response={'data':data,'error':None}
     except Exception as e:response={'data':None,'error':{'code':'P0001','message':str(e)}}
     if 'p_cmd' in a and lost[0]:lost[0]=False;route.abort();return
     route.fulfill(status=200,content_type='application/json',body=json.dumps(response))
    page.route('**/rpc/*',rpc);page.goto(origin+'/tests/lp01-order-sale/fixture.html');page.wait_for_selector('[name=quantity]')
    def save(n,reason):
     page.locator('[name=quantity]').fill(str(n));page.locator('[name=observation]').fill(reason);page.get_by_role('button',name='Guardar definición',exact=True).click()
    save(8,'Ocho definidas');page.wait_for_function("document.querySelector('[data-sale-message]').textContent.includes('Definición guardada.')")
    page.reload();page.wait_for_selector('[name=quantity]');assert page.locator('[name=quantity]').input_value()=='8'
    # Hold an actual read response: refresh must prevent overlapping writes.
    page.evaluate("const originalFetch=window.fetch;window.fetch=(...args)=>{window.fetch=originalFetch;return originalFetch(...args).then(r=>new Promise(resolve=>{window.qaRelease=()=>resolve(r)}))};void 0")
    page.get_by_role('button',name='Actualizar',exact=True).click();page.wait_for_function('typeof qaRelease==="function"')
    assert page.locator('[name=quantity]').is_disabled();count=len(ids)
    page.evaluate("document.querySelector('form').dispatchEvent(new Event('submit',{cancelable:true}));qaRelease()")
    page.wait_for_function("!document.querySelector('[name=quantity]').disabled");assert len(ids)==count
    # Superseded controller cannot erase a newer mount in the same host.
    page.evaluate('window.oldDispose=window.dispose;mount()');page.wait_for_selector('[name=quantity]');page.evaluate('oldDispose()');assert page.locator('[name=quantity]').count()==1
    lost[0]=True;save(10,'Diez definidas');page.wait_for_function("document.querySelector('[data-sale-message]').textContent.includes('Resultado sin confirmar')")
    assert page.locator('[name=quantity]').is_disabled();page.get_by_role('button',name='Reintentar mismo guardado').click();page.wait_for_function("document.querySelector('[data-sale-message]').textContent.includes('Definición guardada.')")
    assert ids[-1]==ids[-2] and db.sql('SELECT count(*) FROM sgp_lp_sale_orden.eventos')=='2'
    page.get_by_text('Historial · 2',exact=True).click();assert 'Ocho definidas' in page.locator('details').inner_text() and 'Diez definidas' in page.locator('details').inner_text()
    assert legacy_snapshot()==before,'Existing turn SALE / audit changed'
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    (HERE/'evidence').mkdir(exist_ok=True);page.screenshot(path=str(HERE/f'evidence/cell-{width}.png'),full_page=True)
    page.evaluate("qaToken='se';mount()");page.wait_for_function("document.querySelector('[name=quantity]')?.readOnly");assert page.get_by_role('button',name='Guardar definición',exact=True).is_hidden()
    page.evaluate("qaToken='invalid'");page.wait_for_function("document.querySelector('#cell').textContent===''")
    assert not errors,errors
    results.append({'width':width,'status':'PASS','nativePostgres':True,'saveReloadHistory':True,'lostResponseSameIdRetry':True,'existingTurnSaleAndAuditUnchanged':True,'roleAndSessionCleanup':True,'refreshSerializesWrites':True,'oldDisposeCannotClearNewMount':True,'isolatedCellOnly':True});page.close()
   finally:x.close()
  browser.close()
 (HERE/'browser-result.json').write_text(json.dumps(results,indent=2)+'\n');print(json.dumps(results))
finally:server.shutdown()
