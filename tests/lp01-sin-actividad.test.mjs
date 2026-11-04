import test from 'node:test';import assert from 'node:assert/strict';
import {reportCSV} from '../src/domain/lp01-operation.js';
test('reporte SIN ACTIVIDAD conserva corte, ámbito, responsable, motivo y versión sin archivo ni cantidades inventadas',()=>{
 const snapshot={type:'SIN_ACTIVIDAD',stage:'EMPAQUE',line:'FRAMES_2',date:'2026-11-01',shift:2,user:'QA Líder',closedAt:'2026-11-02T04:00:00Z',observation:'=motivo explícito',version:4,file:null,rows:[],confirmed:true};
 const csv=reportCSV(snapshot),lines=csv.split('\r\n');assert.equal(lines.length,2);assert.match(lines[1],/SIN ACTIVIDAD/);for(const v of ['EMPAQUE','FRAMES_2','2026-11-01','QA Líder','2026-11-02T04:00:00Z','No aplica: turno sin órdenes'])assert.ok(lines[1].includes(v));assert.ok(lines[1].includes("'=motivo explícito"));assert.ok(lines[1].includes('"4"'));assert.ok(!lines[0].includes('Saldo Export')&&!lines[0].includes('Diferencia'));assert.equal(snapshot.file,null);
});
