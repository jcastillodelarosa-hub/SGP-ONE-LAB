import {registrationPieces} from '../domain/pdt-registration.js';
export async function registrationSources(client,token,origin,context){
 const {data,error}=await client.rpc('sgp_pdt_registro_fuentes_v4',{p_token:token,p_origen:origin,p_contexto:context});
 if(error)throw new Error(['PGRST202','42883'].includes(error.code)?'Registro PDT multiorigen aún no instalado. No se usará el flujo LEGACY.':error.message);
 if(data?.ok!==true||data.contract_version!==4||!Array.isArray(data.fuentes))throw new Error('Contrato de fuentes PDT inválido');
 return data.fuentes;
}
export async function saveRegistration(client,token,{origin,context,sources,entries,idempotencyKey}){
 const pieces=context.completa===true&&origin==='PICKING'?[]:registrationPieces(origin,sources,entries);
 const {data,error}=await client.rpc('sgp_pdt_registrar_v4',{p_token:token,p_origen:origin,p_contexto:context,p_piezas:pieces,p_idempotency_key:idempotencyKey});
 if(error)throw error;
 if(data?.ok!==true)throw new Error('No se pudo confirmar el registro PDT. Reintenta sin cambiar la operación.');
 return data;
}
export async function registrationMetadata(client,token){
 const {data,error}=await client.rpc('sgp_pdt_registro_metadatos_v4',{p_token:token});
 if(error){if(['PGRST202','42883'].includes(error.code))return null;throw error;}
 if(!Array.isArray(data))throw new Error('Metadatos PDT inválidos');
 return data;
}
