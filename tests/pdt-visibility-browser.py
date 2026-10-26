"""Render actual application modal/action functions with isolated read fixtures.
No production RPC, session or write; screenshots clearly identify local preview.
"""
import functools,http.server,json,pathlib,threading,argparse,urllib.request,re,hashlib,os,sys
from playwright.sync_api import sync_playwright
sys.excepthook=lambda kind,error,trace:print('::error title=LAB v359 visual::'+kind.__name__+': '+str(error).replace('\n',' ')[:220])
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=pathlib.Path('/tmp/sgp-pdt-visibility');OUT.mkdir(exist_ok=True)
parser=argparse.ArgumentParser();parser.add_argument('--production-url');parser.add_argument('--expected-sha');args=parser.parse_args()
if args.production_url and (args.production_url!='https://sgp-one-lab.web.app' or not re.fullmatch('[a-f0-9]{40}',args.expected_sha or '')):raise SystemExit('Expected fixed LAB HTTPS URL and full release SHA')
NAMES=['repoRole','repoCanPatinadorEdit','repoCanSolution','repoCanValidate','repoCanState','repoIsActive','repoIsValidated','repoValidationBadgeHtml','repoEnsureWorkModal','repoShowWorkModal','repoCloseWorkModal','repoFlowNoticeHtml','repoBindFlowNotice','repoEncodePiece','repoPieceTableHtml','repoBindPieceRows','openRepoValidate','repoRunAction','repoCloseActionPortal','repoActionMenuHtml','repoActionItemsHtml','repoStateControlHtml','repoRowHtml','renderRepoPending']
release_html=None
if args.production_url:
 def deployed(name):
  with urllib.request.urlopen(args.production_url+'/'+name+'?visual_check='+args.expected_sha,timeout=30) as response:return response.read()
 release_html=deployed('index.html').decode()
 assert 'data-release-commit="'+args.expected_sha+'"' in release_html
 assert 'LAB v359 · PDT v2 · '+args.expected_sha[:7] in release_html
 badge=r'<span\b[^>]*\bid="releaseVersion"[^>]*>[^<]*</span>'
 assert re.sub(badge,'RELEASE_BADGE',release_html)==re.sub(badge,'RELEASE_BADGE',(ROOT/'index.html').read_text())
 for name in ['app.js','styles.css','src/modules/pdt-flow-guidance.js','src/modules/pdt-v2-controller.js']:
  assert hashlib.sha256(deployed(name)).digest()==hashlib.sha256((ROOT/name).read_bytes()).digest(),name
 lines=deployed('app.js').decode().splitlines()
