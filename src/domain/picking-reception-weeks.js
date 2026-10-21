// Semana operativa de las entregas pendientes de auditoría en Picking.
// Reutiliza la RPC de solo lectura sgp_picking_cola; no infiere la semana
// a partir de la fecha de entrega ni del número de reserva.
export function normalizeReceptionWeek(value){
 const text=String(value??'').trim();
 if(!/^(?:[1-9]|[1-4][0-9]|5[0-3])$/.test(text))return null;
 return text;
}

export function attachReceptionWeeks(receptionRows=[],pickingQueue=[]){
 const byProgramming=new Map(),ambiguous=new Set();
 for(const item of pickingQueue||[]){
  const id=String(item?.id_programacion??'').trim();
  const week=normalizeReceptionWeek(item?.semana);
  if(!id||!week||ambiguous.has(id))continue;
  if(byProgramming.has(id)&&byProgramming.get(id)!==week){
   byProgramming.delete(id);
   ambiguous.add(id);
  }else byProgramming.set(id,week);
 }
 return (receptionRows||[]).map(row=>({
  ...row,
  semana:byProgramming.get(String(row?.id_programacion??'').trim())||null
 }));
}

export function receptionWeekOptions(rows=[]){
 const counts=new Map();
 let unknown=0;
 for(const row of rows||[]){
  const week=normalizeReceptionWeek(row?.semana);
  if(week)counts.set(week,(counts.get(week)||0)+1);
  else unknown++;
 }
 const options=[...counts.entries()].sort((a,b)=>Number(b[0])-Number(a[0]))
  .map(([value,count])=>({value,label:'Semana '+value+' ('+count+')',count}));
 if(unknown)options.push({value:'sin-semana',label:'Sin semana ('+unknown+')',count:unknown});
 return options;
}

export function filterReceptionRows(rows=[],{week='',search=''}={}){
 const selected=String(week??'').trim();
 const q=String(search??'').trim().toLocaleLowerCase('es');
 return (rows||[]).filter(row=>{
  const current=normalizeReceptionWeek(row?.semana);
  if(selected==='sin-semana'?current!==null:(selected&&current!==selected))return false;
  if(!q)return true;
  return [row?.produccion,row?.proyecto,row?.reserva,row?.parte,row?.sistema,row?.acabado,JSON.stringify(row?.reservas_compartidas||[])]
   .some(value=>String(value??'').toLocaleLowerCase('es').includes(q));
 });
}
