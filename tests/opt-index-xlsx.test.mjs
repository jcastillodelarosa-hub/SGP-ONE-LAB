import test from 'node:test';import assert from 'node:assert/strict';import {DOMParser} from '@xmldom/xmldom';
import {storeZip} from './lp01-powerbi/zip-fixture.mjs';import {parseIndexWorkbook} from '../opt-digital/workflow.js';import {readExportGrid} from '../src/domain/powerbi/xlsx-reader.js';
const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
function fixture(){return new Map([
 ['[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="bin" ContentType="application/vnd.ms-excel.sheet.binary.macroEnabled.main"/></Types>'],
 ['xl/workbook.xml',`<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Maestro" sheetId="1" r:id="rId1"/><sheet name="Optimizaciones" sheetId="2" r:id="rId2"/></sheets></workbook>`],
 ['xl/_rels/workbook.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>'],
 ['xl/worksheets/sheet2.xml',`<worksheet xmlns="${ns}"><sheetData><row r="1"><c r="A1" t="str"><v>consecutive</v></c><c r="B1" t="str"><v>reserva</v></c><c r="C1" t="str"><v>sistemas</v></c></row><row r="2"><c r="A2" t="str"><v>OPT-SYNTH</v></c><c r="B2" t="str"><v>R-SYNTH</v></c><c r="C2" t="str"><v>PANEL</v></c></row></sheetData></worksheet>`]
]);}
test('Optima selects explicit worksheet and literal strings, unused binary declaration is inert',async()=>{const bytes=storeZip(fixture()),result=await parseIndexWorkbook(bytes,'PROYECTO',{DOMParser});assert.equal(result.sourceRows,1);assert.equal(result.entries[0].opt,'OPT-SYNTH');await assert.rejects(readExportGrid(bytes,{DOMParser}));});
test('OPT rejects actual macro/binary payload, formulas, DTD and hidden rows',async()=>{
 for(const mode of ['binary','vba','formula','dtd','hidden']){const parts=fixture();let sheet=parts.get('xl/worksheets/sheet2.xml');if(mode==='binary')parts.set('xl/payload.bin','dummy');if(mode==='vba')parts.set('xl/vbaProject.bin','dummy');if(mode==='formula')sheet=sheet.replace('<v>OPT-SYNTH</v>','<f>1+1</f><v>OPT-SYNTH</v>');if(mode==='dtd')sheet='<!DOCTYPE worksheet [<!ENTITY x "bad">]>'+sheet;if(mode==='hidden')sheet=sheet.replace('<row r="2">','<row r="2" hidden="1">');parts.set('xl/worksheets/sheet2.xml',sheet);await assert.rejects(parseIndexWorkbook(storeZip(parts),'PROYECTO',{DOMParser}));}
});
test('OPT requires exact visible sheet name, no inferred worksheet fallback',async()=>{await assert.rejects(parseIndexWorkbook(storeZip(fixture()),'PROYECTO',{DOMParser,sheetName:'Unknown'}),/hoja/);});
test('week46 ARCHIVOS uses exact named worksheet and original column names',async()=>{
 const parts=fixture();parts.set('xl/workbook.xml',parts.get('xl/workbook.xml').replace('name="Optimizaciones"','name="ARCHIVOS"'));
 parts.set('xl/worksheets/sheet2.xml',parts.get('xl/worksheets/sheet2.xml').replace('>consecutive<','>Consecutivo<').replace('>reserva<','># Reserva<').replace('>sistemas<','>Sistema<'));
 const result=await parseIndexWorkbook(storeZip(parts),'RETAIL',{DOMParser});assert.equal(result.sheet,'ARCHIVOS');assert.equal(result.entries[0].reservation,'R-SYNTH');assert.equal(result.entries[0].origin,'RETAIL');
});
