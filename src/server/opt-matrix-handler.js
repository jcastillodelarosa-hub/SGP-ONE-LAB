// Private matrix lookup. No client-controlled paths, URLs, role claims or writes.
export const MATRIX_CONTRACT='OPT-MATRIX-1';
export const MATRIX_IMAGE_LIMIT=4*1024*1024;
const HASH=/^[a-f0-9]{64}$/;
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const text=(v,max)=>typeof v==='string'&&v===v.trim()&&v.length>0&&v.length<=max&&!/[\u0000-\u001f\u007f]/.test(v);
const failure=(code,status=422)=>Object.assign(new Error(code),{code,status});
const hex=bytes=>Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
async function readJSON(request){
 const max=8192,header=request.headers.get('content-length');
 if(header&&(!/^\d+$/.test(header)||Number(header)>max))throw failure('MATRIX_REQUEST_LIMIT',413);
 const reader=request.body?.getReader();if(!reader)throw failure('MATRIX_REQUEST_INVALID');
 let size=0;const chunks=[];
 try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>max)throw failure('MATRIX_REQUEST_LIMIT',413);chunks.push(value);}}
 finally{await reader.cancel().catch(()=>{});}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw failure('MATRIX_REQUEST_INVALID');}
}
function base64(bytes){let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(binary);}
function validAsset(m){return plain(m)&&UUID.test(m.id)&&text(m.revision,100)&&Number.isSafeInteger(m.page)&&m.page>0&&m.page<=10000&&HASH.test(m.sourceSha256)&&HASH.test(m.imageSha256)&&m.mimeType==='image/png'&&Number.isSafeInteger(m.byteLength)&&m.byteLength>24&&m.byteLength<=MATRIX_IMAGE_LIMIT&&m.bucket==='opt-matrices-private'&&m.objectPath===`images/${m.imageSha256}.png`;}
export function createOptMatrixHandler({rpc,download,allowedOrigins}){
 if(typeof rpc!=='function'||typeof download!=='function'||!Array.isArray(allowedOrigins)||!allowedOrigins.length)throw Error('MATRIX_DEPENDENCIES_REQUIRED');
 const origins=new Set(allowedOrigins);
 return async request=>{
  const origin=request.headers.get('origin'),headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff'};
  const send=(status,data)=>new Response(JSON.stringify({contract:MATRIX_CONTRACT,...data}),{status,headers});
  const reject=(status,code)=>send(status,{ok:false,code});
  if(origin&&!origins.has(origin))return reject(403,'MATRIX_ORIGIN_DENIED');
  if(origin)headers['Access-Control-Allow-Origin']=origin;
  if(request.method==='OPTIONS'){headers['Access-Control-Allow-Methods']='POST, OPTIONS';headers['Access-Control-Allow-Headers']='content-type, apikey, authorization';return new Response(null,{status:204,headers});}
  if(request.method!=='POST')return reject(405,'MATRIX_METHOD_DENIED');
  try{
   if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||''))throw failure('MATRIX_JSON_REQUIRED',415);
   const body=await readJSON(request);
   if(!plain(body)||Object.keys(body).length!==3||!text(body.p_token,4096)||!text(body.sistema,100)||!text(body.referencia,100))throw failure('MATRIX_REQUEST_INVALID');
   // This service-only RPC validates the live SGP/OPT role, module access and feature gates.
   const result=await rpc('sgp_opt_matriz_resolver_v1',{p_token:body.p_token,p_sistema:body.sistema,p_referencia:body.referencia});
   if(result.error){
    const code=String(result.error.message||'').match(/\b(?:OPT|MATRIX)_[A-Z0-9_]+\b/)?.[0];
    if(code==='OPT_NO_AUTORIZADO')return reject(403,code);
    if(code==='OPT_NO_HABILITADO'||code==='MATRIX_NO_HABILITADO')return reject(409,code);
    return reject(503,'MATRIX_LOOKUP_UNAVAILABLE');
   }
   const data=result.data;
   if(!plain(data)||data.contract!==MATRIX_CONTRACT||data.sistema!==body.sistema||data.referencia!==body.referencia||!['available','unavailable','ambiguous'].includes(data.status))throw failure('MATRIX_RESPONSE_INVALID',503);
   if(data.status!=='available'){
    if(data.matrix!==null)throw failure('MATRIX_RESPONSE_INVALID',503);
    return send(200,{ok:true,status:data.status,sistema:body.sistema,referencia:body.referencia,matrix:null});
   }
   const m=data.matrix;if(!validAsset(m))throw failure('MATRIX_RESPONSE_INVALID',503);
   const bytes=await download(m.bucket,m.objectPath,MATRIX_IMAGE_LIMIT);
   if(!(bytes instanceof Uint8Array)||bytes.length!==m.byteLength||bytes.length>MATRIX_IMAGE_LIMIT||![137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)||new TextDecoder().decode(bytes.subarray(12,16))!=='IHDR')throw failure('MATRIX_IMAGE_INVALID',503);
   const hash=hex(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)));
   if(hash!==m.imageSha256)throw failure('MATRIX_IMAGE_HASH_MISMATCH',503);
   // Explicit projection: storage keys, paths, source locations and any internal fields never leave.
   return send(200,{ok:true,status:'available',sistema:body.sistema,referencia:body.referencia,matrix:{id:m.id,revision:m.revision,page:m.page,sourceSha256:m.sourceSha256,imageSha256:m.imageSha256,mimeType:'image/png',imageBase64:base64(bytes)}});
  }catch(error){return reject(error?.status||503,error?.code||'MATRIX_READ_UNAVAILABLE');}
 };
}
