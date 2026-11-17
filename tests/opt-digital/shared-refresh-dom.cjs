const assert=require('node:assert/strict');const {JSDOM}=require(process.env.JSDOM_MODULE||'jsdom');
(async()=>{
 const {mountSharedCuts}=await import('../../opt-digital/shared-cuts.js');
 const id='01234567-89ab-4cde-8fab-0123456789ab',sha='a'.repeat(64),scope={linea:'PANELES_2',anio:2099,semana:1,modo:'BASE'},group={scope,reservation:'SYNTH',origin:'RETAIL',system:'SYNTH',opts:['QA']},docs=[{format:'pdf',key:sha}];
 let done=false,writes=0,reads=0,hold=null;
 const state=()=>({scope,reserva:'SYNTH',habilitado:true,manifiesto_validado:true,puede_registrar:true,referencias:[{sistema:'SYNTH',referencia:'QA',sha256:sha,fuentes:[{origen:'RETAIL',consecutivo:'QA'}],piezas:[{id_pieza:id,registrable:true,estado:done?'CORTADO':'PENDIENTE',longitud_mm:500,pagina:1,patron:1,barra:1,corte:1}]}]});
 const sessions=[];
 for(const user of ['alice','bob']){
  const dom=new JSDOM('<main></main>',{url:'https://synthetic.invalid',pretendToBeVisual:true}),win=dom.window,doc=win.document;let tick,cleared=false;
  win.setInterval=fn=>{tick=fn;return 1;};win.clearInterval=()=>{cleared=true;};
  const api={authorizesGroup:g=>!!g,estado:async()=>{reads++;if(hold)await hold;return state();},registrar:async()=>{writes++;throw Error('Synthetic writes forbidden');}};
  const panel=mountSharedCuts(doc.querySelector('main'),{api,storage:win.localStorage,storageScope:user});await panel.select(group,docs);
  sessions.push({win,doc,panel,tick:()=>tick(),cleared:()=>cleared});
 }
 const flush=()=>new Promise(r=>setImmediate(r));
 // A second cutter's server state is simulated externally, not by invoking a write.
 done=true;sessions[0].tick();await flush();sessions[1].win.dispatchEvent(new sessions[1].win.Event('focus'));await flush();
 for(const s of sessions)assert.match(s.doc.querySelector('#optSharedStatus').textContent,/1 cortadas y 0 pendientes/);
 done=false;await sessions[0].panel.refresh();const a=sessions[0],check=a.doc.querySelector('[data-piece]');check.checked=true;check.onchange();const before=reads;a.tick();await flush();assert.equal(reads,before);assert(check.checked);
 a.doc.querySelector('#optSharedRegister').click();a.tick();await flush();assert.equal(reads,before);assert.equal(a.doc.querySelector('#optSharedConfirmation').hidden,false);
 a.doc.querySelector('#optSharedCancel').click();check.checked=false;check.onchange();
 let release;hold=new Promise(r=>release=r);a.tick();a.tick();a.win.dispatchEvent(new a.win.Event('focus'));assert.equal(reads,before+1,'no overlapping reads');release();hold=null;await flush();
 Object.defineProperty(a.doc,'visibilityState',{configurable:true,value:'hidden'});const hiddenReads=reads;a.tick();await flush();assert.equal(reads,hiddenReads);
 Object.defineProperty(a.doc,'visibilityState',{configurable:true,value:'visible'});a.doc.dispatchEvent(new a.win.Event('visibilitychange'));await flush();assert.equal(reads,hiddenReads+1);
 // An uncertain command in another tab must never be retried by a refresh.
 a.win.localStorage.setItem('sgp-opt-pending-v1:alice:21234567-89ab-4cde-8fab-0123456789ab',JSON.stringify({version:2,scope,reserva:'SYNTH',piezas:[id],idempotencyKey:'21234567-89ab-4cde-8fab-0123456789ab'}));await a.panel.refresh();const pendingReads=reads;a.tick();await flush();assert.equal(reads,pendingReads);assert.equal(a.win.localStorage.length,1);
 for(const s of sessions){s.panel.destroy();assert(s.cleared());const n=reads;s.tick();s.win.dispatchEvent(new s.win.Event('focus'));await flush();assert.equal(reads,n);s.win.close();}
 assert.equal(writes,0);console.log('PASS: two synthetic sessions, focus/timer sync, selection/confirmation/pending preserved, single-flight, visibility and destroy; zero writes');
})().catch(e=>{console.error(e);process.exitCode=1;});
