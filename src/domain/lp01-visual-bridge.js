/** Frontend visual integration only; never delegates an RPC or token to production. */
export function visualLPBridge(base,readSnapshot){
 return {getToken:()=>base.getToken()?'LP-VISUAL-SYNTHETIC-NOT-A-SESSION':null,getClient:async()=>({rpc:async(name,args)=>{
  if(!base.getToken())return {data:null,error:{message:'Inicia sesión en SGP para abrir la muestra visual'}};
  if(name!=='sgp_lp_operacion_consultar')return {data:null,error:{message:'Muestra sintética: operación no disponible. No se guardó ningún cambio'}};
  if(args.p_linea!=='PANELES_2'||args.p_fecha!=='2026-11-01'||args.p_turno!==1||!['ENSAMBLE','EMPAQUE'].includes(args.p_etapa))return {data:null,error:{message:'Muestra sintética disponible: PANELES_2 · 01/11/2026 · T1'}};
  const data=structuredClone(await readSnapshot(args.p_etapa));data.writes=false;data.role='CONSULTA';return {data,error:null};
 }})};
}
