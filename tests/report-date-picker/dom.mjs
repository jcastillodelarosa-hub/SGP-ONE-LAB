import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {initReportDatePickers} from '../../src/modules/report-date-picker.js';
const {JSDOM}=await import(pathToFileURL(process.env.SGP_JSDOM_MODULE).href);
const dom=new JSDOM(readFileSync('index.html','utf8'),{url:'http://localhost/'});
globalThis.document=dom.window.document;
const root=document.getElementById('pickReportPanel');
initReportDatePickers(root);initReportDatePickers(root);
const dates=[...root.querySelectorAll('input[type="date"]')];
assert.equal(dates.length,4);assert.equal(root.querySelectorAll('.report-date-open').length,4);
for(const input of dates){
 const button=input.nextElementSibling;let opened=0;
 input.value='2026-11-12';input.showPicker=()=>opened++;
 assert.equal(button.type,'button');assert.match(button.getAttribute('aria-label'),/Abrir calendario: (Desde|Hasta)/);
 button.click();button.click();assert.equal(opened,2);assert.equal(document.activeElement,input);assert.equal(input.value,'2026-11-12');
 input.disabled=true;button.click();assert.equal(opened,2);input.disabled=false;
 input.readOnly=true;button.click();assert.equal(opened,2);input.readOnly=false;
 input.showPicker=()=>{throw new Error('NotAllowedError')};assert.doesNotThrow(()=>button.click());assert.equal(input.value,'2026-11-12');
 delete input.showPicker;assert.doesNotThrow(()=>button.click());assert.equal(document.activeElement,input);
 input.value='2026-11-13';input.dispatchEvent(new dom.window.Event('change',{bubbles:true}));assert.equal(input.value,'2026-11-13');
}
console.log('PASS: 4 report date controls, idempotent init, repeated clicks, native opening, disabled/readonly, fallback and manual entry. DOM only.');
