// Offline real handler profile. Synthetic authentication; optional read-only context snapshot.
// deno run --no-config --node-modules-dir=manual --allow-read --allow-env scripts/profile-opt-retail-v3-deno.ts INDEX.xlsx PDF.pdf [context.json] [DOM|STREAM]
import process from 'node:process';
import {inchesToThirtySeconds} from '../src/domain/opt-summary-reconciliation.js';
import {Buffer} from 'node:buffer';
import {basename} from 'node:path';
import {DOMParser} from 'npm:@xmldom/xmldom@0.9.12';
import {SaxesParser} from 'npm:saxes@6.0.0';
import {readOptPdf} from '../supabase/functions/opt-import/pdf-runtime.ts';
import {createOptImportHandler} from '../src/server/opt-import-handler.js';
import {createWorksheetXMLReader} from '../src/server/opt-worksheet-stream.js';
const [indexPath,pdfPath,contextPath,mode='STREAM']=Deno.args;
if(!indexPath||!pdfPath||!['DOM','STREAM'].includes(mode))throw Error('INDEX.xlsx PDF.pdf [context.json or -] [DOM|STREAM]');
const index=await Deno.readFile(indexPath),pdf=await Deno.readFile(pdfPath);
const hash=async(bytes:Uint8Array)=>Buffer.from(await crypto.subtle.digest('SHA-256',bytes)).toString('hex');
const inputs={index:{bytes:index.length,sha256:await hash(index)},pdf:{bytes:pdf.length,sha256:await hash(pdf)}};
const snapshot=contextPath&&contextPath!=='-'?JSON.parse(await Deno.readTextFile(contextPath)):null;
const scope={linea:'PANELES_2',anio:2026,semana:46,modo:'BASE'};
const payload={p_token:'offline-synthetic-not-a-session',scope,source:{origin:'RETAIL',mode:'INDICE',opt:basename(pdfPath).replace(/\.pdf$/i,'')},pdf:{name:basename(pdfPath),base64:Buffer.from(pdf).toString('base64')},index:{name:basename(indexPath),base64:Buffer.from(index).toString('base64'),format:'xlsx',sheet:'ARCHIVOS'}};
const request=new Request('https://offline.invalid',{method:'POST',headers:{origin:'https://offline.invalid','content-type':'application/json'},body:JSON.stringify(payload)});
const phases:any[]=[];let contextRequest:any=null,writeBoundary:any=null,extracted:any=null;
function record(name:string,cpu:any,start:number){const used=process.cpuUsage(cpu);phases.push({phase:name,cpuMs:(used.user+used.system)/1000,wallMs:performance.now()-start});}
const stream=createWorksheetXMLReader(SaxesParser);
const handler=createOptImportHandler({retailV3:true,DOMParser,readWorksheetXML:mode==='STREAM'?(bytes:any,options:any)=>{const cpu=process.cpuUsage(),start=performance.now();try{return stream(bytes,options);}finally{record('worksheet_xml',cpu,start);}}:undefined,readPdf:async(bytes:Uint8Array)=>{const cpu=process.cpuUsage(),start=performance.now();try{extracted=await readOptPdf(bytes);return extracted;}finally{record('pdf_extract',cpu,start);}},allowedOrigins:['https://offline.invalid'],rpc:async(name:string,args:any)=>{
 if(name==='sgp_sesion_actual')return {data:{valida:true,rol:'LIDER MECANIZADO'}};
 if(name==='sgp_mis_accesos')return {data:[{ventana:'mecanizado.proceso'}]};
 if(name==='sgp_opt_import_contexto_retail_v3'){
  contextRequest={scope:args.p_scope,opt:args.p_opt,selectores:args.p_selectores,referencias:args.p_referencias};
  if(snapshot)return {data:snapshot.snapshots?.[args.p_opt]||snapshot};
  throw Error('PROFILE_CONTEXT_REQUIRED');
 }
 if(name==='sgp_opt_importar_retail_validado_v3'){
  const printed=extracted.plans.flatMap((p:any)=>p.cuts.map((c:any)=>inchesToThirtySeconds(c.length))).sort((a:number,b:number)=>a-b);
  const persisted=args.p_manifest.map((p:any)=>Math.round(p.longitud_mm*32/25.4)).sort((a:number,b:number)=>a-b);
  if(JSON.stringify(printed)!==JSON.stringify(persisted))throw Error('PROFILE_PRINTED_LENGTHS_CHANGED');
  writeBoundary={printedLengthsPreserved:true,validationWarnings:args.p_evidence.validation_warnings,roundingPolicy:args.p_evidence.rounding_policy,roundingStatuses:args.p_evidence.rounding_evidence.map((p:any)=>p.diagnostic.status),manifestPieces:args.p_manifest.length,unassigned:args.p_manifest.filter((p:any)=>p.asignacion===null).length,manifestSha256:await hash(new TextEncoder().encode(JSON.stringify(args.p_manifest)))};
  throw Error('PROFILE_WRITE_STOPPED');
 }
 throw Error('PROFILE_RPC_DENIED');
}});
// Runtime cannot fetch remote resources. Imported modules are already loaded.
globalThis.fetch=(()=>{throw Error('PROFILE_NETWORK_DENIED');}) as typeof fetch;
const cpu=process.cpuUsage(),start=performance.now();
const response=await handler(request);const result=await response.json();record('total_handler',cpu,start);
console.log(JSON.stringify({runtime:Deno.version,mode,inputs,syntheticAuthentication:true,contextSupplied:!!snapshot,contextRequest,writeBoundary,writes:0,status:response.status,result,phases,memory:Deno.memoryUsage(),limits:'Local Deno; no hosted CPU guarantee. Without context snapshot stops after parsing. With snapshot stops before any write; not an authorized production session.'},null,2));
