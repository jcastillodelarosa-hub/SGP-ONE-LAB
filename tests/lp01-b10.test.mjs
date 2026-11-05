import test from 'node:test';import assert from 'node:assert/strict';
import {compactSummaryMarkup} from '../src/modules/lp01-affectation-summary.js';
import {weekColor,originalWeek} from '../src/domain/lp01-tracking.js';
test('B10 only applicable recorded causes, distinct validated union and compact unknown',()=>{
 const value={categories:{NC_AL:10,NC_V:8,TECNO:null,NOVEDAD:0},total:12,available:8,aluminumUnknown:false};const html=compactSummaryMarkup(value);
 assert.match(html,/10 × NC AL/);assert.match(html,/8 × NC V/);assert.match(html,/Total distinto: 12/);assert.doesNotMatch(html,/Tecno|Novedad|No disponible|Accesorios|18/);
 const unknown=compactSummaryMarkup({...value,total:null,available:null,aluminumUnknown:true});assert.match(unknown,/Pendiente de validar/);assert.doesNotMatch(unknown,/Disponibles/);
 assert.doesNotMatch(compactSummaryMarkup({categories:{NC_AL:null},total:null,available:null}),/0 ×/);
});
test('week badge is stable by year/week and unknown is distinct; labels retained',()=>{
 const row={oficial:{anio:2026,semana_base:44}};assert.equal(weekColor(row),weekColor(structuredClone(row)));assert.notEqual(weekColor(row),weekColor({oficial:{anio:2025,semana_base:44}}));assert.equal(weekColor({}),'week-unknown');assert.equal(originalWeek(row).label,'44 · 2026');
 const backgrounds=['dbeafe','e0e7ff','f3e8ff','fce7f3','ffedd5','fef3c7','dcfce7','ccfbf1'];const luminance=hex=>hex.match(/../g).map(s=>parseInt(s,16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4).reduce((n,c,i)=>n+c*[.2126,.7152,.0722][i],0);
 for(const bg of backgrounds)for(const fg of ['18344f','25496f'])assert.ok((luminance(bg)+.05)/(luminance(fg)+.05)>4.5);
});
