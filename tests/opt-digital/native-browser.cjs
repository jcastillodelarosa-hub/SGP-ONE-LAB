const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const context=await browser.newContext();let auth={valida:true,usuario:'qa-opt-user',nombre:'QA OPT',rol:'LIDER MECANIZADO'},access=[{ventana:'mecanizado.proceso'}];const calls=[];let delayedAccess=null;
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname==='127.0.0.1')return route.continue();
  const rpc=u.pathname.split('/').pop();calls.push(rpc);
  if(rpc==='sgp_mis_accesos'&&delayedAccess){const pending=delayedAccess;delayedAccess=null;pending.started();await pending.wait;}
  if(u.pathname.includes('/rest/v1/rpc/'))return route.fulfill({json:rpc==='sgp_sesion_actual'?auth:rpc==='sgp_mis_accesos'?access:[]});
  return route.abort();});
 await page.addInitScript(()=>sessionStorage.setItem('sgp_one_session','synthetic-opt-token'));
 await page.goto(process.env.OPT_URL||'http://127.0.0.1:8765/');
 const tab=page.locator('[data-mach-tab="opt-digital"]');await tab.waitFor({state:'visible'});await tab.click();
 const host=page.locator('#optDigitalHost');await host.locator('#files').waitFor();await page.waitForFunction(()=>!document.querySelector('#optDigitalHost').shadowRoot.querySelector('#files').disabled);
 const before=calls.length;
 await host.locator('#files').setInputFiles({name:'native.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({plans:[{id:'p1',ref:'TEST-REF',barqty:1,length:'120"',cuts:[{length:'20"',project:'Synthetic only'}]}]}))});
 await host.locator('#library button').waitFor();assert.equal(await host.locator('.summary button').isDisabled(),true);assert.match(await host.locator('#referenceAudit').textContent(),/provisional/);
 assert.equal(calls.slice(before).some(x=>/guardar|registrar|actualizar/.test(x)),false);
 const syntheticPdf=require('./synthetic-pdf.cjs')();
 await host.locator('#files').setInputFiles({name:'wrong-type.pdf',mimeType:'text/html',buffer:syntheticPdf});await page.waitForFunction(()=>document.querySelector('#optDigitalHost').shadowRoot.querySelector('#status').textContent.includes('incompatible'));assert.equal(await host.locator('#library button').count(),1);
 await host.locator('#files').setInputFiles({name:'safe-actions.pdf',mimeType:'application/pdf',buffer:syntheticPdf});await page.waitForFunction(()=>document.querySelector('#optDigitalHost').shadowRoot.querySelectorAll('#library button').length===2);await host.locator('#optWorkflowTab1').click();await host.locator('#pdfToggle').click();await page.waitForFunction(()=>document.querySelector('#optDigitalHost').shadowRoot.querySelector('#pdfPosition').textContent.includes('Página 1 de 2'));assert.equal(await host.locator('iframe,object,embed').count(),0);assert.equal(await page.evaluate(()=>window.__optFrameExecuted===true),false);
 await host.locator('#optWorkflowTab0').click();await host.locator('#library button').filter({hasText:'native.json'}).click();await host.locator('#optWorkflowTab1').click();
 await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'/tmp/opt-native-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await host.locator('#openRefs').click();for(let i=0;i<10;i++){await page.keyboard.press('Tab');assert(await host.evaluate(h=>{const r=h.shadowRoot;return r.querySelector('#refDrawer').contains(r.activeElement)||!r.activeElement;}));}await page.keyboard.press('Escape');assert.equal(await host.evaluate(h=>h.shadowRoot.activeElement?.id),'openRefs');await host.locator('#openRefs').click();await host.locator('#refs button').click();assert.equal(await host.locator('#optShell').evaluate(e=>e.classList.contains('opt-refs-open')),false);
 await page.screenshot({path:'/tmp/opt-native-mobile.png',fullPage:true});
 if(process.env.AXE_SCRIPT){await page.addScriptTag({path:process.env.AXE_SCRIPT});const violations=await page.evaluate(async()=>{const r=await axe.run(document.querySelector('#optDigitalHost'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return r.violations.map(v=>v.id);});assert.deepEqual(violations,[]);}
 if(process.env.OPT_PRIVATE_PDF){await host.locator('#files').setInputFiles(process.env.OPT_PRIVATE_PDF);await page.waitForFunction(()=>document.querySelector('#optDigitalHost').shadowRoot.querySelectorAll('#library button').length===3,{},{timeout:90000});await host.locator('#optWorkflowTab1').click();await host.locator('#pdfToggle').click();await page.waitForFunction(()=>document.querySelector('#optDigitalHost').shadowRoot.querySelector('#pdfPosition').textContent.startsWith('Página 1 de'),{},{timeout:90000});assert.equal(await host.locator('.summary button').isDisabled(),true);assert.equal(calls.slice(before).some(x=>/guardar|registrar|actualizar/.test(x)),false);}
 await page.locator('#authLogout').click();await tab.waitFor({state:'hidden'});assert.equal(await host.locator('#files').count(),0);
 // A second actor gets another local storage scope, not the first actor's documents.
 auth={...auth,usuario:'qa-opt-other'};await page.reload();await tab.waitFor({state:'visible'});await tab.click();await host.locator('#files').waitFor();await page.waitForFunction(()=>!document.querySelector('#optDigitalHost').shadowRoot.querySelector('#files').disabled);assert.equal(await host.locator('#library button').count(),0);
 access=[{ventana:'mecanizado.recepcion'}];await page.reload();await page.waitForTimeout(500);assert.equal(await tab.isVisible(),false);await tab.evaluate(e=>e.click());assert.equal(await host.locator('#files').count(),0);
 access=[{ventana:'mecanizado.proceso'}];await page.addInitScript(()=>{sessionStorage.removeItem('sgp_one_session');localStorage.setItem('sgp_one_session_persist','synthetic-opt-token');});await page.reload();await tab.waitFor({state:'visible'});
 let release,started;const waiting=new Promise(r=>started=r);delayedAccess={started,wait:new Promise(r=>release=r)};await page.reload();await waiting;await page.locator('#authLogout').click();release();await page.waitForTimeout(150);assert.equal(await tab.isVisible(),false);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({version:21,native:true,passed:true,pdfChecked:Boolean(process.env.OPT_PRIVATE_PDF),checks:['PDF MIME containment and raster-only native view','native modal focus and Escape','existing production permission','native shadow DOM view','file import','provisional counts','no productive write','desktop/mobile','logout clears view','actor-local library','denied permission cannot mount','persistent session permission','stale access response after logout denied']},null,2));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
