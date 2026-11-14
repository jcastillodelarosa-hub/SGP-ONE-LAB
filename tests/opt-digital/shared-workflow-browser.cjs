// Prepared isolated browser QA. All RPCs are synthetic and external network is blocked.
const assert=require('node:assert/strict'),fs=require('node:fs');const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({...(process.env.OPT_CHROMIUM?{executablePath:process.env.OPT_CHROMIUM}:{}),headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 await page.goto('http://127.0.0.1:8765/opt-digital/index.html');
 await page.evaluate(async()=>{
  document.body.replaceChildren();const host=document.createElement('main');document.body.append(host);
  const {mountSharedCuts}=await import('/opt-digital/shared-cuts.js'),{createOptSharedCuts}=await import('/src/services/opt-shared-cuts.js');
  const scope={linea:'PANELES_2',anio:2026,semana:46,modo:'BASE'},piece='01234567-89ab-4cde-8fab-0123456789ab',doc='11234567-89ab-4cde-8fab-0123456789ab',key='21234567-89ab-4cde-8fab-0123456789ab',sha='a'.repeat(64);let receipt=null,loseResponse=true;
  window.testRequests=[];
  const client={rpc:async(name,args)=>{
   window.testRequests.push({name,args});
   if(name==='sgp_opt_cortes_registrar_v2'){
    receipt={contract_version:2,scope,ok:true,duplicado:!!receipt,reserva:'SYNTH-ONLY',cantidad_piezas:1,piezas:[piece],usuario:'synthetic-user',id_registro:key,registrado_en:'2026-11-11T09:30:00Z',periodo:{fecha:'2026-11-10',turno:2,inicio:'2026-11-10T18:00:00-05:00',fin:'2026-11-11T06:00:00-05:00',zona:'America/Bogota',horario_sha256:'b'.repeat(64)}};
    if(loseResponse){loseResponse=false;throw Error('Simulated response loss after commit');}return {data:receipt};
   }
   return {data:{contract_version:2,scope,habilitado:true,reserva:'SYNTH-ONLY',manifiesto_validado:true,puede_registrar:true,totales:{piezas:1,cortadas:receipt?1:0,pendientes:receipt?0:1},referencias:[{id_documento:doc,sha256:sha,fuentes:[{source_key:'SYNTH-1',origen:'RETAIL',consecutivo:'SYNTH-1',modo_carga:'INDICE'}],sistema:'PANEL',referencia:'SYNTH-REF',piezas:[{id_pieza:piece,registrable:true,pagina:1,patron:1,barra:1,corte:1,longitud_mm:500,estado:receipt?'CORTADO':'PENDIENTE',usuario:receipt?'synthetic-user':null,registrado_en:receipt?.registrado_en||null,id_registro:receipt?.id_registro||null,periodo:receipt?.periodo||null}]}]}};
  }};
  const api=createOptSharedCuts(client,()=> 'synthetic-token');window.mountShared=async()=>{window.shared?.destroy();window.shared=mountSharedCuts(host,{api,storage:localStorage,storageScope:'browser-synthetic',createId:()=>key});await window.shared.select({scope,canRegister:true,reservation:'SYNTH-ONLY',origin:'RETAIL',system:'PANEL',opts:['SYNTH-1']},[{format:'pdf',key:sha}]);};await window.mountShared();
 });
 await page.locator('#optSharedPieces input').check();await page.locator('#optSharedRegister').click();await page.locator('#optSharedCancel').click();assert.equal(await page.evaluate(()=>testRequests.filter(r=>r.name.includes('registrar')).length),0);
 await page.locator('#optSharedRegister').click();await page.locator('#optSharedConfirm').click();await page.getByText(/Resultado sin confirmar/).waitFor();assert(await page.locator('#optSharedRegister').isDisabled());
 await page.evaluate(()=>window.mountShared());await page.locator('#optSharedRetry').click();await page.getByText(/Cortes confirmados por el servidor/).waitFor();assert.match(await page.locator('#optSharedPieces').textContent(),/synthetic-user/);assert.equal(await page.locator('#optSharedPieces tbody tr td').nth(5).textContent(),'2026-11-10');assert.equal(await page.locator('#optSharedPieces tbody tr td').nth(6).textContent(),'2');
 const writes=await page.evaluate(()=>testRequests.filter(r=>r.name.includes('registrar')));assert.equal(writes.length,2);assert.deepEqual(writes[0],writes[1]);
 fs.mkdirSync('tests/opt-digital/evidence',{recursive:true});await page.screenshot({path:'tests/opt-digital/evidence/shared-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'tests/opt-digital/evidence/shared-mobile.png',fullPage:true});
 assert(await page.locator('#optSharedPieces input').isDisabled());assert.deepEqual(errors,[]);await browser.close();console.log('PASS synthetic browser: confirmation/cancel, actual adapter + UI, uncertain committed response, remount replay, server attribution, PC/mobile. No production.');
})().catch(e=>{console.error(e);process.exit(1);});
