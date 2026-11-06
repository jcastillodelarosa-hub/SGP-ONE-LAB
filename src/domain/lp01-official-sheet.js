/** Official overlays do not mutate planner assignments or legacy manual execution. */
export function officialSheet(data,view,context){
 if(view.contract!=='LP-OFFICIAL-VIEW-1'||['stage','line','date','shift'].some(k=>view.context[k]!==context[k]))throw Error('OFFICIAL_SHEET_SCOPE_MISMATCH');
 const same=r=>['stage','line','date','shift'].every(k=>r[k]===context[k]);
 const orders=data.orders.map(r=>({...r}));
 for(const i of (view.state.inclusions||[]).filter(same)){
  if(orders.some(r=>r.key===i.key))continue;
  const source=view.catalog.find(r=>r.key_produccion===i.key);if(!source)continue;
  orders.push({key:i.key,parte:i.id,produccion:source.produccion,linea:context.line,etapa:context.stage,fecha:context.date,turno:context.shift,prioridad:i.priority,programada:i.quantity,sale:null,ejecutado:0,total_etapa_parte:0,afectaciones:{},observacion:i.observation,revision:0,oficial:source,officialInclusion:true});
 }
 for(const source of view.catalog||[]){
  const key=source.key_produccion;if(orders.some(r=>r.key===key))continue;
  const balance=source[context.stage==='ENSAMBLE'?'saldo_ensamble':'saldo_empaque'];
  if(source.saldos_inicializados===true&&source.presente_ultimo_export===true&&['number','string'].includes(typeof balance)&&String(balance).trim()!==''&&Number(balance)===0)continue;
  orders.push({key,parte:'official:'+key,produccion:source.produccion,linea:context.line,etapa:context.stage,fecha:context.date,turno:context.shift,prioridad:Number.MAX_SAFE_INTEGER,programada:0,sale:null,ejecutado:0,total_etapa_parte:0,afectaciones:{},observacion:'',revision:0,oficial:source,officialInclusion:true,officialUnscheduled:true});
 }
 for(const row of orders){
  row.officialAvailable=view.availability.find(r=>r.key===row.key&&r.stage===context.stage&&r.line===context.line)?.quantity??null;
  row.officialRealized=view.state.entries.find(r=>r.key===row.key&&same(r))?.quantity??null;
 }
 return {...data,orders,officialView:view};
}
