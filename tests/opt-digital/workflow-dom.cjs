const assert=require('node:assert/strict'),fs=require('node:fs');const {JSDOM}=require(process.env.JSDOM_MODULE||'jsdom');
(async()=>{
 const {mountOptWorkflow}=await import('../../opt-digital/workflow.js');
 const {createOptProgrammingScope}=await import('../../src/services/opt-programming-scope.js');
 const dom=new JSDOM(fs.readFileSync('opt-digital/index.html','utf8'),{url:'https://local.test'});global.document=dom.window.document;
 const scope={linea:'PANELES_2',anio:2026,semana:46,modo:'BASE'},sha='a'.repeat(64),reads=[];let opened,imported,unsubscribed=false,token='synthetic';
 const scopeApi=createOptProgrammingScope({rpc:async(name,args)=>{reads.push({name,args});return {data:name==='sgp_consultar_programacion_semana'?{producciones:[{id_linea:'PANELES_2',key_produccion:'K',sistema:'PANEL',reserva_principal:'R'}]}:[]};}},()=>token);
 const workflow=mountOptWorkflow(document.body,{onDocuments(listener){listener([{format:'pdf',key:sha,name:'EXACT.pdf',sources:[{origin:'RETAIL',mode:'CARPETA',sourceKey:'RETAIL',name:'EXACT.pdf'},{origin:'PROYECTO',mode:'CARPETA',sourceKey:'PROYECTO',name:'PROJECT.pdf'}]}]);return ()=>unsubscribed=true;},openDocument(key){opened=key;},importFiles(files){imported=files;}},{scopeApi,defaultScope:scope,storage:dom.window.localStorage,storageScope:'synthetic'});
 const $=id=>document.getElementById(id);assert.equal($('optLoadPanel').hidden,false);assert.equal($('optCutsPanel').hidden,true);assert.equal(document.querySelectorAll('[role=tab]').length,4);
 $('optIndexOrigin').value='RETAIL';Object.defineProperty($('optIndexFile'),'files',{value:[{name:'index.csv',size:90,text:async()=> 'OPT,Reserva,Sistema\nEXACT,R,PANEL\nUNBOUND,,PANEL\nNOBASE,OTHER,PANEL\n'}],configurable:true});await $('optIndexFile').onchange();
 assert.equal($('optReservation').options.length,1);assert.equal($('optIndexUnassociated').hidden,false);assert.match($('optIndexIssueRows').textContent,/UNBOUND/);assert.match($('optIndexIssueRows').textContent,/Reserva: ausente/);
 await $('optScopeLoad').onclick();assert.equal($('optReservation').options.length,2);assert.equal(reads.length,2);assert.match($('optScopeSummary').textContent,/semana de origen/);
 $('optWorkflowTab1').click();assert($('optLoadPanel').hidden);$('optReservation').value=$('optReservation').options[1].value;$('optReservation').onchange();$('optReservationDocuments').querySelector('button').click();assert.equal(opened,sha);
 assert.equal(document.querySelector('.summary button').disabled,true);assert.match($('optReservationDocuments').textContent,/EXACT.pdf/);assert($('optSharedRegister').disabled);
 Object.defineProperty($('optPdfFolder'),'files',{value:[{name:'ok.pdf'},{name:'ignored.txt'}]});$('optPdfFolder').onchange();assert.equal(imported.length,1);
 // Equal bytes retain both original source names; the second source opens the same document.
 $('optIndexOrigin').value='PROYECTO';Object.defineProperty($('optIndexFile'),'files',{value:[{name:'project.csv',size:30,text:async()=> 'OPT,Reserva,Sistema\nPROJECT,R,PANEL\n'}],configurable:true});await $('optIndexFile').onchange();
 $('optReservation').value=[...$('optReservation').options].find(o=>o.textContent.endsWith('PROYECTO')).value;$('optReservation').onchange();assert.match($('optReservationDocuments').textContent,/PROJECT.pdf/);$('optReservationDocuments').querySelector('button').click();assert.equal(opened,sha);
 // A token replacement for the same person must not reuse the old candidates.
 token='same-user-new-session';$('optReservation').onchange();assert.equal($('optReservation').options.length,1);assert.equal($('optReservationDocuments').children.length,0);await $('optScopeLoad').onclick();assert.equal($('optReservation').options.length,3);
 $('optScopeWeek').value='45';$('optScopeWeek').onchange();assert.equal($('optReservation').options.length,1);assert.equal($('optSharedPieces').children.length,0);
 // The newest same-origin file wins; a late parse cannot restore an older index.
 let release;const fileInput=$('optIndexFile');Object.defineProperty(fileInput,'files',{value:[{name:'old.csv',size:30,text:()=>new Promise(r=>release=r)}],configurable:true});const old=fileInput.onchange();
 Object.defineProperty(fileInput,'files',{value:[{name:'new.csv',size:30,text:async()=> 'OPT,Reserva,Sistema\nNEW,,PANEL\n'}],configurable:true});await fileInput.onchange();release('OPT,Reserva,Sistema\nOLD,,PANEL\n');await old;assert.match($('optIndexIssueRows').textContent,/NEW/);assert(!$('optIndexIssueRows').textContent.includes('OLD'));
 workflow.destroy();assert(unsubscribed);console.log('PASS: workflow DOM, tabs, CSV, read-only scope, original-week labels and unresolved associations, exact document match, folder filter, productive gate, invalidation, cleanup. Not visual browser QA.');
})().catch(e=>{console.error(e);process.exit(1);});
