const assert=require('node:assert/strict'),{JSDOM}=require(process.env.JSDOM_MODULE||'jsdom');
(async()=>{
 const {mountOptImportPanel}=await import('../../opt-digital/import-panel.js');
 const dom=new JSDOM('<main></main>',{url:'https://synthetic.test'}),root=dom.window.document.querySelector('main');
 const scope={linea:'PANELES_2',anio:2026,semana:46,modo:'BASE'},identities=['saved','absent','mismatch','error'].map(name=>({pdf:{name:name+'.pdf'}}));let reads=0,writes=0,pending=[...identities];
 const api={invalidate(){},pending:()=>pending,process(){writes++;throw Error('Unexpected writer');},async reconcilePending(identity){reads++;if(identity===identities[3])throw Error('RPC unavailable');if(identity===identities[0])pending=pending.filter(x=>x!==identity);return {status:identity===identities[0]?'COMMITTED_MATCH':identity===identities[1]?'NOT_OBSERVED':'EVIDENCE_MISMATCH'};}};
 const panel=mountOptImportPanel(root,{api,getScope:()=>scope,getOrigin:()=> 'INDIVIDUAL',getRecords:()=>[],getEntries:()=>[]});
 const file=new File(['synthetic'],'long-name.pdf');Object.defineProperty(file,'webkitRelativePath',{value:'selected-folder/long-name.pdf'});
 panel.setSelection([file],'INDIVIDUAL');panel.setLocalOutcome({file,localOutcome:'processing'});assert.match(root.textContent,/Procesando localmente/);panel.setLocalOutcome({file,localOutcome:'processed'});panel.update();assert.match(root.textContent,/selected-folder\/long-name.pdf/);assert.match(root.textContent,/Procesado localmente/);assert.match(root.textContent,/No enviado a SGP/);assert.doesNotMatch(root.textContent,/Datos de OPT guardados/);
 await root.querySelector('#optImportReconcile').onclick();assert.equal(reads,4);assert.equal(writes,0);assert.equal(pending.length,3);assert.match(root.querySelector('#optImportReconciliation').textContent,/Guardado confirmado/);assert.match(root.textContent,/no autoriza reintentar/);assert.match(root.textContent,/Evidencia diferente/);assert.match(root.textContent,/El pendiente se conserva/);
 panel.destroy();console.log('PASS: persistent relative source, independent local/server states, manual observation positive/absence/mismatch/error with no import. Synthetic only.');
})().catch(e=>{console.error(e);process.exitCode=1;});