else:lines=(ROOT/'app.js').read_text().splitlines()
functions='\n'.join(next(l for l in lines if l.startswith('function '+n+'(') or l.startswith('async function '+n+'(')) for n in NAMES)
class H(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=None
if args.production_url:url=args.production_url
else:
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(H,directory=str(ROOT)))
 threading.Thread(target=server.serve_forever,daemon=True).start()
 url='http://127.0.0.1:'+str(server.server_address[1])
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('SGP_CHROME_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
  report=[]
  for width,height in [(1440,1000),(390,844)]:
   page=browser.new_page(viewport={'width':width,'height':height});errors=[];requests=[]
   page.on('pageerror',lambda e:errors.append(e.name))
   # Only fetch static resources. Never contact Supabase or issue a write request.
   def route_request(route):
    if route.request.method=='GET' and route.request.url.startswith(url+'/'):route.continue_()
    else:route.abort()
   page.route('**/*',route_request)
   if args.production_url:
    page.goto(url+'/?visual_check='+args.expected_sha,wait_until='networkidle',timeout=60000)
    assert page.locator('#releaseVersion').inner_text()=='LAB v359 · PDT v2 · '+args.expected_sha[:7]
    assert not errors,errors
    page.close();page=browser.new_page(viewport={'width':width,'height':height})
    page.on('pageerror',lambda e:errors.append(e.name));page.route('**/*',route_request)
   page.goto(url+'/styles.css')
   page.set_content('<link rel="stylesheet" href="'+url+'/styles.css"><header style="padding:16px;background:#113f67;color:white"><b>SGP_ONE · LAB v359 · PDT v2 · VISTA PREVIA LOCAL</b><p style="margin:6px 0 0">Sin publicar · rol Coordinador · piezas de prueba simuladas · ninguna escritura</p></header><main style="padding:16px"><h2>Pendientes de aluminio</h2><div id="repoSummary"></div><div style="overflow:auto"><table><tbody id="repoBody"></tbody></table></div></main>')
   page.evaluate('''async source=>{
    const {pendingFlowGuidance}=await import(source.base+'/src/modules/pdt-flow-guidance.js');
    const {openPdtV2}=await import(source.base+'/src/modules/pdt-v2-controller.js');
    const escapeHtml=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    let currentAuth={rol:'COORDINADOR'},repoWeekSort='asc';
    const row={id_pendiente:'5e054eb1-4f79-4960-9add-73b782283939',produccion:'172539 - 1039864 - DOMUS II - LEVEL 23',reserva:'8558585',cantidad:9,semana:44,contrato_pdt:'LEGACY',estado:'PENDIENTE',estado_repo:'PENDIENTE',validacion_estado:'POR_VALIDAR'};
    const sources=[{id_pieza:'QA-1',fabricacion:'QA FAB A',longitud:100,acabado:'QA',cantidad:5},{id_pieza:'QA-2',fabricacion:'QA FAB B',longitud:100,acabado:'QA',cantidad:4}];
    let repoRows=[row],repoV2Capabilities={contract_version:2,operations:['sgp_aluminio_pendiente_validar_detalles_v1'],picking_cuantitativo:true,cierre_v2:true};
    window.writes=0;window.rpcCalls=[];
    const client={rpc:async(name,args)=>{window.rpcCalls.push(name);if(name==='sgp_pdt_fuentes_v2')return {data:sources};if(name==='sgp_pdt_picking_v2')return {data:{ok:true,entregas:[],lineas:[]}};window.writes++;throw new Error('Writes prohibited in visual test');}};
    const getSupabaseClient=async()=>client,getAppToken=()=>null,loadRepoPending=async()=>{},repoFetchPieces=async()=>sources,openRepoPendingDetail=()=>{window.detailOpened=true;};
    eval(source.functions+'\\nwindow.openLegacy=()=>openRepoValidate(row);window.renderCase=(contract,role,validated=false)=>{currentAuth={rol:role};repoRows[0]={...row,contrato_pdt:contract,validacion_estado:validated?"VALIDADO":"POR_VALIDAR",detalles:[],ncs:[]};renderRepoPending()};window.openCaseV2=()=>repoRunAction("v2",row.id_pendiente);window.closeModal=repoCloseWorkModal;');
    window.renderCase('LEGACY','COORDINADOR');
   }''',{'base':url,'functions':functions})
   assert page.locator('#repoBody [data-repo-action="v2"]').inner_text()=='Preparar PDT v2'
   page.evaluate('window.openLegacy()')
   page.locator('#repoWorkTitle').wait_for()
   assert 'LEGACY' in page.locator('#repoWorkTitle').inner_text()
   assert page.locator('[data-repo-open-v2]').inner_text()=='Preparar PDT v2'
   # Test the actual formerly white-on-light nested header text using computed colors.
   contrasts=page.locator('#repoWorkModal .repo-section-head h3, #repoWorkModal .repo-piece-source-head span, #repoWorkModal .repo-piece-head span').evaluate_all('(nodes)=>nodes.map(n=>getComputedStyle(n).color)')
   assert all(c=='rgb(23, 62, 94)' for c in contrasts),contrasts
   page.locator('#repoWorkEyebrow').evaluate("n=>n.textContent='Vista previa local · piezas simuladas · sin escritura'")
   assert page.evaluate('document.documentElement.scrollWidth')<=width
   page.screenshot(path=str(OUT/('validacion-legacy-'+str(width)+'.png')),full_page=True)
   page.locator('[data-repo-open-v2]').click()
   page.locator('#repoWorkTitle').filter(has_text='PDT v2').wait_for()
   assert page.locator('[data-source]').count()==2
   assert page.evaluate('window.writes')==0
   page.locator('#repoWorkEyebrow').evaluate("n=>n.textContent='Vista previa local · piezas simuladas · sin escritura'")
   assert page.evaluate('document.documentElement.scrollWidth')<=width
   page.screenshot(path=str(OUT/('preparacion-v2-'+str(width)+'.png')),full_page=True)
   page.evaluate('window.closeModal();window.renderCase("LEGACY","CONSULTA")')
   assert page.locator('#repoBody [data-repo-action="v2"]').count()==0
   page.evaluate('window.renderCase("LEGACY","COORDINADOR",true)')
   assert page.locator('#repoBody [data-repo-action="v2"]').count()==0
   page.evaluate('window.renderCase("V2","COORDINADOR",true)')
   assert page.locator('#repoBody [data-repo-action="v2"]').inner_text()=='Abrir PDT v2'
   page.locator('#repoBody .repo-row td').first.click()
   page.locator('#repoWorkTitle').filter(has_text='PDT v2').wait_for()
   assert not page.evaluate('!!window.detailOpened')
   assert page.evaluate('window.writes')==0
   assert not errors,errors
   report.append({'width':width,'legacy_entry':True,'v2_row_navigation':True,'role_and_validated_legacy_gates':True,'contrast_colors':contrasts,'writes':0,'uncaught_errors':0})
   page.close()
  browser.close()
 (OUT/'report.json').write_text(json.dumps(report,indent=2))
 print(json.dumps(report))
 if args.production_url:print('::notice title=LAB v359 visual::Verified exact published SHA '+args.expected_sha+' and LAB v359 badge; desktop/mobile static assets and isolated LEGACY preparation/V2 row navigation passed; no Supabase requests or operational writes.')
finally:
 if server:server.shutdown()
