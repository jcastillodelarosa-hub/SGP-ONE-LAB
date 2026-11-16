import test from 'node:test';
import {createOptImport} from '../src/services/opt-import.js';
import assert from 'node:assert/strict';
import {DOMParser} from '@xmldom/xmldom';
import * as pdfjs from 'pdfjs-dist/build/pdf.mjs';
const {createOptImportHandler}=await import(process.env.OPT_QA_HANDLER_MODULE || '../src/server/opt-import-handler.js');
import {createOptPdfReader} from '../src/server/opt-pdf-reader.js';
import {retailSelectors} from '../src/server/opt-retail-contract.js';
import {body,binding,base64} from './opt-digital/import-fixtures.mjs';
import {normalizeOptRows} from '../src/domain/opt-index-importer.js';
const entry={project:'123456 - Synthetic',reservation:'9000001',system:'SYNTH-SYS',finish:'FINISH'};
const row={reference:'123456 - Synthetic (Line 1) M1'};
export function retailBody(){const b=body();b.index.base64=base64(new TextEncoder().encode('OPT,Reserva,Sistema,Proyecto,Acabado\nOPT-SYNTH,9000001,SYNTH-SYS,123456 - Synthetic,FINISH\n'));return b;}
async function run({profile='PANEL',mutate=c=>c,request=retailBody(),enabled=true,writeError=null}={}){
 const writes=[];
 const handler=createOptImportHandler({DOMParser,readPdf:createOptPdfReader(pdfjs),retailV3:enabled,allowedOrigins:['https://offline.invalid'],rpc:async(name,a)=>{
  if(name==='sgp_sesion_actual')return {data:{valida:true,rol:'LIDER MECANIZADO'}};
  if(name==='sgp_mis_accesos')return {data:[{ventana:'mecanizado.proceso'}]};
  if(name==='sgp_opt_import_contexto_retail_v3')return {data:mutate({contract:'OPT-IMPORT-CONTEXT-RETAIL-3',revision:'a'.repeat(32),scope:a.p_scope,opt:a.p_opt,selectores:a.p_selectores,referencias:a.p_referencias,profileDestinations:[{referencia:'R1',tipo_pieza:profile,destino_productivo:profile,activa:'SI'}],bindings:['PANELES_2','FRAMES_2'].map(line=>({...binding,documentLabel:entry.project,sgpProductionId:'700000',reserva:entry.reservation,reserva_principal:entry.reservation,programacion_reserva:line==='PANELES_2'?entry.reservation:null,reserva_snapshot:line==='PANELES_2'?entry.reservation:null,id_programacion:line==='PANELES_2'?binding.id_programacion:null,id_linea:line,key_produccion:'700000|'+line}))})};
  if(name==='sgp_opt_importar_retail_validado_v3'){writes.push(a);if(writeError)return {error:writeError};return {data:{ok:true,import_contract:'OPT-IMPORT-1',contract_version:2,id_documento:'11111111-1111-4111-8111-111111111111',duplicado:false,cantidad_piezas:a.p_manifest.length,sin_asignacion:a.p_manifest.filter(x=>x.asignacion===null).length,physical_completion_verified:false}};}
  throw Error('UNEXPECTED_RPC_'+name);
 }});
 const values=new Map();const storage={get length(){return values.size;},key:i=>[...values.keys()][i],getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
 const api=createOptImport({invoke:async b=>({data:await(await handler(new Request('https://offline.invalid',{method:'POST',headers:{origin:'https://offline.invalid','content-type':'application/json'},body:JSON.stringify(b)}))).json()})},()=> 'synthetic-token',{storage,storageScope:'v6-qa'});
 const decode=b=>Uint8Array.from(atob(b),c=>c.charCodeAt(0));
 const receipt=await api.process({scope:request.scope,source:request.source,pdf:new File([decode(request.pdf.base64)],request.pdf.name),index:{file:new File([decode(request.index.base64)],request.index.name),format:'csv',sheet:'ARCHIVOS'}});
 return {receipt,writes,api,values};
}
test('current client accepts Retail handler receipt without recovery API',async()=>{const r=await run();assert.equal(r.writes.length,1);assert.equal(r.api.canResolveImports,false);assert.equal(r.api.pending().length,0);assert(r.receipt);});
