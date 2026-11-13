// Synthetic native-host browser QA for CI's preinstalled Playwright Chromium.
// All remote traffic is intercepted. No real session, upload, SQL, or cut is performed.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const baseURL=process.env.OPT_TEST_URL||'http://127.0.0.1:8765';
const scope={linea:'PANELES_2',anio:2026,semana:46,modo:'BASE'};
const docId='01234567-89ab-4cde-8fab-0123456789ab';
const pieces=[1,2].map(n=>({id_pieza:`${n}1234567-89ab-4cde-8fab-0123456789ab`,pagina:1,patron:1,barra:1,corte:n,longitud_mm:500}));
const indexText='OPT,Reserva,Sistema\nA,R-SYNTH,PANEL\nB,R-SYNTH,PANEL\nMISSING,R-SYNTH,PANEL\nFOREIGN,F-SYNTH,FRAME\nWRONG,R-SYNTH,FRAME\n';
(async()=>{
 const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'opt-upload-browser-'));
 const folder=path.join(temporary,'retail');fs.mkdirSync(folder);
 const pdf=require('./synthetic-pdf.cjs')();fs.writeFileSync(path.join(folder,'A.pdf'),pdf);fs.writeFileSync(path.join(folder,'B.pdf'),Buffer.concat([pdf,Buffer.from('\n \n')]));
 for(const name of ['FOREIGN.pdf','WRONG.pdf','A-near.pdf'])fs.writeFileSync(path.join(folder,name),'not a PDF; must never be read');
 const browser=await chromium.launch({...(process.env.OPT_CHROMIUM?{executablePath:process.env.OPT_CHROMIUM}:{}),headless:true,args:['--no-sandbox']});
 fs.mkdirSync('tests/opt-digital/evidence',{recursive:true});
 try{
  for(const [size,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
   let receipt=null,catalogReads=0,inflight=0,maxInflight=0;const uploads=[],cutWrites=[],unexpected=[],errors=[];
   const reference=()=>({id_documento:docId,sha256:receipt.document.sha256,referencia:'REF-SYNTH',sistema:'PANEL',fuentes:[{origen:'RETAIL',source_key:receipt.document.source_key,consecutivo:'A',modo_carga:'INDICE'}],piezas:pieces});
   const catalog=()=>({contract_version:2,scope,grupos:receipt?[{reserva:'R-SYNTH',sistema:'PANEL',referencias:[reference()]}]:[],totales:{grupos:receipt?1:0,documentos:receipt?1:0,piezas:receipt?2:0}});
   async function openSession(name){
    const token='synthetic-upload-'+name,context=await browser.newContext({viewport});
    await context.addInitScript(value=>sessionStorage.setItem('sgp_one_session',value),token);
    await context.route('**/*',async route=>{
     const request=route.request(),url=new URL(request.url());
     if(url.origin===baseURL)return route.continue();
     if(url.pathname==='/functions/v1/opt-matrix-read'){
      const body=request.postDataJSON();assert.equal(body.p_token,token);assert.equal(body.sistema,'PANEL');assert.equal(body.referencia,'REF-SYNTH');
      return route.fulfill({json:{contract:'OPT-MATRIX-1',ok:true,sistema:body.sistema,referencia:body.referencia,status:'unavailable',matrix:null}});
     }
     if(url.pathname==='/functions/v1/opt-import'){
      const body=request.postDataJSON();uploads.push(structuredClone(body));inflight++;maxInflight=Math.max(maxInflight,inflight);
      try{
       assert.equal(body.p_token,token);assert.deepEqual(Object.keys(body).sort(),['index','p_token','pdf','scope','source']);assert.deepEqual(body.scope,scope);
       assert.deepEqual(Object.keys(body.pdf).sort(),['base64','name']);assert.deepEqual(Object.keys(body.index).sort(),['base64','format','name','sheet']);
       assert.equal(Buffer.from(body.index.base64,'base64').toString(),indexText);assert.equal(body.index.name,'index.csv');assert.equal(body.index.format,'csv');assert.equal(body.index.sheet,'ARCHIVOS');
       assert.deepEqual(body.source,{origin:'RETAIL',opt:body.pdf.name.replace(/\.pdf$/i,''),mode:'INDICE'});
       const authorization=request.headers().authorization;assert.match(authorization,/^Bearer /);const gateway=JSON.parse(Buffer.from(authorization.slice(7).split('.')[1],'base64url').toString());assert.equal(gateway.role,'anon');
       await new Promise(resolve=>setTimeout(resolve,80));
       if(body.source.opt==='B')return route.fulfill({status:422,json:{contract:'OPT-IMPORT-1',ok:false,code:'OPT_AMBIGUA',error:'Synthetic ambiguous production',definitive:true,blockers:['Dos producciones posibles; no se creó esta OPT.']}});
       assert.equal(body.source.opt,'A');assert.deepEqual(Buffer.from(body.pdf.base64,'base64'),pdf);
       const sha=crypto.createHash('sha256').update(pdf).digest('hex'),duplicate=!!receipt;
       receipt={contract:'OPT-IMPORT-1',ok:true,scope,physical_completion_verified:false,data:{contract_version:2,import_contract:'OPT-IMPORT-1',ok:true,physical_completion_verified:false,id_documento:docId,duplicado:duplicate,cantidad_piezas:3,sin_asignacion:1},document:{sha256:sha,source_key:'OPT:A',origin:'RETAIL',opt:'A',mode:'INDICE'},totals:{documentaryBars:1,documentaryCuts:3,cutLength32:96},scopeTotals:{assigned:2,outsideScope:1}};
       return route.fulfill({json:receipt});
      }finally{inflight--;}
     }
     if(url.pathname.startsWith('/rest/v1/rpc/')){
      const rpc=url.pathname.split('/').at(-1);
      if(rpc==='sgp_sesion_actual')return route.fulfill({json:{valida:true,usuario:name,nombre:'Synthetic '+name,rol:'LIDER MECANIZADO'}});
      if(rpc==='sgp_mis_accesos')return route.fulfill({json:[{ventana:'mecanizado.proceso'}]});
      if(rpc==='sgp_consultar_programacion_semana')return route.fulfill({json:{producciones:[{id_linea:'PANELES_2',key_produccion:'SYNTH|PANELES_2',sistema:'PANEL',reserva_principal:'R-SYNTH',anio:2026,semana_base:46}]}});
      if(rpc==='sgp_reservas_asociadas_listar')return route.fulfill({json:[]});
      if(rpc==='sgp_opt_catalogo_v2'){catalogReads++;return route.fulfill({json:catalog()});}
      if(rpc==='sgp_opt_referencias_documentales_v1')return route.fulfill({json:{contract:'OPT-DOCUMENT-REFERENCES-1',scope,reservation:'R-SYNTH',system:'PANEL',references:receipt?[{id_documento:docId,sha256:receipt.document.sha256,referencia:'REF-SYNTH',sistema:'PANEL',piezas_documento:2},{id_documento:docId,sha256:receipt.document.sha256,referencia:'UNASSIGNED-SYNTH',sistema:null,piezas_documento:1}]:[]}});
      if(rpc==='sgp_opt_esquema_documental_v2'){const body=request.postDataJSON();return route.fulfill({json:{contract:'OPT-DOCUMENT-PLANS-2',scope,reservation:'R-SYNTH',system:'PANEL',id_documento:docId,sha256:receipt.document.sha256,reference:body.p_referencia,status:'NOT_PERSISTED',plans:[]}});}
      if(rpc==='sgp_opt_cortes_estado_v2')return route.fulfill({json:{contract_version:2,scope,habilitado:true,reserva:'R-SYNTH',manifiesto_validado:!!receipt,puede_registrar:true,totales:{piezas:receipt?2:0,cortadas:0,pendientes:receipt?2:0},referencias:receipt?[{...reference(),piezas:pieces.map(piece=>({...piece,registrable:true,estado:'PENDIENTE',usuario:null,registrado_en:null,id_registro:null,periodo:null}))}]:[]}});
      if(/guardar|registrar|actualizar|eliminar/.test(rpc))cutWrites.push(rpc);
      // Bootstrap reads are harmless synthetic empty lists, never passed to the network.
      return route.fulfill({json:[]});
     }
     unexpected.push(url.origin+url.pathname);return route.abort();
    });
    const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
    await page.goto(baseURL+'/');
    const tab=page.locator('[data-mach-tab="opt-digital"]');await tab.waitFor({state:'visible'});await tab.click();
    const host=page.locator('#optDigitalHost');await host.locator('#optImportProcess').waitFor();
    await host.locator('#optScopeYear').fill('2026');await host.locator('#optScopeWeek').fill('46');await host.locator('#optScopeLine').selectOption('PANELES_2');await host.locator('#optScopeLoad').click();
    await page.waitForFunction(()=>document.querySelector('#optDigitalHost').shadowRoot.querySelector('#optCatalogStatus').textContent.includes('semana de origen 46/2026'));
    return {page,context,host};
   }
   const first=await openSession('loader-'+size),{page,host}=first;
   assert.equal(uploads.length,0);assert.equal(catalogReads,1);
   await host.locator('#optIndexOrigin').selectOption('RETAIL');await host.locator('#optIndexFile').setInputFiles({name:'index.csv',mimeType:'text/csv',buffer:Buffer.from(indexText)});
   await host.locator('#optPdfFolder').setInputFiles(folder);
   await page.waitForFunction(()=>!document.querySelector('#optDigitalHost').shadowRoot.querySelector('#optImportProcess').disabled);
   await host.locator('summary').filter({hasText:'Resultado de selección por archivo'}).click();
   assert.match(await host.locator('#optLoadPanel').textContent(),/Sin reserva\/sistema en la programación/);
   assert.match(await host.locator('#optLoadPanel').textContent(),/Nombre exacto ausente del índice/);
   // Loading/selecting originals is not consent to transmit them.
   assert.equal(uploads.length,0);assert.match(await host.locator('#optImportPanel').textContent(),/se envían el PDF original y su índice a Supabase/);
   await host.locator('#optImportProcess').click();
   await page.waitForFunction(()=>document.querySelector('#optDigitalHost').shadowRoot.querySelector('#optImportStatus').textContent.includes('1 confirmados · 2 rechazados o bloqueados · 0 inciertos'));
   assert.equal(uploads.length,2);assert.equal(maxInflight,1);
   const results=await host.locator('#optImportResults').textContent();
   assert.match(results,/A.pdf · Guardado en SGP · 3 piezas documentales; 2 asignadas a PANELES_2/);assert.match(results,/1 sin asignación a PANELES_2 y no disponibles para cortar/);assert.match(results,/No acredita cortes realizados/);assert.match(results,/B.pdf · No guardado en este intento: OPT_AMBIGUA/);assert.match(results,/MISSING.pdf · Bloqueado: Falta PDF con nombre exacto/);
   await page.waitForFunction(()=>document.querySelector('#optDigitalHost').shadowRoot.querySelector('#optReservation').selectedOptions[0]?.textContent.includes('Compartida'));assert.equal(catalogReads,2);
   await host.locator('#optImportPanel').scrollIntoViewIfNeeded();const buttonBox=await host.locator('#optImportProcess').boundingBox();assert(buttonBox&&buttonBox.width>0&&buttonBox.x>=0&&buttonBox.x+buttonBox.width<=viewport.width+2);
   await page.screenshot({path:`tests/opt-digital/evidence/import-upload-${size}.png`,fullPage:true});
   // Repeating the explicit command preserves exact original payloads and yields a duplicate receipt.
   await host.locator('#optImportProcess').click();await page.waitForFunction(()=>document.querySelector('#optDigitalHost').shadowRoot.querySelector('#optImportResults').textContent.includes('Duplicado confirmado'));
   await page.waitForFunction(()=>!document.querySelector('#optDigitalHost').shadowRoot.querySelector('#optImportProcess').disabled);assert.equal(uploads.length,4);assert.deepEqual(uploads[0],uploads[2]);assert.deepEqual(uploads[1],uploads[3]);
   // logout awaits sgp_logout before clearing the native host; click alone does not await that handler.
   await page.locator('#authLogout').click();await host.locator('#optImportProcess').waitFor({state:'detached'});assert.equal(await host.locator('#optImportProcess').count(),0);await first.context.close();
   // New browser storage + a different user sees the shared catalog without any original files.
   const second=await openSession('cutter-'+size);assert.equal(await second.host.locator('#library button').count(),0);assert.equal(uploads.length,4);
   await second.host.locator('#optWorkflowTab1').click();await second.host.locator('#optReservation').selectOption(JSON.stringify(['SERVIDOR','R-SYNTH','PANEL']));
   await second.page.waitForFunction(()=>document.querySelector('#optDigitalHost').shadowRoot.querySelector('#optSharedPieces').textContent.includes('REF-SYNTH'));
   assert.match(await second.host.locator('#optReservationDocuments').textContent(),/PDF original es opcional/);assert.match(await second.host.locator('#optSharedPieces').textContent(),/Pendiente/);assert.equal(await second.host.locator('#optSharedPieces tbody tr').count(),2);assert.equal(await second.host.locator('#library button').count(),0);
   assert.equal(await second.host.locator('.opt-shared-references button').count(),2);await second.host.locator('.opt-shared-profile-header').filter({hasText:'Matriz no disponible'}).waitFor();
   await second.page.screenshot({path:`tests/opt-digital/evidence/import-upload-second-cutter-${size}.png`,fullPage:true});
   assert.deepEqual(cutWrites,[]);assert.deepEqual(unexpected,[]);assert.deepEqual(errors,[]);await second.context.close();
  }
  console.log('PASS synthetic native browser, desktop/mobile: explicit original upload, sequential partial result, documentary versus assigned totals, exact duplicate replay, logout and second user without PDFs, shared catalog and pending cuts. All remote traffic mocked; no production verification.');
 }finally{await browser.close();fs.rmSync(temporary,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exit(1);});
