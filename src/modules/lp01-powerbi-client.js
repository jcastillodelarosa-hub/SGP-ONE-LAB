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
export async function importPowerBI({token,command,filename,base64}){
 const config=window.SGP_CONFIG||{},url=config.lpPowerBiUrl||(config.supabaseUrl?config.supabaseUrl.replace(/\/$/,'')+'/functions/v1/lp-powerbi':null);
 if(!url)throw Error('Servicio Power BI pendiente de configuración autorizada');
 const gateway=gatewayJwt(config);
 const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+gateway,...(config.supabasePublishableKey?{apikey:config.supabasePublishableKey}:{})},body:JSON.stringify({p_token:token,command,filename,base64})});let body;
 try{body=await response.json();}catch{const e=Error('No se confirmó la respuesta del servicio Power BI');e.code='FETCH_ERROR';throw e;}
 if(!response.ok||body.error){const error=Error(typeof body.error==='string'?body.error:'No se confirmó la importación Power BI');if(response.status<500)error.code=body.code||'PBI_REJECTED';else error.code='FETCH_ERROR';throw error;}return body.data;
}
