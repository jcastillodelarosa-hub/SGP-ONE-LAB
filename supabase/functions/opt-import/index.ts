// Private credentials never leave the server. Platform JWT + SGP are independent gates.
import {DOMParser} from 'npm:@xmldom/xmldom@0.9.12';
import {PostgrestClient} from 'npm:@supabase/postgrest-js@2.76.1';
import {createOptImportHandler} from '../../../src/server/opt-import-handler.js';
import {powerBIOrigins} from '../../../src/server/lp-powerbi-origins.js';
import {readOptPdf} from './pdf-runtime.ts';
const url=Deno.env.get('SUPABASE_URL');
const serverKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if(!url||!serverKey)throw Error('Configuración servidor OPT incompleta');
const allowedOrigins=powerBIOrigins(Deno.env.get('SGP_OPT_ALLOWED_ORIGINS'));
const client=new PostgrestClient(url.replace(/\/$/,'')+'/rest/v1',{schema:'public',headers:{apikey:serverKey,Authorization:`Bearer ${serverKey}`}});
const allowedRPC=new Set(['sgp_sesion_actual','sgp_mis_accesos','sgp_opt_import_contexto_v1','sgp_opt_importar_validado_v1']);
Deno.serve(createOptImportHandler({DOMParser,readPdf:readOptPdf,allowedOrigins,rpc:(name:string,args:object)=>{
 if(!allowedRPC.has(name))throw Error('RPC servidor OPT no permitida');
 return client.rpc(name,args);
}}));
