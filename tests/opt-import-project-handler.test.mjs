import test from 'node:test';import assert from 'node:assert/strict';
import * as pdfjs from 'pdfjs-dist/build/pdf.mjs';import {DOMParser} from '@xmldom/xmldom';
import {createOptImportHandler} from '../src/server/opt-import-handler.js';import {createOptPdfReader} from '../src/server/opt-pdf-reader.js';
import {body,binding,base64,fullPdf} from './opt-digital/import-fixtures.mjs';
const code='OPT2099-44-4-PINI-22',title=code+'_SYNTHETIC SITE_LEVEL 4_SYSTEM',origin='https://sgp-one-lab.web.app';
async function run({wrongContext=false,ambiguous=false,multiCell=false}={}){
 const b=body();b.source={mode:'INDICE',origin:'PROYECTO',opt:code};b.index={name:'i.csv',format:'csv',base64:base64(new TextEncoder().encode('OPT,Reserva,Sistema\n'+code+',SYNTH-R,SYNTH-SYS'))};
 if(multiCell)b.index={name:'i.json',format:'json',base64:base64(new TextEncoder().encode(JSON.stringify([{OPT:code,Reserva:'SYNTH-R,OTHER',Sistema:'SYNTH-SYS'}])))};
 const extraction=await createOptPdfReader(pdfjs)(fullPdf());
 for(const r of extraction.sourceProjectRows){r.sourceDocumentId=title;r.reference=r.reference.replace(/^\d+\s*-\s*/,'PROJECT ');}
 for(const p of extraction.plans)for(const c of p.cuts)c.project=c.project.replace(/^\d+\s*-\s*/,'PROJECT ');
 const writes=[],calls=[];const rpc=async(name,args)=>{calls.push(name);
 if(name==='sgp_sesion_actual')return {data:{valida:true,rol:'LIDER MECANIZADO'}};
 if(name==='sgp_mis_accesos')return {data:[{ventana:'mecanizado.proceso'}]};
 if(name==='sgp_opt_import_contexto_proyecto_v2'){assert.deepEqual(args.p_selectores,[{reserva:'SYNTH-R',sistema:'SYNTH-SYS'}]);return {data:{contract:'OPT-IMPORT-CONTEXT-PROYECTO-2',opt:wrongContext?'OTHER':code,selectores:args.p_selectores,referencias:args.p_referencias,profileDestinations:args.p_referencias.map(referencia=>({referencia,destino_productivo:'PANEL',tipo_pieza:'PANEL',activa:'SI'})),scope:args.p_scope,revision:'a'.repeat(32),bindings:ambiguous?[binding,{...binding,key_produccion:'OTHER',id_linea:'PANELES_2'}]:[binding]}};}
 if(name==='sgp_opt_importar_proyecto_validado_v2'){writes.push(args);return {data:{ok:true,contract_version:2,import_contract:'OPT-IMPORT-1',physical_completion_verified:false,id_documento:'11111111-1111-4111-8111-111111111111',duplicado:false,cantidad_piezas:args.p_manifest.length,sin_asignacion:0}};}
 throw Error('Unexpected RPC '+name);};
 const handler=createOptImportHandler({rpc,readPdf:async()=>extraction,DOMParser,allowedOrigins:[origin]});
 const res=await handler(new Request('https://example.invalid',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(b)}));return {status:res.status,out:await res.json(),writes,calls};
}
test('project request uses parsed exact index pair, never demands production in PDF',async()=>{const r=await run();assert.equal(r.status,200,JSON.stringify(r.out));assert.equal(r.writes.length,1);assert(!r.calls.includes('sgp_opt_import_contexto_v1'));const e=r.writes[0].p_evidence;assert.equal(e.original_document_title,title);assert.equal(e.sgp_binding.opt,code);assert.equal(e.contract,'OPT-SERVER-VALIDATION-PROYECTO-2');assert(!Object.hasOwn(e.sgp_binding,'producciones'));});
test('mismatched context and ambiguous line identity do not reach import',async()=>{for(const config of [{wrongContext:true},{ambiguous:true}]){const r=await run(config);assert.equal(r.status,config.wrongContext?503:422,JSON.stringify(r.out));assert.equal(r.writes.length,0);}});

test('project multi-reservation cell blocks before context, no first-reservation allocation',async()=>{const r=await run({multiCell:true});assert.equal(r.status,422);assert.equal(r.out.code,'OPT_INDEX_RESERVATION_AMBIGUOUS');assert.equal(r.writes.length,0);assert(!r.calls.includes('sgp_opt_import_contexto_proyecto_v2'));});
