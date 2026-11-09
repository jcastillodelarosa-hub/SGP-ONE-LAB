"""Approved graph colors/filters on actual renderer and CSS, synthetic RPC rows only."""
from pathlib import Path
import json,threading,http.server,functools,os,shutil
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[2]
html=(root/'index.html').read_text();app=(root/'app.js').read_text()
modal=next(line for line in html.splitlines() if line.startswith('<div id="glassExplorerModal"')).replace(' hidden role="dialog"',' role="dialog"')
renderer=app[app.index('const glassExplorer='):app.index('function openGlassBurroDetail(')]
rows=[]
for i,(name,total,prepared,novelty,transfer) in enumerate([('PREP',10,10,0,0),('NOV',5,0,5,0),('TL',2,0,0,2),('OTRO',3,0,0,0),('MIX',4,1,1,1)]):
 rows.append(dict(key_produccion='A',reserva='8739029',parte='6',produccion='1156819 · GH HOUSE',ventanas=17,posicion=name,unidades=total,preparadas=prepared,novedad=novelty,traslado=transfer))
script="""import {glassStates,glassInsightQuantity,glassRackAppearance} from '/src/domain/glass-explorer-states.js';
import {buildGlassRelationGraph,traceGlassRelations} from '/src/domain/glass-relations-graph.js';
import {buildGlassNodeInsights,glassCoverage,glassRackBreakdown} from '/src/domain/glass-explorer-insights.js';
const rows=ROWS,visibleGlassEfficiencyRows=()=>rows;
const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function openGlassBurroDetail(name){document.body.dataset.detail=name;}
RENDER
const select=document.querySelector('#glassExplorerStatus');select.addEventListener('change',()=>{glassExplorer.selected=null;renderGlassExplorer()});
renderGlassExplorer();
""".replace('ROWS',json.dumps(rows)).replace('RENDER',renderer)
pagehtml='<meta charset="utf-8"><link rel="stylesheet" href="/styles.css">'+modal+'<div id="glassExplorerTooltip" class="glass-explorer-tooltip" hidden></div><script type="module">'+script+'</script>'
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(root)));threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=None if os.environ.get('CI') else shutil.which('chromium'))
 for width in [1366,390]:
  page=browser.new_page(viewport={'width':width,'height':900});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.route('**/states-fixture',lambda r:r.fulfill(body=pagehtml,content_type='text/html; charset=utf-8'))
  page.goto(f'http://127.0.0.1:{server.server_port}/states-fixture');page.wait_for_selector('[data-node="b:PREP"]')
  assert page.locator('#glassExplorerStatus option').count()==5
  assert page.locator('[data-node="p:8739029:6"] > rect').first.get_attribute('fill')=='#dceaff'
  assert page.locator('[data-node="o:A"] > rect').first.get_attribute('fill')=='#1b4f9c'
  for state,name,color in [('prepared','PREP','#14834f'),('novelty','NOV','#ffe276'),('transfer','TL','#f89b32'),('others','OTRO','#e84545')]:
   assert page.locator(f'[data-node="b:{name}"] > rect').first.get_attribute('fill')==color
  assert 'Mixto' in page.locator('[data-node="b:MIX"]').text_content()
  page.screenshot(path=f'/tmp/glass-states-all-{width}.png',full_page=True)
  for state,name,color in [('prepared','PREP','#14834f'),('novelty','NOV','#ffe276'),('transfer','TL','#f89b32'),('others','OTRO','#e84545')]:
   page.select_option('#glassExplorerStatus',state)
   assert page.locator('[data-node^="b:"]').count()==2
   assert page.locator('[data-node="b:MIX"] > rect').first.get_attribute('fill')==color
   page.locator(f'[data-node="b:{name}"]').click();assert 'Total en ubicación' in page.locator('#glassExplorerDetails').inner_text()
  page.select_option('#glassExplorerStatus','all');assert page.locator('[data-node^="b:"]').count()==5
  assert not errors,errors;page.close()
 browser.close()
server.shutdown();print('PASS graph approved palette, 5filters, mixed rack, hover/details, PC/mobile, existing actual renderer')
