const assert=require('node:assert/strict');const {JSDOM}=require(process.env.JSDOM_MODULE||'jsdom');
(async()=>{
 const {mountOptScopePanel}=await import('../../opt-digital/scope-panel.js');
 const {createOptProgrammingScope}=await import('../../src/services/opt-programming-scope.js');
 const dom=new JSDOM('<main></main>'),root=dom.window.document.querySelector('main');let token='alice',mode='ok',latest,open,calls=[];const pending=[];
 const scope={linea:'PANELES_2',anio:2026,semana:46,modo:'BASE'},sha='a'.repeat(64),sha2='b'.repeat(64);
 const answer=(name,args)=>({data:name==='sgp_consultar_programacion_semana'?{producciones:[{key_produccion:'K',id_linea:'PANELES_2',sistema:'S',reserva_principal:'R',reservas_compartidas:[{reserva:'R2'}]},{key_produccion:'OTHER',id_linea:'FRAMES_2',sistema:'S',reserva_principal:'R9'}]}:[]});
 const api=createOptProgrammingScope({rpc:async(name,args)=>{calls.push({name,args});if(mode==='hold')return new Promise(resolve=>pending.push(()=>resolve(answer(name,args))));if(mode==='fail')return {error:{message:'denied'}};return answer(name,args);}},()=>token);
 const panel=mountOptScopePanel(root,{api,defaultScope:scope,onChange:plan=>latest=plan,openDocument:key=>open=key}),$=id=>root.querySelector('#'+id);
 const entries=[{sourceKey:'RETAIL',origin:'RETAIL',opt:'MIX',reservation:'R',system:'S'},{sourceKey:'RETAIL',origin:'RETAIL',opt:'MIX',reservation:'R9',system:'S'},{sourceKey:'RETAIL',origin:'RETAIL',opt:'MIX',reservation:'',system:'S'}];
 const docs=[{format:'pdf',key:sha,name:'MIX.pdf',sources:[{origin:'RETAIL',mode:'CARPETA',sourceKey:'RETAIL',name:'MIX.pdf'}]},{format:'pdf',key:sha2,name:'individual.pdf'}];panel.update(entries,docs);
 assert.equal(latest.status,'UNAVAILABLE');assert.equal(latest.groups.length,0);await $('optScopeLoad').onclick();
 assert.equal(latest.documents.length,2);assert.equal(latest.documents[0].status,'MIXED');assert.equal(latest.associations[1].status,'UNRESOLVED_SCOPE');assert.equal(latest.associations[2].status,'UNASSOCIATED');assert(latest.groups.every(g=>g.canRegister===false));
 $('optScopeDocuments').querySelector('button').click();assert.equal(open,sha);
 $('optIndividualFile').value=sha2;$('optIndividualReservation').value=JSON.stringify(['R','S']);$('optIndividualAssociate').click();assert.equal(latest.groups.length,2);assert.equal(latest.groups.find(g=>g.origin==='INDIVIDUAL').documentHashes[0],sha2);
 $('optIndividualReservation').value=JSON.stringify(['R2','S']);$('optIndividualAssociate').click();assert.equal(latest.documents.find(d=>d.sha256===sha2).associations.length,2);$('optIndividualAssociate').click();assert.equal(latest.documents.find(d=>d.sha256===sha2).associations.length,2);
 // No stale-session manual assignment, then no stale asynchronous response.
 token='bob';$('optIndividualAssociate').click();assert.equal(latest.status,'UNAVAILABLE');assert.equal(latest.groups.length,0);
 mode='hold';const load=$('optScopeLoad').onclick();$('optScopeWeek').value='45';$('optScopeWeek').onchange();pending.splice(0).forEach(f=>f());await load;assert.equal(latest.status,'UNAVAILABLE');assert.equal(panel.getScope(),null);
 mode='fail';await $('optScopeLoad').onclick();assert.equal(latest.status,'UNAVAILABLE');assert(!latest.associations.some(a=>a.status==='OUT_OF_SCOPE'));assert.match($('optScopeStatus').textContent,/No se pudo comprobar/);
 mode='ok';await $('optScopeLoad').onclick();assert.equal(panel.getScope().semana,45);
 // Pagination does not lose unmatched rows; filter only changes presentation.
 panel.update(Array.from({length:120},(_,i)=>({sourceKey:'BATCH',origin:'PROYECTO',opt:'P'+i,reservation:'unmatched',system:'S'})),[]);
 $('optScopeFilter').value='UNAVAILABLE';$('optScopeFilter').onchange();assert.equal(latest.associations.length,122);assert.equal($('optScopeDocuments').children.length,50);assert.match(root.textContent,/de 121/);const next=[...root.querySelectorAll('button')].find(b=>b.textContent==='Siguientes');next.click();assert.match(root.textContent,/Documentos 51–100 de 121/);next.click();assert.equal($('optScopeDocuments').children.length,21);
 panel.destroy();assert.equal(root.children.length,0);assert(calls.every(c=>c.name==='sgp_consultar_programacion_semana'||c.name==='sgp_reservas_asociadas_listar'));
 // Original week remains selected even when its execution happens the following week.
 const originScope={...scope,semana:45},originCalls=[];
 const originalApi=createOptProgrammingScope({rpc:async(name,args)=>{
  originCalls.push({name,args});return {data:name==='sgp_consultar_programacion_semana'?{producciones:args.p_anio===2026&&args.p_semana===45?[{key_produccion:'ORIGINAL',id_linea:'PANELES_2',anio:2026,semana_base:45,semana_actual:46,sistema:'S',reserva_principal:'R'}]:[]}:[]};
 }},()=>token);
 const originalPanel=mountOptScopePanel(root,{api:originalApi,defaultScope:originScope,onChange:plan=>latest=plan});
 originalPanel.update([{...entries[0],carry:true}],docs.slice(0,1));await $('optScopeLoad').onclick();
 assert.equal(latest.groups.length,1);assert.equal(latest.documents.length,1);assert.equal(latest.scope.semana,45);
 assert.match($('optScopeStatus').textContent,/semana de origen 45\/2026/);assert(!root.textContent.includes('criterio operativo pendientes'));
 $('optScopeWeek').value='46';$('optScopeWeek').onchange();assert.equal(latest.groups.length,0);await $('optScopeLoad').onclick();
 assert.equal(latest.groups.length,0);assert.equal(latest.associations.length,1);assert.equal(latest.documents.length,1);
 $('optScopeWeek').value='45';$('optScopeWeek').onchange();await $('optScopeLoad').onclick();
 assert.equal(latest.groups.length,1);assert.equal(latest.documents.length,1);assert.equal(latest.groups[0].canRegister,false);
 originalPanel.destroy();assert.equal(root.children.length,0);
 console.log('PASS: scope DOM, mixed PDF, retained unresolved rows, individual multi-association, stale session/filter, read failure, pagination, cleanup. Synthetic read-only.');
})().catch(e=>{console.error(e);process.exit(1);});
