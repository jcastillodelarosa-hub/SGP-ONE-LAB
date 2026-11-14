// Review-only harness. Never mount in the application or use as an authorization service.
import {createOptImportHandler} from './opt-import-handler.js';
const MAX_BYTES=16*1024*1024;
const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
export function createOptImportProbe({secret,readPdf,DOMParser,readWorksheetXML,serializeRetailPlans,wrapRpc=rpc=>rpc}){
 if(typeof secret!=='string'||!/^[a-f0-9]{64}$/.test(secret))throw Error('PROBE_SECRET_REQUIRED');
 return async request=>{
  // Independent of the gateway JWT: publishable project keys alone cannot invoke this probe.
  const supplied=request.headers.get('x-opt-probe-secret')||'';
  let difference=supplied.length^secret.length;
  for(let i=0;i<secret.length;i++)difference|=secret.charCodeAt(i)^(supplied.charCodeAt(i)||0);
  if(difference)return reply(403,{code:'PROBE_DENIED'});
  if(request.method!=='POST')return reply(405,{code:'PROBE_POST_REQUIRED'});
  let bytes=0;const chunks=[],reader=request.body?.getReader();if(!reader)return reply(400,{code:'PROBE_BODY_REQUIRED'});
  try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>MAX_BYTES){await reader.cancel();return reply(413,{code:'PROBE_LIMIT'});}chunks.push(value);}}finally{reader.releaseLock();}
  let input;try{const buffer=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){buffer.set(chunk,offset);offset+=chunk.length;}input=JSON.parse(new TextDecoder().decode(buffer));}catch{return reply(400,{code:'PROBE_JSON'});}
  if(!input||Object.keys(input).sort().join(',')!=='context,request'||!input.context||!input.request)return reply(400,{code:'PROBE_INPUT'});
  // Snapshot is explicitly test evidence, not proof of authorization. Never forward its token.
  const payload={...input.request,p_token:'offline-synthetic-probe'};let boundary=null;
  const handler=createOptImportHandler({retailV3:true,retailOnly:true,serializeRetailPlans,readPdf,DOMParser,readWorksheetXML,allowedOrigins:['https://offline.invalid'],rpc:wrapRpc(async(name,args)=>{
   if(name==='sgp_sesion_actual')return {data:{valida:true,rol:'LIDER MECANIZADO'}};
   if(name==='sgp_mis_accesos')return {data:[{ventana:'mecanizado.proceso'}]};
   if(name==='sgp_opt_import_contexto_retail_v3')return {data:input.context};
   if(name==='sgp_opt_importar_retail_validado_v3'){
    boundary={geometryPlans:args.p_evidence.documentary_plans?.plans.length??null,geometryCuts:args.p_evidence.documentary_plans?.plans.flatMap(p=>p.bars.flatMap(b=>b.cuts)).length??null,pieces:args.p_manifest.length,unassigned:args.p_manifest.filter(p=>p.asignacion===null).length,warningCodes:(args.p_evidence.validation_warnings||[]).map(w=>w.code),roundingStatuses:(args.p_evidence.rounding_evidence||[]).map(p=>p.diagnostic.status)};
    return {data:{ok:true,import_contract:'OPT-IMPORT-1',contract_version:2,id_documento:'11111111-1111-4111-8111-111111111111',duplicado:false,cantidad_piezas:args.p_manifest.length,sin_asignacion:boundary.unassigned,physical_completion_verified:false}};
   }
   throw Error('PROBE_RPC_DENIED');
  })});
  const start=performance.now();
  const response=await handler(new Request('https://offline.invalid',{method:'POST',headers:{origin:'https://offline.invalid','content-type':'application/json'},body:JSON.stringify(payload)}));
  const result=await response.json();
  // Do not expose source bytes, snapshot, session, identities or ambiguous import receipts.
  return reply(200,{probe:true,syntheticAuthorization:true,writes:0,outcome:boundary?'VALIDATED_STOPPED_BEFORE_WRITE':'VALIDATION_BLOCKED',validationCode:boundary?null:result.code,wallMs:performance.now()-start,boundary});
 };
}
