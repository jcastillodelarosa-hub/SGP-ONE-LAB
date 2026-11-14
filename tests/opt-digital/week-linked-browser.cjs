// Local synthetic UI QA only; block all external traffic and all writer calls.
const assert=require('node:assert/strict'),fs=require('node:fs');const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']}),page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const base=process.env.OPT_URL||'http://127.0.0.1:8765/';
 await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin!==new URL(base).origin)return r.abort();if(u.pathname==='/week-fixture')return r.fulfill({contentType:'text/html',body:fs.readFileSync('opt-digital/index.html','utf8').replace(/<script[^>]*>[\s\S]*?<\/script>/g,'').replaceAll('href="','href="/opt-digital/')});return r.continue();});
 await page.goto(base+'week-fixture');await page.evaluate(async()=>{
 document.body.id='optShell';document.body.style.cssText='--opt-blue:#1264c8;--opt-ink:#103b73;--opt-line:#cbd9e8;--opt-soft:#eaf2fb';const css=document.createElement('link');css.rel='stylesheet';css.href='/opt-digital/sgp-theme.css';document.head.append(css);
 const {mountOptWorkflow}=await import('/opt-digital/workflow.js'),{createOptProgrammingScope}=await import('/src/services/opt-programming-scope.js');
 const scope={linea:'PANELES_2',anio:2026,semana:46,modo:'BASE'},relations=Array.from({length:18},(_,i)=>({key_produccion:'SYNTH-'+i,id_linea:'PANELES_2',anio:2026,semana_base:46,sistema:i===0?'SYNTH-PROFILE-LONG-SYSTEM':'SYNTH-SYSTEM',reserva_principal:'SYNTH-R'+String(i).padStart(2,'0')}));
 const client={rpc:async name=>{if(name==='sgp_consultar_programacion_semana')return {data:{producciones:relations}};if(name==='sgp_reservas_asociadas_listar')return {data:[]};throw Error('Unexpected RPC: '+name);}};
 let current=null;const catalogApi={invalidate(){current=null;},isCurrent:s=>!!s&&s===current,ownsGroup:g=>!!current&&current.groups.includes(g),async load(){return current={scope,groups:relations.slice(0,9).map((r,i)=>({key:'SYNTH-G'+i,origin:'SERVIDOR',reservation:r.reserva_principal,system:r.sistema,scope,canRegister:false,opts:i===0?['SYNTH-OPT-LONG-DOCUMENT-NAME-001','SYNTH-OPT-002']:['SYNTH-OPT-'+i],documentHashes:[],references:[]}))};}};
 window.workflow=mountOptWorkflow(document.body,{onDocuments:cb=>{cb([]);return ()=>{};},openDocument(){throw Error('Unexpected PDF');}},{scopeApi:createOptProgrammingScope(client,()=> 'synthetic'),catalogApi,defaultScope:scope});
 });
 await page.locator('#optScopeLoad').click();await page.waitForFunction(()=>document.querySelectorAll('#optWeekLinkedList tbody tr').length===18);
 const dir=process.env.OPT_EVIDENCE_DIR||'/tmp/opt-week-list-evidence';fs.mkdirSync(dir,{recursive:true});
 for(const [name,width,height]of [['desktop',1440,1000],['mobile',390,844]]){
  await page.setViewportSize({width,height});const list=page.locator('#optWeekLinkedList'),region=list.getByRole('region');await list.scrollIntoViewIfNeeded();
  assert.equal(await list.locator('tbody button').count(),18);assert.equal(await list.locator('tbody button').first().evaluate(e=>getComputedStyle(e).whiteSpace),'nowrap');assert.equal(await list.locator('tbody tr').filter({hasText:'Sin OPT enlazada'}).count(),9);
  assert(await region.evaluate(e=>e.scrollHeight>e.clientHeight));assert(await region.evaluate(e=>e.clientHeight<=440));
  await region.evaluate(e=>{e.scrollTop=0;e.scrollLeft=0;});await page.screenshot({path:dir+'/'+name+'.png'});
  if(name==='mobile'){assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.equal(await list.locator('tbody tr').first().evaluate(e=>getComputedStyle(e).display),'block');await page.screenshot({path:dir+'/mobile-right.png'});}
  await region.evaluate(e=>e.scrollTop=e.scrollHeight);assert(await region.evaluate(e=>e.scrollTop>0));await page.screenshot({path:dir+'/'+name+'-bottom.png'});
  await list.locator('summary').click();assert(!(await region.isVisible()));await list.locator('summary').click();assert(await region.isVisible());
 }
 await page.locator('#optWeekFilter').selectOption('no');assert.equal(await page.locator('#optWeekLinkedList tbody tr').count(),9);await page.locator('#optWeekFilter').selectOption('all');await page.locator('#optWeekSearch').fill('SYNTH-R00');assert.equal(await page.locator('#optWeekLinkedList tbody tr').count(),1);await page.locator('#optWeekSearch').fill('');await page.locator('#optWeekLinkedList tbody button').first().click();assert.equal(await page.locator('#optReservation').inputValue(),'SYNTH-G0');assert(await page.locator('#optCutsPanel').isVisible());
 await page.locator('#optScopeWeek').fill('47');await page.locator('#optScopeWeek').dispatchEvent('change');assert.equal(await page.locator('#optWeekLinkedList tbody tr').count(),0);assert.deepEqual(errors,[]);await browser.close();console.log('PASS: synthetic desktop/mobile list, 18 reservations, 9 missing links, bounded vertical scroll, mobile cards and no viewport overflow, collapse/reopen, exact selection, stale week cleared. No writes/network outside localhost.');
})().catch(e=>{console.error(e);process.exit(1);});
