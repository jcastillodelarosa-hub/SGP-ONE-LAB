// Synthetic drawing only; no source documents, credentials or service calls.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch(),page=await browser.newPage();
 const base=process.env.OPT_URL||'http://127.0.0.1:8765/';
 await page.route('**/*',route=>{
  const u=new URL(route.request().url());if(u.origin!==new URL(base).origin)return route.abort();
  if(u.pathname==='/matrix-fixture')return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/opt-digital/matrix-panel.css"><link rel="stylesheet" href="/opt-digital/sgp-theme.css"><body style="margin:16px;font:14px system-ui"><main id="optShell"></main></body></html>'});return route.continue();
 });
 await page.goto(new URL('matrix-fixture',base).href);
 await page.evaluate(async()=>{
  const {mountMatrixPanel}=await import('/opt-digital/matrix-panel.js');const c=document.createElement('canvas');c.width=600;c.height=400;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,600,400);x.strokeStyle='#123';x.lineWidth=5;x.strokeRect(160,70,280,200);x.fillStyle='#123';x.font='22px sans-serif';x.fillText('SYNTHETIC TEST — NOT A REAL PROFILE',45,350);const blob=await new Promise(r=>c.toBlob(r,'image/png'));
  window.panel=mountMatrixPanel(document.querySelector('main'),{api:{load:async(s,r)=>r==='AMBIGUOUS'?{status:'ambiguous',matrix:null}:{status:'available',matrix:{blob,revision:'TEST',page:1,sourceSha256:'a'.repeat(64)}}}});await window.panel.select('TEST','SYNTHETIC');
 });
 fs.mkdirSync('tests/opt-digital/evidence',{recursive:true});
 for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
  await page.setViewportSize({width,height});await page.locator('.opt-matrix-preview').waitFor();assert(await page.locator('.opt-matrix-preview').evaluate(e=>e.complete&&e.naturalWidth===600));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:`tests/opt-digital/evidence/matrix-${name}.png`,fullPage:true});
  await page.getByRole('button',{name:'Ampliar matriz'}).click();assert(await page.locator('dialog').isVisible());await page.screenshot({path:`tests/opt-digital/evidence/matrix-${name}-zoom.png`,fullPage:true});
  await page.keyboard.press('Escape');assert.equal(await page.locator('dialog').isVisible(),false);assert(await page.getByRole('button',{name:'Ampliar matriz'}).evaluate(e=>e===document.activeElement));
 }
 await page.evaluate(()=>window.panel.select('TEST','AMBIGUOUS'));assert.equal(await page.locator('.opt-matrix-preview').isVisible(),false);assert.match(await page.locator('main').textContent(),/varias matrices/);await page.evaluate(()=>window.panel.destroy());assert.equal(await page.locator('.opt-matrix-panel').count(),0);await browser.close();console.log('PASS synthetic matrix desktop/mobile, original PNG, zoom/Escape/focus, no overflow, ambiguity, disposal');
})().catch(e=>{console.error(e);process.exitCode=1;});
