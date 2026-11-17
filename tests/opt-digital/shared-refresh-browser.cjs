// Synthetic-only UI acceptance; no remote requests or writes.
const assert=require('node:assert/strict'),fs=require('node:fs');const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  await page.clock.install();await page.goto('http://127.0.0.1:8765/opt-digital/index.html');
  await page.addStyleTag({url:'http://127.0.0.1:8765/opt-digital/sgp-theme.css'});
  await page.addStyleTag({content:'body{display:block!important;margin:0;padding:12px;--opt-blue:#1264c8;--opt-ink:#103b73;--opt-line:#cbd9e8;--opt-soft:#eaf2fb}'});
  await page.evaluate(async()=>{
   document.body.replaceChildren();const host=document.createElement('main');document.body.append(host);
   const {mountSharedCuts}=await import('/opt-digital/shared-cuts.js');
   const scope={linea:'PANELES_2',anio:2099,semana:1,modo:'BASE'},sha='a'.repeat(64),id='01234567-89ab-4cde-8fab-0123456789ab';window.qaDone=false;window.qaReads=0;window.qaWrites=0;
   const api={authorizesGroup:g=>!!g,estado:async()=>{window.qaReads++;return {scope,reserva:'SYNTH',habilitado:true,manifiesto_validado:true,puede_registrar:true,referencias:[{sistema:'SYNTH',referencia:'PROFILE-QA',sha256:sha,fuentes:[{origen:'RETAIL',consecutivo:'QA'}],piezas:[{id_pieza:id,registrable:true,estado:window.qaDone?'CORTADO':'PENDIENTE',longitud_mm:500,pagina:1,patron:1,barra:1,corte:1}]}]};},registrar:async()=>{window.qaWrites++;throw Error('Writes forbidden');}};
   window.qaPanel=mountSharedCuts(host,{api,storage:localStorage,storageScope:'qa-refresh'});await qaPanel.select({scope,reservation:'SYNTH',origin:'RETAIL',system:'SYNTH',opts:['QA']},[{format:'pdf',key:sha}]);
  });
  await page.locator('[data-piece]').check();const reads=await page.evaluate(()=>qaReads);await page.clock.fastForward(20001);assert.equal(await page.evaluate(()=>qaReads),reads);assert(await page.locator('[data-piece]').isChecked());
  await page.locator('#optSharedRegister').click();await page.clock.fastForward(20001);assert(await page.locator('#optSharedConfirmation').isVisible());
  fs.mkdirSync('tests/opt-digital/evidence',{recursive:true});await page.screenshot({path:`tests/opt-digital/evidence/refresh-paused-${width}.png`,fullPage:true});
  await page.locator('#optSharedCancel').click();await page.locator('[data-piece]').uncheck();await page.evaluate(()=>{qaDone=true;window.dispatchEvent(new Event('focus'));});await page.waitForFunction(()=>document.querySelector('#optSharedStatus').textContent.includes('1 cortadas y 0 pendientes'));assert(await page.locator('[data-piece]').isDisabled());
  await page.evaluate(()=>{qaDone=false;});await page.clock.fastForward(20001);await page.waitForFunction(()=>document.querySelector('#optSharedStatus').textContent.includes('0 cortadas y 1 pendientes'));
  assert.equal(await page.evaluate(()=>qaWrites),0);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
  await page.screenshot({path:`tests/opt-digital/evidence/refresh-idle-${width}.png`,fullPage:true});await page.evaluate(()=>qaPanel.destroy());await page.close();
 }
 await browser.close();console.log('PASS synthetic refresh PC/mobile: focus, timer, selection, confirmation, zero writes, no horizontal overflow');
})().catch(e=>{console.error(e);process.exitCode=1;});
