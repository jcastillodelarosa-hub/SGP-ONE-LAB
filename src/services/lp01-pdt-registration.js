import {openPdtRegistration} from '../modules/pdt-registration-form.js';

/** Reuse the existing PDT writer, bound to the selected order and current session.
 * No affectation is invented from a piece count and no legacy writer is used. */
export function scopedPdtRegistration({client,getToken,context,open=openPdtRegistration}){
 const scope=Object.freeze({...context});
 return async({onClosed=()=>{}}={})=>{
  const token=getToken();
  if(!token)throw Error('NO_AUTORIZADO');
  if(!['ENSAMBLE','EMPAQUE'].includes(scope.stage)||scope.line!=='PANELES_2'||!scope.key)throw Error('Registro PDT no disponible para esta orden y línea.');
  const guardedClient={rpc:async(name,args)=>{
   if(getToken()!==token)throw Error('NO_AUTORIZADO');
   if(!['sgp_pdt_registro_fuentes_v4','sgp_pdt_registrar_v4'].includes(name)||args.p_token!==token||args.p_origen!==scope.stage||args.p_contexto?.key_produccion!==scope.key)throw Error('PDT_AMBITO_INVALIDO');
   const result=await client.rpc(name,args);
   if(getToken()!==token)throw Error('NO_AUTORIZADO');
   return result;
  }};
  return open({client:guardedClient,token,origin:scope.stage,context:{key_produccion:scope.key,produccion:scope.production},onClosed});
 };
}
