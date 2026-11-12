const assert=require('node:assert/strict');const {JSDOM}=require(process.env.JSDOM_MODULE||'jsdom');
(async()=>{
 const {createOptDigitalHost}=await import('../../src/modules/opt-digital.js');
 const dom=new JSDOM('<button></button><section></section><div></div>'),document=dom.window.document;let token='first';
 const button=document.querySelector('button'),panel=document.querySelector('section'),container=document.querySelector('div');
 const host=createOptDigitalHost({button,panel,container,getToken:()=>token}),state={valid:true,username:'same-user',access:['mecanizado']};
 host.update(state);assert(host.canOpen());container.shadowRoot.innerHTML='<p>Old session candidates</p>';panel.hidden=false;
 host.update(state);assert.equal(container.shadowRoot.children.length,1);
 token='renewed';host.update(state);assert.equal(container.shadowRoot.children.length,0);assert.equal(panel.hidden,true);assert(host.canOpen());
 container.shadowRoot.innerHTML='<p>New session candidates</p>';host.update({...state,username:'other'});assert.equal(container.shadowRoot.children.length,0);
 container.shadowRoot.innerHTML='<p>Protected state</p>';host.update({...state,access:[]});assert(!host.canOpen());assert(button.hidden);assert.equal(container.shadowRoot.children.length,0);
 host.destroy();console.log('PASS: native host clears candidate view on same-user token replacement, actor change and access revocation. Synthetic DOM only.');
})().catch(e=>{console.error(e);process.exit(1);});
