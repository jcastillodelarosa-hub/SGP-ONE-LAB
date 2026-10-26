"""Real index shell, weekly summary, read bridge and reducer; synthetic data, no production connection."""
import pathlib,functools,http.server,threading,json,re
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'tests/mecanizado-base-progress/evidence'
class H(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_GET(self):
  if self.path=='/__base_progress':
   self.send_response(200);self.send_header('Content-Type','text/html');self.end_headers();self.wfile.write(b'<!doctype html><meta charset=utf-8>');return
  super().do_GET()
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(H,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start();base='http://127.0.0.1:'+str(server.server_address[1])
app=(ROOT/'app.js').read_text();bridge=app[app.index('// Issue103:'):app.index('window.SGPWeeklyAnchor=')]
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);reports=[]
  for width,height in [(1366,1000),(390,844)]:
   page=browser.new_page(viewport={'width':width,'height':height});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base+'/') else r.abort());page.goto(base+'/__base_progress')
   page.set_content(re.sub(r'<script\b[^>]*>.*?</script>','',(ROOT/'index.html').read_text(),flags=re.S|re.I))
   page.evaluate('''()=>{
    document.querySelectorAll('[data-view-panel]').forEach(n=>n.hidden=n.dataset.viewPanel!=='mecanizado');document.querySelectorAll('[data-mach-panel]').forEach(n=>n.hidden=n.dataset.machPanel!=='programacion');document.querySelectorAll('[data-mach-tab]').forEach(n=>n.classList.toggle('active',n.dataset.machTab==='programacion'));
    document.querySelector('#progWeek').innerHTML='<option value="44">44</option><option value="45">45</option>';
    const note=document.createElement('p');note.textContent='Demostración local · datos sintéticos · ningún cambio productivo';document.querySelector('.topbar').after(note);
   }''')
   assert page.locator('#releaseVersion').inner_text()=='LAB v360'
   page.evaluate('''async args=>{
    const {basePhysicalProgress}=await import(args.base+'/src/domain/mecanizado-base-progress.js');window.token='SYNTHETIC';window.queries=[];window.failBase=false;window.receiptMode='complete';window.delay=0;
    const prod=(key,q,system,reserve,week=44,year=2026)=>({key_produccion:key,id_linea:'PANELES_2',anio:year,semana_base:week,sistema:system,cantidad:q,produccion:'P'+key,reserva_al:reserve});
    window.baseRows=[prod('EL1',430,'ES-EL400','R1'),prod('EL2',277,'ES-EL400','R2'),prod('MX1',100,'ES-MX4000','R3'),prod('MX2',58,'ES-MX4000','R4'),prod('SG1',120,'ES-SGD2020','R5'),prod('SG2',107,'ES-SGD2020','R6'),prod('NC',14,'NC-300','R7'),prod('NEXT',20,'ES-MX4000','R8',45),prod('YEAR',33,'ES-MX4000','RY',44,2027)];
    window.schedule=window.baseRows.filter(p=>['EL1','MX1','SG1'].includes(p.key_produccion)).map(p=>({id_programacion:p.key_produccion,reserva:p.reserva_al,sistema:p.sistema,produccion:p.produccion,cantidad_programada:p.cantidad,fecha_programacion:'2026-10-26',turno:'TURNO 1',estado:'PROGRAMADA',semana_origen:44}));
    window.tables={sgp_mecanizado_ejecucion:[{id_programacion:'EL1',estado:'MECANIZADO',cantidad_procesada:300},{id_programacion:'MX1',estado:'MECANIZADO',cantidad_procesada:60},{id_programacion:'SG1',estado:'MECANIZADO',cantidad_procesada:80}],sgp_mecanizado_ejecucion_orden:[],sgp_produccion_reservas_v:window.baseRows.map(p=>({...p,reserva:p.reserva_al,semana_produccion:p.semana_base}))};
    const client={rpc:async(name,args)=>{window.queries.push(name+':'+(args.p_anio||'')+':'+(args.p_semana||''));await new Promise(r=>setTimeout(r,20));
     if(name==='sgp_consultar_programacion_semana'){if(window.failBase)return {error:{message:'Base denegada (simulada)'}};return {data:{producciones:window.baseRows.filter(p=>p.anio===args.p_anio&&p.semana_base===args.p_semana)}};}
     if(name==='sgp_recepcion_listar')return {data:window.receiptMode==='none'?[]:['R1','R3','R5'].map(reserva=>({reserva,estado:'RECIBIDA',completa:!(window.receiptMode==='partial'&&reserva==='R1'),fecha_recepcion:'2026-10-26'}))};return {data:[]};
    },from:table=>{let field,values,start=0,end=499;const q={select:()=>q,in:(f,v)=>{field=f;values=v;return q;},order:()=>q,range:(a,b)=>{start=a;end=b;return q;},then:(resolve)=>{window.queries.push(table);return Promise.resolve({data:window.tables[table].filter(r=>values.includes(String(r[field]))).slice(start,end+1)}).then(resolve);}};return q;}};
    new Function('getAppToken','getMecanizadoReadClient','progSchedule','progMoves','progMovesError','basePhysicalProgress',args.bridge)(()=>window.token,async()=>client,window.schedule,[],'',basePhysicalProgress);
    window.dispatchEvent(new Event('sgp:programming-loaded'));
    const real=window.SGPWeeklyPhysicalProgress;window.SGPWeeklyPhysicalProgress=async args=>{const result=await real(args);if(window.delay)await new Promise(r=>setTimeout(r,args.weeks.includes(44)?120:5));return result;};
    window.SGPWeeklySchedule=()=>window.schedule;window.SGPWeeklyDemand=()=>[];window.SGPWeeklyDemandForWeeks=async()=>[];window.SGPWeeklyAnchor=()=> '2026-10-26';window.SGPOperationalLoad=async()=>({rows:window.schedule.map(r=>({...r,tipo:'NUEVA'})),notes:[],warnings:[]});
    document.querySelector('#progRefresh').onclick=()=>{window.dispatchEvent(new Event('sgp:programming-loading'));setTimeout(()=>window.dispatchEvent(new Event('sgp:programming-loaded')),15);};
   }''',{'base':base,'bridge':bridge})
   page.add_script_tag(url=base+'/programacion-subtabs-v350.js?v=360')
   def totals(expected):
    page.wait_for_function('(values)=>Array.from(document.querySelectorAll("[data-physical-totals] strong")).map(x=>x.textContent.replace(/\\./g,"")).join("|")===values.map(String).join("|")',arg=expected)
   def capture(name):
    page.locator('.sgp359-progress').evaluate('n=>{n.querySelector("[data-qa-note]")?.remove();const p=document.createElement("p");p.dataset.qaNote="";p.textContent="Datos sintéticos de prueba · no es una consulta productiva";n.querySelector("h3").after(p);}');page.locator('.sgp359-progress').screenshot(path=str(OUT/f'{name}-{width}.png'))
   def week(value,on):
    page.locator('.sgp351-weekdropdown').evaluate('(n)=>n.open=true');page.locator('[data-sgp351-week="'+str(value)+'"]').set_checked(on)
   totals([1106,650,440,666]);assert page.locator('[data-nested-bar]').count()==4
   assert 'NC-300' in page.locator('.sgp359-table tbody').inner_text();assert '1 unidad' in page.locator('.sgp360-audit').inner_text();assert page.evaluate('window.queries.length')==7
   r=page.locator('.sgp359-table tbody tr').filter(has=page.locator('td').filter(has_text=re.compile('^ES-EL400$')))
   b=r.locator('[data-nested-bar]');blue=b.locator('.sgp360-received');green=b.locator('.sgp360-processed')
   dims=page.evaluate('''()=>{const b=document.querySelector('[data-nested-bar]'),r=b.querySelector('.sgp360-received'),p=b.querySelector('.sgp360-processed');return [b,r,p].map(n=>({width:n.getBoundingClientRect().width,left:n.getBoundingClientRect().left,color:getComputedStyle(n).backgroundColor}));}''')
   assert abs(dims[1]['width']/dims[0]['width']-430/707)<.01;assert abs(dims[2]['width']/dims[0]['width']-300/707)<.01;assert abs(dims[1]['left']-dims[2]['left'])<1
   assert page.evaluate('document.documentElement.scrollWidth<=window.innerWidth')
   capture('units')
   page.screenshot(path=str(OUT/f'shell-{width}.png'),full_page=True)
   page.locator('[data-physical-mode=percentage]').click();totals([1106,650,440,666]);assert page.locator('.sgp359-table th').nth(1).inner_text()=='% recibido'
   page.locator('[data-physical-mode=chart]').click();assert page.locator('[data-nested-bar]').count()==4;assert '1106' in page.locator('[data-physical-footer]').inner_text().replace('.','')
   capture('chart');page.locator('[data-physical-mode=units]').click()
   week(45,True);totals([1126,650,440,686]);assert page.evaluate('window.queries.length')==8
   page.locator('[data-sgp351-system]').select_option('NC-300');totals([14,0,0,14]);assert page.locator('[data-nested-bar]').count()==1;assert page.evaluate('window.queries.length')==8
   page.locator('[data-sgp351-system]').select_option('');totals([1126,650,440,686]);week(45,False);totals([1106,650,440,666])
   # An actual inconsistency is shown, not clamped to satisfy the nesting rule.
   page.evaluate("window.receiptMode='none'");page.locator('[data-sgp351-refresh]').click();totals([1106,0,440,666]);assert 'supera recibidas' in page.locator('.sgp359-alert').inner_text();assert page.locator('.sgp359-table tbody tr').filter(has_text='ES-EL400').locator('.sgp360-processed').count()==0
   capture('inconsistent')
   page.evaluate("window.receiptMode='partial'");page.locator('[data-sgp351-refresh]').click();totals([1106,'—',440,666]);assert 'parcial sin cantidad' in page.locator('.sgp359-alert').inner_text()
   capture('partial')
   page.evaluate("window.receiptMode='complete';window.failBase=true");page.locator('[data-sgp351-refresh]').click();page.wait_for_function("document.querySelector('.sgp359-progress [role=alert]')?.textContent.includes('Base denegada')");assert page.locator('[data-physical-totals]').count()==0
   page.evaluate('window.failBase=false');page.locator('[data-physical-retry]').click();totals([1106,650,440,666])
   page.locator('[data-physical-year]').fill('2027');page.locator('[data-physical-year]').press('Tab');totals([33,0,0,33]);assert page.locator('.sgp360-audit').count()==0
   page.locator('[data-physical-year]').fill('2026');page.locator('[data-physical-year]').press('Tab');totals([1106,650,440,666]);page.evaluate('window.delay=1');week(45,True);week(44,False);totals([20,0,0,20]);page.wait_for_timeout(160);totals([20,0,0,20])
   before=page.evaluate('window.queries.length');page.evaluate("window.token=''");week(44,True);page.wait_for_function("document.querySelector('.sgp359-progress [role=alert]')?.textContent.includes('sesión')");assert page.evaluate('window.queries.length')==before
   assert not errors,errors;assert page.evaluate('document.documentElement.scrollWidth<=window.innerWidth')
   reports.append({'viewport':[width,height],'base_reference_2026_week44':1106,'source_of_reference':'owner supplied Supabase aggregate, reproduced as fixture, not a live authenticated comparison','synthetic_received':650,'synthetic_processed':440,'no_base_assignment_required':True,'unassigned_NC300':14,'one_nested_bar_per_system':True,'blue_ratio':430/707,'green_ratio':300/707,'totals_weighted':True,'units_percentage_chart':True,'year_week_system_filters':True,'partial_reception_unknown_not_zero':True,'processed_above_received_not_clamped':True,'failed_query_no_stale_totals':True,'late_response_discarded':True,'session_change_protected':True,'external_network':False,'horizontal_page_overflow':False,'errors':errors});page.close()
  browser.close();(OUT/'browser.json').write_text(json.dumps(reports,indent=2));print(json.dumps(reports))
finally:server.shutdown()
