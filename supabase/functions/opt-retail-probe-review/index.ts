// REVIEW ONLY: new function in OPT-SANDBOX; never replace opt-import.
import {retailDocumentPlans} from '../../../src/server/opt-retail-geometry-contract.js';
import {PostgrestClient} from 'npm:@supabase/postgrest-js@2.76.1';
import {DOMParser} from 'npm:@xmldom/xmldom@0.9.12';
import {SaxesParser} from 'npm:saxes@6.0.0';
import {createWorksheetXMLReader} from '../../../src/server/opt-worksheet-stream.js';
import {createOptImportProbe} from '../../../src/server/opt-import-probe.js';
import {readOptPdf} from '../opt-import/pdf-runtime.ts';
const secret=Deno.env.get('OPT_PROBE_SECRET');
// No database client or service-role key. Dependencies load before runtime network prohibition.
globalThis.fetch=(()=>{throw Error('PROBE_NETWORK_DENIED');}) as typeof fetch;
const wrapRpc=(rpc:any)=>{const client=new PostgrestClient('https://offline.invalid/rest/v1',{fetch:async(input:any,init:any)=>{const name=new URL(String(input)).pathname.split('/').at(-1),result=await rpc(name,JSON.parse(init.body));return new Response(JSON.stringify(result.data),{status:200,headers:{'content-type':'application/json'}});}});return (name:string,args:any)=>client.rpc(name,args);};
Deno.serve(createOptImportProbe({secret,wrapRpc,serializeRetailPlans:(extraction:any,manifest:any)=>retailDocumentPlans(extraction,manifest,'a'.repeat(64)),DOMParser,readPdf:readOptPdf,readWorksheetXML:createWorksheetXMLReader(SaxesParser)}));
