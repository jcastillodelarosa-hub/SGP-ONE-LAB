// Separate candidate endpoint. NEVER deploy this as opt-import or replace v6.
import {RETAIL_SOURCE_SHA256 as extractor} from './source-id.generated.ts';
import {DOMParser} from 'npm:@xmldom/xmldom@0.9.12';
import {SaxesParser} from 'npm:saxes@6.0.0';
import {PostgrestClient} from 'npm:@supabase/postgrest-js@2.76.1';
import {createWorksheetXMLReader} from '../../../src/server/opt-worksheet-stream.js';
import {createOptImportHandler} from '../../../src/server/opt-import-handler.js';
import {retailDocumentPlans} from '../../../src/server/opt-retail-geometry-contract.js';
import {powerBIOrigins} from '../../../src/server/lp-powerbi-origins.js';
import {readOptPdf} from '../opt-import/pdf-runtime.ts';
const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if(!url||!key||!extractor||!/^[a-f0-9]{64}$/.test(extractor))throw Error('OPT_RETAIL_CONFIG_REQUIRED');
const client=new PostgrestClient(url.replace(/\/$/,'')+'/rest/v1',{schema:'public',headers:{apikey:key,Authorization:`Bearer ${key}`}});
const allowed=new Set(['sgp_sesion_actual','sgp_mis_accesos','sgp_opt_import_contexto_retail_v3','sgp_opt_importar_retail_validado_v3']);
Deno.serve(createOptImportHandler({retailV3:true,retailOnly:true,DOMParser,readWorksheetXML:createWorksheetXMLReader(SaxesParser),readPdf:readOptPdf,allowedOrigins:powerBIOrigins(Deno.env.get('SGP_OPT_ALLOWED_ORIGINS')),serializeRetailPlans:(extraction:any,manifest:any)=>retailDocumentPlans(extraction,manifest,extractor),rpc:(name:string,args:object)=>{if(!allowed.has(name))throw Error('OPT_RETAIL_RPC_DENIED');return client.rpc(name,args);}}));
