"""SQL08 + actual UI/handler, synthetic catalog prepared BEFORE opening; no source pruning."""
from pathlib import Path
import sys,json,http.server,threading,subprocess,base64,hashlib
from playwright.sync_api import sync_playwright
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'lp01-b12-b13'))
from current_sheet import inspect_sheet
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'lp01-b12-b13'))
from navigation import open_assignment
from isolated import ClosureDB,ROOT,lit
HERE=Path(__file__).parent;OUT=HERE/'evidence';PBI=ROOT/'tests/lp01-powerbi'
SOURCES={s:PBI/'fixtures'/f'{s.lower()}.xlsx' for s in ['ENSAMBLE','EMPAQUE']}
class Broker(http.server.SimpleHTTPRequestHandler):
 db=None
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT),**kw)
 def log_message(self,*a):pass
 def do_POST(self):
  try:
   body=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
   if self.path not in ['/rpc','/server-rpc']:raise ValueError('QA_ROUTE_DENIED')
   if self.path=='/server-rpc' and body['name'] not in ['sgp_sesion_actual','sgp_lp_operacion_importar_xlsx']:raise ValueError('QA_RPC_DENIED')
   result={'data':self.db.rpc(body['name'],body['args']),'error':None}
  except Exception as e:result={'data':None,'error':{'code':'QA_SQL_ERROR','message':str(e)}}
  raw=json.dumps(result).encode();self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(raw)
def confirmed(page):
 page.wait_for_function("document.querySelector('[data-op-status]').textContent.includes('Guardado confirmado')")
def run(page,db,stage,origin,endpoint,width):
 ctx={'stage':stage,'date':'2026-10-31'};other='EMPAQUE' if stage=='ENSAMBLE' else 'ENSAMBLE'
 before=db.sql('SELECT jsonb_agg(to_jsonb(p) ORDER BY key_produccion) FROM public.sgp_producciones p')
 plan=db.sql('SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM public.sgp_linea_plan_asignaciones a')
 db.execute(db.cmd('ABRIR',**ctx));db.execute(db.cmd('ABRIR',stage=other,date=ctx['date']))
 target=max(db.selected,key=db.selected.get);total=db.selected[target];roots=db.parts[(target,1)]
 for key,q in db.selected.items():
  split=[q//2,q-q//2,0,0] if key==target else [q,0,0,0]
  for i,(part,n) in enumerate(zip(db.parts[(key,1)],split)):
   db.execute(db.cmd('SALE',key=key,part=part,quantity=n,observation='QA reparto explícito',**ctx))
   if n:db.execute(db.cmd('EJECUTAR',key=key,part=part,quantity=n-(1 if key==target and i<2 else 0),observation='QA avance',**ctx),'LIDER')
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('**/*',lambda r:r.continue_() if r.request.url.startswith('http://127.0.0.1:') else r.abort())
 page.goto(origin+'/')
 page.evaluate('''({stage,endpoint})=>{
  document.querySelector('[data-view-panel="ensamble"]').hidden=false;
  window.SGP_CONFIG={...window.SGP_CONFIG,lpPowerBiUrl:endpoint};window.qaRole='LIDER';
  window.SGPPlannerBridge.getToken=()=>window.qaRole;
  window.SGPPlannerBridge.getClient=async()=>({rpc:async(name,args)=>(await fetch('/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,args})})).json()});
  document.querySelector('[data-op-date]').value='2026-10-31';document.querySelector('[data-op-stage]').value=stage;
 }''',{'stage':stage,'endpoint':endpoint})
 audit_before=db.sql('SELECT count(*) FROM sgp_lp_operacion.auditoria')
 page.locator('#productionPackingTab' if stage=='EMPAQUE' else '#productionAssemblyTab').click()
 inspect_sheet(page,stage,detail=True)
 assert db.sql('SELECT count(*) FROM sgp_lp_operacion.auditoria')==audit_before
 assert before==db.sql('SELECT jsonb_agg(to_jsonb(p) ORDER BY key_produccion) FROM public.sgp_producciones p')
 assert plan==db.sql('SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM public.sgp_linea_plan_asignaciones a')
 assert db.snapshot(stage,date=ctx['date'])['turn']['estado']=='ABIERTO'
 assert db.snapshot(other,date=ctx['date'])['turn']['estado']=='ABIERTO'
 assert not errors,errors
 page.screenshot(path=str(OUT/f'sql08-{stage.lower()}-contained-{width}.png'))
 return {'stage':stage,'width':width,'status':'PASS_CONTAINED','manual_legacy_commands_absent':True,'no_new_audit':True,'both_stages_remain_open':True,'export_and_programming_unchanged':True,'legacy_write_contract_coverage':'isolated.py unchanged','errors':errors}
if __name__=='__main__':
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Broker);threading.Thread(target=server.serve_forever,daemon=True).start();origin=f'http://127.0.0.1:{server.server_port}'
 node=subprocess.Popen(['node',str(PBI/'server.mjs'),origin],cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
 endpoint='http://127.0.0.1:'+str(json.loads(node.stdout.readline())['port'])+'/functions/v1/lp-powerbi';results=[]
 try:
  with sync_playwright() as p:
   browser=p.chromium.launch(executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,args=['--no-sandbox'])
   for stage in SOURCES:
    for width in [1440,390]:
     db=ClosureDB(stage,SOURCES);Broker.db=db;page=browser.new_page(viewport={'width':width,'height':950})
     try:results.append(run(page,db,stage,origin,endpoint,width))
     finally:page.close();db.close()
   browser.close()
 finally:node.terminate();node.wait(timeout=10);server.shutdown()
 evidence={'status':'PASS','results':results,'sql08_sha256':hashlib.sha256((ROOT/'docs/sql-proposals/lp01-operacion/08_ambitos_temporales_REVIEW.sql').read_bytes()).hexdigest(),'limits':['PostgreSQL17.11 network-none; real session/RPC/handler/parser; synthetic catalog, accounts, scopes and assignments','Browser auth bridge/HTTP transport local only; no productive login, runtime or source matching certified','Anonymized XLSX fixtures; no pruning after ABRIR; no PDT credit or Export inclusion claimed']}
 (OUT/'browser-sql08.json').write_text(json.dumps(evidence,indent=2)+'\n');print(json.dumps(evidence,indent=2))
