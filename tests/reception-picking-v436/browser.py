"""Real frontend functions with synthetic RPC. No production writes."""
from pathlib import Path
import http.server, threading, json, os, shutil
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
class Handler(http.server.SimpleHTTPRequestHandler):
 def __init__(self,*args,**kwargs): super().__init__(*args,directory=str(ROOT),**kwargs)
 def log_message(self,*args): pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler)
threading.Thread(target=server.serve_forever,daemon=True).start()
origin=f'http://127.0.0.1:{server.server_port}'
results=[]
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path=os.environ.get('RECEPTION_CHROMIUM') or shutil.which('chromium') or shutil.which('google-chrome'),args=['--no-sandbox'])
 for width in [1366,390]:
  page=browser.new_page(viewport={'width':width,'height':844});errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(origin) else r.abort())
  page.goto(origin+'/styles.css')
  page.set_content('<link rel="stylesheet" href="/styles.css"><button id="opener">Abrir</button><div id="pickAuditModal" class="modal-backdrop rec-overlay" hidden><div class="modal-card pick-audit-card"></div></div>')
  page.evaluate("""async()=>{
   const {openAudit}=await import('/src/modules/picking-audit.js');
   const config={lunes_sabado:{turno1:{inicio:'07:00',fin:'19:00'},turno2:{inicio:'19:00',fin:'07:00'}},domingo:{turno1:{inicio:'07:00',fin:'18:00'},turno2:{inicio:'18:00',fin:'05:00'}}};
   const base={key_produccion:'QA',reserva:'R1',acabado:'BLANCO',longitud:20,cantidad_referencia:8};
   window.sources=[{...base,id_pieza:'p1',codigo_sap:'REF1',fabricacion:'FAB1'}, {...base,id_pieza:'p2',codigo_sap:'REF1',fabricacion:'FAB2',cantidad_referencia:12}, {...base,id_pieza:'p3',codigo_sap:'REF2',fabricacion:'FAB3',cantidad_referencia:3}];
   window.sent=[];window.open=()=>openAudit({target:{id_entrega:'qa',reserva:'R1'},rpc:async(name,args)=>{
    if(name==='sgp_picking_auditoria_contexto')return {version:'qa',fuentes:sources,faltantes:[]};
    if(name==='sgp_configuracion_general_obtener')return [{clave:'HORARIOS_TURNOS',valor:config}];
    if(name==='sgp_picking_auditoria_guardar'){sent.push(args);return {ok:true};}
    throw Error(name);
   },onSaved:async()=>{}});await window.open();
  }""")
  page.locator('[data-add]').click();assert page.locator('[data-piece]').count()==0
  page.locator('[data-reference]').select_option('REF1');assert page.locator('[data-piece]').count()==2
  page.locator('[data-piece]').nth(1).check();page.locator('[data-field="cantidad"]').fill('4')
  page.locator('[data-reference]').select_option('REF2');assert page.locator('[data-piece]:checked').count()==0
  page.locator('[data-save]').click();assert len(page.evaluate('sent'))==0
  page.locator('[data-piece]').check();page.locator('[data-field="cantidad"]').fill('2')
  page.locator('[data-date]').fill('2026-11-10');page.locator('[data-shift]').select_option('TURNO 1')
  page.locator('[data-save]').click();page.wait_for_function('sent.length===1')
  payload=page.evaluate('sent[0].p_diferencias[0]');assert payload['id_pieza']=='p3' and payload['cantidad']==2 and payload['reserva']=='R1'
  assert page.locator('#pickAuditModal').is_hidden()
  page.evaluate('window.open()');page.locator('[data-add]').click();page.locator('[data-reference]').select_option('REF1')
  for _ in range(5):page.locator('[data-add]').click()
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  page.keyboard.press('Escape');assert page.locator('#pickAuditModal').is_hidden()
  # Execute the actual pieces opener against its production rendering function.
  page.evaluate("""async()=>{
   const text=await (await fetch('/app.js')).text();
   const opener=text.slice(text.indexOf('async function openPickingAuditPieces('),text.indexOf('async function openPickingAudit(id)'));
   const fn=opener+';return openPickingAuditPieces';
   window.captured=null;
   const openPieces=new Function('sources',`let currentPieceRows,currentPieceContext,currentPieceView;
    const pickingReceptionRows=[{id_entrega:'qa'}],getSupabaseClient=async()=>({rpc:async()=>({data:{fuentes:sources}})}),getAppToken=()=>'',els={pieceModalTitle:{},pieceModalMeta:{},pieceModal:{}};
    const renderPieceModal=()=>window.captured=currentPieceRows;
    ${fn}`)(sources);
   await openPieces('qa');
  }""")
  assert [x['cantidad'] for x in page.evaluate('captured')]==[8,12,3]
  assert not errors,errors
  results.append({'width':width,'quantities':[8,12,3],'reference_then_fabrication':True,'stale_selection_cleared':True,'exact_identity_saved':True,'cancel_scroll':True,'synthetic_rpc':True});page.close()
 browser.close()
server.shutdown()
print(json.dumps(results,indent=2))
