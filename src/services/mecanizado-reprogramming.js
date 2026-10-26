/** Supabase-shaped read result; no direct-table fallback, even when RPC is absent. */
export async function readReprogramming(client,token){
 try{
  if(!token)throw new Error('Se requiere una sesión SGP para consultar reprogramaciones');
  const result=await client.rpc('sgp_mecanizado_reprogramaciones_listar',{p_token:token});
  if(result.error)return {data:null,error:result.error};
  if(!Array.isArray(result.data)||result.data.some(row=>!row||typeof row.id_origen!=='string'||!row.id_origen.trim()||typeof row.id_destino!=='string'||!row.id_destino.trim()))throw new Error('Respuesta de reprogramaciones incompleta o sin vínculo de destino');
  return {data:result.data,error:null};
 }catch(error){return {data:null,error};}
}
