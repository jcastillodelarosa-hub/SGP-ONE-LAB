import {JSDOM} from 'jsdom';
import assert from 'node:assert/strict';
import {mountAccessoryAlertBatchConfig as mountAccessoryAlertConfig} from '../../src/modules/accessory-alerts.js';
const dom=new JSDOM('<main></main>'),host=dom.window.document.querySelector('main');
const rows=[{codigo_sap:'A',descripcion:'Manija azul',revision:0},{codigo_sap:'B',descripcion:'Manija roja',revision:0},{codigo_sap:'C',descripcion:'Tornillo',revision:2,mensaje:'Existente',activa:true}];let writes=[],token='t',allowed=true;
const client={rpc:async(name,args)=>{if(name.endsWith('catalogo'))return {data:structuredClone(rows)};writes.push(args);return {data:args.p_codigos.map(r=>({...r,revision:r.revision+1,mensaje:args.p_mensaje,activa:args.p_activa}))};}};
const mount=(c=client)=>mountAccessoryAlertConfig({host,client:c,token,getToken:()=>token,canEdit:()=>allowed});
await mount();
const get=s=>host.querySelector(s),change=el=>el.dispatchEvent(new dom.window.Event('change',{bubbles:true}));
function pick(code){const el=get('[data-alert-code="'+code+'"]');el.checked=!el.checked;change(el);}
function search(q){get('[data-alert-search]').value=q;get('[data-alert-search]').dispatchEvent(new dom.window.Event('input'));}
const submit=()=>get('form').onsubmit({preventDefault(){}});
assert.equal(get('button').disabled,true);assert.equal(writes.length,0);assert.equal(get('[data-alert-active]').checked,false);
search('manija');assert.equal(host.querySelectorAll('[data-alert-code]').length,2);pick('A');pick('B');
get('textarea').value='Revisar ubicación';search('Tornillo');assert.equal(get('[data-alert-count]').textContent,'2 códigos seleccionados');assert.equal(get('textarea').value,'Revisar ubicación');
search('B');pick('B');assert.equal(get('textarea').value,'Revisar ubicación');pick('B');
get('[data-alert-active]').checked=true;await submit();assert.equal(writes.length,1);assert.deepEqual(writes[0].p_codigos.map(x=>x.codigo_sap),['A','B']);assert.equal(writes[0].p_mensaje,'Revisar ubicación');
assert.equal(get('button').disabled,true);await submit();assert.equal(writes.length,1);
get('[data-alert-replace]').checked=true;change(get('[data-alert-replace]'));assert.equal(get('button').disabled,false);
allowed=false;await submit();assert.equal(writes.length,1);allowed=true;
token='new';await submit();assert.equal(writes.length,1);
await mount({rpc:async(name)=>name.endsWith('catalogo')?{data:structuredClone(rows)}:{error:{message:'NETWORK_UNCERTAIN'}}});pick('A');get('textarea').value='Example';await submit();assert.match(get('[role=status]').textContent,/Recarga/);assert.equal(get('button').disabled,true);assert.equal(get('[data-alert-search]').disabled,true);
let resolve;const late=mount({rpc:()=>new Promise(r=>resolve=r)});await mount();resolve({data:[]});await late;assert.equal(host.querySelectorAll('[data-alert-code]').length,3);
console.log('PASS: no implicit activation/write; description/code search; persistent multi-selection/message; atomic payload; overwrite acknowledgement; revoked role/session and uncertain-save guards; stale mount discarded');
