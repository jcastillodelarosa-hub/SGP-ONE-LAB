/** Calls the authoritative parser. No service key is accepted or exposed here. */
export async function importPowerBI({token,command,filename,base64}){
 const config=window.SGP_CONFIG||{},url=config.lpPowerBiUrl||(config.supabaseUrl?config.supabaseUrl.replace(/\/$/,'')+'/functions/v1/lp-powerbi':null);
 if(!url)throw Error('Servicio Power BI pendiente de configuración autorizada');
 const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...(config.supabasePublishableKey?{apikey:config.supabasePublishableKey}:{})},body:JSON.stringify({p_token:token,command,filename,base64})});let body;
 try{body=await response.json();}catch{const e=Error('No se confirmó la respuesta del servicio Power BI');e.code='FETCH_ERROR';throw e;}
 if(!response.ok||body.error){const error=Error(typeof body.error==='string'?body.error:'No se confirmó la importación Power BI');if(response.status<500)error.code=body.code||'PBI_REJECTED';else error.code='FETCH_ERROR';throw error;}return body.data;
}
