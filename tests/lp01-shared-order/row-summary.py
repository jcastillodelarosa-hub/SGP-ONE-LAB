"""Directed B10 integration: real controller/transports/helper, synthetic RPC responses."""
from pathlib import Path
import http.server,threading,json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];HERE=Path(__file__).parent
prefix=(ROOT/'tests/lp01-tracking-ui/fixture.html').read_text().split('<script type="module">')[0]
html=prefix+'''<script type="module">
import {mountOperation} from '/src/modules/lp01-operation.js';
document.querySelector('#productionTrackingPanel').append(document.querySelector('#tracking'));document.querySelector('#productionOperationPanel').append(document.querySelector('#operation'));
window.qaSaved=[];window.qaHistory=[];window.qaToken='QA';window.qaMode='shared';window.qaReads=[];
const key='QA|PANELES_2';
const bridge={getToken:()=>qaToken,getClient:async()=>({rpc:async(name,args)=>{
 qaReads.push({name,args});const stage=args.p_stage||args.p_etapa,line='PANELES_2';
 if(name==='sgp_lp_seguimiento_consultar')return {data:{contract:'LP-SEGUIMIENTO-1',role:'COORDINADOR',line,stage,productions:[{key,line,stage,classification:'ABIERTA',assignments:[],operations:[],history:[],oficial:{key_produccion:key,id_linea:line,produccion:'QA',sistema:'QA',saldos_inicializados:true,presente_ultimo_export:true,saldo_ensamble:20,saldo_empaque:20,cantidad:30,anio:2026,semana_base:44}}]}};
 if(name==='sgp_lp_order_details_read_v1')return {error:{code:'42883',message:'missing'}};
 if(name==='sgp_lp_shared_order_command_v1'){const c=args.p_cmd;qaSaved.push({id:c.id,key,origin_stage:stage,cause:c.cause,quantity:c.quantity,solved:0,confirmed:0,source_ref:c.sourceRef,nc_reference:c.ncReference});qaHistory.push({reportId:c.id,revision:qaHistory.length+1});return {data:{contract:'LP-SHARED-COMMAND-1',key,id:c.id,reportId:c.id,revision:qaHistory.length,duplicate:false}};}
 if(name==='sgp_lp_afectaciones_consultar_v2')return {data:{contract:'LP-AFFECTATIONS-2',key,line,stage,revision:0,reports:[{id:'legacy',originStage:stage,cause:'NC_V',quantity:10,solved:0,confirmed:0}],events:[],capabilities:['READ'],available:8,consolidated:{quantity:12,balance:20,revision:0},aluminumPending:{status:'AVAILABLE',rows:qaMode==='save'?[{id:'p1',key,readOnly:true,contract:'V2',reference:'PERFIL-1',state:'PENDIENTE',pieceQuantity:8}]:[]}}};
 if(name==='sgp_lp_shared_order_read_v1'){
  if(qaMode==='unavailable')return {error:{code:'42883',message:'missing function'}};
  if(qaMode==='revoked')return {error:{code:'P0001',message:'NO_AUTORIZADO'}};
  if(qaMode==='held')await new Promise(resolve=>window.qaRelease=resolve);
  const reports=[{id:'shared',key,origin_stage:stage==='ENSAMBLE'?'EMPAQUE':'ENSAMBLE',cause:'NC_V',quantity:3,solved:0,confirmed:0},{id:'accessory',key,origin_stage:stage,cause:'ACCESORIOS',quantity:1,solved:0,confirmed:0}];
  return {data:{contract:'LP-SHARED-ORDER-1',key:qaMode==='mismatch'?'FOREIGN|PANELES_2':key,line,stage,revision:qaMode==='save'?qaHistory.length:0,canReport:qaMode==='save',stageBalance:20,reports:qaMode==='save'?qaSaved:reports,history:qaMode==='save'?qaHistory:[],legacyReports:qaMode==='overlap'?[{causa:'NC_V',ventanas:2,confirmadas:0}]:[],accessories:[]}};
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
   page.evaluate("qaMode='save';controller.load()")
   page.wait_for_function("document.querySelector('[data-order-summary]')?.textContent.includes('8 × NC AL · Estimado')")
   page.locator('[data-register-order]').click();page.wait_for_selector('[data-source-estimates]')
   assert '8 ventanas estimadas' in page.locator('[data-source-estimates]').inner_text()
   page.locator('[data-estimate-source]').click();form=page.locator('[data-shared-form]')
   assert form.locator('[name=quantity]').input_value()=='8'
   form.locator('[name=quantity]').fill('21');assert not form.locator('[name=quantity]').evaluate('(el)=>el.checkValidity()');assert page.evaluate('qaSaved.length')==0
   form.locator('[name=quantity]').fill('3');form.locator('[name=observation]').fill('Revisadas, tres ventanas')
   form.locator('[type=submit]').click();page.wait_for_function("document.querySelector('[data-shared-status]')?.textContent==='Guardado.'")
   assert '3 × NC AL' in row.inner_text() and 'por definir' not in row.inner_text() and 'Estimado' not in row.inner_text()
   assert row.locator('[data-summary-cause="NC_AL"]').count()==1
   assert page.evaluate('qaSaved.length')==1
   page.locator('[data-order-type=NC_V]').click();form=page.locator('[data-type-pane=NC_V] [data-shared-form]')
   form.locator('[name=ncReference]').fill('NC-ONE');assert form.locator('[name=quantity]').input_value()==''
   assert not form.locator('[name=quantity]').evaluate('(el)=>el.checkValidity()');assert page.evaluate('qaSaved.length')==1
   form.locator('[name=quantity]').fill('2');form.locator('[name=observation]').fill('Dos ventanas, una NC');form.locator('[type=submit]').click()
   page.wait_for_function("document.querySelector('[data-order-summary]')?.textContent.includes('2 × NC V')")
   assert 'estimación 1 (1 por NC)' in row.inner_text() and 'Total por validar' in row.inner_text()
   page.evaluate('controller.load()');page.wait_for_function("document.querySelector('[data-order-summary]')?.textContent.includes('3 × NC AL')")
   assert '2 × NC V' in row.inner_text() and 'por definir' not in row.inner_text()
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
   page.screenshot(path=f'/tmp/saved-window-summary-{width}.png',full_page=True)
   page.reload();page.wait_for_function("document.querySelector('[data-order-summary]')?.textContent.includes('3 × NC V')")
   page.evaluate("qaMode='overlap';controller.load()")
   page.wait_for_function("document.querySelector('[data-order-summary]')?.textContent.includes('reportadas: 3 / 2')&&document.querySelector('[data-order-summary]')?.textContent.includes('Accesorios')")
   page.evaluate("qaMode='unavailable';controller.load()")
   page.wait_for_function("document.querySelector('[data-order-summary]')?.textContent.includes('lectura heredada')")
   assert '10 × NC V' in row.inner_text() and 'Total 12' not in row.inner_text() and 'Disponibles 8' not in row.inner_text()
   page.locator('[data-columns-reset]').click();assert 'lectura heredada' in row.inner_text()
   page.locator('[data-tracking-status]').select_option('ABIERTA');assert 'lectura heredada' in row.inner_text()
   page.evaluate('controller.load()');page.wait_for_function("document.querySelector('[data-order-summary]')?.textContent.includes('lectura heredada')")
   page.evaluate("qaMode='mismatch';controller.load()")
   page.wait_for_function("document.querySelector('[data-order-summary] .lp-summary-pending')?.textContent==='Datos pendientes'")
   assert row.locator('[data-summary-source=EXPORT]').inner_text()=='Tecno · sin dato'
   assert row.locator('[data-summary-cause]:not([data-summary-source=EXPORT])').count()==0 and 'Total ' not in row.inner_text()
   page.evaluate("qaMode='revoked';controller.load()")
   page.wait_for_function("document.querySelector('[data-op-status]')?.textContent.includes('Acceso revocado')")
   assert page.locator('[data-order-summary]').count()==0
   page.evaluate("qaMode='held';controller.load()")
   page.wait_for_function('typeof qaRelease===\'function\'')
   page.evaluate("qaToken='changed';document.dispatchEvent(new CustomEvent('sgp:lp-role',{detail:'CONSULTA'}));qaRelease()")
   page.wait_for_timeout(100);assert page.locator('[data-order-summary]').count()==0
   assert not errors,errors;results.append({'width':width,'saved_row_immediate_and_reload':True,'single_aluminum_badge_with_editable_estimate_in_detail':True,'shared_cross_stage_and_accessories':True,'overlap_not_summed':True,'unavailable_labeled_legacy':True,'internal_table_redraw_preserves_badges':True,'invalid_identity_unavailable':True,'revocation_and_stale_response_cleared':True,'pageErrors':errors});page.close()
  browser.close()
 (HERE/'row-summary-result.json').write_text(json.dumps({'scope':'Synthetic browser integration only; no backend writes or activation','results':results},indent=2)+'\n');print(json.dumps(results))
finally:server.shutdown()
