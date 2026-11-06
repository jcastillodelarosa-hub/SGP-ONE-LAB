"""Integrated application screenshots for coordinator comparison; synthetic local data only."""
from pathlib import Path
import sys,json,http.server,threading,uuid,subprocess
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'tests/lp01-shared-order'))
from fixture import setup,f
HERE=Path(__file__).parent;OUT=HERE/'evidence';OUT.mkdir(exist_ok=True)
class Files(http.server.SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT),**kw)
 def log_message(self,*a):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Files);threading.Thread(target=server.serve_forever,daemon=True).start();origin=f'http://127.0.0.1:{server.server_port}'
x,_=setup();db=x.db;results=[]
try:
 db.sql("CREATE TABLE public.sgp_accesorios(id_accesorio text PRIMARY KEY,key_produccion text,codigo_sap text,descripcion text,cantidad numeric,unidad text);ALTER TABLE public.sgp_producciones ADD COLUMN IF NOT EXISTS porc_vidrio numeric;ALTER TABLE public.sgp_producciones ADD COLUMN IF NOT EXISTS anio int;ALTER TABLE public.sgp_producciones ADD COLUMN IF NOT EXISTS semana_base int;UPDATE public.sgp_producciones SET cantidad=300,porc_vidrio=50;")
 for file in ['01_definition_REVIEW.sql','02_activate_REVIEW.sql']:db.sql((ROOT/'docs/sql-proposals/lp01-shared-order'/file).read_text())
 db.sql((ROOT/'docs/sql-proposals/lp01-official-close/01_storage_REVIEW.sql').read_text())
 assert db.sql("SELECT has_function_privilege('service_role','public.sgp_lp_official_read_v1(text,jsonb)','EXECUTE')")=='f'
 db.sql('GRANT EXECUTE ON FUNCTION public.sgp_lp_order_details_read_v1(text,text,text),public.sgp_lp_order_note_save_v1(text,text,text,jsonb),public.sgp_lp_seguimiento_consultar(text,text,text) TO anon;')
 cmd={'id':str(uuid.uuid4()),'action':'CREATE','revision':0,'cause':'NOVEDAD','quantity':2,'observation':'QA faltante reportado en Ensamble, visible en ambas hojas'}
 db.sql("SET ROLE anon;SELECT public.sgp_lp_shared_order_command_v1('se','QA|PANELES_2','ENSAMBLE',"+f.lit(json.dumps(cmd))+"::jsonb)")
 allowed={'sgp_sesion_actual','sgp_mis_accesos','sgp_lp_operacion_consultar','sgp_lp_operacion_resultado','sgp_lp_seguimiento_consultar','sgp_lp_afectaciones_consultar_v2','sgp_lp_order_details_read_v1','sgp_lp_order_note_save_v1','sgp_lp_shared_order_read_v1','sgp_lp_shared_order_command_v1','sgp_lp_shared_nc_lookup_v1','sgp_pdt_registro_fuentes_v4','sgp_lp_sale_orden_consultar_v1'}
 with sync_playwright() as p:
  browser=p.chromium.launch(**({'executable_path':'/usr/bin/chromium'} if Path('/usr/bin/chromium').exists() else {}),args=['--no-sandbox'])
  for width in [1440,390]:
   page=browser.new_page(viewport={'width':width,'height':1050});page.set_default_timeout(15000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.add_init_script("sessionStorage.setItem('sgp_one_session','COORDINADOR')")
   page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(origin) else r.abort())
   def rpc(route):
    name=route.request.url.split('/rpc/')[-1];a=route.request.post_data_json
    try:
     if name not in allowed:raise ValueError('QA unavailable '+name)
     params=','.join(k+'=>'+('NULL' if v is None else f.lit(json.dumps(v))+'::jsonb' if isinstance(v,dict) else f.lit(v)) for k,v in a.items())
     if name=='sgp_mis_accesos':sql="SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM public.sgp_mis_accesos("+f.lit(a['p_token'])+') x'
     else:sql='SELECT public.'+name+'('+params+')'
     value=json.loads(db.sql('SET ROLE anon;'+sql));route.fulfill(content_type='application/json',body=json.dumps(value))
    except Exception as e:
     route.fulfill(status=400,content_type='application/json',body=json.dumps({'code':'PGRST202' if 'does not exist' in str(e) else 'QA_ERROR','message':str(e)}))
   def official(route):
    body=route.request.post_data_json
    assert body['command']['action']=='READ'
    req={'container':db.container,'database':getattr(db,'database','postgres'),'request':{'token':body['p_token'],'command':body['command']}}
    r=subprocess.run(['node',str(HERE/'service-runner.mjs')],input=json.dumps(req),cwd=ROOT,text=True,capture_output=True);answer=json.loads(r.stdout)
    route.fulfill(status=422 if r.returncode else 200,content_type='application/json',headers={'access-control-allow-origin':origin},body=json.dumps({'error':answer['error']} if r.returncode else {'data':{'ok':True,**answer}}))
   page.route('**/rest/v1/rpc/*',rpc);page.route('**/functions/v1/lp-powerbi',official)
   page.goto(origin+'/');page.wait_for_function("document.querySelector('#authStatus').textContent.length>3")
   if page.locator('#mobileMenuToggle').is_visible():page.locator('#mobileMenuToggle').click()
   page.locator('.nav [data-view="ensamble"]').click();page.locator('#productionTrackingTab').click()

   try:page.wait_for_selector('[data-order-summary] [data-summary-cause=NOVEDAD]')
   except Exception:
    print('STATUS',page.locator('[data-op-status]').all_text_contents(),'LIVE',page.locator('[data-live-orders]').all_text_contents(),'ERRORS',errors,flush=True);raise
   page.screenshot(path=str(OUT/f'tracking-contracted-{width}.png'),full_page=True)
   page.locator('[data-order-summary] [data-summary-cause=NOVEDAD]').first.click();page.wait_for_selector('[data-order-type=NOVEDAD]');page.screenshot(path=str(OUT/f'tracking-detail-{width}.png'),full_page=True)
   for stage,tab in [('ENSAMBLE','productionAssemblyTab'),('EMPAQUE','productionPackingTab')]:
    page.locator('#'+tab).click();page.locator('[data-op-date]').fill('2026-11-01');page.locator('[data-op-date]').dispatch_event('change')
    page.wait_for_selector('[data-live-orders] tr[data-order-part]');page.wait_for_selector('[data-sheet-summary] [data-summary-cause=NOVEDAD]');page.screenshot(path=str(OUT/f'{stage.lower()}-table-{width}.png'),full_page=True)
    page.locator('[data-live-orders] [data-live-operate]').first.click();page.wait_for_selector('[data-operation-detail] [data-order-type=NOVEDAD]');page.locator('[data-operation-detail] [data-order-type=NOVEDAD]').click()
    page.locator('[data-back]').scroll_into_view_if_needed();page.screenshot(path=str(OUT/f'{stage.lower()}-detail-{width}.png'),full_page=True)
   assert not errors,errors;results.append({'width':width,'tracking_chips_and_detail':True,'both_operation_tables_and_details':True,'pageErrors':errors});page.close()
  browser.close()
 (HERE/'integrated-views-result.json').write_text(json.dumps({'scope':'Actual app controllers, synthetic PostgreSQL; original comparison left to coordinator','results':results},indent=2)+'\n');print(json.dumps(results))
finally:db.close();server.shutdown()
