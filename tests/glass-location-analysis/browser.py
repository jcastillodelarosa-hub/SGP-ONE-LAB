"""Actual Tabla/Árbol renderers, synthetic data, no production network/writes."""
from pathlib import Path
import json,threading,http.server,functools,shutil,os
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[2]
index=(root/'index.html').read_text();app=(root/'app.js').read_text()
region=index[index.index('<div id="assemblyLocationReportPanel"'):index.index('</div><div id="productionPackingPanel"')].replace('id="assemblyLocationReportPanel" hidden','id="assemblyLocationReportPanel"')
render=app[app.index("let glassReportMode='table';"):app.index('/* LAB v298: explorador')]
rows=[dict(key_produccion='A',reserva='R1',parte='1',produccion='Producción A',posicion='B1',unidades=10,preparadas=10,ventanas=8),dict(key_produccion='A',reserva='R1',parte='1',produccion='Producción A',posicion='B2',unidades=6,novedad=6,ventanas=8),dict(key_produccion='B',reserva='R2',parte='1',produccion='Producción B',posicion='B1',unidades=4,preparadas=4),dict(key_produccion='C',reserva='R3',parte='2',produccion='Sin semana C',posicion='B2',unidades=2,traslado=2)]
script="""import {mountGlassLocationAnalysis} from '/src/modules/glass-location-analysis.js';
import {glassLocationSummary,glassLocationReportCSV} from '/src/domain/glass-location-report.js';
const glassRackTotals=[{posicion:'B1',unidades:14},{posicion:'B2',unidades:8}],glassEfficiencyRows=ROWS,glassWeekByProduction=new Map([['A','2026-46'],['B','2026-45']]),glassReportMetadata=new Map();
const els=Object.fromEntries(['lrPrepared','lrNovelty','lrTransfer','lrOther','lrRacks','lrMixed'].map(id=>[id,document.getElementById(id)]));
const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const visibleGlassEfficiencyRows=()=>glassEfficiencyRows.filter(r=>document.querySelector('#glassEfficiencyWeek').value==='all'||glassWeekByProduction.get(r.key_produccion)===document.querySelector('#glassEfficiencyWeek').value);
function openGlassExplorer(){};function loadLocationReport(){};
function bindSheetFilters(table,getRows,cols,filters,onSort,onFilter){table.querySelectorAll('[data-sheet-filter]').forEach(b=>b.onclick=()=>onSort(b.dataset.sheetFilter,1));}
RENDER
const week=document.querySelector('#glassEfficiencyWeek');week.disabled=false;week.innerHTML='<option value="2026-46">46</option><option value="all">Todas</option>';
for(const id of ['glassReportLevel','glassEfficiencyWeek','glassEfficiencyFilter'])document.getElementById(id).addEventListener('change',renderGlassEfficiency);
document.getElementById('glassEfficiencySearch').addEventListener('input',renderGlassEfficiency);renderGlassEfficiency();
""".replace('ROWS',json.dumps(rows)).replace('RENDER',render)
html='<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><main>'+region+'</main><script type="module">'+script+'</script>'
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(root)));threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=None if os.environ.get('CI') else shutil.which('chromium') or None)
 for width in [1366,390]:
  page=browser.new_page(viewport={'width':width,'height':850});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.route('**/analysis-fixture',lambda route:route.fulfill(body=html,content_type='text/html'))
  page.goto(f'http://127.0.0.1:{server.server_port}/analysis-fixture');page.wait_for_selector('.glass-analysis-table')
  assert page.locator('[data-analysis-detail]').count()==1
  assert '1 / 1' in page.locator('#glassEfficiencyStats').inner_text()
  assert '62,5%' in page.locator('.glass-analysis-table').inner_text()
  page.click('[data-analysis-detail="0"]');assert page.locator('[data-analysis-expanded="0"]').is_visible()
  page.locator('[data-analysis-expanded="0"] summary').first.click();assert 'Producción B' in page.locator('[data-analysis-expanded="0"]').inner_text()
  page.click('[data-analysis-view="racks"]');assert page.locator('[data-analysis-detail]').count()==2
  with page.expect_download() as d:page.click('#glassAnalysisExport')
  assert 'racks' in d.value.suggested_filename
  page.click('[data-analysis-view="groups"]');assert page.locator('[data-analysis-detail]').count()==1
  page.select_option('#glassAnalysisState','novelty');assert '6' in page.locator('.glass-analysis-table').inner_text()
  page.click('#glassTreeTab');assert page.locator('#glassTreePanel').is_visible();assert page.locator('.glass-efficiency-reservation').count()==1
  page.click('#glassTableTab');page.select_option('#glassAnalysisState','all');page.click('[data-analysis-view="productions"]')
  page.fill('#glassEfficiencySearch','NO MATCH');assert page.locator('#glassAnalysisExport').is_disabled()
  page.fill('#glassEfficiencySearch','');page.screenshot(path=f'/tmp/glass-analysis-{width}.png',full_page=True);assert not errors,errors
  page.close()
 browser.close()
server.shutdown();print('PASS Tabla/Árbol weekly mixing, inline detail, CSV, states, empty and PC/mobile')
