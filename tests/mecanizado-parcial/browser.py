"""Real new-dialog -> RPC facade -> isolated PostgreSQL. No remote network or production data."""
import functools,http.server,json,pathlib,subprocess,threading,shutil,os
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=ROOT/'tests/mecanizado-parcial/evidence';OUT.mkdir(exist_ok=True)
def sql(q):
 p=subprocess.run(['docker','exec','-i','sgp-parcial-test','psql','-U','postgres','-d','sgp_parcial_integration','-At','-v','ON_ERROR_STOP=1'],input=q,text=True,capture_output=True)
 if p.returncode:raise RuntimeError(p.stderr)
 return p.stdout.strip()
def lit(v):
 if v is None:return 'null'
 if isinstance(v,bool):return 'true' if v else 'false'
 if isinstance(v,(dict,list)):return "'"+json.dumps(v).replace("'","''")+"'::jsonb"
 return "'"+str(v).replace("'","''")+"'"
ARGS={
 'sgp_mecanizado_partes_consultar':['p_token','p_key'],
 'sgp_mecanizado_partes_programar':['p_token','p_key','p_reserva','p_partes','p_clave'],
 'sgp_mecanizado_parte_historial':['p_token','p_id'],
 'sgp_mecanizado_parte_mover':['p_token','p_id','p_fecha','p_turno','p_prioridad','p_motivo','p_cancelar']}
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_GET(self):
  if self.path.startswith('/demo'):
   app=(ROOT/'app.js').read_text();opener=app[app.index('async function refreshProgrammingContext()'):app.index('function closeProgModal()')]
   script="""import {openPartialProgramming} from '/src/modules/mecanizado-partes.js';
+const client={rpc:async(name,args)=>fetch('/rpc',{method:'POST',body:JSON.stringify({name,args})}).then(r=>r.json())};
+let progRows=[];const currentAuth={rol:'COORDINADOR'};const getSupabaseClient=()=>Promise.resolve(client),getAppToken=()=>'qa-coordinador';
+async function loadProgramming(){window.saved=(window.saved||0)+1;}
+""".replace('\n+','\n')+opener+"""
+window.openParts=(key,reserva)=>{progRows=[{reserva,ordenes:[{produccion:'8642595',key_produccion:key}]}];openProgModal(reserva,'8642595',288);};
+window.ready=true;""".replace('\n+','\n')
   content=('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/src/modules/mecanizado-partes.css"><button id="open">Programar producción</button><input id="fixtureFilter" value="conservar filtro"><div id="progPool"><details open><summary>Reserva</summary><button data-prog-res="UI-R-1366">Programar</button></details></div><script type="module">'+script+'</script></html>').encode()
   self.send_response(200);self.send_header('Content-Type','text/html');self.end_headers();self.wfile.write(content)
  else:super().do_GET()
 def do_POST(self):
  try:
   req=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
   assert req['name'] in ARGS
   query='select public.'+req['name']+'('+','.join(lit(req['args'].get(k)) for k in ARGS[req['name']])+');'
   result={'data':json.loads(sql(query)),'error':None}
  except Exception as e:result={'data':None,'error':{'message':str(e)}}
  self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(json.dumps(result).encode())
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
results=[]
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path=os.environ.get('PLAYWRIGHT_CHROMIUM_EXECUTABLE') or shutil.which('chromium'),headless=True,args=['--no-sandbox'])
  for width,height in [(1366,1000),(390,844)]:
   key=f'UI{width}|PANELES_2';reserve=f'UI-R-{width}'
   sql(f"insert into sgp_producciones(key_produccion,id,id_linea,anio,semana_base,semana_actual,produccion,cantidad,sistema,acabado,reserva_al) values('{key}','UI{width}','PANELES_2',2026,44,44,'8642595',288,'QA-S','QA-A','{reserve}'); insert into sgp_prioridades(anio,semana,id_linea,reserva,key_produccion,prioridad,usuario) values(2026,44,'PANELES_2','{reserve}','{key}','1.1','qa-coordinador');")
   page=browser.new_page(viewport={'width':width,'height':height});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(f'http://127.0.0.1:{server.server_port}/demo');page.wait_for_function('window.ready');page.evaluate('([key,reserva])=>window.openParts(key,reserva)',[key,reserve])
   page.locator('[data-summary]').get_by_text('288',exact=True).first.wait_for()
   if width==1366:
    page.locator('[data-field=cantidad]').fill('0');page.locator('[data-field=fecha]').fill('2026-10-28');page.locator('[data-field=turno]').select_option('TURNO 1');page.locator('[data-save]').click()
    page.get_by_role('alert').get_by_text('Cantidad debe ser un entero positivo.').wait_for()
    page.locator('[data-field=cantidad]').fill('90');page.locator('[data-save]').click()
    page.get_by_text('Partes guardadas. Saldo disponible: 198 ventanas.').wait_for();page.screenshot(path=str(OUT/f'manual-{width}.png'))
    page.locator('[data-split]').click();assert page.locator('[data-row]').count()==3
   else:
    page.locator('[data-split]').click();assert page.locator('[data-row]').count()==4
   proposal=page.locator('[data-row]');n=proposal.count()
   for i in range(n):
    proposal.nth(i).locator('[data-field=fecha]').fill(f'2026-10-{28+i//2}')
    proposal.nth(i).locator('[data-field=turno]').select_option('TURNO 1' if i%2==0 else 'TURNO 2')
    proposal.nth(i).locator('[data-field=observacion]').fill(f'Parte QA {i+1}')
   page.locator('.mec-part-content').evaluate('(node)=>node.scrollTop=0');page.screenshot(path=str(OUT/f'proposal-{width}.png'));page.locator('[data-save]').click()
   page.get_by_text('Partes guardadas. Saldo disponible: 0 ventanas.').wait_for()
   assert page.locator('.mec-part-existing').count()==4
   assert page.locator('[data-save]').is_disabled();assert page.locator('#fixtureFilter').input_value()=='conservar filtro'
   assert page.evaluate('document.querySelector("dialog").scrollWidth<=window.innerWidth')
   page.locator('[data-history-id]').first.click();page.get_by_role('heading',name='Historial',exact=True).wait_for()
   page.screenshot(path=str(OUT/f'complete-{width}.png'))
   page.keyboard.press('Escape');assert page.locator('dialog').count()==0
   assert not errors,errors
   results.append({'viewport':[width,height],'ok':True,'checks':['real SQL saldo','manual validation' if width==1366 else 'four editable capacity rows','explicit dates/shifts','P1-P4','save disabled at zero','history','Escape','no horizontal overflow','no browser errors']});page.close()
  browser.close()
finally:server.shutdown()
(OUT/'browser-results.json').write_text(json.dumps({'transport':'local RPC facade to PostgreSQL synthetic fixture, real module','results':results},indent=2)+'\n')
print(json.dumps(results))
