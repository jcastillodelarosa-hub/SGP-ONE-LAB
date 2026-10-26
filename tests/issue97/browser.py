"""Real mounted Resumen script + calendar/Production loader, synthetic read-only fixtures."""
import functools,http.server,json,pathlib,threading
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'tests/issue97/evidence'
class H(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_GET(self):
  if self.path=='/__issue97_fixture':
   self.send_response(200);self.send_header('Content-Type','text/html; charset=utf-8');self.end_headers();self.wfile.write(b'<!doctype html><meta charset="utf-8"><title>Issue97 fixture</title>');return
  super().do_GET()
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(H,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start();base='http://127.0.0.1:'+str(server.server_address[1])
app=(ROOT/'app.js').read_text();production=app[app.index('let productionBoardRequestSeq='):app.index('function prodWeekCalendarHtml')]
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);results=[]
  for width,height in [(1366,1000),(390,844)]:
   page=browser.new_page(viewport={'width':width,'height':height});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.route('https://**/*',lambda route:route.abort())
   page.goto(base+'/__issue97_fixture');page.set_content('<meta charset="UTF-8"><link rel="stylesheet" href="'+base+'/styles.css">'+__import__('re').search(r'<span[^>]+id="releaseVersion"[^>]*>[^<]+</span>',(ROOT/'index.html').read_text()).group()+'<p>Prueba local · datos sintéticos · sin Supabase</p><input id="prodDate" value="2026-10-26"><select id="prodShift"><option>TURNO 1</option></select><div id="prodBoard"></div><section data-mach-panel="programacion"><div class="prog-summary"></div><div class="toolbar"><select id="progWeek"><option value="44">44</option></select><button id="progRefresh">Actualizar</button></div><div class="prog-layout"><div>Programación por reserva conservada</div><div><div id="progAgenda"></div></div></div></section><div id="legacyCalendar"></div>')
   page.evaluate('''async args=>{
    const {readReprogramming}=await import(args.base+'/src/services/mecanizado-reprogramming.js');const {createCarryReader,enrichMoveSources}=await import(args.base+'/src/services/mecanizado-carry.js');const {operationalLoad,applyScheduleMoves}=await import(args.base+'/src/domain/mecanizado-operational-load.js');const {openWorkloadDetail,renderWorkloadCalendar}=await import(args.base+'/src/modules/mecanizado-operational-calendar.js');
    window.schedule=[{id_programacion:'new8',reserva:'R8',produccion:'Nueva QA',sistema:'ES-EL400',fecha_programacion:'2026-10-26',turno:'TURNO 1',estado:'PROGRAMADA',cantidad_programada:8,semana:44},{id_programacion:'source',reserva:'RM',produccion:'Movida QA',sistema:'ES-EL400',fecha_programacion:'2026-10-26',turno:'TURNO 2',estado:'PROGRAMADA',cantidad_programada:12,semana:44},{id_programacion:'target',reserva:'RM',produccion:'Movida QA',sistema:'ES-EL400',fecha_programacion:'2026-10-27',turno:'TURNO 2',estado:'PROGRAMADA',cantidad_programada:12,semana:44}];
    window.moves=[{id_origen:'source',id_destino:'target',produccion:'Movida QA'}];window.calls=[];window.denied=false;
    window.carry=[{id_programacion_origen:'old16',key_produccion:'16|PANELES_2',produccion:'Arrastre MX QA',reserva:'R16',sistema:'ES-MX4000',cantidad:16,estado:'SIN INICIAR',fecha_origen:'2026-10-24',turno_origen:'TURNO 2',semana:44},{id_programacion_origen:'old41',key_produccion:'41|PANELES_2',produccion:'Arrastre EL QA',reserva:'R41',sistema:'ES-EL400',cantidad:41,estado:'CORTE',fecha_origen:'2026-10-25',turno_origen:'TURNO 2',semana:44}];
    window.client={rpc:async(name,params)=>{window.calls.push({name,date:params.p_fecha,shift:params.p_turno});if(name==='sgp_mecanizado_pendientes_turno'){if(window.denied)return {error:new Error('Consulta denegada simulada')};return {data:params.p_fecha==='2026-10-26'&&params.p_turno==='TURNO 1'?window.carry:[]};}if(name==='sgp_mecanizado_reprogramaciones_listar')return {data:window.moves};if(name==='sgp_mecanizado_programacion_listar')return {data:window.schedule};if(name==='sgp_mecanizado_semanas_programacion')return {data:[]};throw new Error('RPC inesperada: '+name);},from:name=>{if(name==='sgp_mecanizado_reprogramaciones')throw new Error('Direct-table access prohibited');let rows=name==='sgp_mecanizado_programacion'?window.schedule:name==='sgp_mecanizado_reprogramaciones'?window.moves:[];const query={select:()=>query,eq:(key,value)=>{rows=rows.filter(row=>row[key]===value);return query;},neq:(key,value)=>{rows=rows.filter(row=>row[key]!==value);return query;},in:()=>query,order:()=>query,then:(resolve,reject)=>Promise.resolve({data:rows}).then(resolve,reject)};return query;}};
    window.reader=createCarryReader();
    const deps={deferredProductionLoad:{cancel(){}},refreshProductionPending:()=>{},machiningMetrics:{measure:async(k,n,task)=>task(),sync:(n,task)=>task()},getMecanizadoReadClient:async()=>window.client,getSupabaseClient:async()=>window.client,getAppToken:()=> 'SYNTHETIC',loadAluminumPending:()=>{},ensureSharedReservations:async()=>{},machiningCarry:window.reader,readReprogramming,enrichMoveSources,operationalLoad,applyScheduleMoves,escapeHtml:x=>String(x??'')};
    window.loadProduction=new Function('deps','const {'+Object.keys(deps).join(',')+'}=deps;let prodRows=[];const renderProductionBoard=()=>{window.prodSnapshot=structuredClone(prodRows)};'+args.production+';return loadProductionBoard;')(deps);
    await window.loadProduction();
    window.SGPWeeklySchedule=()=>window.schedule;window.SGPWeeklyDemand=()=>window.schedule.map(x=>({reserva:x.reserva,sistema:x.sistema,cantidad:x.cantidad_programada,semana:44}));window.SGPWeeklyDemandForWeeks=async()=>window.SGPWeeklyDemand();window.SGPWeeklyAnchor=()=> '2026-10-26';
    window.SGPOperationalLoad=async dates=>operationalLoad(window.schedule,await window.reader.week(window.client,'SYNTHETIC',dates),window.moves);
    window.SGPOpenOperationalDetail=openWorkloadDetail;window.renderCalendar=()=>renderWorkloadCalendar({host:document.querySelector('#legacyCalendar'),dates:['2026-10-26','2026-10-27','2026-10-28','2026-10-29','2026-10-30','2026-10-31','2026-11-01'],load:window.SGPOperationalLoad});
    document.querySelector('#progRefresh').onclick=()=>{window.reader.clear();window.dispatchEvent(new Event('sgp:programming-loaded'));};
   }''',{'base':base,'production':production})
   assert 'LAB v356' in page.locator('#releaseVersion').inner_text()
   assert page.evaluate('window.prodSnapshot.reduce((n,row)=>n+row.cantidad_programada,0)')==65
   page.locator('#prodBoard').evaluate('node=>node.remove()')
   page.add_script_tag(url=base+'/programacion-subtabs-v350.js')
   cell=page.locator('[data-sgp351-day="2026-10-26"][data-sgp351-shift="1"]');page.wait_for_function("[...document.querySelectorAll('[data-sgp351-day]')].some(n=>n.textContent.includes('65'))")
   assert '65' in cell.inner_text();assert '8 nuevas + 57 arrastre' in cell.locator('..').inner_text();assert '72,2% de 90' in cell.locator('..').inner_text()
   assert page.evaluate("window.calls.filter(call=>call.name==='sgp_mecanizado_pendientes_turno').length")==14
   # No duplicate new query when second calendar opens the same week.
   page.evaluate('window.renderCalendar()');page.wait_for_function("document.querySelector('#legacyCalendar').textContent.includes('65 ventanas')")
   assert page.evaluate("window.calls.filter(call=>call.name==='sgp_mecanizado_pendientes_turno').length")==14
   assert page.locator('#legacyCalendar [data-load-date="2026-10-26"][data-load-shift="TURNO 1"]').inner_text().find('65 ventanas')>=0
   page.locator('#legacyCalendar').evaluate('node=>node.hidden=true')
   assert page.evaluate('document.documentElement.scrollWidth')<=width
   page.screenshot(path=str(OUT/f'calendar-{width}.png'),full_page=True)
   cell.click();modal=page.locator('.mec-workload-modal');assert modal.is_visible();assert '8 nuevas + 57 arrastre = 65' in modal.inner_text();assert modal.locator('article').count()==3
   assert '2026-10-24 / TURNO 2' in modal.inner_text();assert modal.locator('[data-manage]').count()==0
   color=modal.locator('.state-sin-iniciar').first.evaluate('node=>getComputedStyle(node).backgroundColor');assert color=='rgb(229, 231, 235)',color
   assert modal.evaluate('node=>node.scrollWidth<=node.clientWidth+1')
   bounds=modal.bounding_box();assert bounds['y']>=-1 and bounds['y']+bounds['height']<=height+1,bounds
   page.screenshot(path=str(OUT/f'detail-{width}.png'),full_page=False)
   modal.locator('[data-close]').click();assert page.locator('.mec-workload-modal').count()==0
   origin=page.locator('[data-sgp351-day="2026-10-26"][data-sgp351-shift="2"]');assert 'Movida a 2026-10-27 / TURNO 2' in origin.locator('..').inner_text();assert 'Total: 0' in origin.inner_text();origin.click()
   assert 'Movida a 2026-10-27 / TURNO 2' in page.locator('.mec-workload-modal').inner_text();assert page.locator('.mec-workload-modal article').count()==0
   page.screenshot(path=str(OUT/f'moved-origin-{width}.png'),full_page=False);page.keyboard.press('Escape');page.locator('.mec-workload-modal').wait_for(state='detached')
   # Existing Reservas navigation stays available; readonly detail never adds execute buttons.
   page.locator('#sgpProgTabs [data-tab=reservas]').click();assert page.locator('#sgpProgLegacy').is_visible();page.locator('#sgpProgTabs [data-tab=resumen]').click();assert cell.is_visible()
   page.evaluate('''async()=>{const snapshot=await window.SGPOperationalLoad(['2026-10-26']);window.SGPOpenOperationalDetail({date:'2026-10-26',shift:'TURNO 1',rows:snapshot.rows,notes:snapshot.notes,canManage:true,onManage:date=>window.managedDate=date});}''')
   page.locator('[data-manage]').click();page.locator('.mec-workload-modal').wait_for(state='detached');assert page.evaluate('window.managedDate')=='2026-10-26'
   page.evaluate("window.denied=true;document.querySelector('#progRefresh').click()")
   page.wait_for_function("document.querySelector('#sgpProgView [role=alert]')?.textContent.includes('denegada')")
   assert page.locator('.sgp351-board').is_hidden();assert 'No se presume arrastre cero' in page.locator('#sgpProgView').inner_text()
   # Late response for an old calendar week cannot overwrite the new header.
   calendar=app[app.index('function renderProgCalendar(){'):app.index('function renderProgramming(')]
   page.evaluate('''async args=>{
    const {renderWorkloadCalendar}=await import(args.base+'/src/modules/mecanizado-operational-calendar.js');const {workloadTotals}=await import(args.base+'/src/domain/mecanizado-operational-load.js');
    const iso=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
    window.SGPOperationalCanManage=()=>false;window.SGPOperationalLoad=dates=>dates[0]==='2026-10-26'?new Promise(resolve=>window.resolveOldCalendar=resolve):Promise.resolve({rows:[{...window.schedule[0],tipo:'NUEVA',fecha_programacion:dates[0]}],notes:[],warnings:[]});
    const deps={progSchedule:window.schedule,progDateISO:iso,progWeekStart:value=>{const d=new Date(value+'T12:00:00');d.setDate(d.getDate()-(d.getDay()+6)%7);return d;},escapeHtml:value=>String(value??''),openProgDay:()=>{},renderWorkloadCalendar,workloadTotals};
    const render=new Function('deps','const {'+Object.keys(deps).join(',')+'}=deps;let progCalendarAnchor="2026-10-26";'+args.source+';return renderProgCalendar;')(deps);render();document.querySelector('#progAgenda [data-cal-next]').click();
   }''',{'source':calendar,'base':base})
   page.wait_for_function("document.querySelector('#progAgenda .prog-week-summary').textContent.includes('8')")
   page.evaluate("window.resolveOldCalendar({rows:[],notes:[],warnings:[]})");page.wait_for_timeout(30)
   assert '8' in page.locator('#progAgenda .prog-week-summary').inner_text()
   assert not errors,errors
   results.append({'viewport':[width,height],'active_component':'programacion-subtabs-v350.js Resumen 7days x2shifts','production_total':65,'calendar_total':65,'new':8,'carry':57,'systems':{'ES-MX4000_carry':16,'ES-EL400_carry':41},'occupancy':'72.2% of90','shared_RPC_queries':14,'no_per_order_N_plus_1':True,'origin_informational_only':True,'modal_scroll_close':True,'SIN_INICIAR_background':color,'backend_writes':0,'external_network_allowed':False,'errors':errors})
   page.close()
  browser.close()
 (OUT/'results.json').write_text(json.dumps(results,indent=2));print(json.dumps(results))
finally:server.shutdown()
