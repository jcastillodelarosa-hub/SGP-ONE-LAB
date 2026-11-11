const assert=require('node:assert/strict'),fs=require('node:fs');const {JSDOM}=require(process.env.JSDOM_MODULE||'jsdom');
(async()=>{
 const {mountOptWorkflow}=await import('../../opt-digital/workflow.js');
 const {createOptProgrammingScope}=await import('../../src/services/opt-programming-scope.js');
 const {createOptSharedCatalog}=await import('../../src/services/opt-shared-catalog.js');
 const {createOptSharedCuts}=await import('../../src/services/opt-shared-cuts.js');
 const scope={linea:'PANELES_2',anio:2026,semana:45,modo:'BASE'},sha='a'.repeat(64),id=n=>`${n}1234567-89ab-4cde-8fab-0123456789ab`,calls=[];
 let committed=false,writeCount=0,catalogMode='ok',stateMode='ok',pending=[];
 const reference=()=>({id_documento:id(0),sha256:sha,fuentes:[{origen:'RETAIL',source_key:'RETAIL/OPT-1',consecutivo:'OPT-1',modo_carga:'INDICE'}],sistema:'PANEL',referencia:'REF',piezas:[1,2].map(n=>({id_pieza:id(n),pagina:1,patron:1,barra:1,corte:n,longitud_mm:500}))});
 const period={fecha:'2026-11-10',turno:2,inicio:'2026-11-10T19:00:00-05:00',fin:'2026-11-11T07:00:00-05:00',zona:'America/Bogota',horario_sha256:'b'.repeat(64)};
 const catalog=()=>({contract_version:2,scope,grupos:[{reserva:'R',sistema:'PANEL',referencias:[reference()]}],totales:{grupos:1,documentos:1,piezas:2}});
 const state=()=>({contract_version:2,scope,habilitado:true,reserva:'R',manifiesto_validado:true,puede_registrar:stateMode!=='readonly',totales:{piezas:2,cortadas:committed?1:0,pendientes:committed?1:2},referencias:[{...reference(),piezas:reference().piezas.map((p,i)=>({...p,longitud_mm:stateMode==='mismatch'?600:p.longitud_mm,registrable:true,estado:committed&&i===0?'CORTADO':'PENDIENTE',usuario:committed&&i===0?'synthetic-alice':null,registrado_en:committed&&i===0?'2026-11-11T01:00:00Z':null,id_registro:committed&&i===0?id(3):null,periodo:committed&&i===0?period:null}))}]});
 const client={rpc:async(name,args)=>{
  calls.push({name,args});
  if(name==='sgp_consultar_programacion_semana')return {data:{producciones:[{key_produccion:'SYNTH',id_linea:'PANELES_2',anio:2026,semana_base:45,semana_actual:46,sistema:'PANEL',reserva_principal:'R'}]}};
  if(name==='sgp_reservas_asociadas_listar')return {data:[]};
  if(name==='sgp_opt_catalogo_v2'){if(catalogMode==='hold')return new Promise(resolve=>pending.push(resolve));if(catalogMode==='fail')return {error:{message:'denied'}};return {data:catalog()};}
  if(name==='sgp_opt_cortes_estado_v2'){if(stateMode==='fail')return {error:{message:'denied'}};return {data:state()};}
  if(name==='sgp_opt_cortes_registrar_v2'){writeCount++;assert.equal(args.p_token,'synthetic-alice');assert.deepEqual(args.p_piezas,[id(1)]);committed=true;return {data:{contract_version:2,scope,reserva:'R',ok:true,duplicado:false,cantidad_piezas:1,piezas:[id(1)],usuario:'synthetic-alice',id_registro:id(3),registrado_en:'2026-11-11T01:00:00Z',periodo:period}};}
  throw Error('Unexpected RPC '+name);
 }};
 const tick=()=>new Promise(resolve=>setTimeout(resolve,5));
 function mount(user){
  const dom=new JSDOM(fs.readFileSync('opt-digital/index.html','utf8'),{url:'https://synthetic.invalid'});global.document=dom.window.document;let token=user,filesCallback;const $=id=>dom.window.document.getElementById(id);
  const catalogApi=createOptSharedCatalog(client,()=>token,{getContext:()=>({linea:$('optScopeLine')?.value,anio:Number($('optScopeYear')?.value),semana:Number($('optScopeWeek')?.value),modo:'BASE'})});
  const workflow=mountOptWorkflow(dom.window.document.body,{onDocuments(listener){filesCallback=listener;listener([]);return ()=>{};},openDocument(){throw Error('No PDF is present');},importFiles(){throw Error('No file import expected');}},{scopeApi:createOptProgrammingScope(client,()=>token),catalogApi,api:createOptSharedCuts(client,()=>token,{catalog:catalogApi}),defaultScope:scope,storage:dom.window.localStorage,storageScope:user,createId:()=>id(3)});
  return {$,workflow,catalogApi,dom,setToken:value=>{token=value;},filesCallback};
 }
 const alice=mount('synthetic-alice');await alice.$('optScopeLoad').onclick();await tick();assert.equal(alice.$('optReservation').options.length,2);assert.match(alice.$('optCatalogStatus').textContent,/1 reservas/);assert.equal(alice.$('optIndexFile').files.length,0);
 alice.$('optWorkflowTab1').click();alice.$('optReservation').value=alice.$('optReservation').options[1].value;alice.$('optReservation').onchange();await tick();
 let boxes=[...alice.$('optSharedPieces').querySelectorAll('input')];assert.equal(boxes.length,2);assert(boxes.every(b=>!b.disabled));assert.match(alice.$('optSharedStatus').textContent,/0 cortadas y 2 pendientes/);boxes[0].checked=true;boxes[0].onchange();alice.$('optSharedRegister').click();alice.$('optSharedCancel').click();assert.equal(writeCount,0);alice.$('optSharedRegister').click();await alice.$('optSharedConfirm').onclick();assert.equal(writeCount,1);assert.match(alice.$('optSharedPieces').textContent,/synthetic-alice/);alice.workflow.destroy();
 const bob=mount('synthetic-bob');await bob.$('optScopeLoad').onclick();await tick();bob.$('optReservation').value=bob.$('optReservation').options[1].value;bob.$('optReservation').onchange();await tick();assert.match(bob.$('optSharedStatus').textContent,/1 cortadas y 1 pendientes/);assert.match(bob.$('optSharedPieces').textContent,/synthetic-alice/);boxes=[...bob.$('optSharedPieces').querySelectorAll('input')];assert(boxes[0].disabled);assert(!boxes[1].disabled);assert.equal(bob.$('optIndexFile').files.length,0);assert.equal(writeCount,1);
 // Same reservation in an index remains a separate, non-server candidate.
 bob.$('optIndexOrigin').value='RETAIL';Object.defineProperty(bob.$('optIndexFile'),'files',{value:[{name:'index.csv',size:40,text:async()=> 'OPT,Reserva,Sistema\nOPT-1,R,PANEL\n'}],configurable:true});await bob.$('optIndexFile').onchange();assert.equal(bob.$('optReservation').options.length,3);assert.match(bob.$('optReservation').options[1].textContent,/Compartida/);assert.match(bob.$('optReservation').options[2].textContent,/Candidato local/);
 stateMode='mismatch';await bob.$('optSharedRefresh').onclick();assert.equal(bob.$('optSharedPieces').querySelectorAll('input').length,0);assert(bob.$('optSharedRegister').disabled);
 stateMode='readonly';await bob.$('optSharedRefresh').onclick();assert([...bob.$('optSharedPieces').querySelectorAll('input')].every(b=>b.disabled));
 stateMode='fail';await bob.$('optSharedRefresh').onclick();assert.equal(bob.$('optSharedPieces').children.length,0);stateMode='ok';
 catalogMode='hold';bob.$('optCatalogRefresh').click();await tick();assert.equal(bob.$('optSharedPieces').children.length,0);bob.$('optScopeWeek').value='46';bob.$('optScopeWeek').onchange();pending.shift()({data:catalog()});await tick();assert.equal(bob.$('optReservation').options.length,1);
 bob.$('optScopeWeek').value='45';bob.$('optScopeWeek').onchange();await bob.$('optScopeLoad').onclick();await tick();bob.setToken('synthetic-charlie');pending.shift()({data:catalog()});await tick();assert.equal(bob.$('optReservation').options.length,1);assert.equal(bob.$('optSharedPieces').children.length,0);
 catalogMode='fail';await bob.$('optScopeLoad').onclick();await tick();assert.match(bob.$('optCatalogStatus').textContent,/no disponible/);assert(![...bob.$('optReservation').options].some(o=>o.textContent.includes('Compartida')));
 catalogMode='hold';bob.$('optCatalogRefresh').click();await tick();bob.workflow.destroy();pending.shift()({data:catalog()});await tick();assert.equal(bob.$('optSharedPieces'),null);assert.equal(writeCount,1);
 console.log('PASS: two synthetic cutters, no PDF/index prerequisite, shared attribution and pending cuts, separate local candidates, mismatch/read-only/failed state blocks writes, stale scope/session/reload/destroy rejected. DOM only, no production.');
})().catch(e=>{console.error(e);process.exit(1);});
