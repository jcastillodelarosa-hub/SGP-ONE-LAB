"""Actual weekly summary + read bridge + reducer; synthetic state only, external traffic blocked."""
import pathlib,functools,http.server,threading,json
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'tests/issue103/evidence'
class H(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_GET(self):
  if self.path=='/__issue103':
   self.send_response(200);self.send_header('Content-Type','text/html');self.end_headers();self.wfile.write(b'<!doctype html><meta charset=utf-8>');return
  super().do_GET()
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(H,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start();base='http://127.0.0.1:'+str(server.server_address[1])
app=(ROOT/'app.js').read_text();bridge=app[app.index('// Issue103:'):app.index('window.SGPWeeklyAnchor=')]
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'],headless=True);reports=[]
  for width,height in [(1366,1000),(390,844)]:
   page=browser.new_page(viewport={'width':width,'height':height});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.route('https://**/*',lambda route:route.abort());page.goto(base+'/__issue103')
   # Isolate from application boot/network; actual summary/bridge run below with explicit fixture clients.
   page.set_content('<meta charset="utf-8"><link rel="stylesheet" href="'+base+'/styles.css"><header><h1>SGP · LAB v359 · demostración local</h1><p>Datos sintéticos, sin Supabase</p></header><section data-mach-panel="programacion"><div class="prog-summary"></div><div class="toolbar"><select id="progWeek"><option>44</option><option>45</option></select><button id="progRefresh">Actualizar</button></div><div class="prog-layout"><div></div><div id="progAgenda"></div></div></section>')
   page.evaluate('''async args=>{
    const {physicalProgress}=await import(args.base+'/src/domain/mecanizado-operational-load.js');
    window.token='SYNTHETIC';window.queries=[];window.failed=false;window.physicalDelay=0;
    const make=(id,system,q,week,date,production)=>({id_programacion:id,reserva:'QA'+id,sistema:system,cantidad_programada:q,semana_origen:week,fecha_programacion:date,turno:'TURNO 1',produccion:production,estado:'PROGRAMADA'});
    window.schedule=[make('A','ES-MX4000',8,44,'2026-10-26','A'),make('B','ES-EL400',57,44,'2026-10-23','B'),make('C','ES-MX4000',20,45,'2026-11-02','C'),make('D','ES-EL400',10,44,'2026-10-24','D'),make('E','ES-EL400',10,45,'2026-10-27','D')];window.schedule[4].reserva='QAD';
    const moves=[{id_origen:'D',id_destino:'E',produccion:'D'}];
    window.tables={sgp_mecanizado_ejecucion:[{id_programacion:'A',estado:'CORTE',cantidad_procesada:3},{id_programacion:'B',estado:'PROCESADO',cantidad_procesada:0},{id_programacion:'C',estado:'PROCESADO',cantidad_procesada:20},{id_programacion:'E',estado:'MECANIZADO',cantidad_procesada:2}],sgp_mecanizado_ejecucion_orden:[],sgp_produccion_reservas_v:[]};
    const client={rpc:async(name)=>{window.queries.push(name);return {data:[],error:null};},from:table=>{
     let values=null,field=null,start=0,end=499;const q={select:()=>q,in:(f,v)=>{field=f;values=v;return q;},order:()=>q,range:(a,b)=>{start=a;end=b;return q;},then:(resolve,reject)=>{window.queries.push(table);setTimeout(()=>{if(window.failed&&table==='sgp_mecanizado_ejecucion')resolve({error:{message:'Lectura denegada (simulada)'}});else resolve({data:window.tables[table].filter(r=>values.includes(r[field])).slice(start,end+1),error:null});},25);}};return q;
    }};
    new Function('getAppToken','getMecanizadoReadClient','progSchedule','progMoves','progMovesError','physicalProgress',args.bridge)(()=>window.token,async()=>client,window.schedule,moves,'',physicalProgress);
    window.dispatchEvent(new Event('sgp:programming-loaded'));
    const read=window.SGPWeeklyPhysicalProgress;window.SGPWeeklyPhysicalProgress=async args=>{const result=await read(args);if(window.physicalDelay)await new Promise(r=>setTimeout(r,args.weeks.includes(44)?120:5));return result;};
    window.SGPWeeklySchedule=()=>window.schedule;window.SGPWeeklyDemand=()=>[];window.SGPWeeklyDemandForWeeks=async()=>[];window.SGPWeeklyAnchor=()=> '2026-10-26';
    window.SGPOperationalLoad=async dates=>({rows:[{...window.schedule[0],tipo:'NUEVA'},{...window.schedule[1],tipo:'ARRASTRE',fecha_programacion:'2026-10-26'},{...window.schedule[1],tipo:'ARRASTRE',fecha_programacion:'2026-10-27'},{...window.schedule[4],semana_origen:44,tipo:'NUEVA'}].filter(r=>dates.includes(r.fecha_programacion)),notes:[],warnings:[]});
    document.querySelector('#progRefresh').onclick=()=>{window.dispatchEvent(new Event('sgp:programming-loading'));setTimeout(()=>window.dispatchEvent(new Event('sgp:programming-loaded')),10);};
   }''',{'base':base,'bridge':bridge})
   page.add_script_tag(url=base+'/programacion-subtabs-v350.js?v=359')
   def ready(values):
    page.wait_for_function('(values)=>Array.from(document.querySelectorAll("[data-physical-totals] strong")).slice(0,3).map(x=>Number(x.textContent.replace(/\\./g,""))).join(",")===values.join(",")',arg=values)
   def check_week(week,value):
    page.locator('.sgp351-weekdropdown').evaluate('(n)=>n.open=true');page.locator('[data-sgp351-week="'+str(week)+'"]').set_checked(value)
   ready([75,62,13]);assert page.locator('.sgp359-table tbody tr').count()==2;assert 'Carga operativa por sistema' in page.locator('#sgpProgView').inner_text();assert '132' in page.locator('.sgp351-cards').inner_text();assert page.evaluate('window.queries.length')==4
   assert page.evaluate('document.documentElement.scrollWidth<=window.innerWidth'), 'progress page overflow'
   assert page.locator('.sgp359-table').evaluate('(node)=>node.getBoundingClientRect().right<=window.innerWidth'), 'progress table overflow'
   page.locator('.sgp359-progress').scroll_into_view_if_needed();page.screenshot(path=str(OUT/f'progress-{width}.png'),full_page=True)
   page.locator('.sgp359-progress').screenshot(path=str(OUT/f'progress-detail-{width}.png'))
   check_week(45,True);ready([95,82,13]);assert page.evaluate('window.queries.length')==4
   page.locator('[data-sgp351-system]').select_option('ES-MX4000');ready([28,23,5]);assert page.evaluate('window.queries.length')==4
   page.locator('[data-sgp351-system]').select_option('');ready([95,82,13]);page.locator('[data-physical-order]').select_option('processed');assert page.locator('.sgp359-table th').nth(2).get_attribute('aria-sort')=='ascending'
   # Reordered week responses must not replace the latest filter result.
   page.evaluate('window.physicalDelay=1');check_week(44,False);ready([20,20,0]);page.wait_for_timeout(160);ready([20,20,0]);assert page.evaluate('window.queries.length')==4
   page.evaluate('window.failed=true');page.locator('[data-sgp351-refresh]').click();page.wait_for_function("document.querySelector('.sgp359-progress [role=alert]')?.textContent.includes('Lectura denegada')");assert page.locator('[data-physical-totals]').count()==0
   page.locator('.sgp359-progress').scroll_into_view_if_needed();page.screenshot(path=str(OUT/f'error-{width}.png'))
   page.evaluate('window.failed=false;window.physicalDelay=0');page.locator('[data-physical-retry]').click();ready([20,20,0])
   before=page.evaluate('window.queries.length');page.evaluate("window.token=''");check_week(44,True);page.wait_for_function("document.querySelector('.sgp359-progress [role=alert]')?.textContent.includes('sesión')");assert page.locator('[data-physical-totals]').count()==0;assert page.evaluate('window.queries.length')==before
   assert not errors,errors
   assert page.evaluate('document.documentElement.scrollWidth<=window.innerWidth'), 'page overflow'
   reports.append({'viewport':[width,height],'week44':{'programmed':75,'processed':62,'pending':13,'workload':132},'multiweek':[95,82,13],'system_filter':[28,23,5],'destination_preserves_origin_week':True,'filter_queries_after_initial_snapshot':0,'failed_read_has_no_zeros':True,'retry':True,'session_change_hides_old_data':True,'responsive_no_page_overflow':True,'external_network_allowed':False,'errors':errors});page.close()
  browser.close();(OUT/'browser.json').write_text(json.dumps(reports,indent=2));print(json.dumps(reports))
finally:server.shutdown()
