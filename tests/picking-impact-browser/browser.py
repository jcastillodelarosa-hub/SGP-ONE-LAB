"""Actual UI controllers with synthetic local RPCs only; no live data or writes."""
import functools,http.server,json,pathlib,threading,os
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=pathlib.Path('/tmp/sgp-picking-impact-browser');OUT.mkdir(exist_ok=True)
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start();url='http://127.0.0.1:'+str(server.server_address[1])
html=(ROOT/'index.html').read_text();section=html[html.index('<section class="view" data-view-panel="picking"'):html.index('<section class="view sgp-home"')].replace('data-view-panel="picking" hidden','data-view-panel="picking"')
setup='''async()=>{
 const {initPickingDeliveryReport}=await import('./src/modules/picking-delivery-report-controller.js');
 const {initPickingReceptionReport}=await import('./src/modules/picking-reception-report-controller.js');
 window.token='synthetic-admin';window.role='ADMINISTRADOR';window.saved=0;window.reads=0;window.auditSaves=0;window.complement=null;window.pauseContext=false;window.pendingResolve=null;
 window.row={id_recepcion:'demo-receipt',id_entrega:'demo-receipt',id_programacion:'demo-program',key_produccion:'DEMO|PANELES_2',produccion:'DEMO-001',reserva:'R-DEMO',sistema:'EL400',fecha_recepcion:'2026-11-16',turno_recepcion:'TURNO 1',registrado_en:'2026-11-16T14:00:00Z',nombre_entrego:'Operario ficticio',completa_al_recibir:false,semana_programada:47,cantidad_programada:10,impacto_paneles_version:1,pendientes_al_recibir:[{id_faltante:'f1',id_pendiente:'p1',perfil:'DEMO-A',fabricacion:'A',cantidad:4,ventanas_afectadas:null},{id_faltante:'f2',id_pendiente:'p2',perfil:'DEMO-B',fabricacion:'B',cantidad:2,ventanas_afectadas:null}],revisiones_areas:[]};
 window.context=()=>({ok:true,contract_version:1,can_complement:['ADMINISTRADOR','COORDINADOR'].includes(window.role),pendientes:structuredClone(window.row.pendientes_al_recibir),cantidad_programada:10,complemento:window.complement});
 const client={rpc:async(name,args)=>{
  if(name==='sgp_picking_reporte_recepciones_v1'){window.reads++;return {data:{ok:true,contract_version:1,rows:[{...structuredClone(window.row),impacto_complementario:window.complement}],total_rows:1,coverage:{},warnings:[]}};}
  if(name==='sgp_picking_impacto_contexto'){if(window.pauseContext)return new Promise(resolve=>window.pendingResolve=()=>resolve({data:window.context()}));return {data:window.context()};}
  if(name==='sgp_picking_impacto_complementar'){
   if(!['ADMINISTRADOR','COORDINADOR'].includes(window.role))throw Error('Synthetic permission denied');
   window.saved++;window.lastSave=structuredClone(args);window.complement={fuente:'COMPLEMENTO_POSTERIOR',registrado_en:'2026-11-17T14:00:00Z',nombre:'Coordinador ficticio',total_consolidado:args.p_detalle.total_consolidado,cantidad_programada_al_complementar:10};return {data:{ok:true}};
  }throw Error('Unexpected RPC '+name);
 }};
 initPickingDeliveryReport({getSupabaseClient:async()=>client,getAppToken:()=>window.token});initPickingReceptionReport({getSupabaseClient:async()=>client,getAppToken:()=>window.token});
 window.openAuditTest=async()=>{
  if(!document.querySelector('#pickAuditModal')){const modal=document.createElement('div');modal.id='pickAuditModal';modal.className='modal-backdrop rec-overlay';modal.innerHTML='<div class="modal-card pick-audit-card"></div>';document.body.append(modal);}
  const {openAudit}=await import('./src/modules/picking-audit.js');
  const schedule={turno1:{inicio:'00:00',fin:'12:00'},turno2:{inicio:'12:00',fin:'00:00'}};
  await openAudit({target:{id_entrega:'demo-audit',produccion:'DEMO-AUDIT',fecha_entrega:'2026-11-16',turno_entrega:'TURNO 1'},rpc:async(name,args)=>{
   if(name.endsWith('areas_contexto'))return {impacto_paneles_version:1,linea:'PANELES_2',fuentes:[],areas:[{id:'VERTICALES',nombre:'Verticales'}],revisados_ids:[],version:'synthetic',faltantes:[{id_faltante:'demo-f',perfil:'DEMO',cantidad:1,ventanas_afectadas:null,pendiente:{reserva:'R',acabado_pendiente:'WHITE'}}]};
   if(name==='sgp_configuracion_general_obtener')return [{clave:'HORARIOS_TURNOS',valor:{lunes_sabado:schedule,domingo:schedule}}];
   if(name==='sgp_picking_auditoria_area_guardar'){window.auditSaves++;window.auditPayload=args;return {ok:true};}throw Error('Unexpected audit RPC');
  },onSaved:()=>{}});
 };
}'''
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path=os.environ.get('SGP_CHROME_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox']);checks=[]
  for width,height in [(1440,1000),(390,844)]:
   page=browser.new_page(viewport={'width':width,'height':height});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.route('**/*',lambda r:r.continue_() if r.request.method=='GET' and r.request.url.startswith(url+'/') else r.abort())
   page.goto(url+'/styles.css');page.set_content('<base href="'+url+'/"><link rel="stylesheet" href="styles.css"><link rel="stylesheet" href="picking-delivery-report.css"><link rel="stylesheet" href="src/modules/lp01-followup.css"><header style="padding:12px;background:#103b73;color:white">PRUEBA LOCAL · DATOS FICTICIOS · NO PUBLICADO</header><main style="padding:16px;min-width:0">'+section+'</main>');page.evaluate(setup)
   page.locator('#pickReportTab').click();page.locator('#pickReportReceptionTab').click();page.locator('#pickReceptionReportWeek').fill('2026-W47');page.locator('#pickReceptionReportWeek').dispatch_event('change');page.locator('#pickReceptionReportRun').click();page.locator('[data-impact-complement]').wait_for()
   assert 'Paneles sin registrar' in page.locator('#pickReceptionReportRows').inner_text()
   # READ roles may inspect missing impact, but cannot obtain the write form.
   for role in ['PICKING','SUPERVISOR DE PICKING']:
    page.evaluate('(role)=>window.role=role',role);page.locator('[data-impact-complement]').click();modal=page.locator('.pick-impact-complement');modal.wait_for();assert modal.locator('form').count()==0;assert 'personal autorizado' in modal.inner_text();modal.locator('[data-close]').click()
   assert page.evaluate('window.saved')==0
   # Authorized explicit consolidation counts distinct panels once, not piece quantities.
   page.evaluate("window.role='ADMINISTRADOR'");page.locator('[data-impact-complement]').click();modal=page.locator('.pick-impact-complement');modal.locator('[data-impact="0"]').wait_for();assert modal.locator('[data-impact="0"]').input_value()==''
   b=modal.bounding_box();assert b['x']>=0 and b['x']+b['width']<=width+1 and b['height']<=height+1,(width,b)
   modal.locator('[data-impact="0"]').fill('2');modal.locator('[data-impact="1"]').fill('2');modal.locator('[name="consolidado"]').fill('3');modal.locator('[name="motivo"]').fill('Revisión sintética de paneles distintos');modal.screenshot(path=str(OUT/f'complement-form-{width}.png'));modal.locator('button[type="submit"]').click()
   page.wait_for_function('window.saved===1 && window.reads===2');assert modal.locator('button[type="submit"]').is_disabled();modal.locator('[data-close]').click()
   assert page.locator('#pickReceptionReportRows tbody tr').count()==1;assert page.evaluate('window.row.pendientes_al_recibir.every(p=>p.ventanas_afectadas===null)')
   summary=page.locator('#pickReceptionReportSummary');assert 'Total efectivo · actualizado' in summary.inner_text();assert summary.locator('.pick-report-kpi').last.locator('strong').inner_text()=='7'
   assert 'Actualizado' in page.locator('#pickReceptionReportRows').inner_text();page.locator('#pickReceptionReportRows summary').filter(has_text='Ver original').first.click();assert 'No registrado' in page.locator('#pickReceptionReportRows').inner_text()
   assert page.evaluate('document.documentElement.scrollWidth')<=width
   page.screenshot(path=str(OUT/f'updated-report-{width}.png'),full_page=True,animations='disabled')
   page.locator('#pickReceptionReportRun').click();page.wait_for_function('window.reads===3');assert page.locator('#pickReceptionReportRows tbody tr').count()==1;assert page.evaluate('window.saved')==1
   # An in-flight context from an old login must disappear, not be shown to the next user.
   page.evaluate('window.pauseContext=true');page.locator('[data-impact-complement]').click();page.wait_for_function('window.pendingResolve!==null');page.evaluate("window.token='synthetic-next-session';window.pendingResolve()");page.wait_for_function("document.querySelectorAll('.pick-impact-complement').length===0")
   # Existing audit accepts no default impact; missing value blocks the RPC.
   page.evaluate('window.openAuditTest()');audit=page.locator('#pickAuditModal');audit.locator('[data-area]').select_option('VERTICALES');audit.locator('[data-result]').select_option('CON_FALTANTES');audit.locator('[data-action]').select_option('ACEPTAR');field=audit.locator('[data-field="ventanas_afectadas"]');assert field.input_value()==''
   audit.locator('[data-save]').click();assert page.evaluate('window.auditSaves')==0;assert 'ventanas afectadas' in audit.locator('[data-error]').inner_text();field.fill('2');audit.screenshot(path=str(OUT/f'accept-impact-{width}.png'));audit.locator('[data-save]').click();page.wait_for_function('window.auditSaves===1');assert page.evaluate('window.auditPayload.p_decisiones[0].ventanas_afectadas')==2
   assert not errors,errors;checks.append({'width':width,'passed':True,'source':'synthetic local RPC fixture'});page.close()
  browser.close();(OUT/'result.json').write_text(json.dumps(checks,indent=2))
finally:server.shutdown()
