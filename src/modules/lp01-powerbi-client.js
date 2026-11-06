import {OFFICIAL_POWERBI_VERSION} from '../domain/powerbi/adapter.js';
/** Calls the authoritative parser. No service key is accepted or exposed here. */
function gatewayJwt(config){
 const token=config.lpPowerBiGatewayJwt;
 try{
  if(typeof token!=='string'||!token.split('.').every(x=>/^[A-Za-z0-9_-]+$/.test(x))||token.split('.').length!==3)throw Error();
  const decode=part=>JSON.parse(atob(part.replace(/-/g,'+').replace(/_/g,'/')));
  const [header,claims]=token.split('.').slice(0,2).map(decode),base=new URL(config.supabaseUrl);
  // Configuration sanity only. The platform verifies the signature; SQL verifies the human.
  if(header.alg!=='HS256'||claims.role!=='anon'||base.protocol!=='https:'||base.hostname!==claims.ref+'.supabase.co'||!Number.isSafeInteger(claims.exp)||claims.exp*1000<=Date.now())throw Error();
  return token;
 }catch{throw Error('JWT público del gateway Power BI ausente, vencido o incompatible; no se envió el archivo');}
}
async function requestPowerBI(payload,{official=false}={}){
 const config=window.SGP_CONFIG||{},url=config.lpPowerBiUrl||(config.supabaseUrl?config.supabaseUrl.replace(/\/$/,'')+'/functions/v1/lp-powerbi':null);
 if(!url)throw Error('Servicio Power BI pendiente de configuración autorizada');
 const gateway=gatewayJwt(config);
 let response;try{response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+gateway,...(config.supabasePublishableKey?{apikey:config.supabasePublishableKey}:{})},body:JSON.stringify(payload)});}catch(error){if(official)error.code='OFFICIAL_COMMIT_UNCERTAIN';throw error;}let body;
 try{body=await response.json();}catch{const e=Error('No se confirmó la respuesta del servicio Power BI');e.code=official?'OFFICIAL_COMMIT_UNCERTAIN':'FETCH_ERROR';throw e;}
 if(!response.ok||body?.error){const error=Error(typeof body?.error==='string'?body.error:'No se confirmó la importación Power BI');if(response.status<500)error.code=body?.code||'PBI_REJECTED';else error.code=official?'OFFICIAL_COMMIT_UNCERTAIN':'FETCH_ERROR';throw error;}return body?.data;
}

export function importPowerBI({token,command,filename,base64}){
 return requestPowerBI({p_token:token,command,filename,base64});
}
/** Same gateway and parser; callers retain the UUID and exact payload on an
 * uncertain response. This does not enable the server contract or native close. */
export async function submitOfficialClose({token,command,filename,base64,observation}){
 if(!command||!['IMPORT','CLOSE','DEFINE_AVAILABLE','INCORPORATE'].includes(command.action))throw Error('OFFICIAL_COMMAND_INVALID');
 const data=await requestPowerBI({adapter:OFFICIAL_POWERBI_VERSION,p_token:token,command,filename,base64,observation},{official:true});
 if(data?.ok!==true||data.contract!=='LP-OFFICIAL-COMMITTED-1'||data.id!==command.id||data.revision!==command.revision+1){
  throw Object.assign(Error('No se confirmó el cierre oficial; reintenta la misma solicitud'),{code:'OFFICIAL_COMMIT_UNCERTAIN'});
 }
 return data;
}

export async function readOfficialClose({token,context}){
 const command={...context,id:crypto.randomUUID(),revision:0,action:'READ'};
 const data=await requestPowerBI({adapter:OFFICIAL_POWERBI_VERSION,p_token:token,command});
 if(data?.contract!=='LP-OFFICIAL-VIEW-1'||!Number.isSafeInteger(data.revision)||data.revision<0||!data.state||['stage','line','date','shift'].some(k=>data.context?.[k]!==context[k]))throw Error('OFFICIAL_READ_INVALID');
 return data;
}
