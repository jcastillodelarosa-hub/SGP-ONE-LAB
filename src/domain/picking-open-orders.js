// A normal order may be expanded under several programming rows of one reserve/part.
// Quantitative parts remain separate and no source delivery is created or changed.
import {partDeliveryStatus} from './mecanizado-partes.js';

export function uniqueOpenPickingOrders(rows=[]){
 const unique=new Map();
 rows.forEach((row,ri)=>(row.ordenes||[]).forEach((order,oi)=>{
  const scope=[row.reserva||'',row.parte||''];
  const identity=row.parte_id?['partial',row.parte_id,order.key_produccion||order.produccion]:
   order.key_produccion?['order',order.key_produccion,order.produccion,order.cantidad]:['unknown',row.id_programacion||ri,oi];
  const key=JSON.stringify([...scope,...identity]);
  const next={row,order},prev=unique.get(key);
  // Preserve positive delivery evidence across repeated read projections; otherwise
  // prefer the program explicitly assigned to this order for the delivery action.
  if(!prev||(!prev.order.entrega_estado&&order.entrega_estado)||
    (!prev.order.entrega_estado&&!order.entrega_estado&&row.produccion===order.produccion&&prev.row.produccion!==order.produccion))unique.set(key,next);
 }));
 return [...unique.values()];
}

/** Receipt and audit do not undo delivery. Keep material-only replacements separate. */
export function pickingDeliveryQueue(rows=[]){
 const pending=new Map(),material=new Map();
 for(const {row,order} of uniqueOpenPickingOrders(rows)){
  let target;
  if(row.parte_id){
   const {remaining,materialPending}=partDeliveryStatus(row);
   target=remaining>0?pending:remaining===0&&materialPending?material:null;
  }else{
   target=String(order.entrega_estado??'').trim()?null:pending;
  }
  if(!target)continue;
  if(!target.has(row))target.set(row,[]);
  target.get(row).push(order);
 }
 const project=source=>[...source].map(([row,ordenes])=>({...row,ordenes}));
 return {pending:project(pending),material:project(material)};
}
