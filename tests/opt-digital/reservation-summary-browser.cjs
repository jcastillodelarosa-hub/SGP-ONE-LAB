// Approved stacked-table option, rendered with synthetic documentary data only.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch(),page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const base=process.env.OPT_URL||'http://127.0.0.1:8765/';
 await page.route('**/*',route=>{
  const u=new URL(route.request().url());if(u.origin!==new URL(base).origin)return route.abort();
  if(u.pathname==='/summary-fixture')return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:16px;background:#eef2f7"><div id="host"></div></body></html>'});
  return route.continue();
 });
 await page.goto(new URL('summary-fixture',base).href);
 await page.evaluate(async()=>{
  const {mountReservationSummary}=await import('/opt-digital/reservation-summary.js');
  const root=document.querySelector('#host').attachShadow({mode:'open'}),css=document.createElement('link');css.rel='stylesheet';css.href='/opt-digital/sgp-theme.css';root.append(css);
  const shell=document.createElement('main');shell.id='optShell';root.append(shell);
  window.fixture=mountReservationSummary(shell,{api:{load:async()=>({documents:[{opt:'OPT-QA · EJEMPLO NO PRODUCTIVO',scope:'DOCUMENTO',status:'AVAILABLE',cutRows:[{reference:'QA-PERFIL-001',finish:'ACABADO QA',bars:2,pieces:4,plans:1,scrapPrinted:'12"',scrapPercentagePrinted:'10%',sourcePage:2},{reference:'QA-PERFIL-002',finish:'ACABADO QA',bars:3,pieces:9,plans:2,scrapPrinted:'20"',scrapPercentagePrinted:'20%',sourcePage:8}],materialRows:[{reference:'QA-PERFIL-001',finish:'ACABADO QA',length:'40 1/2"',quantity:2,location:'QA-01',code:'QA-COD-001',observation:'EJEMPLO QA',sourcePage:2},{reference:'QA-PERFIL-002',finish:'ACABADO QA',length:'40 1/2"',quantity:3,location:'QA-01',code:'QA-COD-002',observation:'EJEMPLO QA',sourcePage:8}]}]})}});
  window.fixture.select({origin:'SERVIDOR',reservation:'RESERVA SINTÉTICA',system:'PANEL'});window.fixture.show(true);
 });
 const host=page.locator('#host');await host.locator('table').first().waitFor();
 await page.waitForFunction(()=>getComputedStyle(document.querySelector('#host').shadowRoot.querySelector('th')).backgroundColor==='rgb(234, 242, 251)');
 fs.mkdirSync('tests/opt-digital/evidence',{recursive:true});
 for(const [name,width,height]of [['desktop',1440,1000],['mobile',390,844]]){
  await page.setViewportSize({width,height});const tables=host.locator('table');assert.equal(await tables.count(),2);
  const first=await tables.nth(0).boundingBox(),second=await tables.nth(1).boundingBox();assert(second.y>first.y+first.height,'tables must stack, never become side-by-side cards');
  assert(await host.evaluate(h=>h.getBoundingClientRect().right<=innerWidth));
  const wraps=host.locator('.opt-summary-scroll');for(let i=0;i<2;i++){
   const region=wraps.nth(i);assert.equal(await region.getAttribute('tabindex'),'0');
   assert.equal(await region.locator('th').first().evaluate(e=>getComputedStyle(e).position),'sticky');
   if(name==='mobile'){assert(await region.evaluate(e=>e.scrollWidth>e.clientWidth));await region.evaluate(e=>e.scrollLeft=120);const left=await region.boundingBox(),cell=await region.locator('th').first().boundingBox();assert(Math.abs(cell.x-left.x)<3);await region.evaluate(e=>e.scrollLeft=0);}
  }
  await page.screenshot({path:`tests/opt-digital/evidence/summary-${name}.png`,fullPage:true});
 }
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS: synthetic summary desktop/mobile, stacked tables, scrollable regions, sticky reference, no page overflow. No production.');
})().catch(e=>{console.error(e);process.exitCode=1;});
