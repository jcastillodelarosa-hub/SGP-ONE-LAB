import {parseIndex,parseIndexWorkbook} from '../domain/opt-index-file.js';
import {documentProduction} from '../../opt-digital/individual-reconciliation.js';
import {validateOptImportManifest} from '../../functions/opt-import-manifest-core.mjs';

export const OPT_IMPORT_LIMITS=Object.freeze({pdfBytes:1024*1024,indexBytes:1024*1024,requestBytes:3*1024*1024});
const CONTRACT='OPT-IMPORT-1', WRITE_ROLES=['ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO'];
const ACCESS=['mecanizado','mecanizado.proceso','mecanizado.produccion'];
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const exactKeys=(v,keys,optional=[])=>record(v)&&keys.every(k=>Object.hasOwn(v,k))&&Object.keys(v).every(k=>keys.includes(k)||optional.includes(k));
const text=(v,max=255)=>typeof v==='string'&&v.trim()===v&&v.length>0&&v.length<=max&&!/[\u0000-\u001f\u007f]/.test(v);
const fail=(code,message=code,status=422)=>{throw Object.assign(new Error(message),{code,status});};
const HEX=Array.from({length:256},(_,i)=>i.toString(16).padStart(2,'0'));
const hex=bytes=>{const chunks=[];for(let offset=0;offset<bytes.length;offset+=4096){let chunk='';for(let i=offset;i<Math.min(offset+4096,bytes.length);i++)chunk+=HEX[bytes[i]];chunks.push(chunk);}return chunks.join('');};
const sha256=async bytes=>hex(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)));
const utf8=new TextDecoder('utf-8',{fatal:true});
function scopeValid(scope){return exactKeys(scope,['linea','anio','semana','modo'])&&scope.linea==='PANELES_2'&&scope.modo==='BASE'&&Number.isSafeInteger(scope.anio)&&scope.anio>=2020&&scope.anio<=2100&&Number.isSafeInteger(scope.semana)&&scope.semana>=1&&scope.semana<=53;}
async function bodyJSON(request){
 const length=request.headers.get('content-length');if(length&&(!/^\d+$/.test(length)||Number(length)>OPT_IMPORT_LIMITS.requestBytes))fail('OPT_REQUEST_LIMIT','Solicitud mayor a 3 MiB',413);
 const reader=request.body?.getReader();if(!reader)fail('OPT_REQUEST_INVALID','Solicitud vacía');
 let size=0;const parts=[];try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>OPT_IMPORT_LIMITS.requestBytes)fail('OPT_REQUEST_LIMIT','Solicitud mayor a 3 MiB',413);parts.push(value);}}finally{await reader.cancel().catch(()=>{});}
 const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
 try{return JSON.parse(utf8.decode(bytes));}catch{fail('OPT_REQUEST_INVALID','JSON inválido');}
}
function decodeFile(file,kind){
 const limit=OPT_IMPORT_LIMITS[kind==='PDF'?'pdfBytes':'indexBytes'];
 if(!record(file)||!text(file.name)||typeof file.base64!=='string'||!file.base64.length||file.base64.length>4*Math.ceil(limit/3)||file.base64.length%4||!/^[A-Za-z0-9+/]*={0,2}$/.test(file.base64))fail(`OPT_${kind}_INVALID`,`${kind} inválido o mayor del límite`);
 let binary;try{binary=atob(file.base64);}catch{fail(`OPT_${kind}_INVALID`);}
 if(!binary.length||binary.length>limit||btoa(binary)!==file.base64)fail(`OPT_${kind}_INVALID`);
 const bytes=new Uint8Array(binary.length);
 for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
 if(kind==='PDF'&&(!/\.pdf$/i.test(file.name)||utf8.decode(bytes.subarray(0,5))!=='%PDF-'))fail('OPT_PDF_INVALID','Se requiere un PDF original');
 return bytes;
}
function checkRequest(body){
 if(!exactKeys(body,['p_token','scope','source','pdf'],['index']))fail('OPT_REQUEST_FIELDS','Campos de solicitud no permitidos');
 if(!text(body.p_token,4096)||!scopeValid(body.scope))fail('OPT_REQUEST_INVALID','Sesión o ámbito inválido');
 const s=body.source;if(!exactKeys(s,['origin','opt','mode'])||!['RETAIL','PROYECTO','DESCONOCIDO'].includes(s.origin)||!['INDICE','INDIVIDUAL'].includes(s.mode)||!text(s.opt))fail('OPT_SOURCE_INVALID','Origen, OPT o modalidad inválidos');
 if(!exactKeys(body.pdf,['name','base64']))fail('OPT_PDF_INVALID');
 if(s.mode==='INDICE'){
  if(s.origin==='DESCONOCIDO'||!exactKeys(body.index,['name','base64','format'],['sheet'])||!['xlsx','csv','json'].includes(body.index.format)||!text(body.index.name)||!body.index.name.toLowerCase().endsWith('.'+body.index.format)||(body.index.sheet!==undefined&&!text(body.index.sheet,80)))fail('OPT_INDEX_INVALID','Índice original y hoja requeridos');
 }else if(Object.hasOwn(body,'index'))fail('OPT_INDEX_UNEXPECTED','La modalidad individual no recibe índice');
}
function sqlError(error){
 const message=String(error?.message||'');
 const code=message.match(/\b(OPT_[A-Z0-9_]+)\b/)?.[1];
 if(code)return {code,error:code,status:code==='OPT_NO_AUTORIZADO'?403:code==='OPT_NO_HABILITADO'?409:422};
 return {code:'OPT_RPC_REJECTED',error:'El servidor rechazó la importación',status:422};
}
function receiptValid(receipt,manifest){return record(receipt)&&receipt.ok===true&&receipt.import_contract===CONTRACT&&receipt.contract_version===2&&receipt.physical_completion_verified===false&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(receipt.id_documento)&&typeof receipt.duplicado==='boolean'&&receipt.cantidad_piezas===manifest.pieces.length&&receipt.sin_asignacion===manifest.scopeTotals.outsideScope;}

