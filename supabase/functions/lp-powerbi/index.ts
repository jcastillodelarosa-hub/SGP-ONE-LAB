// Source proposal only. Deployment and secrets configuration require authorization.
import {DOMParser} from 'npm:@xmldom/xmldom@0.9.12';
import {createClient} from 'npm:@supabase/supabase-js@2.76.1';
import {createPowerBIHandler} from '../../../src/server/lp-powerbi-handler.js';
const url=Deno.env.get('SUPABASE_URL');
const serverKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const origins=(Deno.env.get('SGP_LP_ALLOWED_ORIGINS')||'').split(',').map(x=>x.trim()).filter(Boolean);
if(!url||!serverKey||!origins.length)throw Error('Configuración servidor LP incompleta');
// Only session read and the protected import RPC are used. No direct table writes.
const client=createClient(url,serverKey,{auth:{persistSession:false,autoRefreshToken:false}});
Deno.serve(createPowerBIHandler({DOMParser,rpc:(name:string,args:object)=>client.rpc(name,args),allowedOrigins:origins}));
