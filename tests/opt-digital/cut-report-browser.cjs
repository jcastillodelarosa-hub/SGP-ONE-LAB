// Prepared CI-only isolated browser QA: synthetic RPCs, no external requests or writes.
const assert=require('node:assert/strict'),fs=require('node:fs');const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({...(process.env.OPT_CHROMIUM?{executablePath:process.env.OPT_CHROMIUM}:{}),headless:true,args:['--no-sandbox']});
 fs.mkdirSync('tests/opt-digital/evidence',{recursive:true});
 for(const [label,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
  const page=await browser.newPage({viewport,acceptDownloads:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  await page.goto('http://127.0.0.1:8765/opt-digital/index.html');
  await page.evaluate(async()=>{
   document.body.replaceChildren();const host=document.createElement('main');document.body.append(host);
   const {mountOptCutReport}=await import('/opt-digital/cut-report.js'),{createOptCutReport}=await import('/src/services/opt-cut-report.js');
   const scope={linea:'PANELES_2',anio:2026,semana:45,modo:'BASE'},id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
   window.reportTest={mode:'ok',token:'synthetic-user',calls:[],release:null};
   const api=createOptCutReport({rpc:async(name,args)=>{
    reportTest.calls.push({name,args});if(reportTest.mode==='hold')await new Promise(resolve=>reportTest.release=resolve);
    if(reportTest.mode==='error')return {error:{message:'OPT_NO_AUTORIZADO'}};
    const rows=(args.p_reservas||[]).filter(r=>r!=='ZERO').map((r,i)=>({id_pieza:id(i+1),id_documento:id(10),sha256:'a'.repeat(64),reserva:r,sistema:'PANEL',referencia:r==='R'?'=REFERENCE':'REF-2',longitud_mm:1200,pagina:1,patron:1,barra:1,corte:i+1,id_registro:id(i+20),usuario:r==='R'?'Cortador A':'Cortador B',registrado_en:'2026-11-10T07:00:00Z',periodo:{fecha:'2026-11-09',turno:2,inicio:'2026-11-09T23:00:00Z',fin:'2026-11-10T11:00:00Z',zona:'America/Bogota',horario_sha256:'b'.repeat(64)}}));
    return {data:{contract_version:2,report_contract:'OPT-CUT-REPORT-1',scope:args.p_scope,semana_tipo:'ALCANCE_REGISTRADO',reservas:reportTest.mode==='empty'?[]:[{reserva:'R',cortadas:1},{reserva:'R2',cortadas:1},{reserva:'ZERO',cortadas:0}],seleccion:args.p_reservas,filas:rows,total_piezas:rows.length}};
   }},()=>reportTest.token);
   window.reportPanel=mountOptCutReport(host,{api,defaultScope:scope});
  });
  const load=page.locator('#optReportLoad'),generate=page.locator('#optReportGenerate'),csv=page.locator('#optReportCsv');
  assert(await generate.isDisabled());await load.click();await page.locator('#optReportReservations input[value=R]').check();await generate.click();await page.locator('#optReportPreview h3').waitFor();
  assert.match(await page.locator('#optReportPreview').textContent(),/semana de origen 45\/2026/);assert.match(await page.locator('#optReportPreview').textContent(),/2026-11-09/);assert.match(await page.locator('#optReportPreview').textContent(),/Cortador A/);
  const downloadPromise=page.waitForEvent('download');await csv.click();const download=await downloadPromise;assert.match(download.suggestedFilename(),/2026-semana-45\.csv$/);const bytes=fs.readFileSync(await download.path(),'utf8');assert(bytes.includes('"\'=REFERENCE"'));assert(bytes.includes('"2026-11-09","2"'));
  await page.locator('#optReportAll').click();assert(await csv.isDisabled());await generate.click();await page.getByText('Reporte generado: 2 piezas cortadas.',{exact:true}).waitFor();assert.match(await page.locator('#optReportPreview').textContent(),/Cortador B/);
  await page.screenshot({path:`tests/opt-digital/evidence/cut-report-${label}.png`,fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.locator('#optReportClear').click();assert(await generate.isDisabled());await page.locator('#optReportReservations input[value=ZERO]').check();await generate.click();await page.getByText('Reporte generado: 0 piezas cortadas.',{exact:true}).waitFor();assert.match(await page.locator('#optReportPreview').textContent(),/no tienen cortes/);assert.match(await page.locator('#optCutReport').textContent(),/0 cortes no significa reserva completada/);
  await page.locator('#optReportWeek').fill('46');assert(await csv.isDisabled());assert.equal(await page.locator('#optReportPreview').textContent(),'');await load.click();await page.locator('#optReportAll').click();await generate.click();await page.getByText('Reporte generado: 2 piezas cortadas.',{exact:true}).waitFor();assert.match(await page.locator('#optReportPreview').textContent(),/46\/2026/);
  await page.evaluate(()=>reportTest.token='new-session');await csv.click();assert(await csv.isDisabled());assert.equal(await page.locator('#optReportPreview').textContent(),'');
  await page.evaluate(()=>reportTest.mode='error');await load.click();await page.getByText(/No se pudo consultar el reporte:.*NO_AUTORIZADO/).waitFor();assert(await generate.isDisabled());
  await page.evaluate(()=>reportTest.mode='empty');await load.click();await page.getByText('No hay reservas en el alcance consultado.',{exact:true}).waitFor();assert(await page.locator('#optReportAll').isDisabled());
  await page.evaluate(()=>reportTest.mode='hold');await load.click();await page.waitForFunction(()=>!!reportTest.release);await page.locator('#optReportWeek').fill('44');await page.evaluate(()=>{reportTest.mode='ok';reportTest.release();});assert.equal(await page.locator('#optReportReservations input').count(),0);
  await page.evaluate(()=>reportPanel.destroy());assert.equal(await page.locator('#optCutReport').count(),0);assert(await page.evaluate(()=>reportTest.calls.every(c=>c.name==='sgp_opt_cortes_reporte_v2')));assert.deepEqual(errors,[]);await page.close();
 }
 await browser.close();console.log('PASS synthetic report browser PC/mobile: catalog, single/multiple/clear, CSV download, operational period, zero cuts, empty, permission error, context/session cancellation and layout. No production.');
})().catch(e=>{console.error(e);process.exit(1);});
