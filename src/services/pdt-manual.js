export async function manualCatalog(client,token){
 const {data,error}=await client.rpc('sgp_pdt_manual_catalogo_v1',{p_token:token});
 if(error)throw new Error(['PGRST202','42883'].includes(error.code)?'Alta manual PDT aún no instalada.':error.message);
 if(data?.ok!==true||!Array.isArray(data.producciones))throw new Error('Catálogo PDT inválido');
 return data.producciones;
}
export async function manualSources(client,token,context){
 const {data,error}=await client.rpc('sgp_pdt_manual_fuentes_v1',{p_token:token,p_key_produccion:context.key_produccion,p_reserva:context.reserva});
 if(error)throw error;
 if(data?.ok!==true||!Array.isArray(data.fuentes))throw new Error('Fuentes PDT inválidas');
 return data.fuentes;
}
export async function manualNc(client,token,reference){
 const {data,error}=await client.rpc('sgp_pdt_manual_nc_consultar_v1',{p_token:token,p_referencia:reference});
 if(error)throw error;
 if(data?.ok!==true)throw new Error('Consulta NC inválida');
 return data.nc;
}
export async function saveManualReport(client,token,payload,key){
 const {data,error}=await client.rpc('sgp_pdt_manual_registrar_v1',{p_token:token,p_origen:payload.origin,p_contexto:payload.context,p_detalles:payload.details,p_observacion:payload.observation,p_idempotency_key:key});
 if(error)throw error;
 if(data?.ok!==true||!data.id_reporte)throw new Error('No se confirmó el PDT. Reintenta sin cambiar la operación.');
 return data;
}
