const assert=require('node:assert/strict');const {JSDOM}=require(process.env.JSDOM_MODULE||'jsdom');
(async()=>{
 const {mountSharedCuts}=await import('../../opt-digital/shared-cuts.js');
 const dom=new JSDOM('<main></main>',{url:'https://synthetic.test'}),root=dom.window.document.querySelector('main');
 const scope={linea:'PANELES_2',anio:2099,semana:1,modo:'BASE'},id='00000000-0000-4000-8000-000000000001',sha='a'.repeat(64);
 const known={validationWarnings:[{code:'OPT_PRINTED_ROUNDING_COMPATIBLE'}],id_documento:id,sha256:sha,sistema:'SYS',referencia:'REF',fuentes:[{consecutivo:'QA'}],piezas:[{id_pieza:id,estado:'PENDIENTE',registrable:true,pagina:1,patron:1,barra:1,corte:1,longitud_mm:1}]};
 const group={origin:'SERVIDOR',scope,reservation:'QA',system:'SYS',references:[known]},refs=[{id_documento:id,sha256:sha,sistema:null,referencia:'REF',piezas_documento:2},{id_documento:id,sha256:sha,sistema:'OTHER',referencia:'OTHER',piezas_documento:1}];
 let cutsFail=false,docFail=false;
 const api={authorizesGroup:g=>g===group&&!cutsFail,estado:async()=>{if(cutsFail)throw Error('synthetic outage');return{scope,reserva:'QA',habilitado:true,manifiesto_validado:true,puede_registrar:true,referencias:[known]};}};
 const catalogApi={ownsGroup:g=>g===group,matchesReference:()=>true};
 const documentApi={invalidate(){},load:async()=>{if(docFail)throw Error('synthetic unavailable');return refs;},ownsReference:(g,r)=>g===group&&refs.includes(r)};
 const c=mountSharedCuts(root,{api,catalogApi,documentApi,storage:dom.window.localStorage,storageScope:'qa'});await c.select(group);
 assert.equal(root.querySelectorAll('[data-warning]').length,1);
 assert.equal(root.querySelector('input').disabled,false,'ambiguous matrix system must not remove existing cut authority');assert.match(root.textContent,/sistema del perfil sin vínculo inequívoco/);
 root.querySelectorAll('.opt-shared-references button')[1].click();assert.equal(root.querySelectorAll('input').length,0);
 cutsFail=true;await c.refresh();assert.equal(root.querySelectorAll('.opt-shared-references button').length,2);assert.equal(root.querySelector('#optSharedRegister').disabled,true);assert.match(root.querySelector('#optSharedStatus').textContent,/Saldo de cortes sin confirmar/);assert.doesNotMatch(root.querySelector('#optSharedStatus').textContent,/0 pendientes/);
 cutsFail=false;docFail=true;await c.refresh();assert.equal(root.querySelectorAll('.opt-shared-references button').length,1);assert.match(root.querySelector('#optSharedStatus').textContent,/Consulta documental completa no disponible/);
 c.destroy();console.log('PASS documentary DOM: ambiguous matrix preserves authorized cuts; outside scope cannot select; ledger outage keeps documentary read without zero balance; missing new RPC explicitly falls back.');
})().catch(e=>{console.error(e);process.exitCode=1;});
