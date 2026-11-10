"""Offline Chromium checks of real Export review frontend with synthetic RPC only."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,os,mimetypes
ROOT=Path(__file__).resolve().parents[2]
OUT=Path(os.environ.get('EXPORT_QA_OUT','/tmp/export-select-all-qa'));OUT.mkdir(parents=True,exist_ok=True)
fixture='''<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body style="padding:20px"><h2>Detalle por semanas</h2><input id="dailyExportFile" type="file"><select id="dailyExportLine"><option>PANELES_2</option></select><button id="previewDailyExport">Comparar</button><button id="applyDailyExport">Aplicar selección</button><button id="dailyExportPending">Pendientes</button><button id="dailyExportAbsent">Ausentes</button><div id="dailyExportStatus"></div><div id="dailyExportMetrics"></div><div id="dailyExportWeeks" class="daily-week-table"></div><script type="module">
import {createExportReview} from '/src/modules/export-review.js';
window.calls=[];window.rows=[...Array.from({length:20},(_,i)=>({id:'row-'+i,estado:'PENDIENTE',tipo_cambio:[i===0?'SALDOS_ARCHIVADA':'CANTIDAD'],produccion:'PRODUCCIÓN DE PRUEBA '+i,key_produccion:'TEST'+i+'|PANELES_2',anterior:{cantidad:10,semana_actual:46,saldo_ensamble:6,saldo_empaque:8},propuesto:{cantidad:10,semana_actual:46,saldo_ensamble:3,saldo_empaque:5}})),{id:'blocked',estado:'BLOQUEADA',tipo_cambio:['ARCHIVADA','SEMANA'],produccion:'ARCHIVADA BLOQUEADA'}];
window.review=createExportReview({getToken:()=> 'synthetic',readWorkbook:async()=>({rows:[{id_linea:'PANELES_2'}],errors:[]}),getClient:async()=>({rpc:async(name,args)=>{calls.push({name,args});return {data:name==='sgp_export_preparar'?{lote_id:'batch',filas:rows}:name==='sgp_export_revisiones_listar'?{revisiones:[{lote_id:'pending',filas:rows}]}:{aprobados:args.p_filas?.length,pendientes:0}};}})});
document.querySelector('#previewDailyExport').onclick=()=>review.preview();document.querySelector('#applyDailyExport').onclick=()=>review.apply();
</script></body></html>'''
results=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('EXPORT_CHROMIUM','/usr/bin/chromium'),args=['--no-sandbox'])
 for width in [1440,390]:
  page=browser.new_page(viewport={'width':width,'height':900});errors=[];external=[]
  page.on('pageerror',lambda error:errors.append(str(error)))
  def route(r):
   url=r.request.url
   if not url.startswith('http://export.test/'):
    external.append(url);r.abort();return
   name=url.removeprefix('http://export.test/').split('?')[0]
   if not name:r.fulfill(content_type='text/html',body=fixture);return
   path=ROOT/name
   if path.is_file():r.fulfill(content_type=mimetypes.guess_type(name)[0] or 'text/plain',body=path.read_bytes())
   else:r.fulfill(status=404,body='Not found')
  page.route('**/*',route);page.goto('http://export.test/');page.wait_for_function('!!window.review')
  page.locator('#dailyExportFile').set_input_files({'name':'synthetic.xlsx','mimeType':'application/octet-stream','buffer':b'qa'})
  page.locator('#previewDailyExport').click()
  all=page.get_by_role('button',name='Seleccionar todos',exact=True);none=page.get_by_role('button',name='Deseleccionar todos',exact=True)
  all.wait_for();assert page.locator('[data-export-approval]').count()==20
  assert page.locator('[data-export-approval]:checked').count()==0;assert none.is_disabled()
  assert page.locator('[data-export-selection-count]').inner_text()=='0 de 20 seleccionados'
  all.click();assert page.locator('[data-export-approval]:checked').count()==20;assert all.is_disabled()
  assert page.evaluate('calls.length')==1
  page.locator('[data-export-approval]').first.uncheck();assert not all.is_disabled()
  assert page.locator('[data-export-selection-count]').inner_text()=='19 de 20 seleccionados'
  none.click();assert page.locator('[data-export-approval]:checked').count()==0
  all.focus();page.keyboard.press('Enter');assert page.locator('[data-export-approval]:checked').count()==20
  assert all.bounding_box()['x']>=0 and none.bounding_box()['x']+none.bounding_box()['width']<=width
  page.screenshot(path=str(OUT/f'select-all-{width}.png'),full_page=True)
  def cancel(dialog):dialog.dismiss()
  page.on('dialog',cancel);page.locator('#applyDailyExport').click();assert page.evaluate('calls.length')==1;assert page.locator('[data-export-approval]:checked').count()==20
  page.remove_listener('dialog',cancel);page.on('dialog',lambda dialog:dialog.accept());page.locator('#applyDailyExport').click()
  page.wait_for_function('calls.length===2');payload=page.evaluate('calls[1].args.p_filas');assert payload==['row-'+str(i) for i in range(20)];assert 'blocked' not in payload
  assert page.locator('[data-export-select]').count()==0
  page.locator('#dailyExportPending').click();page.locator('[data-review]').click();assert page.locator('[data-export-approval]:checked').count()==0;all.click();assert page.locator('[data-export-approval]:checked').count()==20
  page.evaluate('review.reset()');assert page.locator('[data-export-select]').count()==0
  page.evaluate("rows=[rows.at(-1)]");page.locator('#previewDailyExport').click();all.wait_for();assert all.is_disabled() and none.is_disabled();assert page.locator('[data-export-selection-count]').inner_text()=='0 de 0 seleccionados'
  assert not errors,errors;assert not external,external
  results.append({'width':width,'status':'PASS','checks':['none selected initially','select/deselect all','individual override and counter','keyboard','blocked excluded','cancel preserves selection','confirmed exact payload','pending review restored unselected','reset','blocked-only disabled','no external traffic']});page.close()
 browser.close()
(OUT/'results.json').write_text(json.dumps(results,indent=2));print(json.dumps(results,indent=2))
