const assert=require('node:assert/strict');
const {JSDOM}=require(process.env.JSDOM_MODULE||'jsdom');
(async()=>{
 const {mountOptImportRecovery}=await import('../../opt-digital/import-recovery-panel.js');
 const dom=new JSDOM('<main></main>'),scope={linea:'PANELES_2',anio:2026,semana:46,modo:'BASE'};
 let resolutions=0,retries=0;
 const api={pending:()=>[{scope,source:{origin:'RETAIL',mode:'INDICE'},pdf:{name:'213.pdf'},index:{name:'index.csv'}}],exportPendingIdentities:async()=>({items:[]}),resolvePending:async()=>{resolutions++;},retryResolved:async()=>{retries++;}};
 const panel=mountOptImportRecovery(dom.window.document.querySelector('main'),{api,getScope:()=>scope});
 assert.match(dom.window.document.body.textContent,/Recuperación temporalmente desactivada/);
 const buttons=[...dom.window.document.querySelectorAll('button')],resolve=buttons.find(b=>b.textContent==='Consultar cierre certificado'),retry=buttons.find(b=>b.textContent==='Reintentar manualmente este PDF');
 assert(resolve.disabled);assert(retry.disabled);assert(!buttons.find(b=>b.textContent==='Exportar identidades para revisión').disabled);
 await resolve.onclick();await retry.onclick();assert.equal(resolutions,0);assert.equal(retries,0);
 panel.invalidate();assert(dom.window.document.querySelector('.opt-recovery-row button').disabled);panel.destroy();
 console.log('OPT recovery paused DOM: PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
