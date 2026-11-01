"""Actual navigation + actual read-only UI, explicit synthetic RPC responses. No write certification."""
from pathlib import Path
import http.server,threading,json,os
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];os.chdir(ROOT);OUT=ROOT/'tests/lp01-seguimiento/evidence';OUT.mkdir(exist_ok=True)
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start()
results=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,args=['--no-sandbox'])
 for width in [1440,390]:
  page=browser.new_page(viewport={'width':width,'height':900 if width>400 else 844});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.route('**/*',lambda route:route.continue_() if route.request.url.startswith('http://127.0.0.1:') else route.abort())
  page.goto('http://127.0.0.1:'+str(server.server_port)+'/')
  page.evaluate('''()=>{
   document.querySelector('[data-view-panel="ensamble"]').hidden=false;
   const banner=document.createElement('p');banner.textContent='QA · DATOS SINTÉTICOS · SIN ESCRITURAS';document.querySelector('[data-view-panel="ensamble"]').prepend(banner);
   const products=[{key_produccion:'QA1|PANELES_2',produccion:'TORRE NORTE',id_linea:'PANELES_2',sistema:'ES7100',reserva_al:'R1,R2',saldos_inicializados:true,ensamblado:100,empacado:40,saldo_ensamble:188,saldo_empaque:248,estado_mecanizado:'MECANIZADO',observacion_mecanizado:'P1 procesada · P2 pendiente',pendientes_mecanizado:'PDT PANEL en validación'},
    {key_produccion:'QA2|PANELES_2',produccion:'TORRE NORTE',id_linea:'PANELES_2',sistema:'ES7100',reserva_al:'R3',saldos_inicializados:false,saldo_ensamble:null,saldo_empaque:null,estado_mecanizado:'CORTE'}];
   window.calls=[];window.failRead=false;
   window.SGPPlannerBridge.getToken=()=> 'qa-synthetic';window.SGPPlannerBridge.getClient=async()=>({rpc:async(name,args)=>{
    window.calls.push({name,args});if(!['sgp_linea_plan_consultar','sgp_consultar_ensamble'].includes(name))throw Error('Unexpected RPC: '+name);
    if(window.failRead)return {error:{message:'QA no disponible'},data:null};
    return {error:null,data:name==='sgp_consultar_ensamble'?{filas:products}:[
     {id:'A1',key_produccion:'QA1|PANELES_2',fecha:args.p_desde,turno:1,prioridad:1,cantidad:90,ejecutado:30,estado:'ABIERTA',produccion:'TORRE NORTE',sistema:'ES7100',observacion:'Falta vidrio',creado_por:'QA Líder'},
     {id:'A2',key_produccion:'QA1|PANELES_2',fecha:args.p_desde,turno:2,prioridad:2,cantidad:90,ejecutado:0,estado:'PROGRAMADA',produccion:'TORRE NORTE',sistema:'ES7100',origen_id:'P0'},
     {id:'A3',key_produccion:'QA2|PANELES_2',fecha:args.p_desde,turno:1,prioridad:3,cantidad:18,ejecutado:18,estado:'FINALIZADA',produccion:'TORRE NORTE',sistema:'ES7100'}]};
   }});
  }''')
  page.locator('#productionTrackingTab').click();page.wait_for_selector('.lp-followup-order');assert page.locator('.lp-followup-order').count()==3
  page.locator('[data-week]').fill('2026-W44');page.locator('[data-week]').dispatch_event('change');page.wait_for_function("document.querySelector('[data-status]').textContent.includes('2026-10-26')")
  page.locator('[data-search]').fill('vidrio');assert page.locator('.lp-followup-order').count()==1;page.locator('[data-search]').fill('')
  page.locator('[data-shift]').select_option('2');assert page.locator('.lp-followup-order').count()==1;page.locator('[data-shift]').select_option('')
  page.locator('.lp-followup-order').first.locator('summary').click();page.locator('#productionTrackingPanel').screenshot(path=str(OUT/f'tracking-{width}.png'))
  page.locator('[data-operate]').first.click();assert page.locator('#productionOperationPanel').is_visible()
  page.locator('[data-stage]').select_option('EMPAQUE');assert '248' in page.locator('[data-stage-context]').inner_text()
  page.locator('[data-quantity]').fill('61');page.locator('[data-review]').click();assert 'no superar' in page.locator('[data-draft-status]').inner_text()
  page.locator('[data-quantity]').fill('20');page.locator('[data-review]').click();assert 'observación' in page.locator('[data-draft-status]').inner_text()
  page.locator('[data-note]').fill('QA material pendiente');page.locator('[data-review]').click();assert 'sin guardar' in page.locator('[data-draft-status]').inner_text()
  assert page.locator('.lp-followup-actions button:disabled').count()==3
  page.locator('#productionOperationPanel').screenshot(path=str(OUT/f'operation-{width}.png'))
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  followup_calls=page.evaluate('window.calls');assert all(x['name'] in ['sgp_linea_plan_consultar','sgp_consultar_ensamble'] for x in followup_calls)
  page.locator('#productionLocationsTab').click();assert page.locator('#assemblyLocationReportPanel').is_visible()
  page.locator('#productionPlannerTab').click();assert page.locator('#productionPlannerPanel').is_visible()
  page.locator('#productionTrackingTab').click()
  page.evaluate('''()=>{window.originalClient=window.SGPPlannerBridge.getClient;window.releases=[];window.SGPPlannerBridge.getClient=async()=>({rpc:async()=>{await new Promise(resolve=>window.releases.push(resolve));return {error:null,data:[]};}});}''')
  page.locator('[data-refresh]').click();page.wait_for_function('window.releases.length===2')
  page.evaluate("window.SGPPlannerBridge.getToken=()=> 'qa-session-changed';window.releases.forEach(resolve=>resolve())")
  page.wait_for_function("document.querySelector('[data-status]').textContent.includes('sesión cambió')");assert page.locator('.lp-followup-order').count()==0
  page.evaluate("window.SGPPlannerBridge.getClient=window.originalClient;window.SGPPlannerBridge.getToken=()=> 'qa-synthetic';window.failRead=true");page.locator('[data-refresh]').click();page.wait_for_function("document.querySelector('[data-status]').textContent.includes('QA no disponible')");assert page.locator('.lp-followup-order').count()==0
  calls=page.evaluate('window.calls');assert not any(any(word in x['name'] for word in ['guardar','registrar','programar','mover','arrastrar']) for x in calls)
  assert not errors,errors
  results.append({'viewport':width,'assignments':3,'identity_homonyms':True,'filters':True,'navigation_legacy':True,'draft_only':True,'write_calls':0,'read_error_clears_rows':True,'late_session_discarded':True});page.close()
 browser.close()
server.shutdown();(OUT/'browser-results.json').write_text(json.dumps({'results':results,'scope':'Real UI/navigation; synthetic RPC response fixtures. Not backend, plant, authenticated-role or write verification.'},indent=2)+'\n');print(json.dumps(results))
