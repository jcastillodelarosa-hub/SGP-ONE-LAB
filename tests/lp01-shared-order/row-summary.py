"""Directed B10 integration: real controller/transports/helper, synthetic RPC responses."""
from pathlib import Path
import http.server,threading,json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];HERE=Path(__file__).parent
prefix=(ROOT/'tests/lp01-tracking-ui/fixture.html').read_text().split('<script type="module">')[0]
html=prefix+'''<script type="module">
import {mountOperation} from '/src/modules/lp01-operation.js';
document.querySelector('#productionTrackingPanel').append(document.querySelector('#tracking'));document.querySelector('#productionOperationPanel').append(document.querySelector('#operation'));
window.qaToken='QA';window.qaMode='shared';window.qaReads=[];
const key='QA|PANELES_2';
const bridge={getToken:()=>qaToken,getClient:async()=>({rpc:async(name,args)=>{
 qaReads.push({name,args});const stage=args.p_stage||args.p_etapa,line='PANELES_2';
 if(name==='sgp_lp_seguimiento_consultar')return {data:{contract:'LP-SEGUIMIENTO-1',role:'COORDINADOR',line,stage,productions:[{key,line,stage,classification:'ABIERTA',assignments:[],operations:[],history:[],oficial:{key_produccion:key,id_linea:line,produccion:'QA',sistema:'QA',saldos_inicializados:true,presente_ultimo_export:true,saldo_ensamble:20,saldo_empaque:20,cantidad:30,anio:2026,semana_base:44}}]}};
 if(name==='sgp_lp_afectaciones_consultar_v2')return {data:{contract:'LP-AFFECTATIONS-2',key,line,stage,revision:0,reports:[{id:'legacy',originStage:stage,cause:'NC_V',quantity:10,solved:0,confirmed:0}],events:[],capabilities:['READ'],available:8,consolidated:{quantity:12,balance:20,revision:0},aluminumPending:{status:'AVAILABLE',rows:[]}}};
 if(name==='sgp_lp_shared_order_read_v1'){
  if(qaMode==='unavailable')return {error:{code:'42883',message:'missing function'}};
  if(qaMode==='revoked')return {error:{code:'P0001',message:'NO_AUTORIZADO'}};
  if(qaMode==='held')await new Promise(resolve=>window.qaRelease=resolve);
  const reports=[{id:'shared',key,origin_stage:stage==='ENSAMBLE'?'EMPAQUE':'ENSAMBLE',cause:'NC_V',quantity:3,solved:0,confirmed:0},{id:'accessory',key,origin_stage:stage,cause:'ACCESORIOS',quantity:1,solved:0,confirmed:0}];
  return {data:{contract:'LP-SHARED-ORDER-1',key:qaMode==='mismatch'?'FOREIGN|PANELES_2':key,line,stage,revision:0,canReport:false,reports,history:[],legacyReports:qaMode==='overlap'?[{causa:'NC_V',ventanas:2,confirmadas:0}]:[],accessories:[]}};
 }
 throw Error('Unexpected synthetic RPC '+name);
}})};
window.controller=mountOperation({tracking:document.querySelector('#tracking'),operation:document.querySelector('#operation'),bridge});
document.dispatchEvent(new CustomEvent('sgp:lp-role',{detail:'COORDINADOR'}));document.querySelector('#productionTrackingTab').click();
</script>'''
class Files(http.server.SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT),**kw)
 def log_message(self,*a):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Files);threading.Thread(target=server.serve_forever,daemon=True).start();origin=f'http://127.0.0.1:{server.server_port}'
results=[]
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(**({'executable_path':'/usr/bin/chromium'} if Path('/usr/bin/chromium').exists() else {}),args=['--no-sandbox'])
  for width in [1440,390]:
   page=browser.new_page(viewport={'width':width,'height':950});page.set_default_timeout(8000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(origin) else r.abort())
   page.route('**/qa-row',lambda r:r.fulfill(content_type='text/html',body=html));page.goto(origin+'/qa-row')
   row=page.locator('[data-order-summary]')
   page.wait_for_function("document.querySelector('[data-order-summary]')?.textContent.includes('3 × NC V')")
   assert '10 × NC V' not in row.inner_text() and '1 × Accesorios' in row.inner_text() and 'Total 12' not in row.inner_text()
   page.locator('[data-columns-reset]').click();assert '1 × Accesorios' in row.inner_text()
   page.evaluate("qaMode='overlap';controller.load()")
   page.wait_for_function("!document.querySelector('[data-order-summary] [data-summary-cause=NC_V]')&&document.querySelector('[data-order-summary]')?.textContent.includes('Accesorios')")
   page.evaluate("qaMode='unavailable';controller.load()")
   page.wait_for_function("document.querySelector('[data-order-summary]')?.textContent.includes('lectura heredada')")
   assert '10 × NC V' in row.inner_text() and 'Total 12' not in row.inner_text() and 'Disponibles 8' not in row.inner_text()
   page.locator('[data-columns-reset]').click();assert 'lectura heredada' in row.inner_text()
   page.locator('[data-tracking-status]').select_option('ABIERTA');assert 'lectura heredada' in row.inner_text()
   page.evaluate('controller.load()');page.wait_for_function("document.querySelector('[data-order-summary]')?.textContent.includes('lectura heredada')")
   page.evaluate("qaMode='mismatch';controller.load()")
   page.wait_for_function("document.querySelector('[data-order-summary]')?.textContent==='Datos pendientes'")
   page.evaluate("qaMode='revoked';controller.load()")
   page.wait_for_function("document.querySelector('[data-op-status]')?.textContent.includes('Acceso revocado')")
   assert page.locator('[data-order-summary]').count()==0
   page.evaluate("qaMode='held';controller.load()")
   page.wait_for_function('typeof qaRelease===\'function\'')
   page.evaluate("qaToken='changed';document.dispatchEvent(new CustomEvent('sgp:lp-role',{detail:'CONSULTA'}));qaRelease()")
   page.wait_for_timeout(100);assert page.locator('[data-order-summary]').count()==0
   assert not errors,errors;results.append({'width':width,'shared_cross_stage_and_accessories':True,'overlap_not_summed':True,'unavailable_labeled_legacy':True,'internal_table_redraw_preserves_badges':True,'invalid_identity_unavailable':True,'revocation_and_stale_response_cleared':True,'pageErrors':errors});page.close()
  browser.close()
 (HERE/'row-summary-result.json').write_text(json.dumps({'scope':'Synthetic browser integration only; no backend writes or activation','results':results},indent=2)+'\n');print(json.dumps(results))
finally:server.shutdown()
