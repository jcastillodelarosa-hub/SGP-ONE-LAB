import test from 'node:test';
import assert from 'node:assert/strict';
import {DOMParser} from '@xmldom/xmldom';
import * as pdfjs from 'pdfjs-dist/build/pdf.mjs';
import {createOptImportHandler} from '../src/server/opt-import-handler.js';
import {createOptPdfReader} from '../src/server/opt-pdf-reader.js';
import {retailSelectors} from '../src/server/opt-retail-contract.js';
import {body,binding,base64} from './opt-digital/import-fixtures.mjs';
import {normalizeOptRows} from '../src/domain/opt-index-importer.js';
const entry={project:'123456 - Synthetic',reservation:'9000001',system:'SYNTH-SYS',finish:'FINISH'};
const row={reference:'123456 - Synthetic (Line 1) M1'};
export function retailBody(){const b=body();b.index.base64=base64(new TextEncoder().encode('OPT,Reserva,Sistema,Proyecto,Acabado\nOPT-SYNTH,9000001,SYNTH-SYS,123456 - Synthetic,FINISH\n'));return b;}
async function run({profile='PANEL',mutate=c=>c,request=retailBody(),enabled=true}={}){
 const writes=[];
 const handler=createOptImportHandler({DOMParser,readPdf:createOptPdfReader(pdfjs),retailV3:enabled,allowedOrigins:['https://offline.invalid'],rpc:async(name,a)=>{
  if(name==='sgp_sesion_actual')return {data:{valida:true,rol:'LIDER MECANIZADO'}};
  if(name==='sgp_mis_accesos')return {data:[{ventana:'mecanizado.proceso'}]};
  if(name==='sgp_opt_import_contexto_retail_v3')return {data:mutate({contract:'OPT-IMPORT-CONTEXT-RETAIL-3',revision:'a'.repeat(32),scope:a.p_scope,opt:a.p_opt,selectores:a.p_selectores,referencias:a.p_referencias,profileDestinations:[{referencia:'R1',tipo_pieza:profile,destino_productivo:profile,activa:'SI'}],bindings:['PANELES_2','FRAMES_2'].map(line=>({...binding,documentLabel:entry.project,sgpProductionId:'700000',reserva:entry.reservation,reserva_principal:entry.reservation,programacion_reserva:line==='PANELES_2'?entry.reservation:null,reserva_snapshot:line==='PANELES_2'?entry.reservation:null,id_programacion:line==='PANELES_2'?binding.id_programacion:null,id_linea:line,key_produccion:'700000|'+line}))})};
  if(name==='sgp_opt_importar_retail_validado_v3'){writes.push(a);return {data:{ok:true,import_contract:'OPT-IMPORT-1',contract_version:2,id_documento:'11111111-1111-4111-8111-111111111111',duplicado:false,cantidad_piezas:a.p_manifest.length,sin_asignacion:a.p_manifest.filter(x=>x.asignacion===null).length,physical_completion_verified:false}};}
  throw Error('UNEXPECTED_RPC_'+name);
 }});
 const response=await handler(new Request('https://offline.invalid',{method:'POST',headers:{origin:'https://offline.invalid','content-type':'application/json'},body:JSON.stringify(request)}));
 return {status:response.status,out:await response.json(),writes};
}
test('full label identity, numeric namespace, finish and exact reservation preserved',()=>{
 assert.equal(retailSelectors([entry],[row])[0].documentProduction,'123456');
 assert.throws(()=>retailSelectors([{...entry,reservation:'9000001,9000002'}],[row]),/SELECTOR_INVALID/);
 assert.throws(()=>retailSelectors([entry],[{reference:'123456 - Synthetic OTHER (Line 1)'}]),/LABEL_MISMATCH/);
 assert.throws(()=>retailSelectors([entry,{...entry,project:'123456 - Other'}],[row]),/LABEL_AMBIGUOUS/);
 const raw=[{OPT:'X',Reserva:'9000001,9000002',Sistema:'S',Proyecto:entry.project}];
 assert.equal(normalizeOptRows(raw,'RETAIL',{exactReservations:true})[0].reservation,'9000001,9000002');
});
test('different internal ID resolves exact Panel profile without choosing by eligible program',async()=>{
 const r=await run();assert.equal(r.status,200,JSON.stringify(r.out));assert.equal(r.writes[0].p_manifest.length,4);assert(r.writes[0].p_manifest.every(p=>p.asignacion.key_produccion==='700000|PANELES_2'));assert.equal(r.writes[0].p_evidence.contract,'OPT-SERVER-VALIDATION-RETAIL-3');
});
test('Frames documentary units remain unassigned even with a Panel program',async()=>{
 const r=await run({profile:'FRAME'});assert.equal(r.status,200,JSON.stringify(r.out));assert(r.writes[0].p_manifest.every(p=>p.asignacion===null));
});
test('missing/conflicting profile, wrong labels, changed scope, duplicate identity and absent program never write',async()=>{
 const mutations=[c=>({...c,profileDestinations:[]}),c=>({...c,profileDestinations:[...c.profileDestinations,{referencia:'R1',tipo_pieza:'FRAME',destino_productivo:'FRAME',activa:'SI'}]}),c=>({...c,bindings:c.bindings.map(b=>({...b,documentLabel:'wrong'}))}),c=>({...c,scope:{...c.scope,linea:'FRAMES_2'}}),c=>({...c,bindings:[...c.bindings,{...c.bindings[0],key_produccion:'competing'}]}),c=>({...c,bindings:c.bindings.map(b=>({...b,id_programacion:null}))})];
 for(const mutate of mutations){const r=await run({mutate});assert.equal(r.status,422,JSON.stringify(r.out));assert.equal(r.writes.length,0);}
});
test('request cannot activate new contract or supply bindings',async()=>{
 for(const field of ['retailV3','bindings']){const b=retailBody();b[field]=true;const r=await run({request:b});assert.equal(r.status,422);assert.equal(r.writes.length,0);}
});

test('printed zero remainder uses painted borders, never default zero or midpoint guessing',async()=>{
 const {pages}=await import('./opt-digital/import-fixtures.mjs');
 const {extractCoordinatePlans}=await import('../opt-digital/geometric-extraction.js');
 const source=pages(),page=source[1],rest=page.items.find(i=>i.str==='9"');rest.str='0"';rest.transform[4]=792;rest.width=6;
 page.items.push({str:'Cortar',width:12,transform:[1,0,0,1,810,440]});
 page.rules=[750,800,840].map(x=>({x1:x,x2:x,y1:400,y2:460}));
 assert.equal(extractCoordinatePlans(source).plans[0].rest,'0"');
 page.rules=[];assert.equal(extractCoordinatePlans(source).plans[0].rest,'');
 page.rules=[750,800,840].map(x=>({x1:x,x2:x,y1:400,y2:460}));rest.str='';
 assert.equal(extractCoordinatePlans(source).plans[0].rest,'');
});
