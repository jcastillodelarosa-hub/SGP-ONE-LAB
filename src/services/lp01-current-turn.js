/** Only the server's capability and schedule may materialize a turn. */
export function currentAssemblyPeriod(data,context){
 const cap=data?.turnoHorario,s=data?.schedule,p=s?.currentPeriod;
 if(context?.stage!=='ENSAMBLE'||context.line!=='PANELES_2'||cap?.contract!=='LP-TURNO-HORARIO-1'||cap.mode!=='AUTHENTICATED_ON_ENTRY'||cap.enabled!==true||cap.canMaterialize!==true||s?.status!=='AVAILABLE'||!/^\d{4}-\d{2}-\d{2}$/.test(p?.date)||![1,2].includes(p?.shift))return null;
 return {date:p.date,shift:p.shift};
}
export async function materializeAssemblyTurn(data,context,rpc){
 const period=currentAssemblyPeriod(data,context);
 if(!period||period.date!==context.date||period.shift!==context.shift||data?.turn?.estado!=='NO_ABIERTO')return false;
 const result=await rpc('sgp_lp_ensamble_turno_actual',{});
 if(result?.contract!=='LP-TURNO-HORARIO-1'||result.stage!=='ENSAMBLE'||result.line!=='PANELES_2'||result.mode!=='AUTHENTICATED_ON_ENTRY')throw Error('Respuesta de turno actual incompatible');
 if(result.state==='DISABLED'||result.state==='OUTSIDE_SCHEDULE')return false;
 if(result.state!=='MATERIALIZED'||result.currentPeriod?.date!==context.date||result.currentPeriod?.shift!==context.shift)throw Error('El horario cambió. Vuelve a consultar el turno actual.');
 return true;
}
