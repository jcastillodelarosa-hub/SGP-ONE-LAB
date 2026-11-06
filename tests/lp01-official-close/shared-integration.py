"""New integration seam only: operation adapter -> actual shared component and row summary."""
from pathlib import Path
import sys,json,http.server,threading
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'tests/lp01-shared-order'))
from fixture import setup,f
HERE=Path(__file__).parent
class Files(http.server.SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT),**kw)
 def log_message(self,*a):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Files);threading.Thread(target=server.serve_forever,daemon=True).start();origin=f'http://127.0.0.1:{server.server_port}'
html='''<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/src/modules/lp01-followup.css"><main class="lp-followup lp-tracking"><div id="panel"></div><output id="summary"></output></main><script type="module">
import {mountTrackingAffectations} from '/src/modules/lp01-tracking-affectations.js';
import {mountOperationOrderContext} from '/src/modules/lp01-operation-context.js';
import {readOperationSummary} from '/src/services/lp01-operation-summary.js';
const stage=new URLSearchParams(location.search).get('stage')||'ENSAMBLE',token=stage==='ENSAMBLE'?'se':'sp',key='QA|PANELES_2',line='PANELES_2';
const client={rpc:async(name,args)=>(await fetch('/rpc/'+name,{method:'POST',body:JSON.stringify(args)})).json()};
await mountOperationOrderContext({host:document.querySelector('#panel'),row:{key,produccion:'QA'},scope:{line,stage},bridge:{getToken:()=>token,getClient:async()=>client},isCurrent:()=>true,mount:mountTrackingAffectations});
window.readSummary=async()=>{window.qaSummary=await readOperationSummary({client,getToken:()=>token,key,line,stage});document.querySelector('#summary').textContent=JSON.stringify(window.qaSummary);};
await readSummary();
</script>'''
results=[]
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(**({'executable_path':'/usr/bin/chromium'} if Path('/usr/bin/chromium').exists() else {}),args=['--no-sandbox'])
  for width in [1440,390]:
   x,_=setup();db=x.db
   try:
    for file in ['01_definition_REVIEW.sql','02_activate_REVIEW.sql']:db.sql((ROOT/'docs/sql-proposals/lp01-shared-order'/file).read_text())
    db.sql('GRANT EXECUTE ON FUNCTION public.sgp_lp_order_details_read_v1(text,text,text),public.sgp_lp_order_note_save_v1(text,text,text,jsonb) TO anon;UPDATE sgp_lp_operacion.turnos SET estado=\'CERRADO\';')
    db.sql("CREATE TABLE public.sgp_accesorios(id_accesorio text PRIMARY KEY,key_produccion text,codigo_sap text,descripcion text,cantidad numeric,unidad text);ALTER TABLE public.sgp_producciones ADD COLUMN IF NOT EXISTS porc_vidrio numeric;UPDATE public.sgp_producciones SET cantidad=3,porc_vidrio=50;")
    before=db.sql('SELECT jsonb_agg(to_jsonb(t)) FROM sgp_lp_operacion.turnos t')
    page=browser.new_page(viewport={'width':width,'height':950});page.set_default_timeout(15000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(origin) else r.abort())
    page.route('**/fixture*',lambda r:r.fulfill(content_type='text/html',body=html))
    def rpc(route):
     name=route.request.url.split('/rpc/')[-1];args=route.request.post_data_json
     assert name in ['sgp_lp_afectaciones_consultar_v2','sgp_lp_order_details_read_v1','sgp_lp_order_note_save_v1','sgp_lp_shared_order_read_v1','sgp_lp_shared_order_command_v1','sgp_lp_shared_nc_lookup_v1']
     params=','.join(k+'=>'+(f.lit(json.dumps(v))+'::jsonb' if isinstance(v,dict) else f.lit(v)) for k,v in args.items())
     try:r={'data':json.loads(db.sql('SET ROLE anon;SELECT public.'+name+'('+params+')'))}
     except Exception as e:r={'error':{'message':str(e),'code':'P0001'}}
     route.fulfill(content_type='application/json',body=json.dumps(r))
    page.route('**/rpc/*',rpc)
    page.goto(origin+'/fixture');page.wait_for_selector('[data-order-type=NOVEDAD]');page.locator('[data-order-type=NOVEDAD]').click()
    form=page.locator('[data-type-pane=NOVEDAD] [data-shared-form]');form.locator('[name=quantity]').fill('2');form.locator('[name=observation]').fill('QA reporte desde hoja Ensamble');form.locator('button[type=submit]').click()
    page.wait_for_function("document.querySelector('[data-type-pane=NOVEDAD] [data-shared-status]')?.textContent==='Guardado.'")
    page.evaluate('readSummary()');assert page.evaluate('window.qaSummary.categories.NOVEDAD')==2
    page.goto(origin+'/fixture?stage=EMPAQUE');page.wait_for_function('window.qaSummary?.categories?.NOVEDAD===2')
    assert page.locator('[data-order-type]').count()==5 and page.locator('[data-affect-context]').count()==0
    assert db.sql('SELECT jsonb_agg(to_jsonb(t)) FROM sgp_lp_operacion.turnos t')==before
    assert not errors,errors;results.append({'width':width,'adapter_to_shared_component':'PASS','both_stage_summaries':2,'native_turn_mutations':0,'pageErrors':errors});page.close()
   finally:x.close()
  browser.close()
 (HERE/'shared-integration-result.json').write_text(json.dumps({'scope':'Integrated PR208 + operation adapter, ephemeral PostgreSQL','results':results},indent=2)+'\n');print(json.dumps(results))
finally:server.shutdown()
