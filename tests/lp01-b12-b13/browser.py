"""Current Ensamble workspace against isolated native SQL plus a scoped note UI stub.
The note store is synthetic; native SQL still checks its session/key/stage scope.
No manual production commands are exposed or sent by the new Ensamble route.
"""
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
     held=[];holding=[True];held_native=[];hold_native=[False];operation_reads=[0];proposal_reads=[0];operation_commands=[]
     notes={};note_commands=[];note_receipts={}
     page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(origin) else r.abort())
     def rpc(route):
      name=route.request.url.split('/rpc/')[-1];a=route.request.post_data_json
      if name=='sgp_lp_afectaciones_consultar_v2' and holding[0]:held.append(route);return
      if name=='sgp_lp_operacion_consultar':operation_reads[0]+=1
      if name=='sgp_lp_operacion_comando':operation_commands.append(a['p_cmd'])
      if name=='sgp_lp_propuesta_v1':proposal_reads[0]+=1
      if name=='sgp_lp_operacion_consultar' and hold_native[0]:held_native.append((route,db.rpc(name,a)));return
      try:
       if name=='sgp_sesion_actual':data=json.loads(db.sql('SELECT public.sgp_sesion_actual('+f.lit(a['p_token'])+')'))
       elif name=='sgp_mis_accesos':data=json.loads(db.sql("SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM public.sgp_mis_accesos("+f.lit(a['p_token'])+') x'))
       elif name in ['sgp_lp_operacion_consultar','sgp_lp_operacion_comando','sgp_lp_operacion_resultado']:data=db.rpc(name,a)
       elif name=='sgp_lp_propuesta_v1':data=json.loads(db.sql('SET ROLE anon;SELECT public.sgp_lp_propuesta_v1('+','.join([f.lit(a[k]) for k in ['p_token','p_key','p_linea','p_fecha']]+[str(a['p_turno']),'NULL' if a['p_cmd'] is None else f.lit(json.dumps(a['p_cmd']))+'::jsonb'])+')'))
       elif name=='sgp_lp_seguimiento_consultar':reads[0]+=1;data=json.loads(db.sql('SET ROLE anon;SELECT public.sgp_lp_seguimiento_consultar('+','.join(f.lit(a[k]) for k in ['p_token','p_etapa','p_linea'])+')'))
       elif name=='sgp_lp_afectaciones_consultar_v2':data=x.read2(a['p_token'],a['p_stage'])
       elif name in ['sgp_lp_order_details_read_v1','sgp_lp_order_note_save_v1']:
        # Only the note persistence is stubbed. Never bypass the native scope check.
        if a['p_key']!=x.key or a['p_stage']!='ENSAMBLE':raise ValueError('NO_AUTORIZADO')
        scope=x.read2(a['p_token'],a['p_stage']);can_note='REPORT' in scope['capabilities']
        note=notes.setdefault(a['p_key'],{'revision':0,'observation':'','history':[]})
        if name=='sgp_lp_order_details_read_v1':
         data={'contract':'LP-ORDER-DETAILS-1','key':a['p_key'],'line':'PANELES_2','stage':a['p_stage'],'note':{k:note[k] for k in ['revision','observation']},'history':note['history'],'capabilities':['READ','NOTE'] if can_note else ['READ'],'export':{'quantity':None,'percentage':None,'present':None}}
        else:
         if not can_note:raise ValueError('NO_AUTORIZADO')
         c=a['p_cmd'];note_commands.append(c);receipt=note_receipts.get(c['id'])
         if receipt:
          if receipt['command']!=c:raise ValueError('ORDER_NOTE_ID_REUSED')
          data={**receipt['result'],'duplicate':True}
         else:
          if c['revision']!=note['revision']:raise ValueError('ORDER_NOTE_REVISION_STALE')
          note['revision']+=1;note['observation']=c['observation'];note['history'].append({'id':c['id'],'revision':note['revision'],'observation':c['observation'],'stage':a['p_stage']})
          data={'contract':'LP-ORDER-NOTE-SAVED-1','key':a['p_key'],'id':c['id'],'revision':note['revision'],'observation':c['observation'],'duplicate':False}
          note_receipts[c['id']]={'command':c,'result':data}
       elif name=='sgp_pdt_registro_fuentes_v4':data=json.loads(db.sql('SET ROLE anon;SELECT public.sgp_pdt_registro_fuentes_v4('+','.join([f.lit(a['p_token']),f.lit(a['p_origen']),f.lit(json.dumps(a['p_contexto']))+'::jsonb'])+')'))
       else:raise ValueError('QA RPC not enabled '+name)
       route.fulfill(status=200,content_type='application/json',body=json.dumps(data))
      except Exception as e:route.fulfill(status=400,content_type='application/json',body=json.dumps({'code':'QA_ERROR','message':str(e)}))
     page.route('**/rest/v1/rpc/*',rpc);page.goto(origin+'/');page.wait_for_function("document.querySelector('#authStatus').textContent.length>3")
     if page.locator('#mobileMenuToggle').is_visible():page.locator('#mobileMenuToggle').click()
     page.locator('.nav [data-view="ensamble"]').click()
     if user=='COORDINADOR':
      page.locator('#productionTrackingTab').click();page.wait_for_selector('.lp-tracking-table');page.locator('.lp-tracking-table tbody summary').first.click();page.locator('[data-tracking-tab=Afectaciones]').click();page.wait_for_selector('.lp-pdt-compact');assert any(r['id']==original for r in (x.read2(user).get('aluminumPending') or x.read2(user)['pickingPending'])['rows']);assert page.locator('.lp-aluminum-pending').is_visible()
      assert page.locator('[data-order-affectations] form').is_hidden()
      page.locator('[data-tracking-tab=Historial]').click();page.locator('[data-advance-context] summary').click();value=page.locator('[data-tracking-context] option').nth(1).get_attribute('value');page.locator('[data-tracking-context]').select_option(value);page.locator('[data-tracking-tab=Afectaciones]').click();page.locator('[data-order-type=NC_AL]').click();page.locator('[data-register-affectation] summary').click();page.locator('[data-affect-context] button').click()
      page.locator('[data-order-type=NOVEDAD]').click();page.locator('[data-type-pane=NOVEDAD] [name=observation]').fill('Borrador que debe conservarse')
      page.evaluate("window.qaPanel=document.querySelector('[data-type-pane=NOVEDAD] form')");prior_reads=reads[0]
      db.sql("UPDATE public.sgp_producciones SET saldo_ensamble=287 WHERE key_produccion="+f.lit(x.key));page.clock.fast_forward(20000)
      page.wait_for_timeout(200);assert reads[0]>prior_reads,'Expected actual quiet RPC';assert page.evaluate("window.qaPanel===document.querySelector('[data-type-pane=NOVEDAD] form')");assert page.locator('[data-type-pane=NOVEDAD] [name=observation]').input_value()=='Borrador que debe conservarse'
      page.screenshot(path=str(HERE/f'evidence/app-tracking-{width}.png'),full_page=True)
      db.sql("UPDATE public.sgp_usuario_accesos SET permitido=false WHERE id_usuario=(SELECT id_usuario FROM public.sgp_usuarios WHERE usuario='COORDINADOR')")
      page.clock.fast_forward(20000);page.wait_for_function("!document.querySelector('.lp-aluminum-pending')")
     else:
      assert page.locator('#productionTrackingTab').is_hidden();page.locator('#productionAssemblyTab').click();page.locator('[data-op-date]').fill('2026-11-01');page.locator('[data-op-date]').dispatch_event('change');page.wait_for_selector('[data-assembly-key]:visible')
      assert page.locator('[data-live-orders] [data-assembly-key]').count()==1
      assert page.locator('[data-live-orders] [data-assembly-key]').first.get_attribute('data-assembly-key')==x.key
      assert 'Por validar' in page.locator('[data-live-orders] td[data-label=Semana]').inner_text()
      assert page.locator('[data-executed],[data-order-form],[data-open],[data-assignment-select]').count()==0
      page.locator('[data-live-orders] [data-order-summary]').scroll_into_view_if_needed()
      for _ in range(50):
       if held:break
       page.wait_for_timeout(100)
      assert len(held)==1,'The visible sheet summary must start one evidence read'
      page.screenshot(path=str(OUT/f'evidence/list-{width}.png'),full_page=True)
      before_execution=db.sql("SELECT coalesce(sum(ejecutado),0) FROM sgp_lp_operacion.ordenes WHERE etapa='ENSAMBLE'")
      page.locator('[data-live-orders] [data-assembly-detail]').first.click();page.wait_for_selector('section[data-assembly-detail]')
      note=page.locator('section[data-assembly-detail] [data-order-note]');note.wait_for(state='visible');page.wait_for_function("!document.querySelector('section[data-assembly-detail] [data-order-note]').disabled")
      for n in [6,8]:
       note.fill('QA falta material '+str(n));page.locator('section[data-assembly-detail] [data-order-note-save]').click()
       page.wait_for_function("document.querySelector('section[data-assembly-detail] [data-order-note-status]').textContent.includes('guardada') && !document.querySelector('section[data-assembly-detail] [data-order-note-refresh]').disabled")
      assert notes[x.key]['observation']=='QA falta material 8' and notes[x.key]['revision']==2
      note.fill('Borrador que debe conservarse');page.evaluate("window.qaPanel=document.querySelector('section[data-assembly-detail]')")
      # One table read and one independent detail read may be pending, never one per tick.
      for _ in range(50):
       if len(held)>=2:break
       page.wait_for_timeout(100)
      pending_evidence=len(held);assert pending_evidence==2
      page.clock.fast_forward(40000);page.wait_for_timeout(200);assert note.input_value()=='Borrador que debe conservarse'
      assert page.evaluate("window.qaPanel===document.querySelector('section[data-assembly-detail]')")
      assert len(held)==pending_evidence,'Background evidence reads must not overlap across 20s refresh cycles'
      assert operation_reads[0]>=3,'Native reads must remain available while evidence waits'
      holding[0]=False
      for route in held:rpc(route)
      page.wait_for_selector('.lp-pdt-compact');assert any(r['id']==original for r in (x.read2(user).get('aluminumPending') or x.read2(user)['pickingPending'])['rows']);assert page.locator('.lp-aluminum-pending').is_visible()
      assert page.locator('[data-proposal-save],[data-executed],[data-order-form],[data-bi-file],[data-close]').count()==0 and proposal_reads[0]==0
      assert page.locator('[data-shared-form] button[type=submit]').is_disabled(),'Missing shared contract cannot enable writes'
      assert not operation_commands and db.sql("SELECT coalesce(sum(ejecutado),0) FROM sgp_lp_operacion.ordenes WHERE etapa='ENSAMBLE'")==before_execution
      assert page.evaluate('document.documentElement.scrollWidth<=window.innerWidth+1')
      if width>850:
       nav=page.locator('.lp-assembly-order-nav').bounding_box();pane=page.locator('.lp-assembly-detail-pane').bounding_box();assert nav['x']<pane['x'] and abs(nav['y']-pane['y'])<25
      page.locator('[data-assembly-back]').scroll_into_view_if_needed()
      page.screenshot(path=str(OUT/f'evidence/detail-{width}.png'))
      page.locator('section[data-assembly-detail] [data-order-note-discard]').click()
     if width==1440:
      # A native response read before revocation must not resurrect a cleared view.
      held.clear();holding[0]=True
      page.locator('[data-assembly-back]').click();page.clock.fast_forward(20001)
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
      page.wait_for_function("document.querySelector('[data-live-orders]').textContent.includes('Acceso revocado')")
      page.evaluate("window.qaRevokedRowsRestored=false;window.qaRevokedObserver=new MutationObserver(()=>{if(document.querySelector('[data-live-orders] [data-assembly-key]'))window.qaRevokedRowsRestored=true;});window.qaRevokedObserver.observe(document.querySelector('[data-live-orders]'),{childList:true,subtree:true});")
      for route,old in held_native:route.fulfill(status=200,content_type='application/json',body=json.dumps(old))
      page.wait_for_timeout(200)
      assert page.locator('[data-order-form]').count()==0 and page.locator('[data-live-orders] [data-assembly-key]').count()==0
      assert not page.evaluate('window.qaRevokedRowsRestored'),'A response captured before revocation must never remount the sheet'
      page.evaluate('window.qaRevokedObserver.disconnect()')
     # Client-only fault injection: no SQL or network writes in this check.
     page.evaluate("""async()=>{const {mountProposal}=await import('/src/modules/lp01-proposal.js');const h=document.createElement('div');h.id='qa-proposal-fault';document.body.append(h);let reads=0;const scope={key:'QA',line:'L',date:'2026-11-05',shift:1};await mountProposal(h,{scope,enabled:true,isCurrent:()=>true,rpc:async(_,a)=>{if(a.p_cmd)return {contract:'LP-PROPOSAL-1',...scope,revision:1,id:a.p_cmd.id};if(reads++)throw Error('QA refresh failed');return {contract:'LP-PROPOSAL-1',...scope,revision:0,target:{date:'2026-11-05',shift:2},available:10,canWrite:true,history:[]};}});h.querySelector('input').value='5';h.querySelector('textarea').value='QA';h.querySelector('button').click();}""")
     page.wait_for_function("document.querySelector('#qa-proposal-fault').textContent.includes('Propuesta guardada. No se pudo actualizar')")
     assert not errors,errors;results.append({'width':width,'role':user,'originalPickingVisible':True,'existingController':True,'externalRequests':0,'proposalRpcCalls':proposal_reads[0],'notePersistence':'Synthetic UI store with native SQL scope checks','noteRevisions':len(note_commands),'manualProductionCommands':len(operation_commands),'delayedEvidenceMs':40000,'staleResponseAfterRevocationRejected':width==1440});page.close()
   finally:x.close()
  browser.close()
 (OUT/'browser-result.json').write_text(json.dumps(results,indent=2)+'\n');print(json.dumps(results))
finally:server.shutdown()
