const readers=new Set(['sgp_consultar_ensamble','sgp_lp_seguimiento_consultar','sgp_lp_operacion_consultar','sgp_linea_plan_consultar','sgp_mecanizado_disponibles']);
export function markAlertsUnavailable(value){
 if(Array.isArray(value))return value.map(markAlertsUnavailable);
 if(!value||typeof value!=='object')return value;
 return {...Object.fromEntries(Object.entries(value).map(([k,v])=>[k,markAlertsUnavailable(v)])),...(value.key_produccion?{accessory_alerts:null}:{})};
}
/** Additive read facade. Never fallback on ACL or network errors. Missing migration is visible. */
export async function readWithAccessoryAlerts(client,name,args,{signal}={}){
 const send=(method,params)=>{const q=client.rpc(method,params);return signal&&typeof q.abortSignal==='function'?q.abortSignal(signal):q;};
 if(!readers.has(name))return send(name,args);
 const {p_token,...params}=args;
 const result=await send('sgp_alertas_accesorio_consultar',{p_token,p_fuente:name,p_parametros:params});
 if(result.error?.code!=='PGRST202')return result;
 const legacy=await send(name,args);
 return legacy.error?legacy:{...legacy,data:markAlertsUnavailable(legacy.data)};
}
