/** One exact request per dialog; never substitutes an Ensamble command/plan root. */
export function packingInclusionController({context,revision,rpc,isCurrent,id=()=>crypto.randomUUID()}){
 if(context?.stage!=='EMPAQUE'||context.line!=='PANELES_2'||!Number.isSafeInteger(revision)||revision<0)throw Error('Contexto de incorporación Empaque incompatible');
 let request=null;
 async function transmit(){
  if(!request||!isCurrent())throw Error('La sesión o el turno cambió. Consulta de nuevo.');
  try{
   const result=await rpc('sgp_lp_empaque_incorporar',{p_cmd:request});
   if(result?.contract!=='LP-INCORPORAR-EMPAQUE-1'||result.id!==request.id||result.key!==request.key||result.quantity!==request.quantity||result.stage!=='EMPAQUE'||result.line!==context.line||result.date!==context.date||result.shift!==context.shift||result.turnRevision!==request.revision+1)throw Error('Respuesta de incorporación sin confirmar');
   return result;
  }catch(error){
   // SQL business rejection guarantees rollback; transport/unknown reply does not.
   error.uncertain=!['P0001','42501','22003','22007','22P02','23505'].includes(error.code);throw error;
  }
 }
 return {save(input){
  if(request)throw Error('Reintenta la misma incorporación antes de cambiarla.');
  request=Object.freeze({id:id(),date:context.date,shift:context.shift,revision,key:input.key,quantity:input.quantity,observation:input.observation});
  return transmit().catch(error=>{if(!error.uncertain)request=null;throw error;});
 },retry(){return transmit().catch(error=>{if(!error.uncertain)request=null;throw error;});}};
}
