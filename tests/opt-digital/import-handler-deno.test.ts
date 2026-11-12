// Real Deno PDF and HTTP handler; RPC boundary is synthetic, not hosted Supabase.
import {readOptPdf} from '../../supabase/functions/opt-import/pdf-runtime.ts';
import {DOMParser} from 'npm:@xmldom/xmldom@0.9.12';
import {createOptImportHandler} from '../../src/server/opt-import-handler.js';
import {Buffer} from 'node:buffer';
import {body,binding,base64,indexWorkbook,sizedIndexWorkbook} from './import-fixtures.mjs';
Deno.test('Deno original PDF/CSV -> exact manifest and private RPC boundary',async()=>{
 let write:any=null;
 const rpc=async(name:string,args:any)=>{
  if(name==='sgp_sesion_actual')return {data:{valida:true,rol:'LIDER MECANIZADO'}};
  if(name==='sgp_mis_accesos')return {data:[{ventana:'mecanizado.proceso'}]};
  if(name==='sgp_opt_import_contexto_v1')return {data:{contract:'OPT-IMPORT-CONTEXT-1',scope:args.p_scope,revision:'a'.repeat(32),bindings:[binding]}};
  if(name==='sgp_opt_importar_validado_v1'){write=args;return {data:{contract_version:2,id_documento:'11111111-1111-4111-8111-111111111111',duplicado:false,cantidad_piezas:args.p_manifest.length,sin_asignacion:0,import_contract:'OPT-IMPORT-1',ok:true,physical_completion_verified:false}};}
  throw Error('Unexpected RPC');
 };
 const handler=createOptImportHandler({rpc,readPdf:readOptPdf,DOMParser,allowedOrigins:['https://sgp-one-lab.web.app']});
 const originalFetch=globalThis.fetch;globalThis.fetch=(()=>{throw Error('Runtime must not fetch');}) as typeof fetch;
 try{
  const response=await handler(new Request('https://example.invalid',{method:'POST',headers:{origin:'https://sgp-one-lab.web.app','content-type':'application/json'},body:JSON.stringify(body())}));
  const data=await response.json();if(response.status!==200)throw Error(JSON.stringify(data));
  if(data.totals.documentaryCuts!==4||data.totals.cutLength32!==1284||data.data.cantidad_piezas!==4)throw Error('Complete totals differ');
  if(!write?.p_manifest.every((p:any)=>p.longitud_mm===254.79375))throw Error('Fraction lost before private SQL RPC');
  if(write.p_evidence.physical_completion_verified!==false)throw Error('Physical completion invented');
  const xlsxBody:any=body();xlsxBody.index={name:'index.xlsx',format:'xlsx',sheet:'ARCHIVOS',base64:base64(await indexWorkbook())};
  const xlsxResponse=await handler(new Request('https://example.invalid',{method:'POST',headers:{origin:'https://sgp-one-lab.web.app','content-type':'application/json'},body:JSON.stringify(xlsxBody)}));
  if(xlsxResponse.status!==200)throw Error(JSON.stringify(await xlsxResponse.json()));
  // The original 3 MiB index is sent complete, never converted or trimmed client-side.
  const large=await sizedIndexWorkbook(3*1024*1024);
  const t=performance.now();xlsxBody.index.base64=Buffer.from(large).toString('base64');
  const largeResponse=await handler(new Request('https://example.invalid',{method:'POST',headers:{origin:'https://sgp-one-lab.web.app','content-type':'application/json'},body:JSON.stringify(xlsxBody)}));
  const largeData=await largeResponse.json();if(largeResponse.status!==200)throw Error(JSON.stringify(largeData));
  const sha=Buffer.from(await crypto.subtle.digest('SHA-256',large)).toString('hex');
  if(write.p_evidence.original_index.sha256!==sha||largeData.data.cantidad_piezas!==4)throw Error('Large original changed');
  console.log(JSON.stringify({case:'3MiB-original-index',elapsedMs:Math.round(performance.now()-t),memory:Deno.memoryUsage()}));

 }finally{globalThis.fetch=originalFetch;}
});
