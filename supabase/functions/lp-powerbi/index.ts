// Deployment is controlled; SGP session and scope validation remain in protected SQL.
import {DOMParser} from 'npm:@xmldom/xmldom@0.9.12';
import {createClient} from 'npm:@supabase/supabase-js@2.76.1';
import {createPowerBIHandler} from '../../../src/server/lp-powerbi-handler.js';
import {powerBIExportMode} from '../../../src/server/lp-powerbi-export-mode.js';
import {powerBIOrigins} from '../../../src/server/lp-powerbi-origins.js';
const url=Deno.env.get('SUPABASE_URL');
const serverKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const origins=powerBIOrigins(Deno.env.get('SGP_LP_ALLOWED_ORIGINS'));
if(!url||!serverKey||!origins.length)throw Error('Configuración servidor LP incompleta');
// Platform verify_jwt=true is additional to the SGP session, never its replacement.
// Only session read and the protected import RPC are used. No direct table writes.
const client=createClient(url,serverKey,{auth:{persistSession:false,autoRefreshToken:false}});
const allowedRPC=new Set(['sgp_sesion_actual','sgp_lp_operacion_importar_xlsx']);
Deno.serve(createPowerBIHandler({DOMParser,rpc:(name:string,args:object)=>{
 if(!allowedRPC.has(name))throw Error('RPC servidor LP no permitida');
 return client.rpc(name,args);
},allowedOrigins:origins,...powerBIExportMode(Deno.env.get('SGP_LP_EXPORT_MODE'))}));
