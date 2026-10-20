/** LAB v307: métricas de vidrio para el explorador (solo lectura). */
const positive = value => {const n=Number(value);return Number.isFinite(n)?Math.max(0,n):0};
const principal=value=>String(value||'SIN RESERVA').split(',')[0].trim()||'SIN RESERVA';

export function glassCoverage(insight){
 const windows=positive(insight?.windows),prepared=positive(insight?.prepared);
 return {windows,prepared,percentage:windows>0?Math.min(100,Math.round(prepared/windows*100)):0,complete:windows>0&&prepared>=windows};
}
export function glassRackBreakdown(insight,mode='prepared'){
 if(!insight?.byReservation)return [];
 return [...insight.byReservation.entries()].map(([reserva,v])=>({reserva,...v}))
  .filter(v=>mode==='prepared'?v.prepared>0:v.total>0)
  .sort((a,b)=>(mode==='prepared'?b.prepared-a.prepared:b.total-a.total)||a.reserva.localeCompare(b.reserva,undefined,{numeric:true}));
}
export function buildGlassNodeInsights(rows){
 const nodes=new Map();
 const get=(id,type)=>{
  if(!nodes.has(id))nodes.set(id,{id,type,windows:0,prepared:0,novelty:0,transfer:0,others:0,total:0,orderWindows:new Map(),byReservation:new Map()});
  return nodes.get(id);
 };
 for(const r of rows||[]){
  const key=String(r.key_produccion||'').trim();if(!key)continue;
  const res=principal(r.reserva),part=String(r.parte||'SIN PARTE'),pos=String(r.posicion||'SIN UBICACIÓN').trim()||'SIN UBICACIÓN';
  const prepared=positive(r.preparadas),novelty=positive(r.novedad),transfer=positive(r.traslado),total=positive(r.unidades);
  if(total<=0)continue;
  const others=Math.max(0,total-prepared-novelty-transfer),windows=positive(r.ventanas);
  for(const [id,type] of [['r:'+res,'reserva'],['p:'+res+':'+part,'parte'],['o:'+key,'orden'],['b:'+pos,'burro']]){
   const node=get(id,type);node.prepared+=prepared;node.novelty+=novelty;node.transfer+=transfer;node.others+=others;node.total+=total;
   if(type!=='burro')node.orderWindows.set(key,Math.max(windows,node.orderWindows.get(key)||0));
   else{
    if(!node.byReservation.has(res))node.byReservation.set(res,{prepared:0,novelty:0,transfer:0,others:0,total:0,orderKeys:new Set()});
    const piece=node.byReservation.get(res);piece.prepared+=prepared;piece.novelty+=novelty;piece.transfer+=transfer;piece.others+=others;piece.total+=total;piece.orderKeys.add(key);
   }
  }
 }
 for(const node of nodes.values()){
  node.windows=[...node.orderWindows.values()].reduce((a,b)=>a+b,0);
  if(node.type==='burro')for(const part of node.byReservation.values())part.orders=part.orderKeys.size;
 }
 return nodes;
}