/** Only server bootstrap supplies dependencies. Neither extraction nor SGP facts
 * are ever accepted from the caller. SQL remains the final authorization gate. */
export function createOptImportHandler({rpc,readPdf,DOMParser,allowedOrigins}){
 if(typeof rpc!=='function'||typeof readPdf!=='function'||!Array.isArray(allowedOrigins)||!allowedOrigins.length)throw Error('OPT_SERVER_DEPENDENCIES_REQUIRED');
 const origins=new Set(allowedOrigins);let busy=false;
 return async request=>{
  const origin=request.headers.get('origin'),headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
  const send=(status,data)=>new Response(JSON.stringify({contract:CONTRACT,...data}),{status,headers});
  const reject=(status,code,error=code,extra={})=>send(status,{ok:false,code,error,definitive:true,...extra});
  if(origin&&!origins.has(origin))return reject(403,'OPT_ORIGIN_DENIED','Origen no permitido');
  if(origin)headers['Access-Control-Allow-Origin']=origin;
  if(request.method==='OPTIONS'){headers['Access-Control-Allow-Methods']='POST, OPTIONS';headers['Access-Control-Allow-Headers']='content-type, apikey, authorization';return new Response(null,{status:204,headers});}
  if(request.method!=='POST')return reject(405,'OPT_METHOD_DENIED','Método no permitido');
  if(busy)return reject(429,'OPT_IMPORT_BUSY','Hay otra importación en curso. Reintenta este mismo documento.');
  busy=true;let writeAttempted=false;
  try{
   if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||''))fail('OPT_JSON_REQUIRED','Se requiere JSON',415);
   const body=await bodyJSON(request);checkRequest(body);
   const auth=await rpc('sgp_sesion_actual',{p_token:body.p_token});
   if(auth.error)return reject(503,'SGP_SESSION_UNAVAILABLE','No se pudo comprobar la sesión SGP');
   if(auth.data?.valida!==true)return reject(401,'SGP_SESSION_INVALID','Sesión SGP inválida');
   if(!WRITE_ROLES.includes(auth.data.rol))return reject(403,'SGP_ROLE_DENIED','Rol SGP no autorizado');
   const access=await rpc('sgp_mis_accesos',{p_token:body.p_token});
   if(access.error||!Array.isArray(access.data))return reject(503,'SGP_ACCESS_UNAVAILABLE','No se pudo comprobar el acceso SGP');
   if(!access.data.some(row=>ACCESS.includes(row?.ventana)))return reject(403,'SGP_ACCESS_DENIED','Sin acceso a Mecanizado');
   const bytes=decodeFile(body.pdf,'PDF'),hash=await sha256(bytes);
   let indexEntries=[],indexHash=null,indexSheet=null;
   if(body.index){
    const raw=decodeFile(body.index,'INDEX');indexHash=await sha256(raw);
    if(body.index.format==='xlsx'){const parsed=await parseIndexWorkbook(raw,body.source.origin,{sheetName:body.index.sheet,DOMParser});indexEntries=parsed.entries;indexSheet=parsed.sheet;}
    else indexEntries=parseIndex(utf8.decode(raw),body.index.format,body.source.origin);
   }
   const extraction=await readPdf(bytes);
   const rows=extraction?.sourceProjectRows;
   if(!Array.isArray(rows)||!rows.length)fail('FINAL_DETAIL_OR_EXTRACTION_MISSING','El PDF no contiene el detalle final completo');
   const ids=[...new Set(rows.map(row=>row?.sourceDocumentId))];
   if(ids.length!==1||!text(ids[0]))fail('OPT_DOCUMENT_ID_UNRESOLVED','El encabezado OPT del PDF está ausente o es ambiguo');
   const opt=ids[0];
   if(body.source.mode==='INDICE'&&opt!==body.source.opt)fail('OPT_DOCUMENT_ID_MISMATCH','El encabezado del PDF no coincide con la OPT del índice');
   const document={sha256:hash,sourceKey:body.source.mode==='INDICE'?`OPT:${encodeURIComponent(opt)}`:`SHA256:${hash}`,origin:body.source.origin,opt,mode:body.source.mode};
   const productions=[...new Set(rows.map(row=>documentProduction(row.reference)))];
   if(productions.some(id=>typeof id!=='string'||!/^\d{1,30}$/.test(id))||productions.length>1000)fail('OPT_DOCUMENT_PRODUCTION_UNRESOLVED','Referencias documentales sin una producción única');
   const contextResult=await rpc('sgp_opt_import_contexto_v1',{p_token:body.p_token,p_scope:body.scope,p_producciones:productions});
   if(contextResult.error){const error=sqlError(contextResult.error);return reject(error.status,error.code,error.error);}
   const context=contextResult.data;
   if(context?.contract!=='OPT-IMPORT-CONTEXT-1'||!text(context.revision,128)||!scopeEqual(context.scope,body.scope)||!Array.isArray(context.bindings)||context.bindings.length>20000||!context.bindings.every(record))fail('OPT_CONTEXT_INVALID','Respuesta de contexto SGP incompatible',503);
   if(rows.length*context.bindings.length>2000000)fail('OPT_CONTEXT_COMPLEXITY_LIMIT','El cruce documental excede el límite de procesamiento');
   let indexRows;
   const common={pdfSha256:hash,sourceKey:document.sourceKey,origin:document.origin,opt};
   if(document.mode==='INDICE'){
    indexRows=indexEntries.filter(row=>row.opt===opt).map(row=>({...common,rowId:`index-${row.sourceRow}`,reservation:row.reservation,system:row.system}));
   }else{
    // Documentary production IDs join to ALL real SGP destinations. Preserve
    // competing reservations/programs for the validator instead of choosing one.
    indexRows=rows.flatMap(row=>context.bindings.filter(binding=>binding.documentProduction===documentProduction(row.reference)).map((binding,i)=>({...common,rowId:`individual-${row.sourceId}-${i}`,sourceRowId:row.sourceId,reference:row.reference,documentProduction:binding.documentProduction,reservation:binding.reserva,system:binding.sistema})));
   }
   if(rows.length*indexRows.length>2000000)fail('OPT_INDEX_COMPLEXITY_LIMIT','El índice seleccionado excede el límite de procesamiento');
   const server={schema:'sgp.opt.server-evidence.v1',revision:context.revision,scope:body.scope,pdfSha256:hash,bindings:context.bindings,indexRows};
   const result=validateOptImportManifest({document,extraction},server);
   if(!result.importable)return reject(422,'OPT_DOCUMENT_BLOCKED','El documento no supera la conciliación completa',{blockers:result.blockers.slice(0,100).map(blocker=>({...blocker,...(Array.isArray(blocker.candidates)?{candidates:blocker.candidates.slice(0,20),candidate_count:blocker.candidates.length}:{}),...(Array.isArray(blocker.issues)?{issues:blocker.issues.slice(0,100),issue_count:blocker.issues.length}:{})})),blocker_count:result.blockers.length});
   const manifest=result.manifest;
   const evidence={contract:'OPT-SERVER-VALIDATION-1',algorithm:'opt-import-manifest-v1',pdf_sha256:hash,validation:'DOCUMENTARY_MANIFEST_READY',physical_completion_verified:false,
    sgp_binding:{contract:context.contract,scope:body.scope,revision:context.revision,producciones:productions},
    original_index:body.index?{sha256:indexHash,name:body.index.name,format:body.index.format,sheet:indexSheet}:null};
   // PostgreSQL bytea hex notation is used only inside the private server call.
   // It is never put in a browser config or returned to the client.
   const args={p_token:body.p_token,p_pdf:'\\x'+hex(bytes),p_manifest:manifest.pieces,p_sources:[manifest.source],p_evidence:evidence};
   writeAttempted=true;
   const imported=await rpc('sgp_opt_importar_validado_v1',args);
   if(imported.error){
    if(imported.error.code==='P0001'){const error=sqlError(imported.error);return reject(error.status,error.code,error.error);}
    return reject(503,'OPT_IMPORT_OUTCOME_UNKNOWN','No se pudo confirmar el resultado. Reintenta el mismo PDF y el mismo índice.',{definitive:false});
   }
   if(!receiptValid(imported.data,manifest))return reject(503,'OPT_IMPORT_OUTCOME_UNKNOWN','Respuesta de registro incompatible. Conserva y reintenta los mismos archivos.',{definitive:false});
   return send(200,{ok:true,data:imported.data,document:{sha256:hash,source_key:document.sourceKey,origin:document.origin,opt,mode:document.mode},scope:body.scope,totals:manifest.totals,scopeTotals:manifest.scopeTotals,physical_completion_verified:false});
  }catch(error){
   if(writeAttempted)return reject(503,'OPT_IMPORT_OUTCOME_UNKNOWN','No se pudo confirmar el resultado. Reintenta los mismos archivos.',{definitive:false});
   return reject(error.status||422,error.code||'OPT_INPUT_INVALID',String(error.message||'No se pudo validar el documento').slice(0,500));
  }finally{busy=false;}
 };
}
function scopeEqual(a,b){return scopeValid(a)&&['linea','anio','semana','modo'].every(k=>a[k]===b[k]);}
