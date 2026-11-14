const assert=require('node:assert/strict');const {JSDOM}=require(process.env.JSDOM_MODULE||'jsdom');
(async()=>{
 const {mountReservationSummary}=await import('../../opt-digital/reservation-summary.js');
 const {buildOptProjectData}=await import('../../src/domain/opt-project-data.js');
 const dom=new JSDOM('<main></main>'),root=dom.window.document.querySelector('main');
 const projectData=buildOptProjectData([{sourceId:'project-p1-item6',page:1,ref:'PROFILE',finish:'FINISH A/\nFINISH B',length:'132 5/16"',reference:'<img src=x> '+ 'LINE '.repeat(90)+'FINAL-LOCATION',quantity:16},{sourceId:'project-p1-item7',page:1,ref:'PROFILE',finish:'OTHER',length:'133 1/16"',reference:'FINAL SECOND LOCATION',quantity:14}]);
 const data={documents:[{opt:'QA',scope:'DOCUMENTO',status:'PARTIAL',projectData,cutRows:[],materialRows:[]}]};let pending=[];
 const api={invalidate(){},load(){return new Promise(resolve=>pending.push(resolve));}};
 const v=mountReservationSummary(root,{api});v.select({origin:'SERVIDOR',reservation:'A',system:'TEST'});v.show(true);pending.shift()(data);await new Promise(r=>setTimeout(r,0));
 assert.equal(root.querySelectorAll('table').length,3);const t=root.querySelector('.opt-project-data-table');assert.deepEqual([...t.querySelectorAll('th')].map(x=>x.textContent),['Ítem','Perfil','Código/acabado','Longitud','Referencia','Cantidad']);
 assert.equal(t.querySelectorAll('tbody tr').length,2);assert.equal(t.querySelector('tbody tr').children[3].textContent,'132 5/16"');assert.match(t.textContent,/FINAL-LOCATION/);assert.equal(root.querySelectorAll('img,script').length,0);assert.match(root.textContent,/30 piezas impresas/);assert.equal(t.parentElement.getAttribute('tabindex'),'0');
 const filter=root.querySelector('.opt-project-data-filter'),order=root.querySelector('.opt-project-data-order');
 filter.value='FINAL-LOCATION';filter.dispatchEvent(new dom.window.Event('input'));assert.equal(root.querySelectorAll('.opt-project-data-table tbody tr').length,1);assert.match(root.querySelector('.opt-project-data-counts').textContent,/1 de 2 ítems · 16 de 30/);
 filter.value='not present';filter.dispatchEvent(new dom.window.Event('input'));assert.equal(root.querySelectorAll('.opt-project-data-table tbody tr').length,0);assert.match(root.textContent,/No hay coincidencias/);
 filter.value='';filter.dispatchEvent(new dom.window.Event('input'));order.value='desc';order.dispatchEvent(new dom.window.Event('change'));assert.equal(root.querySelector('.opt-project-data-table tbody tr').children[0].textContent,'7');order.value='asc';order.dispatchEvent(new dom.window.Event('change'));assert.equal(root.querySelector('.opt-project-data-table tbody tr').children[0].textContent,'6');
 v.select({origin:'SERVIDOR',reservation:'B',system:'TEST'});assert.equal(root.querySelectorAll('table').length,0);pending.shift()({documents:[{opt:'OLD',scope:'DOCUMENTO',status:'NOT_PERSISTED',cutRows:[],materialRows:[]}]});await new Promise(r=>setTimeout(r,0));assert.equal(root.querySelector('.opt-project-data-table'),null);assert.match(root.textContent,/ni se supone cantidad cero/);v.destroy();
 console.log('PASS: six columns, exact fractions, full references, safe text, old summaries, absence and reservation change. DOM only.');
})().catch(e=>{console.error(e);process.exit(1)});
