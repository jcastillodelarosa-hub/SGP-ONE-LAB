"""Existing SGP Seguimiento and Operation controllers against isolated native SQL."""
from pathlib import Path
import importlib.util,json,http.server,threading,uuid
from playwright.sync_api import sync_playwright
HERE=Path(__file__).resolve().parents[1]/'lp01-afectaciones-rpc';ROOT=HERE.parents[1];OUT=ROOT/'tests/lp01-b12-b13';import sys;sys.path.insert(0,str(HERE))
spec=importlib.util.spec_from_file_location('atomic_app_fixture',HERE/'atomic.py');f=importlib.util.module_from_spec(spec);spec.loader.exec_module(f)
class Files(http.server.SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT),**kw)
 def log_message(self,*a):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Files);threading.Thread(target=server.serve_forever,daemon=True).start();origin=f'http://127.0.0.1:{server.server_port}'
results=[]
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,args=['--no-sandbox'])
  for width in [1440,390]:
   x=f.Fixture()
   try:
    db=x.db;db.sql('GRANT EXECUTE ON FUNCTION public.sgp_lp_seguimiento_consultar(text,text,text) TO anon;UPDATE sgp_lp_afectaciones.config SET writes=true,physical=true,atomic_pdt=true,pdt_links=true')
    ctx={'id_programacion':'00000000-0000-0000-0000-000000000001','produccion':'QA ORDER','completa':False,'fecha_entrega':'2026-11-01','turno':'TURNO 1'}
    original=json.loads(db.sql('SET ROLE anon;SELECT public.sgp_pdt_registrar_v4('+','.join([f.lit('COORDINADOR'),f.lit('PICKING'),f.lit(json.dumps(ctx))+'::jsonb',f.lit(json.dumps(x.pieces()))+'::jsonb',f.lit(str(uuid.uuid4()))])+')'))['ids_pendientes'][0]
    db.sql((ROOT/'docs/sql-proposals/lp01-propuestas/01_propuesta_REVIEW.sql').read_text())
    db.sql('GRANT EXECUTE ON FUNCTION public.sgp_lp_propuesta_v1(text,text,text,date,int,jsonb) TO anon;UPDATE sgp_lp_propuestas.config SET enabled=true')
    db.execute(db.cmd('SALE',key=x.key,part=x.parts[0],quantity=10,observation='QA validado'))
    for user in ['ll']:
     page=browser.new_page(viewport={'width':width,'height':950});page.clock.install();reads=[0];errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.add_init_script("sessionStorage.setItem('sgp_one_session',"+json.dumps(user)+")")
     held=[];holding=[True];held_native=[];hold_native=[False];operation_reads=[0];proposal_reads=[0]
     page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(origin) else r.abort())
     def rpc(route):
      name=route.request.url.split('/rpc/')[-1];a=route.request.post_data_json
      if name=='sgp_lp_afectaciones_consultar_v2' and holding[0]:held.append(route);return
      if name=='sgp_lp_operacion_consultar':operation_reads[0]+=1
      if name=='sgp_lp_propuesta_v1':proposal_reads[0]+=1
      if name=='sgp_lp_operacion_consultar' and hold_native[0]:held_native.append((route,db.rpc(name,a)));return
      try:
       if name=='sgp_sesion_actual':data=json.loads(db.sql('SELECT public.sgp_sesion_actual('+f.lit(a['p_token'])+')'))
       elif name=='sgp_mis_accesos':data=json.loads(db.sql("SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM public.sgp_mis_accesos("+f.lit(a['p_token'])+') x'))
       elif name in ['sgp_lp_operacion_consultar','sgp_lp_operacion_comando','sgp_lp_operacion_resultado']:data=db.rpc(name,a)
       elif name=='sgp_lp_propuesta_v1':data=json.loads(db.sql('SET ROLE anon;SELECT public.sgp_lp_propuesta_v1('+','.join([f.lit(a[k]) for k in ['p_token','p_key','p_linea','p_fecha']]+[str(a['p_turno']),'NULL' if a['p_cmd'] is None else f.lit(json.dumps(a['p_cmd']))+'::jsonb'])+')'))
       elif name=='sgp_lp_seguimiento_consultar':reads[0]+=1;data=json.loads(db.sql('SET ROLE anon;SELECT public.sgp_lp_seguimiento_consultar('+','.join(f.lit(a[k]) for k in ['p_token','p_etapa','p_linea'])+')'))
       elif name=='sgp_lp_afectaciones_consultar_v2':data=x.read2(a['p_token'],a['p_stage'])
       elif name=='sgp_pdt_registro_fuentes_v4':data=json.loads(db.sql('SET ROLE anon;SELECT public.sgp_pdt_registro_fuentes_v4('+','.join([f.lit(a['p_token']),f.lit(a['p_origen']),f.lit(json.dumps(a['p_contexto']))+'::jsonb'])+')'))
       else:raise ValueError('QA RPC not enabled '+name)
       route.fulfill(status=200,content_type='application/json',body=json.dumps(data))
      except Exception as e:route.fulfill(status=400,content_type='application/json',body=json.dumps({'code':'QA_ERROR','message':str(e)}))
     page.route('**/rest/v1/rpc/*',rpc);page.goto(origin+'/');page.wait_for_function("document.querySelector('#authStatus').textContent.length>3")
     if page.locator('#mobileMenuToggle').is_visible():page.locator('#mobileMenuToggle').click()
     page.locator('.nav [data-view="ensamble"]').click()
     if user=='COORDINADOR':
      page.locator('#productionTrackingTab').click();page.wait_for_selector('.lp-tracking-table');page.locator('.lp-tracking-table tbody summary').first.click();page.locator('[data-tracking-tab=Afectaciones]').click();page.wait_for_selector('.lp-picking-pending article');assert original in page.locator('.lp-picking-pending').inner_text()
      assert page.locator('[data-order-affectations] form').is_hidden()
      value=page.locator('[data-tracking-context] option').nth(1).get_attribute('value');page.locator('[data-tracking-context]').select_option(value)
      page.locator('[data-tracking-content] [name=cause]').select_option('NOVEDAD');page.locator('[data-tracking-content] [name=observation]').fill('Borrador que debe conservarse')
      page.evaluate("window.qaPanel=document.querySelector('[data-order-affectations] form')");prior_reads=reads[0]
      db.sql("UPDATE public.sgp_producciones SET saldo_ensamble=287 WHERE key_produccion="+f.lit(x.key));page.clock.fast_forward(20000)
      page.wait_for_timeout(200);assert reads[0]>prior_reads,'Expected actual quiet RPC';assert page.evaluate("window.qaPanel===document.querySelector('[data-order-affectations] form')");assert page.locator('[data-tracking-content] [name=observation]').input_value()=='Borrador que debe conservarse'
      page.screenshot(path=str(HERE/f'evidence/app-tracking-{width}.png'),full_page=True)
      db.sql("UPDATE public.sgp_usuario_accesos SET permitido=false WHERE id_usuario=(SELECT id_usuario FROM public.sgp_usuarios WHERE usuario='COORDINADOR')")
      page.clock.fast_forward(20000);page.wait_for_function("!document.querySelector('.lp-picking-pending')")
     else:
      assert page.locator('#productionTrackingTab').is_hidden();page.locator('#productionAssemblyTab').click();page.locator('[data-op-date]').fill('2026-11-01');page.locator('[data-op-date]').dispatch_event('change');page.wait_for_selector('[data-order-part]:visible')
      assert page.locator('[data-live-orders] [data-order-part]').count()==1
      assert 'Semana no disponible' in page.locator('[data-live-orders]').inner_text()
      page.screenshot(path=str(OUT/f'evidence/list-{width}.png'),full_page=True)
      page.locator('[data-live-orders] [data-live-operate]').first.click();page.wait_for_selector('[data-order-form]')
      page.locator('[data-assignment-select]').select_option(x.parts[0])
      for n in [6,8]:
       page.locator('[data-executed]').fill(str(n));page.locator('[data-operation-note]').fill('QA falta material')
       page.locator('[data-order-form] button[type=submit]').click()
       page.wait_for_function('(n)=>document.querySelector("[data-order-total]")?.textContent.includes(": "+n)',arg=n)
      assert db.sql("SELECT ejecutado FROM sgp_lp_operacion.ordenes WHERE etapa='ENSAMBLE' AND parte="+f.lit(x.parts[0]))=='8'
      assert page.locator('[data-assignment-select]').count()==1
      page.locator('[data-executed]').fill('9');page.clock.fast_forward(40000);page.wait_for_timeout(200);assert page.locator('[data-executed]').input_value()=='9'
      assert len(held)==1,'Background evidence reads must not overlap across 20s refresh cycles'
      assert operation_reads[0]>=3,'Native reads/writes must remain available while evidence waits'
      holding[0]=False
      for route in held:rpc(route)
      page.wait_for_timeout(100)
      page.locator('summary').filter(has_text='Propuesta de disponibilidad').click()
      page.wait_for_function("document.querySelector('[data-proposal-panel]')?.textContent.includes('pendiente de habilitación autorizada')")
      assert page.locator('[data-proposal-save]').count()==0 and proposal_reads[0]==0
      page.locator('[data-individual-affects] > summary').click();page.wait_for_selector('.lp-picking-pending article');assert original in page.locator('.lp-picking-pending').inner_text()
      assert page.locator('[data-affect-save]').is_disabled()
      assert page.evaluate('document.documentElement.scrollWidth<=window.innerWidth+1')
      if width>850:
       nav=page.locator('.lp-operation-order-nav').bounding_box();pane=page.locator('.lp-operation-form-pane').bounding_box();assert nav['x']<pane['x'] and abs(nav['y']-pane['y'])<25
      page.locator('[data-back]').scroll_into_view_if_needed()
      page.screenshot(path=str(OUT/f'evidence/detail-{width}.png'))
     if width==1440:
      # A native response read before revocation must not resurrect a cleared view.
      held.clear();holding[0]=True
      page.evaluate("document.querySelector('[data-op-load]').click()")
      for _ in range(50):
       if held:break
       page.wait_for_timeout(100)
      assert len(held)==1
      hold_native[0]=True;page.clock.fast_forward(20000)
      for _ in range(50):
       if held_native:break
       page.wait_for_timeout(100)
      assert len(held_native)==1
      db.sql("UPDATE public.sgp_usuario_accesos SET permitido=false WHERE id_usuario=(SELECT id_usuario FROM public.sgp_usuarios WHERE usuario='ll')")
      holding[0]=False
      for route in held:rpc(route)
      page.wait_for_function("document.querySelector('[data-op-status]').textContent.includes('No se pudo verificar el acceso')")
      for route,old in held_native:route.fulfill(status=200,content_type='application/json',body=json.dumps(old))
      page.wait_for_timeout(200)
      assert page.locator('[data-order-form]').count()==0 and page.locator('[data-live-orders] [data-order-part]').count()==0
     # Client-only fault injection: no SQL or network writes in this check.
     page.evaluate("""async()=>{const {mountProposal}=await import('/src/modules/lp01-proposal.js');const h=document.createElement('div');h.id='qa-proposal-fault';document.body.append(h);let reads=0;const scope={key:'QA',line:'L',date:'2026-11-05',shift:1};await mountProposal(h,{scope,enabled:true,isCurrent:()=>true,rpc:async(_,a)=>{if(a.p_cmd)return {contract:'LP-PROPOSAL-1',...scope,revision:1,id:a.p_cmd.id};if(reads++)throw Error('QA refresh failed');return {contract:'LP-PROPOSAL-1',...scope,revision:0,target:{date:'2026-11-05',shift:2},available:10,canWrite:true,history:[]};}});h.querySelector('input').value='5';h.querySelector('textarea').value='QA';h.querySelector('button').click();}""")
     page.wait_for_function("document.querySelector('#qa-proposal-fault').textContent.includes('Propuesta guardada. No se pudo actualizar')")
     assert not errors,errors;results.append({'width':width,'role':user,'originalPickingVisible':True,'existingController':True,'externalRequests':0,'proposalRpcCalls':proposal_reads[0],'replacementTotal':8,'delayedEvidenceMs':40000,'staleResponseAfterRevocationRejected':width==1440});page.close()
   finally:x.close()
  browser.close()
 (OUT/'browser-result.json').write_text(json.dumps(results,indent=2)+'\n');print(json.dumps(results))
finally:server.shutdown()
