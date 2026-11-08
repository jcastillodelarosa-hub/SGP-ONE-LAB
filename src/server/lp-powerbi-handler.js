import {parsePowerBI,POWERBI_VERSION} from '../domain/powerbi/adapter.js';
const MAX_REQUEST=3*1024*1024;
async function bodyJSON(request){const reader=request.body?.getReader();if(!reader)throw Error('Solicitud vacía');let n=0,parts=[];try{for(;;){const {done,value}=await reader.read();if(done)break;n+=value.length;if(n>MAX_REQUEST)throw Error('Solicitud mayor del límite');parts.push(value);}}finally{await reader.cancel().catch(()=>{});}const bytes=new Uint8Array(n);let p=0;for(const value of parts){bytes.set(value,p);p+=value.length;}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}
/** rpc must use a server-only credential; the SQL RPC still validates SGP session + scopes. */
export function createPowerBIHandler({rpc,DOMParser,allowedOrigins,exportProductionV2=false,exportWriterScope=null}){
 const origins=new Set(allowedOrigins);
 return async request=>{
  const origin=request.headers.get('origin');const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
  if(origin&&!origins.has(origin))return new Response(JSON.stringify({error:'Origen no permitido'}),{status:403,headers});
  if(origin)headers['Access-Control-Allow-Origin']=origin;
  if(request.method==='OPTIONS'){headers['Access-Control-Allow-Methods']='POST, OPTIONS';headers['Access-Control-Allow-Headers']='content-type, apikey, authorization';return new Response(null,{status:204,headers});}
  if(request.method!=='POST')return new Response(JSON.stringify({error:'Método no permitido'}),{status:405,headers});
  try{
   if(!request.headers.get('content-type')?.startsWith('application/json'))throw Error('Se requiere JSON');const b=await bodyJSON(request);
   if(!b||Object.keys(b).some(k=>!['p_token','command','filename','base64'].includes(k)))throw Error('Campos de solicitud no permitidos');
   if(typeof b.p_token!=='string'||!b.p_token||b.p_token.length>4096||typeof b.base64!=='string'||b.base64.length>2800000||!b.base64||b.base64.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(b.base64))throw Error('Sesión o archivo inválido');
   if(typeof b.filename!=='string'||b.filename.length>255||!/^.+\.xlsx$/i.test(b.filename))throw Error('Se requiere archivo XLSX');
   const c=b.command;if(!c||typeof c!=='object'||Array.isArray(c)||Object.keys(c).some(k=>!['id','stage','line','date','shift','revision','authority'].includes(k))||!['ENSAMBLE','EMPAQUE'].includes(c.stage)||!['PANELES_2','FRAMES_2'].includes(c.line)||!Number.isInteger(c.shift)||![1,2].includes(c.shift)||!Number.isSafeInteger(c.revision)||c.revision<0||typeof c.id!=='string'||!/^[a-f0-9-]{36}$/i.test(c.id)||typeof c.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(c.date))throw Error('Contexto de cierre inválido');
   // Opt-in adapter candidate only. The deployed Deno entry point never sets it.
   const v2=Object.hasOwn(c,'authority');
   if(v2&&(exportProductionV2!==true||c.authority!=='EXPORT_PRODUCTION_V2'||(c.stage!=='ENSAMBLE'&&!(exportWriterScope==='LP-EXPORT-DUAL-1'&&c.stage==='EMPAQUE'))||c.line!=='PANELES_2'))throw Error('Autoridad Export V2 no habilitada');
   const auth=await rpc('sgp_sesion_actual',{p_token:b.p_token});
   if(auth.error)return new Response(JSON.stringify({error:'No se pudo comprobar la sesión SGP',code:'SGP_SESSION_UNAVAILABLE'}),{status:503,headers});
   if(auth.data?.valida!==true)return new Response(JSON.stringify({error:'Sesión SGP inválida',code:'SGP_SESSION_INVALID'}),{status:401,headers});
   if(!['LIDER','LIDER LINEA','COORDINADOR','ADMINISTRADOR','SUPERVISOR ENSAMBLE','SUPERVISOR EMPAQUE'].includes(auth.data.rol))return new Response(JSON.stringify({error:'Rol SGP no autorizado',code:'SGP_ROLE_DENIED'}),{status:403,headers});
   const raw=Uint8Array.from(atob(b.base64),ch=>ch.charCodeAt(0)),parsed=await parsePowerBI(raw,{DOMParser});if(parsed.stage!==c.stage)throw Error('El archivo corresponde a otra etapa');
   // Client totals and normalized rows are never trusted; parse and hash the original again.
   const {data,error}=await rpc('sgp_lp_operacion_importar_xlsx',{p_token:b.p_token,p_contexto:c,p_nombre:b.filename,p_base64:b.base64,p_documento:parsed});if(error)return new Response(JSON.stringify({error:error.message||'Importación rechazada',code:error.code||'PBI_RPC_REJECTED'}),{status:422,headers});
   if(data?.ok!==true||(v2&&(data.authority!=='EXPORT_PRODUCTION_V2'||data.contract!=='LP-EXPORT-IMPORT-3'||(exportWriterScope==='LP-EXPORT-DUAL-1'&&!['LP-EXPORT-DUAL-1','LP-EXPORT-HISTORICAL-1'].includes(data.writerScope)))))throw Error('Respuesta de importación incompatible');return new Response(JSON.stringify({data,adapter:POWERBI_VERSION}),{status:200,headers});
  }catch(error){return new Response(JSON.stringify({error:error.message||'No se pudo validar XLSX',code:'PBI_INPUT_INVALID'}),{status:422,headers});}
 };
}
