# Approved B hierarchy: isolated browser fixtures, no production connection.
import http.server,threading,os,pathlib
from playwright.sync_api import sync_playwright
root=pathlib.Path(__file__).resolve().parents[2];os.chdir(root)
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('RECEPTION_CHROMIUM','/usr/bin/chromium'),args=['--no-sandbox'])
  for width in [1440,768,390]:
   page=browser.new_page(viewport={'width':width,'height':900});page.goto('http://127.0.0.1:'+str(server.server_port)+'/styles.css');page.set_content('<link rel="stylesheet" href="/styles.css"><div id="pickAuditModal" class="modal-backdrop rec-overlay" hidden><div class="modal-card pick-audit-card"></div></div>')
   page.evaluate('''async()=>{const {openAudit}=await import('/src/modules/picking-audit.js');await openAudit({target:{id_entrega:'qa',produccion:'QA semana 47',reserva:'RES-1048',sistema:'Paneles',fecha_entrega:'2026-11-16',turno_entrega:'TURNO 1'},rpc:async(name,args)=>name==='sgp_configuracion_general_obtener'?[{clave:'HORARIOS_TURNOS',valor:{lunes_sabado:{turno1:{inicio:'07:00',fin:'19:00'},turno2:{inicio:'19:00',fin:'07:00'}},domingo:{turno1:{inicio:'07:00',fin:'18:00'},turno2:{inicio:'18:00',fin:'05:00'}}}}]:name==='sgp_picking_auditoria_areas_contexto'?{version:'qa',linea:'PANELES_2',fuentes:[{id_pieza:'qa-piece',key_produccion:'qa-key',reserva:'qa-reserva',acabado:'BL',codigo_sap:'QA-SAP',fabricacion:'VERTICAL',cantidad_referencia:5}],faltantes:[],areas:[{id:'VERTICALES',nombre:'Verticales'},{id:'ZOCALERO',nombre:'Zocalero (top y bottom)',revision:{usuario:'Operador QA',resultado:'SIN_FALTANTES',fecha:'2026-11-16',turno:'TURNO 1'}}]}:name==='sgp_picking_auditoria_nc_consultar'?{ok:true,nc:args.p_referencia==='QA-NC'?{numero:'QA-NC',estado:'ABIERTA'}:null}:{ok:true},onSaved:()=>window.saved=true});}''')
   page.wait_for_function("getComputedStyle(document.querySelector('.modal-header')).backgroundColor==='rgb(255, 255, 255)'")
   assert page.locator('.sgp-window-context').inner_text().startswith('QA semana 47')
   assert page.locator('.sgp-window-section-title').count()==2
   assert page.locator('label').filter(has=page.locator('[data-area]')).inner_text().startswith('Sección')
   assert page.locator('.pick-audit-area-status[data-area-state="pending"]').count()==1
   assert page.locator('.pick-audit-area-status[data-area-state="audited"]').count()==1
   assert page.evaluate("getComputedStyle(document.querySelector('.pick-audit-area-status[data-area-state=pending]')).color==='rgb(154, 52, 18)'")
   assert page.evaluate("getComputedStyle(document.querySelector('.pick-audit-area-status[data-area-state=audited]')).color==='rgb(22, 101, 52)'")
   assert page.evaluate("parseFloat(getComputedStyle(document.querySelector('#pickAuditTitle')).fontSize)>parseFloat(getComputedStyle(document.querySelector('.sgp-window-guide')).fontSize)")
   assert page.evaluate("getComputedStyle(document.querySelector('.sgp-window-guide')).color==='rgb(82, 101, 124)'")
   assert page.evaluate("getComputedStyle(document.querySelector('.pick-audit-body')).overflowY==='auto'")
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   out=pathlib.Path(os.environ.get('SGP_VISUAL_OUTPUT','/tmp/sgp-window-b'));out.mkdir(parents=True,exist_ok=True)
   page.screenshot(path=str(out/f'audit-{width}.png'),full_page=True)
   page.locator('[data-area]').select_option('VERTICALES');page.locator('[data-result]').select_option('CON_FALTANTES');page.locator('[data-shift]').select_option('TURNO 1')
   page.locator('[data-add]').click();page.locator('[data-reference]').select_option('QA-SAP');page.locator('[data-piece]').check();page.locator('[data-field="nc"]').fill('QA-NC');page.locator('[data-field="nc"]').press('Tab')
   page.wait_for_function("document.querySelector('[data-nc-info]').textContent.includes('ABIERTA')")
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   page.screenshot(path=str(out/f'audit-with-missing-{width}.png'),full_page=True)
   page.locator('[data-save]').click();page.wait_for_function('window.saved===true');page.close()
  browser.close();print('PASS hierarchy/layout and audit flow 1440/768/390 synthetic')
finally:server.shutdown()
