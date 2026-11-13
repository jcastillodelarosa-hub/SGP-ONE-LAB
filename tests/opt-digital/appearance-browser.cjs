// Isolated visual regression of the native shadow host. No service connections.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch(),page=await browser.newPage();
 const base=process.env.OPT_URL||'http://127.0.0.1:8765/';
 await page.route('**/*',route=>{
  const u=new URL(route.request().url());
  if(u.origin!==new URL(base).origin)return route.abort();
  if(u.pathname==='/appearance-fixture')return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:16px;background:#eef2f7"><button id="tab">OPT</button><section id="panel"><div id="host"></div></section></body></html>'});
  return route.continue();
 });
 await page.goto(new URL('appearance-fixture',base).href);
 await page.evaluate(async()=>{
  const {createOptDigitalHost}=await import('/src/modules/opt-digital.js');
  window.fixture=createOptDigitalHost({button:document.querySelector('#tab'),panel:document.querySelector('#panel'),container:document.querySelector('#host'),getToken:()=> 'synthetic-only',getDefaultScope:()=>({linea:'PANELES_2',anio:2026,semana:46})});
  window.fixture.update({valid:true,username:'synthetic-style',access:['mecanizado']});document.querySelector('#panel').hidden=false;await window.fixture.open();
 });
 const host=page.locator('#host');await host.locator('#optScopeLoad').waitFor();
 await page.waitForFunction(()=>getComputedStyle(document.querySelector('#host').shadowRoot.querySelector('#optScopeLoad')).backgroundColor==='rgb(237, 241, 246)',null,{timeout:15000});
 fs.mkdirSync('tests/opt-digital/evidence',{recursive:true});
 for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
  await page.setViewportSize({width,height});
  for(const tab of [0,1]){
   await host.locator('#optWorkflowTab'+tab).click();
   assert.equal(await host.locator('#optWorkflowTab'+tab).getAttribute('aria-selected'),'true');
   assert.equal(await host.locator(tab?'#optLoadPanel':'#optCutsPanel').isVisible(),false);
   assert(await host.locator('#optReservationScope').isVisible());
   assert(await host.locator('#optScopeYear').isVisible());
   assert(await host.locator('#optScopeWeek').isVisible());
   assert(await host.locator('#optScopeLine').isVisible());
   assert(await host.locator('#optScopeLoad').isVisible());
   assert.equal(await host.locator('#optScopeLoad').count(),1);
   const result=await host.evaluate((h)=>{const r=h.shadowRoot,visible=e=>e.getClientRects().length>0;return [...r.querySelectorAll('button,input:not([type=checkbox]),select')].filter(visible).map(e=>({id:e.id,height:e.getBoundingClientRect().height,right:e.getBoundingClientRect().right}));});
   for(const c of result){assert(c.height>=40,`${name}: undersized ${c.id}`);assert(c.right<=width+1,`${name}: overflow ${c.id}`);}
   await page.screenshot({path:`tests/opt-digital/evidence/appearance-${name}-${tab?'cuts':'load'}.png`,fullPage:true});
  }
 }
 await host.locator('#optWorkflowTab0').click();await host.locator('#optWorkflowTab0').focus();await page.keyboard.press('ArrowRight');assert.equal(await host.locator('#optWorkflowTab1').getAttribute('aria-selected'),'true');
 assert(await host.locator('#optSharedRegister').isDisabled());
 assert.equal(await host.locator('#optSharedRegister').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(237, 241, 246)');
 await host.locator('#optWorkflowTab0').click();assert((await host.locator('#search').boundingBox()).width>250);
 await page.evaluate(()=>window.fixture.destroy());assert.equal(await host.locator('#optShell').count(),0);
 await browser.close();console.log('PASS: native SGP style, desktop/mobile, tabs, disabled action, no horizontal control overflow, logout cleanup. Synthetic only.');
})().catch(e=>{console.error(e);process.exitCode=1;});
