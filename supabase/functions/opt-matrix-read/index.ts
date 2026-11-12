import {PostgrestClient} from 'npm:@supabase/postgrest-js@2.76.1';
import {createOptMatrixHandler} from '../../../src/server/opt-matrix-handler.js';
import {powerBIOrigins} from '../../../src/server/lp-powerbi-origins.js';
const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if(!url||!key)throw Error('Configuración servidor matrices incompleta');
const base=url.replace(/\/$/,'');
const headers={apikey:key,Authorization:`Bearer ${key}`};
const client=new PostgrestClient(base+'/rest/v1',{schema:'public',headers});
Deno.serve(createOptMatrixHandler({
 allowedOrigins:powerBIOrigins(Deno.env.get('SGP_OPT_ALLOWED_ORIGINS')),
 rpc:(name:string,args:object)=>{
  if(name!=='sgp_opt_matriz_resolver_v1')throw Error('RPC no permitida');
  return client.rpc(name,args);
 },
 download:async(bucket:string,path:string,limit:number)=>{
  if(bucket!=='opt-matrices-private'||!/^images\/[a-f0-9]{64}\.png$/.test(path))throw Error('Objeto no permitido');
  const response=await fetch(base+'/storage/v1/object/authenticated/'+bucket+'/'+path,{headers,redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!response.ok||response.headers.get('content-type')?.split(';')[0]!=='image/png')throw Error('Imagen no disponible');
  const length=response.headers.get('content-length');if(length&&(!/^\d+$/.test(length)||Number(length)>limit))throw Error('Imagen demasiado grande');
  const reader=response.body?.getReader();if(!reader)throw Error('Imagen vacía');let size=0;const chunks:Uint8Array[]=[];
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit)throw Error('Imagen demasiado grande');chunks.push(value);}}
  finally{await reader.cancel().catch(()=>{});}
  const out=new Uint8Array(size);let offset=0;for(const chunk of chunks){out.set(chunk,offset);offset+=chunk.length;}return out;
 }
}));
