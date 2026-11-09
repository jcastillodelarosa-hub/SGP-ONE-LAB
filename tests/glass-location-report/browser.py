"""Focused B19 actual-renderer smoke with synthetic source, no production writes."""
from pathlib import Path
import re,json,threading,http.server,functools,shutil,os
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[2]
index=(root/'index.html').read_text();app=(root/'app.js').read_text()
region=index[index.index('<div id="assemblyLocationReportPanel"'):index.index('</div><div id="productionPackingPanel"')]
region=region.replace('id="assemblyLocationReportPanel" hidden','id="assemblyLocationReportPanel"')
render=app[app.index('function renderGlassEfficiency(){'):app.index('/* LAB v298: explorador')]
rows=[dict(key_produccion='A',reserva='R1',parte='9.9',produccion='PRODUCCION A',sistema='ES100',acabado='Blanco',ventanas=10,posicion='B1',preparadas=3,novedad=1,traslado=0,unidades=4),dict(key_produccion='B',reserva='R2',parte='1.1',produccion='PRODUCCION B',sistema='ES200',acabado='Negro',ventanas=5,posicion='B2',preparadas=2,novedad=0,traslado=0,unidades=2)]
script="""import {glassLocationSummary,glassLocationReportCSV} from '/src/domain/glass-location-report.js';
const rows=ROWS,glassWeekByProduction=new Map([['A','2026-45'],['B','2026-46']]),glassReportMetadata=new Map([['A',{prioridad:'2.1'}]]);
const els=Object.fromEntries(['lrPrepared','lrNovelty','lrTransfer','lrOther','lrRacks','lrMixed'].map(id=>[id,document.getElementById(id)]));
const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const visibleGlassEfficiencyRows=()=>rows.filter(r=>document.querySelector('#glassEfficiencyWeek').value==='all'||glassWeekByProduction.get(r.key_produccion)===document.querySelector('#glassEfficiencyWeek').value);
function openGlassExplorer(){};
RENDER
const week=document.querySelector('#glassEfficiencyWeek');week.disabled=false;week.innerHTML='<option value="all">Todas</option><option value="2026-45">45</option><option value="2026-46">46</option>';
for(const id of ['glassReportLevel','glassEfficiencyWeek','glassEfficiencyFilter'])document.getElementById(id).addEventListener('change',renderGlassEfficiency);
document.getElementById('glassEfficiencySearch').addEventListener('input',renderGlassEfficiency);renderGlassEfficiency();
""".replace('ROWS',json.dumps(rows)).replace('RENDER',render)
html='<meta charset="utf-8"><link rel="stylesheet" href="/styles.css"><main>'+region+'</main><script type="module">'+script+'</script>'
handler=functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(root));server=http.server.ThreadingHTTPServer(('127.0.0.1',0),handler);threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=None if os.environ.get('CI') else shutil.which('chromium') or None)
 for width in [1366,390]:
  page=browser.new_page(viewport={'width':width,'height':850});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.route('**/b19-fixture',lambda route:route.fulfill(body=html,content_type='text/html'))
  page.goto(f'http://127.0.0.1:{server.server_port}/b19-fixture');page.wait_for_selector('.glass-efficiency-reservation')
  assert page.locator('.glass-efficiency-reservation').count()==2
  assert page.locator('#lrPrepared').inner_text()=='5'
  page.select_option('#glassReportLevel','racks');assert page.locator('.glass-efficiency-order[open]').count()==2
  assert 'Prioridad: 2.1' in page.locator('.glass-efficiency-reservation').first.inner_text()
  page.select_option('#glassEfficiencyWeek','2026-45');assert page.locator('#lrPrepared').inner_text()=='3'
  assert page.locator('.glass-efficiency-reservation').count()==1
  with page.expect_download() as d:page.click('#glassReportExport')
  assert d.value.suggested_filename=='SGP-ubicaciones-vidrio.csv'
  page.fill('#glassEfficiencySearch','NO MATCH');assert page.locator('#lrPrepared').inner_text()=='0';assert page.locator('#glassReportExport').is_disabled()
  page.fill('#glassEfficiencySearch','');page.screenshot(path=f'/tmp/b19-{width}.png',full_page=True);assert not errors,errors
  page.close()
 browser.close()
server.shutdown();print('PASS B19 PC/mobile hierarchy, actual weekly priority, filtered totals, CSV and empty state')
