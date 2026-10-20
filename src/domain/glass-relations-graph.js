/**
 * LAB v306: modelo de relaciones para vidrio preparado y ubicación.
 * Conserva identidad de orden mediante key_produccion.
 * Los totales de ventanas se deduplican por producción, nunca por burro.
 */
export const glassNodeRank=Object.freeze({reserva:0,parte:1,orden:2,burro:3});

export function buildGlassRelationGraph(rows, mode='prepared') {
 const nodes=new Map(),edges=new Map(),orderWindows=new Map(),nodeOrders=new Map();
 const addNode=(id,type,label)=>{
  if(!nodes.has(id))nodes.set(id,{id,type,label,windows:0,glass:0});
  return nodes.get(id);
 };
 const addEdge=(a,b,qty)=>{
  const id=JSON.stringify([a,b]),prev=edges.get(id);
  edges.set(id,{a,b,qty:(prev?.qty||0)+qty});
 };
 const register=(id,key)=>{
  if(!nodeOrders.has(id))nodeOrders.set(id,new Set());
  nodeOrders.get(id).add(key);
 };
 for(const r of rows||[]) {
  const key=String(r.key_produccion||'').trim(),res=String(r.reserva||'SIN RESERVA').split(',')[0].trim()||'SIN RESERVA';
  const part=String(r.parte||'SIN PARTE'),pos=String(r.posicion||'SIN UBICACIÓN').trim()||'SIN UBICACIÓN';
  const total=Number(r.unidades||0),prepared=Number(r.preparadas||0),qty=mode==='all'?total:prepared;
  if(!key||!Number.isFinite(qty)||qty<=0)continue;
  const ri='r:'+res,pi='p:'+res+':'+part,oi='o:'+key,bi='b:'+pos;
  addNode(ri,'reserva','Reserva '+res);
  addNode(pi,'parte','Parte '+part);
  addNode(oi,'orden',String(r.produccion||key));
  addNode(bi,'burro',pos).glass+=qty;
  const windows=Number(r.ventanas||0);
  if(!orderWindows.has(key))orderWindows.set(key,Number.isFinite(windows)?Math.max(0,windows):0);
  for(const id of [ri,pi,oi])register(id,key);
  addEdge(ri,pi,qty);
  addEdge(pi,oi,qty);
  addEdge(oi,bi,qty);
 }
 for(const [id,keys] of nodeOrders){
  nodes.get(id).windows=[...keys].reduce((sum,key)=>sum+(orderWindows.get(key)||0),0);
 }
 return {nodes,edges};
}

export function traceGlassRelations(model,selectedId){
 const visited=new Set(),activeEdges=new Set();
 if(!selectedId||!model.nodes.has(selectedId))return {nodes:visited,edges:activeEdges};
 visited.add(selectedId);
 const neighbors=new Map();
 for(const [edgeId,edge] of model.edges){
  for(const [from,to] of [[edge.a,edge.b],[edge.b,edge.a]]){
   if(!neighbors.has(from))neighbors.set(from,[]);
   neighbors.get(from).push({id:to,edgeId});
  }
 }
 const origin=model.nodes.get(selectedId);
 const directions=origin.type==='reserva'?[1]:origin.type==='burro'?[-1]:[-1,1];
 for(const direction of directions){
  const queue=[selectedId],seen=new Set(queue);
  for(let i=0;i<queue.length;i++){
   const id=queue[i],rank=glassNodeRank[model.nodes.get(id).type];
   for(const {id:next,edgeId} of neighbors.get(id)||[]){
    const n=model.nodes.get(next);
    if(!n||glassNodeRank[n.type]!==rank+direction)continue;
    activeEdges.add(edgeId);visited.add(next);
    if(!seen.has(next)){seen.add(next);queue.push(next)}
   }
  }
 }
 return {nodes:visited,edges:activeEdges};
}

export function summarizeGlassBurro(rows,position){
 const location=String(position);
 const items=(rows||[]).filter(r=>String(r.posicion||'SIN UBICACIÓN').trim()===location).map(r=>({
  key:String(r.key_produccion||''),
  reserva:String(r.reserva||'SIN RESERVA').split(',')[0].trim(),
  parte:String(r.parte||'SIN PARTE'),
  orden:String(r.produccion||r.key_produccion||''),
  ventanas:Number(r.ventanas||0),
  preparados:Number(r.preparadas||0),
  novedad:Number(r.novedad||0),
  traslado:Number(r.traslado||0),
  total:Number(r.unidades||0)
 })).map(item=>({...item,otros:Math.max(0,item.total-item.preparados-item.novedad-item.traslado)}));
 const count=new Set(items.map(item=>item.key)).size;
 const reservations=new Set(items.map(item=>item.reserva));
 const parts=new Set(items.map(item=>item.reserva+'|'+item.parte));
 const totals=['preparados','novedad','traslado','otros','total'].reduce((out,k)=>{
  out[k]=items.reduce((n,item)=>n+item[k],0);
  return out;
 },{});
 return {position:location,items,orders:count,parts:parts.size,reservations:reservations.size,totals};
}
