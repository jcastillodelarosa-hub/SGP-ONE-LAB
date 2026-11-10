"""Actual modal → local HTTP adapter → real SQL. Managed Auth/PostgREST not certified."""
import http.server,threading,json,pathlib,subprocess,re,os
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2];os.chdir(ROOT)
OUT=ROOT/'tests/picking-audit/evidence';OUT.mkdir(exist_ok=True)
CONFIG={'lunes_sabado':{'turno1':{'inicio':'07:00','fin':'19:00'},'turno2':{'inicio':'19:00','fin':'07:00'}},'domingo':{'turno1':{'inicio':'07:00','fin':'18:00'},'turno2':{'inicio':'18:00','fin':'05:00'}}}
def sql(q):
 p=subprocess.run(['docker','exec','-i','sgp-audit-test','psql','-U','postgres','-d','sgp_parcial_integration','-At','-v','ON_ERROR_STOP=1'],input=q,text=True,capture_output=True)
 if p.returncode:raise RuntimeError(p.stderr)
 return p.stdout.strip()
def lit(v):
 if v is None:return 'null'
 if isinstance(v,(dict,list)):return "'"+json.dumps(v).replace("'","''")+"'::jsonb"
 return "'"+str(v).replace("'","''")+"'"
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_POST(self):
  try:
   args=json.loads(self.rfile.read(int(self.headers['Content-Length'])));name=args['name'];kw=args['args'];assert name in ['sgp_picking_auditoria_contexto','sgp_picking_auditoria_guardar','sgp_pdt_registro_fuentes_v4','sgp_configuracion_general_obtener']
   if name=='sgp_configuracion_general_obtener':result=json.loads(sql("select coalesce(jsonb_agg(to_jsonb(c)),'[]') from sgp_configuracion_general_obtener('qa-recepcion') c;"))
   else:
    assert all(re.fullmatch(r'p_[a-z_]+',k) for k in kw)
    result=json.loads(sql('set role anon;select '+name+"(p_token=>'qa-recepcion',"+','.join(k+'=>'+lit(v) for k,v in kw.items())+');').splitlines()[-1])
   self.send_response(200);self.end_headers();self.wfile.write(json.dumps(result).encode())
  except Exception as e:self.send_response(400);self.end_headers();self.wfile.write(str(e).encode())
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start()
# Create browser-only synthetic deliveries using the real registrar, independent of directed cases.
context={'__file__':str(ROOT/'tests/picking-audit/integration.py')}
exec((ROOT/'tests/picking-audit/integration.py').read_text().split("test('aceptar,")[0],context)
context['counter']=int(os.environ.get('AUDIT_BROWSER_COUNTER','200'))
fixtures=[context['fixture'](3),context['fixture'](3),context['fixture'](1)]
results=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium' if pathlib.Path('/usr/bin/chromium').exists() else None,args=['--no-sandbox'])
 for width,f in zip([1366,390],fixtures):
  prod=f['prod']
  target=json.loads(sql("select public.sgp_picking_recepcion_cola('qa-recepcion');"));target=next(x for x in target if x['produccion']==prod)
  page=browser.new_page(viewport={'width':width,'height':900 if width>400 else 844});page.goto('http://127.0.0.1:'+str(server.server_port)+'/styles.css')
  page.set_content('<link rel="stylesheet" href="/styles.css"><div id="pickAuditModal" class="modal-backdrop rec-overlay" hidden><div class="modal-card pick-audit-card"></div></div>')
  page.evaluate("""async target=>{const {openAudit}=await import('/src/modules/picking-audit.js');window.saved=false;await openAudit({target,rpc:async(name,args)=>{const r=await fetch('/rpc',{method:'POST',body:JSON.stringify({name,args})});if(!r.ok)throw Error(await r.text());return r.json();},onSaved:async()=>window.saved=true});}""",target)
  page.wait_for_selector('[data-action]');actions=page.locator('[data-action]');count=actions.count()
  for i in range(count):page.locator('[data-action]').nth(i).select_option('ACEPTAR')
  if count>1:
   page.locator('[data-action]').nth(1).select_option('MODIFICAR');page.locator('[data-field="motivo"]').fill('QA navegador: corrección física');page.locator('[data-field="cantidad"]').fill('3');page.locator('[data-field="ventanas_afectadas"]').fill('2')
  page.locator('[data-action]').nth(2).select_option('ELIMINAR');page.locator('[data-rows] .pick-audit-decision').nth(2).locator('[data-field="motivo"]').fill('QA rechazo: no falta material')
  for i in range(8):page.locator('[data-add]').click()
  metrics=page.locator('.pick-audit-body').evaluate('(el)=>({scroll:el.scrollHeight>el.clientHeight,offset:el.scrollTop})');assert metrics['scroll'] and metrics['offset']>0
  header=page.locator('.modal-header').bounding_box();assert header['y']>=0
  footer=page.locator('[data-save]').bounding_box();assert footer['y']>=0 and footer['y']+footer['height']<=page.viewport_size['height']
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  page.screenshot(path=str(OUT/f'scroll-{width}.png'))
  while page.locator('[data-remove]').count()>1:page.locator('[data-remove]').last.click()
  source=f['snap']['fuentes'][3];page.locator('[data-new] [data-reference]').select_option(source['codigo_sap'])
  key=json.dumps([source['key_produccion'],source['reserva'],source['id_pieza']],separators=(',',':'))
  page.locator('[data-new] [data-piece]').evaluate_all('(els,key)=>els.find(el=>el.value===key).click()',key);page.locator('[data-date]').fill('2026-10-30');page.locator('[data-shift]').select_option('TURNO 2')
  page.screenshot(path=str(OUT/f'decisions-{width}.png'))
  page.locator('[data-save]').click();page.wait_for_function("window.saved===true || document.querySelector('[data-error]')?.textContent",timeout=20000)
  assert page.evaluate('window.saved===true'),page.locator('[data-error]').inner_text()
  audit=json.loads(sql("select to_jsonb(a)-'payload' from sgp_picking_audit.eventos a where id_entrega='"+target['id_entrega']+"';"));assert audit['fecha_recepcion']=='2026-10-30'
  modified=f['snap']['faltantes'][1]['pendiente']['id_pendiente'];rejected=f['snap']['faltantes'][2]['pendiente']['id_pendiente']
  assert sql("select cantidad from sgp_aluminio_pendientes where id_pendiente='"+modified+"';")=='3'
  assert sql("select count(*) from sgp_aluminio_pendientes_historial where id_pendiente='"+modified+"' and tipo_evento='AUDITORIA_PICKING_MODIFICAR';")=='1'
  assert sql("select estado from sgp_aluminio_pendientes where id_pendiente='"+rejected+"';")=='ANULADO'
  active=json.loads(sql("set role anon;select sgp_aluminio_pendientes_listar_v2('qa-recepcion',true);").splitlines()[-1])['pendientes']
  assert not any(r['id_pendiente']==rejected for r in active)
  assert sql("select count(*) from sgp_aluminio_pendientes_historial where id_pendiente='"+rejected+"' and tipo_evento='AUDITORIA_PICKING_ELIMINAR';")=='1'
  assert sql("select count(*) from sgp_picking_audit.decisiones where id_entrega='"+target['id_entrega']+"';")=='3'
  assert sql("select count(*) from sgp_picking_auditoria_diferencias where id_entrega='"+target['id_entrega']+"';")=='1'
  results.append({'decisions':'aceptar/modificar/rechazar/agregar; same ID, history and active list verified','width':width,'scroll':metrics,'saved':True,'real_sql':True,'date':audit['fecha_recepcion'],'shift':audit['turno_recepcion']});page.close()
 # Explicit client fault injection: no claim that a synthetic response certifies SQL behavior.
 target=json.loads(sql("select public.sgp_picking_recepcion_cola('qa-recepcion');"));target=next(x for x in target if x['produccion']==fixtures[2]['prod'])
 page=browser.new_page(viewport={'width':390,'height':844});page.goto('http://127.0.0.1:'+str(server.server_port)+'/styles.css');page.set_content('<link rel="stylesheet" href="/styles.css"><div id="pickAuditModal" class="modal-backdrop rec-overlay" hidden><div class="modal-card pick-audit-card"></div></div>')
 page.evaluate("""async target=>{const {openAudit}=await import('/src/modules/picking-audit.js');window.attempts=0;window.mode='negative';await openAudit({target,rpc:async(name,args)=>{if(name==='sgp_picking_auditoria_guardar'){window.attempts++;if(window.mode==='negative')return {ok:false};}const r=await fetch('/rpc',{method:'POST',body:JSON.stringify({name,args})});if(!r.ok)throw Error(await r.text());return r.json();},onSaved:async()=>{throw Error('QA refresh disconnected');}});}""",target)
 page.locator('[data-save]').click();assert page.locator('[data-error]').inner_text();assert page.evaluate('window.attempts')==0
 page.locator('[data-action]').select_option('ACEPTAR');page.locator('[data-date]').fill('');page.locator('[data-save]').click();assert page.evaluate('window.attempts')==0
 page.locator('[data-date]').fill('2026-10-30');page.locator('[data-shift]').select_option('TURNO 2');page.locator('[data-save]').click();page.wait_for_function("document.querySelector('[data-error]').textContent.includes('no confirmó')")
 assert page.locator('#pickAuditModal').is_visible();assert sql("select count(*) from sgp_picking_audit.eventos where id_entrega='"+target['id_entrega']+"';")=='0'
 page.evaluate("window.mode='refresh'");page.locator('[data-save]').click();page.wait_for_function("document.querySelector('[data-error]').textContent.includes('Auditoría guardada')")
 assert page.locator('[data-save]').is_disabled();assert page.locator('[data-close]').first.is_enabled()
 assert sql("select count(*) from sgp_picking_audit.eventos where id_entrega='"+target['id_entrega']+"';")=='1'
 page.screenshot(path=str(OUT/'saved-refresh-error-390.png'))
 results.append({'case':'form validation, unconfirmed response and refresh failure after real save','client_fault_injection':True,'real_saved_events':1,'duplicate_save_disabled':True});page.close()
 browser.close()
server.shutdown();(OUT/'browser-results.json').write_text(json.dumps({'tests':results,'limitations':['Synthetic data only; actual modal and SQL functions. Local RPC transport; current captured shift configuration read by the real SQL configuration function in a synthetic database; no managed Auth/PostgREST, plant or physical-device certification.']},indent=2)+'\n');print(json.dumps(results))
