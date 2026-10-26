"""Reproducible BEFORE/AFTER actual loader/render code, controlled 45ms read latency.
Not a measurement of live Supabase. No production session/network traffic.
"""
import functools,hashlib,http.server,json,pathlib,subprocess,threading
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'tests/issue99/evidence';BASE_SHA='c6d759751ea7a8e879233ad7d3df9f1c8876321e'
class H(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_GET(self):
  if self.path=='/__perf':self.send_response(200);self.send_header('Content-Type','text/html; charset=utf-8');self.end_headers();self.wfile.write(b'<!doctype html><meta charset=utf-8>');return
  super().do_GET()
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(H,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start();base='http://127.0.0.1:'+str(server.server_address[1])
before=subprocess.check_output(['git','show',BASE_SHA+':app.js'],text=True,cwd=ROOT);after=(ROOT/'app.js').read_text()
def sources(app):
 start=app.index('let programmingRequestSeq=') if 'let programmingRequestSeq=' in app else app.index('async function loadProgramming(')
 return {'load':app[start:app.index('\nfunction glassClass',start)],'render':app[app.index('function renderProgramming('):app.index('function renderProgParts(')],'pending':app[app.index('let productionPendingContext='):app.index('let productionBoardRequestSeq=')] if 'let productionPendingContext=' in app else '', 'production':app[app.index('let productionBoardRequestSeq='):app.index('function prodWeekCalendarHtml')], 'productionRender':app[app.index('function renderProductionBoard()'):app.index('async function saveProductionExecution')], 'client_version':'candidate' if 'let programmingRequestSeq=' in app else 'baseline'}
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);results=[]
  for width,height in [(1366,1000),(390,844)]:
   for label,app in [('before',before),('after',after)]:
    page=browser.new_page(viewport={'width':width,'height':height});page.route('https://**/*',lambda route:route.abort());page.goto(base+'/__perf')
    page.set_content('<meta charset=utf-8><link rel="stylesheet" href="'+base+'/styles.css"><h2>Mecanizado · prueba de rendimiento controlada</h2><p>Datos sintéticos; no mide latencia productiva.</p><select id="progWeek" data-ready="1"><option value="44">44</option><option value="43">43</option></select><input id="progSearch"><input id="prodDate" value="2026-10-26"><select id="prodShift"><option>TURNO 1</option><option>TURNO 2</option></select><div id="prodSummary"></div><div id="prodBoard"></div><div id="progAvailable"></div><div id="progScheduled"></div><div id="progWindows"></div><div id="progGlassAvg"></div><div id="progPool"></div>')
    report=page.evaluate(r'''async args=>{
     const {createReadMetrics,observeReadClient,createInFlightReads,scopedReadClient,latestTask}=await import(args.base+'/src/services/mecanizado-performance.js');
     const {glassCountLabel,mergeCarryOrdersWithGlass}=await import(args.base+'/src/domain/carry-glass.js');const {readReprogramming}=await import(args.base+'/src/services/mecanizado-reprogramming.js');
     const {operationalLoad}=await import(args.base+'/src/domain/mecanizado-operational-load.js');
     const metrics=createReadMetrics({enabled:true});const inFlight=createInFlightReads();
     const delay=()=>new Promise(resolve=>setTimeout(resolve,45));
     const rows=Array.from({length:120},(_,i)=>({reserva:'QA'+i,sistema:i%2?'ES-EL400':'ES-MX4000',acabado:'DS',cantidad:8,semana:44,grupo:i%4+1,vidrio_pct:50,vidrio_cant:4,ordenes:[{produccion:'ORDER'+i,cantidad:8}]}));
     const schedule=Array.from({length:24},(_,i)=>({id_programacion:'p'+i,reserva:'QA'+i,sistema:'ES-MX4000',acabado:'DS',produccion:'ORDER0',cantidad_programada:8,fecha_programacion:'2026-10-26',turno:'TURNO 1',prioridad:1,estado:'PROGRAMADA',semana:44}));
     const raw={rpc:async(name,params)=>{await delay();if(name==='sgp_mecanizado_disponibles')return {data:rows};if(name==='sgp_mecanizado_programacion_listar')return {data:schedule};if(name==='sgp_mecanizado_ordenes_programacion')return {data:[{produccion:'ORDER0',key_produccion:'QA|PANELES_2',cantidad:8,vidrio_preparado:0,vidrio_novedad:0,vidrio_traslado:0}]};if(name==='sgp_pdt_capacidades_v2')return {data:{ok:true,contract_version:2,operations:[]}};if(name==='sgp_aluminio_pendientes_listar_v2')return {data:{ok:true,contract_version:2,pendientes:[]}};return {data:[]};},from:table=>{let data=table==='sgp_mecanizado_programacion'?schedule:[];const q={select:()=>q,eq:(key,value)=>{data=data.filter(row=>row[key]===value);return q;},neq:()=>q,order:()=>q,in:()=>q,then:(resolve,reject)=>{return delay().then(()=>({data})).then(resolve,reject)}};return q;}};
     const observed=observeReadClient(raw,metrics);const candidate=()=>scopedReadClient(raw,'QA_SESSION',metrics,inFlight);
     const getSupabaseClient=async()=>args.label==='after'?raw:observed,getMecanizadoReadClient=async()=>candidate();
     const loadAluminumPending=async()=>{await observed.rpc('sgp_pdt_capacidades_v2',{p_token:'QA_SESSION'});await observed.rpc('sgp_aluminio_pendientes_listar',{p_token:'QA_SESSION'});await observed.rpc('sgp_aluminio_pendientes_listar_v2',{p_token:'QA_SESSION'});};
     const machiningCarry={clear(){},read:async(client,token,date,shift)=>{await client.rpc('sgp_mecanizado_pendientes_turno',{p_token:token,p_fecha:date,p_turno:shift});return [];}};
     let calendarReads=[];
     const renderProgCalendar=()=>{calendarReads.push(observed.from('sgp_mecanizado_ejecucion').select('id_programacion,estado').in('id_programacion',['p1']));};
     const deps={glassCountLabel,mergeCarryOrdersWithGlass,scopedReadClient,machiningInFlight:inFlight,getSupabaseClient,getMecanizadoReadClient,getAppToken:()=> 'QA_SESSION',machiningMetrics:metrics,machiningCarry,clearMoveSources:()=>{},ensureSharedReservations:()=>observed.rpc('sgp_reservas_asociadas_listar',{p_token:'QA_SESSION'}),readReprogramming,latestTask,renderProgCalendar,escapeHtml:x=>String(x??''),sharedReserveNoticeHtml:()=>'',sharedMetaFromEmbedded:()=>null,isSharedMeta:()=>false,sharedBadgeHtml:()=>'',sharedDetailsHtml:()=>'',glassClass:()=>'',progGroupName:{1:'A',2:'B',3:'C',4:'D'},openProgModal:()=>{},repoRole:()=> 'COORDINADOR',PROD_STATES:['SIN INICIAR','CORTE','MECANIZADO','PROCESADO'],prodDisplayState:value=>value==='PROGRAMADA'?'SIN INICIAR':value||'SIN INICIAR',prodStateClass:value=>'state-'+String(value).toLowerCase().replaceAll(' ','-'),shiftLabelForDate:()=> 'QA shift',prodWeekCalendarHtml:()=>'',bindProdWeek:()=>{},loadAluminumPending,enrichMoveSources:async(c,t,s)=>s,operationalLoad};
     window.productionRenderTimes=[];const productionRender=args.sources.productionRender.replace('function renderProductionBoard(){','function renderProductionBoardRaw(){')+'\nfunction renderProductionBoard(){const start=performance.now();try{return renderProductionBoardRaw();}finally{window.productionRenderTimes.push(performance.now()-start);}}';
     const code='const {'+Object.keys(deps).join(',')+'}=deps;let progRows=[],progSchedule=[],progCoverage=[],progOrderCoverage=[],progConfirmations=[],progMoves=[],progMovesError=\"\",repoV2Capabilities,prodRows=[];'+args.sources.render+'\n'+args.sources.load+'\n'+args.sources.pending+'\n'+args.sources.production+'\n'+productionRender+'\nreturn {loadProgramming,renderProgramming,loadProductionBoard,queueProgramming:typeof scheduleProgrammingLoad===\"function\"?scheduleProgrammingLoad:null,queueProduction:typeof scheduleProductionLoad===\"function\"?scheduleProductionLoad:null};';
     const api=new Function('deps','window',code)(deps,window);
     const count=()=>metrics.snapshot().filter(entry=>['rpc','query'].includes(entry.kind)).length;
     const timed=async fn=>{const start=performance.now();await fn();await Promise.all(calendarReads.map(q=>Promise.resolve(q)));calendarReads=[];return performance.now()-start;};
     await timed(()=>api.loadProgramming());metrics.reset();const coldRuns=[];let coldRequests=0;for(let run=0;run<3;run++){metrics.reset();coldRuns.push(await timed(()=>api.loadProgramming()));coldRequests=count();}const programming={wall_ms:[...coldRuns].sort((a,b)=>a-b)[1],runs_ms:coldRuns,requests:coldRequests,samples:metrics.snapshot()};
     metrics.reset();const rapidMs=await timed(async()=>{const tasks=[];for(const week of ['43','44','43']){document.querySelector('#progWeek').value=week;tasks.push(api.queueProgramming?api.queueProgramming():api.loadProgramming());}await Promise.all(tasks);});const rapid={wall_ms:rapidMs,requests:count(),samples:metrics.snapshot()};
     metrics.reset();const searchMs=await timed(async()=>{for(const q of ['Q','QA','QA1']){document.querySelector('#progSearch').value=q;metrics.sync('filter-render',()=>api.renderProgramming(args.label==='after'?{skipCalendar:true}:undefined));}});const search={wall_ms:searchMs,requests:count(),render_ms:metrics.snapshot().filter(x=>x.kind==='render').reduce((n,x)=>n+x.ms,0),samples:metrics.snapshot()};
     metrics.reset();await api.loadProductionBoard();await delay();await delay();await delay();metrics.reset();const datesMs=await timed(async()=>{const tasks=[];for(const shift of ['TURNO 2','TURNO 1','TURNO 1']){document.querySelector('#prodShift').value=shift;tasks.push(api.queueProduction?api.queueProduction():api.loadProductionBoard());}await Promise.all(tasks);await delay();await delay();await delay();});const dates={wall_ms:datesMs,requests:count(),render_samples_ms:[...window.productionRenderTimes],samples:metrics.snapshot()};
     metrics.reset();document.querySelector('#prodDate').value='2026-10-27';const emptyStart=performance.now();await api.loadProductionBoard({refreshPending:false});const emptyMs=performance.now()-emptyStart;await delay();await delay();await delay();const emptyDate={wall_ms:emptyMs,requests:count(),samples:metrics.snapshot()};
     document.querySelector('#prodDate').value='2026-10-26';await api.loadProductionBoard({refreshPending:false});await delay();await delay();metrics.reset();const first=document.querySelector('[data-prod-expand]');first.click();await delay();await delay();const detail={requests:count(),save:!!document.querySelector('[data-order-save]'),state:!!document.querySelector('[data-order-state]'),novelty:!!document.querySelector('[data-order-novelty]'),reprogram:!!document.querySelector('[data-order-reprogram]')};first.click();first.click();await delay();detail.reopen_requests=count();
     return {programming,rapid,search,dates,emptyDate,detail};
    }''',{'base':base,'sources':sources(app),'label':label})
    if label=='after':
     assert report['detail']['requests']==2 and report['detail']['reopen_requests']==2,report['detail']
     assert all(report['detail'][key] for key in ['save','state','novelty','reprogram']),report['detail']
    page.screenshot(path=str(OUT/f'performance-{label}-{width}.png'),full_page=True)
    results.append({'viewport':[width,height],'variant':label,'measurements':report});page.close()
  browser.close()
 report={'baseline_commit':BASE_SHA,'candidate_app_sha256':hashlib.sha256(after.encode()).hexdigest(),'environment':'Chromium, 45ms controlled latency per synthetic read, actual loadProgramming/renderProgramming/loadProductionBoard source; actual Production renderer with 24 synthetic program rows','not_live_supabase':True,'no_external_network':True,'results':results}
 (OUT/'performance.json').write_text(json.dumps(report,indent=2));print(json.dumps([{ 'viewport':x['viewport'],'variant':x['variant'],'programming_median_ms':round(x['measurements']['programming']['wall_ms'],1),'rapid_requests':x['measurements']['rapid']['requests'],'filter_requests':x['measurements']['search']['requests'],'date_shift_requests':x['measurements']['dates']['requests']} for x in results]))
finally:server.shutdown()
