// Reuse the same synthetic mount as browser QA, without substituting production APIs.
const assert=require('node:assert/strict'),fs=require('node:fs'),{pathToFileURL}=require('node:url');
const {JSDOM}=require(process.env.JSDOM_MODULE||'jsdom');
(async()=>{
 const source=fs.readFileSync('tests/opt-digital/shared-scheme-workflow-browser.cjs','utf8');
 const mount=source.split('await page.evaluate(async()=>{')[1].split('\n });\n const host=')[0];
 const dom=new JSDOM('<div id="host"></div>',{url:'https://synthetic.test'});
 Object.assign(global,{window:dom.window,document:dom.window.document,DOMParser:dom.window.DOMParser,localStorage:dom.window.localStorage,innerWidth:1440});
 global.fetch=async path=>({text:async()=>fs.readFileSync('.'+path,'utf8')});
 await new Function('return (async()=>{'+mount.replace(/import\('\//g,"import('"+pathToFileURL(process.cwd()+'/').href)+'})()')();
 const root=document.querySelector('#host').shadowRoot,$=s=>root.querySelector(s),tick=()=>new Promise(r=>setTimeout(r,20));
 $('#optWorkflowTab1').click();await $('#optScopeLoad').onclick();await tick();$('#optReservation').value='SYNTHETIC-GROUP';$('#optReservation').onchange();await tick();
 assert.equal($('.layout').hidden,true);assert.equal($('.mobile-controls').hidden,true);assert.equal(root.querySelectorAll('.opt-shared-references button').length,32);assert.equal(root.querySelectorAll('#optSharedScheme').length,1);
 assert.equal($('.opt-shared-piece-details').open,false);
 $('#optSharedScheme button.segment').click();assert.equal($('#optSharedPieces input').checked,true);
 root.querySelectorAll('.opt-shared-references button')[1].click();await tick();$('#optSharedScheme button.segment').click();
 $('#optReservationTab1').click();await tick();assert.equal(root.querySelectorAll('#optSummaryView table').length,2);$('#optReservationTab0').click();
 root.querySelectorAll('.opt-shared-references button')[0].click();await tick();assert.equal($('#optSharedPieces input').checked,true);assert.equal($('#optSharedScheme button.segment').getAttribute('aria-pressed'),'true');
 $('#optSharedRegister').click();$('#optSharedCancel').click();assert.equal(window.fixtureWrites.length,0);
 $('#optSharedRegister').click();await $('#optSharedConfirm').onclick();await tick();assert.equal(window.fixtureWrites.length,1);assert.equal(window.fixtureWrites[0].piezas.length,2);assert.equal($('#optSharedScheme button.segment').disabled,true);
 await $('#optSharedRefresh').onclick();await tick();assert.equal($('#optSharedScheme button.segment').dataset.state,'CORTADO');
 window.fixture.destroy();assert.equal($('#optSharedCuts'),null);
 console.log('PASS: full synthetic workflow DOM, direct query, server layout, scheme selection across references and tabs, stacked summary tables, confirmation/cancel, saved state after refresh.');
})().catch(e=>{console.error(e);process.exitCode=1;});
