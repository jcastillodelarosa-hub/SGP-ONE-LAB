// Isolated full-workflow fixture. Every API and identifier below is synthetic.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.OPT_CHROMIUM?{executablePath:process.env.OPT_CHROMIUM}:{}),args:['--no-sandbox']});
 const base=process.env.OPT_URL||'http://127.0.0.1:8765/',errors=[];
 try{
 for(const [name,width,height]of [['desktop',1440,1000],['mobile',390,844]]){
 const page=await browser.newPage({viewport:{width,height}});page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{
  const u=new URL(route.request().url());if(u.origin!==new URL(base).origin)return route.abort();
  if(u.pathname==='/shared-scheme-fixture')return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0"><div id="host"></div></body></html>'});
  return route.continue();
 });
 await page.goto(new URL('shared-scheme-fixture',base).href);
 await page.evaluate(async()=>{
  const {mountOptWorkflow}=await import('/opt-digital/workflow.js');
  const {buildOptProgrammingSnapshot}=await import('/src/domain/opt-line-scope.js');
  const source=new DOMParser().parseFromString(await(await fetch('/opt-digital/index.html')).text(),'text/html');
  source.querySelectorAll('script').forEach(n=>n.remove());
  const root=document.querySelector('#host').attachShadow({mode:'open'});
  for(const href of ['/opt-digital/pilot.css','/opt-digital/sgp-theme.css','/opt-digital/matrix-panel.css']){const css=document.createElement('link');css.rel='stylesheet';css.href=href;root.append(css);}
  const shell=document.createElement('div');shell.id='optShell';shell.innerHTML=source.body.innerHTML;shell.querySelector('aside')?.remove();root.append(shell);
  const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,sha='a'.repeat(64),scope={linea:'PANELES_2',anio:2026,semana:46,modo:'BASE'};
  const refs=[1,2].map(n=>({id_documento:id(99),sha256:sha,sistema:'PANEL',referencia:'SYNTH-REF-'+n,fuentes:[{origen:'RETAIL',consecutivo:'OPT-SYNTHETIC'}],piezas:[{id_pieza:id(n),pagina:n,patron:n,barra:1,corte:1,longitud_mm:100}]}));
  const allRefs=[...refs.map(r=>({...r,piezas_documento:1})),{...refs[0],referencia:'SYNTH-FOREIGN',sistema:'OTHER',piezas_documento:3},{...refs[0],referencia:'SYNTH-ERROR',sistema:'OTHER',piezas_documento:2}];
  const group={key:'SYNTHETIC-GROUP',scope,origin:'SERVIDOR',reservation:'SYNTHETIC-RESERVE',system:'PANEL',opts:['OPT-SYNTHETIC'],references:refs,documentHashes:[sha]};
  const snapshot=buildOptProgrammingSnapshot({context:scope,productions:[{key_produccion:'SYNTHETIC-PRODUCTION',id_linea:'PANELES_2',sistema:'PANEL',reserva_principal:group.reservation,anio:2026,semana_base:46}],shared:[]});
  const catalogSnapshot={groups:[group]};let done=new Set();window.fixtureWrites=[];window.fixturePlanReads=[];window.fixtureMatrixReads=[];
  window.fixture=mountOptWorkflow(shell,{onDocuments(fn){fn([]);return()=>{};},onReference(){return()=>{};},openDocument(){throw Error('No original PDF in synthetic fixture');},importFiles(){throw Error('No import expected');}},{
   defaultScope:scope,storage:localStorage,storageScope:'synthetic-'+innerWidth,createId:()=>id(88),
   scopeApi:{load:async()=>snapshot,isCurrent:s=>s===snapshot,invalidate(){}},
   catalogApi:{load:async()=>catalogSnapshot,isCurrent:s=>s===catalogSnapshot,ownsGroup:g=>g===group,matchesReference:(g,r)=>g===group&&refs.some(x=>x.referencia===r.referencia),invalidate(){}},
   documentApi:{invalidate(){},load:async()=>allRefs,ownsReference:(g,r)=>g===group&&allRefs.includes(r)},
   matrixApi:{load:async(system,reference)=>{window.fixtureMatrixReads.push([system,reference]);if(reference==='SYNTH-ERROR')throw Error('Synthetic network failure');if(reference==='SYNTH-FOREIGN')return {status:'missing'};await new Promise(r=>setTimeout(r,reference==='SYNTH-REF-1'?80:1));return {status:'available',matrix:{blob:new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="200" height="60"><text x="5" y="30">SYNTHETIC QA ONLY</text></svg>'],{type:'image/svg+xml'}),revision:'QA',page:1,sourceSha256:'a'.repeat(64)}};}},
   api:{authorizesGroup:g=>g===group,estado:async()=>({scope,reserva:group.reservation,habilitado:true,manifiesto_validado:true,puede_registrar:true,referencias:refs.map(r=>({...r,piezas:r.piezas.map(p=>({...p,estado:done.has(p.id_pieza)?'CORTADO':'PENDIENTE',registrable:true}))}))}),registrar:async command=>{window.fixtureWrites.push(command);command.piezas.forEach(p=>done.add(p));}},
   plansApi:{invalidate(){},load:async(g,r)=>{window.fixturePlanReads.push(r.referencia);return {status:'AVAILABLE',plans:[1,2].map(n=>({finish:'SYNTHETIC FINISH',length:'240"',page:n,barqty:1,rest:'40"',code:'QA',location:'QA-LOCATION',restDisposition:'QA ONLY',cuts:[{id_pieza:r.piezas[0]?.id_pieza,profileInstance:1,length:'100"',project:g.reservation,selectedReservation:true},{profileInstance:1,length:'100"',project:'PRIVATE-OTHER-RESERVE',selectedReservation:false}]}))};}},
   summaryApi:{invalidate(){},load:async()=>({documents:[{opt:'OPT-SYNTHETIC',scope:'DOCUMENTO',status:'AVAILABLE',cutRows:refs.map(r=>({reference:r.referencia,finish:'QA',bars:1,pieces:2,plans:1,scrapPrinted:'40"',scrapPercentagePrinted:'16.7%',sourcePage:1})),materialRows:refs.map(r=>({reference:r.referencia,finish:'QA',length:'240"',quantity:1,location:'QA',code:'QA',observation:'SYNTHETIC ONLY',sourcePage:1}))}]})}
  });
 });
 const host=page.locator('#host');await host.locator('#optWorkflowTab1').click();await host.locator('#optScopeLoad').click();await host.locator('#optReservation').selectOption('SYNTHETIC-GROUP');
 await host.locator('#optSharedScheme .physical-track').first().waitFor();
 assert.equal(await host.locator('#optLoadPanel').isVisible(),false);assert.equal(await host.locator('.layout').isVisible(),false);assert.equal(await host.locator('.mobile-controls').isVisible(),false);
 assert.equal(await host.locator('.opt-shared-references button').count(),4);
 await host.locator('.opt-shared-profile-header .opt-matrix-preview:not([hidden])').waitFor();
 assert.match(await host.locator('.opt-shared-profile-header img').first().getAttribute('alt'),/SYNTH-REF-1/);
 const header=await host.locator('.opt-shared-profile-header').boundingBox(),matrix=await host.locator('.opt-shared-profile-header .opt-matrix-panel').boundingBox(),scheme=await host.locator('#optSharedScheme').boundingBox();
 assert(scheme.y>=header.y+header.height);assert(Math.abs(scheme.width-header.width)<2);if(width>1000)assert(matrix.x>header.x+100);
 assert.equal(await host.locator('#optSharedScheme').count(),1);assert.equal(await host.locator('#optSharedPieces > section').count(),1);
 assert.equal(await host.locator('.opt-shared-technical').getAttribute('open'),null);assert.equal(await host.locator('.opt-shared-piece-details').getAttribute('open'),null);
 assert(!((await host.locator('#optSharedScheme').textContent()).includes('PRIVATE-OTHER-RESERVE')));
 await host.locator('#optSharedScheme').getByRole('button',{name:'Siguiente',exact:true}).click();assert.match(await host.locator('#optSharedScheme').textContent(),/2 \/ 2/);
 await host.locator('#optSharedScheme button.segment').click();assert.equal(await host.locator('#optSharedPieces input').isChecked(),true);
 await host.locator('.opt-shared-references button').nth(1).click();await host.locator('#optSharedScheme .physical-track').first().waitFor();await host.locator('#optSharedScheme button.segment').click();assert.equal(await host.locator('#optSharedPieces input').isChecked(),true);
 await host.locator('.opt-shared-references button').nth(2).click();await host.locator('#optSharedScheme .physical-track').first().waitFor();assert.equal(await host.locator('#optSharedPieces input').count(),0);assert.equal(await host.locator('#optSharedScheme button.segment').count(),0);assert.match(await host.locator('.opt-shared-profile-header').textContent(),/Matriz no disponible/);
 await host.locator('.opt-shared-references button').nth(3).click();await host.locator('.opt-shared-profile-header').filter({hasText:'No se pudo consultar la matriz'}).waitFor();
 await host.locator('.opt-shared-references button').nth(0).click();await host.locator('.opt-shared-references button').nth(1).click();await page.waitForTimeout(120);assert.match(await host.locator('.opt-shared-profile-header img').first().getAttribute('alt'),/SYNTH-REF-2/);
 await host.locator('#optReservationTab1').click();await host.locator('#optSummaryView table').first().waitFor();assert.equal(await host.locator('#optSummaryView table').count(),2);
 const a=await host.locator('#optSummaryView table').nth(0).boundingBox(),b=await host.locator('#optSummaryView table').nth(1).boundingBox();assert(b.y>a.y+a.height);
 await host.locator('#optReservationTab0').click();assert.equal(await host.locator('#optSharedPieces input').isChecked(),true);
 await host.locator('.opt-shared-references button').nth(0).click();await host.locator('.opt-shared-piece-details > summary').click();assert.equal(await host.locator('#optSharedPieces input').isChecked(),true);
 await host.locator('#optSharedRegister').click();await host.locator('#optSharedCancel').click();assert.equal(await page.evaluate(()=>fixtureWrites.length),0);
 await host.locator('#optSharedRegister').click();await host.locator('#optSharedConfirm').click();await host.locator('#optSharedStatus').filter({hasText:'Cortes confirmados por el servidor'}).waitFor();
 await host.locator('#optSharedScheme button.segment').waitFor();assert.equal(await host.locator('#optSharedScheme button.segment').isDisabled(),true);await host.locator('#optSharedRefresh').click();await host.locator('#optSharedScheme button.segment').waitFor();assert.equal(await host.locator('#optSharedScheme button.segment').getAttribute('data-state'),'CORTADO');
 const writes=await page.evaluate(()=>fixtureWrites);assert.equal(writes.length,1);assert.equal(writes[0].piezas.length,2);assert.equal(new Set(writes[0].piezas).size,2);
 assert(await host.evaluate(h=>h.shadowRoot.querySelector('#optShell').scrollWidth<=innerWidth+1),'No horizontal page overflow');
 await host.locator('.opt-shared-profile-header img:not([hidden])').first().waitFor();await host.locator('.opt-shared-profile-header img').first().evaluate(img=>img.decode());assert(await host.locator('.opt-shared-profile-header img').first().evaluate(img=>img.naturalWidth>0));
 fs.mkdirSync('tests/opt-digital/evidence',{recursive:true});await page.screenshot({path:`tests/opt-digital/evidence/shared-scheme-${name}.png`,fullPage:true});
 await page.evaluate(()=>fixture.destroy());assert.equal(await host.locator('#optSharedCuts').count(),0);await page.close();
 }
 assert.deepEqual(errors,[]);console.log('PASS: synthetic full workflow PC/mobile, direct week/reservation, one reference and original scheme, old local layout hidden, private label masked, two summary tables, cross-reference/tab selection, confirm/cancel/exact registration.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
