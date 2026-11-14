import test from 'node:test';import assert from 'node:assert/strict';import {DOMParser} from '@xmldom/xmldom';
const {SaxesParser}=await import(process.env.SAXES_MODULE||'saxes');
import {storeZip} from './lp01-powerbi/zip-fixture.mjs';
import {readWorksheetGrid} from '../src/domain/powerbi/xlsx-reader.js';
import {parseIndexWorkbook} from '../src/domain/opt-index-file.js';
import {createWorksheetXMLReader} from '../src/server/opt-worksheet-stream.js';
const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main',readWorksheetXML=createWorksheetXMLReader(SaxesParser);
const row=(n,values)=>`<row r="${n}">${values.map((v,i)=>`<c r="${String.fromCharCode(65+i)}${n}" t="str"><v>${v}</v></c>`).join('')}</row>`;
const sheet=rows=>`<worksheet xmlns="${ns}"><sheetData>${rows}</sheetData></worksheet>`;
function zip(xml,mutate=()=>{}){const parts=new Map([
 ['[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'],
 ['xl/workbook.xml',`<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="ARCHIVOS" r:id="s"/></sheets></workbook>`],
 ['xl/_rels/workbook.xml.rels','<Relationships><Relationship Id="s" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'],
 ['xl/worksheets/sheet1.xml',xml],['xl/sharedStrings.xml',`<sst xmlns="${ns}"><si><t>shared&amp;text</t></si></sst>`]
]);mutate(parts);return storeZip(parts);}
const grid=(bytes,fast)=>readWorksheetGrid(bytes,{DOMParser,sheetName:'ARCHIVOS',allowStringCells:true,maxFileBytes:5*1024*1024,...(fast?{readWorksheetXML}:{})});
const base=sheet(row(1,['Consecutivo','# Reserva','Sistema'])+row(2,['OPT-SYNTH','R','PANEL']));
test('complete worksheet values match DOM, including sparse, shared, rich, entities, CDATA and namespaces',async()=>{
 const variants=[base,base.replace('<v>R</v>','<v><x>one<x>two</x>three</x><!--not text--><?ignored x?>four</v>'),sheet('<row><c t="s"><v>0</v></c><c r="C1" t="n"><v>1.25</v></c><c t="inlineStr"><is><r><t>A&amp;</t></r><r><t><![CDATA[B<C]]></t></r></is></c></row>'),base.replace('<v>R</v>','<v> R&#13;\n&amp;\t </v>'),base.replace('<sheetData>','<sheetData><!--ignored-->').replace('</sheetData>','</sheetData><ext xmlns="urn:foreign"><f>not a spreadsheet formula</f></ext>'),base.replace(/<v>/g,'<s:v xmlns:s="'+ns+'">').replace(/<\/v>/g,'</s:v>')];
 for(const xml of variants)assert.deepEqual(await grid(zip(xml),true),await grid(zip(xml),false));
});
test('all row and cell rejection rules remain fail closed',async()=>{
 const cases=[base.replace('r="2"','r="1"'),base.replace('r="2"','r="20001"'),base.replace('r="2"','r="2" hidden="true"'),base.replace('A2','AG2'),base.replace('B2','A2'),base.replace('A2','A3'),base.replace('<v>R</v>','<v>R</v><v>R</v>'),base.replace('<v>R</v>','<f>1+1</f><v>R</v>'),base.replace('</worksheet>','<mergeCell/></worksheet>'),base.replace('</worksheet>','<ext><f/></ext></worksheet>'),base.replace('t="str"','t="b"'),sheet('<row><c t="s"><v>1</v></c></row>'),sheet('<row><c t="n"><v>Infinity</v></c></row>'),sheet('<row><c t="inlineStr"><v>v</v><is><t>x</t></is></c></row>'),base.replace('</worksheet>','<sheetData/></worksheet>'),'<worksheet xmlns="'+ns+'"/>','<!DOCTYPE worksheet [<!ENTITY x "x">]>'+base,base.replace('</worksheet>','</broken>'),base+'<extra/>',base.replace('<v>R</v>','<v>&unknown;</v>')];
 for(const xml of cases){await assert.rejects(grid(zip(xml),false));await assert.rejects(grid(zip(xml),true));}
});
test('ZIP/workbook integrity, external content and sheet selection guards remain shared',async()=>{
 for(const mutate of [p=>p.set('xl/vbaProject.bin','x'),p=>p.set('xl/externalLinks/link.xml','x'),p=>p.set('xl/workbook.xml',p.get('xl/workbook.xml').replace('name="ARCHIVOS"','name="OTHER"')),p=>p.set('xl/workbook.xml',p.get('xl/workbook.xml').replace('name="ARCHIVOS"','name="ARCHIVOS" state="hidden"')),p=>p.set('xl/_rels/workbook.xml.rels',p.get('xl/_rels/workbook.xml.rels').replace('Target="','TargetMode="External" Target="'))]){const b=zip(base,mutate);await assert.rejects(grid(b,false));await assert.rejects(grid(b,true));}
 const b=zip(base);b[50]^=1;await assert.rejects(grid(b,false));await assert.rejects(grid(b,true));
});
test('namespace spoofing and malformed trailing XML cannot return partial accepted rows',async()=>{
 for(const xml of [base.replace('xmlns="'+ns+'"','xmlns="urn:wrong"'),base.replace('</worksheet>','<p:unknown/></worksheet>'),base.replace('</worksheet>','<ext attr="1" attr="2"/></worksheet>'),base.replace('</worksheet>','<ext>\u0000</ext></worksheet>')])await assert.rejects(grid(zip(xml),true));
 assert.throws(()=>readWorksheetXML(new TextEncoder().encode(sheet('<a>'.repeat(130)+'</a>'.repeat(130))),{shared:[],allowStringCells:true}),/Profundidad/);
});
test('7692-row synthetic index has exact normalized output for both origins',async()=>{
 const xml=sheet(row(1,['Consecutivo','# Reserva','Sistema'])+Array.from({length:7692},(_,i)=>row(i+2,['SYNTH-'+i,i%2?'R':'','PANEL'])).join(''));
 const b=zip(xml);for(const origin of ['RETAIL','PROYECTO']){
  const options={DOMParser,sheetName:'ARCHIVOS'};
  const baseline=await parseIndexWorkbook(b,origin,options),candidate=await parseIndexWorkbook(b,origin,{...options,readWorksheetXML});assert.deepEqual(candidate,baseline);assert.equal(candidate.entries.length,7692);
 }
});
test('new resource boundaries are explicit: depth128 and 8192 child elements per row',()=>{
 const read=xml=>readWorksheetXML(new TextEncoder().encode(xml),{shared:[],allowStringCells:true});
 assert.equal(read(sheet('<row>'+'<x>'.repeat(125)+'</x>'.repeat(125)+'</row>')).length,1);
 assert.throws(()=>read(sheet('<row>'+'<x>'.repeat(126)+'</x>'.repeat(126)+'</row>')),/Profundidad/);
 assert.equal(read(sheet('<row>'+'<x/>'.repeat(8192)+'</row>')).length,1);
 assert.throws(()=>read(sheet('<row>'+'<x/>'.repeat(8193)+'</row>')),/Fila XML/);
 assert.throws(()=>read(base.replace('</worksheet>','<x xmlns:a="urn:x" xmlns:b="urn:x" a:v="1" b:v="2"/></worksheet>')),/XML inválido/);
 assert.throws(()=>read('<?xml version="1.1"?>'+base.replace('<v>R</v>','<v>\u0001</v>')),/XML inválido/);
});
