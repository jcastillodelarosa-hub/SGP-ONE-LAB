import {validateOptResolution} from './opt-import-resolution.js';
import {sameOptImportIdentity} from './opt-import-observation.js';
// Only original bytes cross this boundary. Client extraction and associations are not authority.
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const exact=(value,fields)=>object(value)&&Object.keys(value).sort().join()===fields.split(',').sort().join();
const sha=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const scopeValid=s=>exact(s,'linea,anio,semana,modo')&&s.linea==='PANELES_2'&&s.modo==='BASE'&&Number.isInteger(s.anio)&&s.anio>=2020&&s.anio<=2100&&Number.isInteger(s.semana)&&s.semana>=1&&s.semana<=53;
const scopeKey=s=>JSON.stringify([s?.linea,s?.anio,s?.semana,s?.modo]);
const fault=(message,details={})=>Object.assign(Error(message),details);
async function hash(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');}
function base64(bytes){let text='';for(let offset=0;offset<bytes.length;offset+=32768)text+=String.fromCharCode(...bytes.subarray(offset,offset+32768));return btoa(text);}
async function original(file,max){
 if(!file||typeof file.name!=='string'||!file.name.trim()||file.name.length>255||typeof file.arrayBuffer!=='function'||!Number.isSafeInteger(file.size)||file.size<=0||file.size>max)throw fault('OPT_ARCHIVO_ORIGINAL_INVALIDO',{definitive:true});
 const bytes=new Uint8Array(await file.arrayBuffer());if(bytes.length!==file.size)throw fault('OPT_ARCHIVO_CAMBIO',{definitive:true});
 return {name:file.name,base64:base64(bytes),hash:await hash(bytes)};
}
export async function prepareOptImport({scope,source,pdf,index}){
 if(!scopeValid(scope)||!exact(source,'origin,opt,mode')||typeof source.opt!=='string'||!source.opt.trim()||source.opt.length>200||!['INDICE','INDIVIDUAL'].includes(source.mode)||!['RETAIL','PROYECTO','DESCONOCIDO'].includes(source.origin)||source.mode==='INDIVIDUAL'&&source.origin!=='DESCONOCIDO'||source.mode==='INDICE'&&source.origin==='DESCONOCIDO')throw fault('OPT_IMPORTACION_PARAMETROS_INVALIDOS',{definitive:true});
 if(!/\.pdf$/i.test(pdf?.name||'')||pdf.name.replace(/\.pdf$/i,'')!==source.opt)throw fault('OPT_PDF_NOMBRE_EXACTO_REQUERIDO',{definitive:true});
 if(pdf.size>1024*1024)throw fault('PDF mayor a 1 MiB. Este perfil admite como máximo 100 páginas y no divide el documento.',{definitive:true});
 const raw=await original(pdf,1024*1024),body={scope:{...scope},source:{...source},pdf:{name:raw.name,base64:raw.base64}};
 let indexHash=null;
 if(source.mode==='INDICE'){
  if(!index||!['xlsx','csv','json'].includes(index.format)||typeof index.sheet!=='string'||!index.sheet.trim())throw fault('OPT_INDICE_ORIGINAL_REQUERIDO',{definitive:true});
  if(index.file?.size>3*1024*1024)throw fault('Índice mayor a 3 MiB',{definitive:true});
  const data=await original(index.file,3*1024*1024);indexHash=data.hash;body.index={name:data.name,base64:data.base64,format:index.format,sheet:index.sheet};
 }else if(index)throw fault('OPT_INDIVIDUAL_NO_ADMITE_INDICE',{definitive:true});
 const identity={scope:body.scope,source:body.source,pdf:{name:raw.name,sha256:raw.hash},index:body.index?{name:body.index.name,sha256:indexHash,format:body.index.format,sheet:body.index.sheet}:null};
 return {body,identity,requestHash:await hash(new TextEncoder().encode(JSON.stringify(identity)))};
}
function validateReceipt(value,prepared){
 const fail=()=>{throw fault('OPT_IMPORTACION_CONTRATO_INVALIDO',{uncertain:true});};
 if(!object(value)||value.contract!=='OPT-IMPORT-1'||value.ok!==true||value.physical_completion_verified!==false||!scopeValid(value.scope)||scopeKey(value.scope)!==scopeKey(prepared.body.scope))fail();
 const receipt=value.data,doc=value.document,source=prepared.body.source;
 if(!exact(receipt,'contract_version,id_documento,duplicado,cantidad_piezas,sin_asignacion,import_contract,ok,physical_completion_verified')||receipt.contract_version!==2||receipt.import_contract!=='OPT-IMPORT-1'||receipt.ok!==true||receipt.physical_completion_verified!==false||!uuid(receipt.id_documento)||typeof receipt.duplicado!=='boolean'||!Number.isSafeInteger(receipt.cantidad_piezas)||receipt.cantidad_piezas<=0||!Number.isSafeInteger(receipt.sin_asignacion)||receipt.sin_asignacion<0||receipt.sin_asignacion>receipt.cantidad_piezas)fail();
 if(!exact(doc,'sha256,source_key,origin,opt,mode')||!sha(doc.sha256)||doc.sha256!==prepared.identity.pdf.sha256||doc.source_key!==(source.mode==='INDICE'?`OPT:${encodeURIComponent(source.opt)}`:`SHA256:${doc.sha256}`)||['origin','mode'].some(k=>doc[k]!==source[k])||typeof doc.opt!=='string'||!doc.opt.trim()||source.mode==='INDICE'&&doc.opt!==source.opt)fail();
 if(!exact(value.totals,'documentaryBars,documentaryCuts,cutLength32')||!Object.values(value.totals).every(n=>Number.isSafeInteger(n)&&n>0)||value.totals.documentaryCuts!==receipt.cantidad_piezas||!exact(value.scopeTotals,'assigned,outsideScope')||!Object.values(value.scopeTotals).every(n=>Number.isSafeInteger(n)&&n>=0)||value.scopeTotals.assigned+value.scopeTotals.outsideScope!==receipt.cantidad_piezas||value.scopeTotals.outsideScope!==receipt.sin_asignacion)fail();
 return structuredClone(value);
}
export function createOptImport(client,getToken,{getContext,storage,storageScope,timeoutMs=120000,observationApi=null,resolutionApi=null}={}){
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<=0)throw Error('OPT_ESPERA_INVALIDA');
 let epoch=0,busy=false;const prefix='sgp-opt-import-v1:'+storageScope+':';
 const current=scope=>{try{return !getContext||scopeKey(getContext())===scopeKey(scope);}catch{return false;}};
 const invalidate=()=>{epoch++;};
 async function processInternal(input,resolved=false){
  if(resolved&&!resolutionApi)throw fault('OPT_RECUPERACION_PAUSADA',{definitive:true});
  if(busy)throw fault('OPT_IMPORTACION_EN_CURSO',{definitive:true});
  busy=true;const operation=epoch,token=getToken();let journal,key,wasUncertain=false,sent=false;
  try{
   if(!token)throw fault('OPT_SESION_REQUERIDA',{definitive:true});
   const prepared=await prepareOptImport(input);
   const assertCurrent=()=>{if(operation!==epoch||getToken()!==token||!current(prepared.body.scope))throw fault('OPT_IMPORTACION_OBSOLETA',{uncertain:sent,definitive:!sent});};
   assertCurrent();
   if(!storage||!storageScope)throw fault('OPT_DIARIO_NO_DISPONIBLE',{definitive:true});
   key=prefix+prepared.requestHash;
   try{
    for(let n=0;n<storage.length;n++){
     const name=storage.key(n);if(!name?.startsWith(prefix))continue;
     const saved=JSON.parse(storage.getItem(name));
     if(![1,2].includes(saved?.version)||!sha(saved.requestHash)||!sha(saved.identity?.pdf?.sha256))throw Error('diario inválido');
     if(saved.state==='pending'&&(saved.identity.pdf.sha256===prepared.identity.pdf.sha256||['origin','mode','opt'].every(field=>saved.identity.source?.[field]===prepared.identity.source[field]))&&saved.requestHash!==prepared.requestHash)throw fault('OPT_REINTENTO_IDENTICO_REQUERIDO',{definitive:true});
    }
    const saved=JSON.parse(storage.getItem(key)||'null');wasUncertain=saved?.state==='pending';
    if(wasUncertain&&!resolved)throw fault('OPT_RESOLUTION_REQUERIDA',{uncertain:true,definitive:false});
    if(resolved){
     if(!wasUncertain||!sameOptImportIdentity(saved.identity,prepared.identity)||!saved.resolution)throw fault('OPT_RESOLUTION_UNAVAILABLE',{definitive:true});
     const certificate=validateOptResolution(saved.resolution.certificate,saved.identity,saved.requestHash);
     const attemptId=saved.resolution.attemptId||crypto.randomUUID();
     if(!uuid(attemptId))throw fault('OPT_RESOLUTION_UNAVAILABLE',{definitive:true});
     journal={...saved,resolution:{...saved.resolution,attemptId},history:[...saved.history,{event:'manual_attempt',attemptId,at:new Date().toISOString()}]};
     prepared.body.resolution={identity:structuredClone(saved.identity),requestHash:saved.requestHash,decisionId:certificate.decisionId,retryGeneration:certificate.retryGeneration,attemptId};
    }else journal={...(saved||{}),version:1,state:'pending',requestHash:prepared.requestHash,identity:prepared.identity};
    storage.setItem(key,JSON.stringify(journal));if(storage.getItem(key)!==JSON.stringify(journal))throw Error('diario no verificado');
   }catch(error){if(error.message==='OPT_REINTENTO_IDENTICO_REQUERIDO'||error.message.startsWith('OPT_RESOLUTION_'))throw error;throw fault('OPT_DIARIO_NO_DISPONIBLE',{definitive:true});}
   assertCurrent();let timer;sent=true;
   const result=await Promise.race([Promise.resolve().then(()=>client.invoke({...structuredClone(prepared.body),p_token:token})),new Promise((_,reject)=>{timer=setTimeout(()=>reject(fault('OPT_IMPORTACION_TIMEOUT',{uncertain:true})),timeoutMs);})]).finally(()=>clearTimeout(timer));
   assertCurrent();
   let payload=result?.data;
   if(result?.error){
    // Supabase FunctionsHttpError carries the structured endpoint rejection in context.
    try{payload=await result.error.context?.clone().json();}catch{}
    assertCurrent();
   }
   if(payload?.contract==='OPT-IMPORT-1'&&payload.ok===false&&typeof payload.code==='string')throw fault(payload.code,{definitive:payload.definitive===true,uncertain:payload.definitive!==true,blockers:payload.blockers});
   // A platform termination has no application receipt; it cannot prove rollback.
   if(result?.error?.context?.status===546)throw fault('OPT_IMPORTACION_LIMITE_RECURSOS',{uncertain:true});
   if(result?.error)throw fault('OPT_IMPORTACION_TRANSPORTE',{uncertain:true});
   const receipt=validateReceipt(payload,prepared);assertCurrent();
   // Retain identity only, never original bytes or tokens, for an identical idempotent replay.
   storage.setItem(key,JSON.stringify({...journal,state:'confirmed'}));
   return receipt;
  }catch(error){
   if(sent&&(!error.definitive||wasUncertain)){error.uncertain=true;error.definitive=false;}
   else if(key&&journal&&!wasUncertain){try{storage.setItem(key,JSON.stringify({...journal,state:'rejected'}));}catch{}}
   throw error;
  }finally{busy=false;}
 }
 function pending(){
  if(!storage||!storageScope)return [];
  const items=[];
  try{for(let n=0;n<storage.length;n++){const name=storage.key(n);if(!name?.startsWith(prefix))continue;const saved=JSON.parse(storage.getItem(name));if([1,2].includes(saved?.version)&&saved.state==='pending')items.push(structuredClone(saved.identity));}}catch{return null;}
  return items;
 }
 async function reconcilePending(identity){
  if(busy)throw fault('OPT_IMPORTACION_EN_CURSO',{definitive:true});
  if(!observationApi||!storage||!storageScope)throw fault('OPT_OBSERVACION_NO_DISPONIBLE');
  const token=getToken(),operation=epoch;if(!token||!current(identity?.scope))throw fault('OPT_SESION_REQUERIDA');
  busy=true;
  try{
   const requestHash=await hash(new TextEncoder().encode(JSON.stringify(identity))),key=prefix+requestHash,raw=storage.getItem(key),saved=JSON.parse(raw||'null');
   if(![1,2].includes(saved?.version)||saved.state!=='pending'||saved.requestHash!==requestHash||JSON.stringify(saved.identity)!==JSON.stringify(identity))throw fault('OPT_DIARIO_IDENTIDAD_NO_COINCIDE');
   const observation=await observationApi.observe(structuredClone(saved.identity));
   if(operation!==epoch||getToken()!==token||!current(identity.scope))throw fault('OPT_OBSERVACION_OBSOLETA');
   if(storage.getItem(key)!==raw)throw fault('OPT_DIARIO_CAMBIO');
   if(observation?.contract!=='OPT-IMPORT-OBSERVATION-1'||!sameOptImportIdentity(observation.identity,saved.identity)||observation.retryAuthorized!==false||observation.pdfArchived!==false||!['COMMITTED_MATCH','NOT_OBSERVED','EVIDENCE_MISMATCH'].includes(observation.status))throw fault('OPT_OBSERVACION_CONTRATO_INVALIDO');
   // Only a positive exact observation settles this entry. Absence does not
   // prove that an old request cannot still commit and never permits a resend.
   if(observation.status==='COMMITTED_MATCH'){
    const next={...saved,state:'confirmed',reconciliation:{previousState:saved.state,checkedAt:new Date().toISOString(),observation}};
    storage.setItem(key,JSON.stringify(next));if(storage.getItem(key)!==JSON.stringify(next))throw fault('OPT_DIARIO_NO_DISPONIBLE');
   }
   return structuredClone(observation);
  }finally{busy=false;}
 }

 function identityValid(i){
  const clean=v=>typeof v==='string'&&v.length>0&&v.length<=255&&!/[\x00-\x1f\x7f/\\]/.test(v);
  return exact(i,'scope,source,pdf,index')&&scopeValid(i.scope)&&exact(i.source,'origin,opt,mode')&&['PROYECTO','RETAIL','DESCONOCIDO'].includes(i.source.origin)&&['INDICE','INDIVIDUAL'].includes(i.source.mode)&&clean(i.source.opt)&&exact(i.pdf,'name,sha256')&&clean(i.pdf.name)&&i.pdf.name===i.source.opt+'.pdf'&&sha(i.pdf.sha256)&&(i.source.mode==='INDIVIDUAL'?i.index===null:exact(i.index,'name,sha256,format,sheet')&&clean(i.index.name)&&sha(i.index.sha256)&&['xlsx','csv','json'].includes(i.index.format)&&clean(i.index.sheet)&&i.index.sheet.length<=80);
 }
 async function exportPendingIdentities(){
  const token=getToken(),operation=epoch;if(!token||!storage||!storageScope)throw fault('OPT_SESION_REQUERIDA');
  const items=[];
  for(let n=0;n<storage.length;n++){
   const key=storage.key(n);if(!key?.startsWith(prefix))continue;
   const raw=storage.getItem(key),saved=JSON.parse(raw||'null');
   if(![1,2].includes(saved?.version))throw fault('OPT_DIARIO_NO_DISPONIBLE');
   if(saved.state!=='pending')continue;
   if(!identityValid(saved.identity)||!sha(saved.requestHash))throw fault('OPT_DIARIO_IDENTIDAD_NO_COINCIDE');
   if(!current(saved.identity.scope))continue;
   const identityText=JSON.stringify(saved.identity),requestHash=await hash(new TextEncoder().encode(identityText));
   if(key!==prefix+requestHash||saved.requestHash!==requestHash||storage.getItem(key)!==raw)throw fault('OPT_DIARIO_IDENTIDAD_NO_COINCIDE');
   if(operation!==epoch||token!==getToken()||!current(saved.identity.scope))throw fault('OPT_IMPORTACION_OBSOLETA');
   items.push({identity:structuredClone(saved.identity),identityText,requestHash});
  }
  if(operation!==epoch||token!==getToken())throw fault('OPT_IMPORTACION_OBSOLETA');
  return {contract:'OPT-IMPORT-IDENTITIES-1',items};
 }
 async function resolvePending(identity){
  if(busy)throw fault('OPT_IMPORTACION_EN_CURSO');
  const token=getToken(),operation=epoch;
  if(!token||!current(identity?.scope)||!identityValid(identity)||!resolutionApi||!storage)throw fault('OPT_RESOLUTION_UNAVAILABLE');
  busy=true;
  try{
   const requestHash=await hash(new TextEncoder().encode(JSON.stringify(identity))),key=prefix+requestHash,raw=storage.getItem(key),saved=JSON.parse(raw||'null');
   if(![1,2].includes(saved?.version)||saved.state!=='pending'||saved.requestHash!==requestHash||!sameOptImportIdentity(saved.identity,identity))throw fault('OPT_RESOLUTION_UNAVAILABLE');
   // Once an attempt exists, never allocate another generation or replace its evidence.
   if(saved.resolution?.attemptId)return validateOptResolution(saved.resolution.certificate,identity,requestHash);
   const certificate=validateOptResolution(await resolutionApi.resolve(structuredClone(identity),requestHash),identity,requestHash);
   if(operation!==epoch||token!==getToken()||!current(identity.scope))throw fault('OPT_RESOLUTION_OBSOLETA');
   if(storage.getItem(key)!==raw)throw fault('OPT_DIARIO_CAMBIO');
   const next={...saved,version:2,history:saved.history||[{event:'original_entry',entry:structuredClone(saved)}],resolution:{certificate,checkedAt:new Date().toISOString()}};
   const serialized=JSON.stringify(next);storage.setItem(key,serialized);if(storage.getItem(key)!==serialized)throw fault('OPT_DIARIO_NO_DISPONIBLE');
   return certificate;
  }finally{busy=false;}
 }
 return {canResolveImports:Boolean(resolutionApi),process:input=>processInternal(input),retryResolved:input=>processInternal(input,true),invalidate,pending,reconcilePending,exportPendingIdentities,resolvePending};
}
