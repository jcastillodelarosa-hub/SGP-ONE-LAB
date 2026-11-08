const same=(a,b)=>['stage','line','date','shift'].every(k=>a?.[k]===b?.[k]);
export function canPrepareHistoricalTurn(data,context){
 const cap=data?.historicalTurn;
 return data?.contract==='LP-OPERACION-1'&&data.writes===true&&data.turn?.estado==='NO_ABIERTO'&&['COORDINADOR','ADMINISTRADOR'].includes(data.role)&&cap?.contract==='LP-TURNO-HISTORICO-1'&&cap.enabled===true&&cap.canPrepare===true&&same(cap,context);
}
export function historicalTurnController({context,rpc,isCurrent,id=()=>crypto.randomUUID()}){
 let request=null;
 async function transmit(){
  if(!request||!isCurrent())throw Error('La sesión o el turno cambió. Consulta de nuevo.');
  try{
   const result=await rpc('sgp_lp_turno_historico_preparar',{p_id:request.id,p_etapa:request.stage,p_linea:request.line,p_fecha:request.date,p_turno:request.shift,p_motivo:request.observation});
   if(!isCurrent()||result?.ok!==true||result.contract!=='LP-TURNO-HISTORICO-1'||result.requestId!==request.id||!same(result,context)||result.state!=='PREPARED')throw Error('Respuesta de preparación sin confirmar');
   return result;
  }catch(error){error.uncertain=!['P0001','42501','22003','22007','22P02','23505'].includes(error.code);if(!error.uncertain)request=null;throw error;}
 }
 return {save(motive){if(request)throw Error('Reintenta la misma preparación antes de cambiarla.');if(typeof motive!=='string'||!motive.trim()||motive.trim().length>2000)throw Error('Indica un motivo de hasta 2000 caracteres.');request=Object.freeze({id:id(),...context,observation:motive.trim()});return transmit();},retry:transmit};
}
