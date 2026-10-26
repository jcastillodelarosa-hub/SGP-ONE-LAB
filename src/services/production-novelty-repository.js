import {validatedNoveltySource} from '../domain/pdt-piece-identity.js';
export async function saveProductionNovelty(client,{token,payload,source}){
 if(String(payload.perfil||'').trim()){
  if(!Number.isSafeInteger(Number(payload.cantidad))||Number(payload.cantidad)<=0)throw new Error('Indica una cantidad entera positiva para el PDT.');
  const verified=validatedNoveltySource(source,{perfil:payload.perfil,reserva:source?.reserva,acabado:source?.acabado,produccion:payload.produccion});
  if(Number(payload.longitud)!==Number(verified.longitud))throw new Error('La longitud no corresponde a la pieza seleccionada.');
  const {data,error}=await client.rpc('sgp_produccion_novedad_pdt_crear_v3',{
   p_token:token,p_novedad:{...payload,perfil:verified.codigo_sap,produccion:verified.produccion},
   p_id_pieza:verified.id_pieza,p_reserva:verified.reserva,p_acabado:verified.acabado,
   p_key_produccion:verified.key_produccion,p_reserva_principal:verified.reserva_principal||verified.reserva
  });
  if(error)throw error;if(data?.ok!==true)throw new Error('El servidor no confirmó la novedad y el PDT.');
  return data;
 }
 const {data,error}=await client.from('sgp_mecanizado_novedades').insert(payload);if(error)throw error;return data;
}
