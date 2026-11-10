import {receptionAluminumStateMeta} from './reception-aluminum-state.js';

const common=[['week','Semana',true],['reservation','Reserva'],['system','Sistema'],['finish','Acabado'],['type','Tipo'],['quantity','Cantidad',true],['reception','Estado recepción'],['aluminum','Estado aluminio']];
export const receptionColumns={
 pending:[...common,['missing','Faltantes',true],['days','Días pendiente',true]],
 received:[...common,['legal','Legalización'],['missing','Faltantes',true]]
};
export const newReceptionTableState=()=>({filters:{},sort:null,direction:'asc'});
const text=value=>String(value??'').trim()||null;
const number=value=>value===null||value===undefined||String(value).trim()===''||!Number.isFinite(Number(value))?null:Number(value);
export function receptionColumnValue(row,key,states=new Map()){
 switch(key){
  case 'week':return number(row.semana_prog);
  case 'reservation':return text(row.reserva);
  case 'system':return text(row.sistema);
  case 'finish':return text(row.acabado);
  case 'type':return ['PROYECTO','RETAIL','MIXTO'].includes(String(row.tipo_reserva??row.tipo??'').trim().toUpperCase())?String(row.tipo_reserva??row.tipo).trim().toUpperCase():'SIN DATO';
  case 'quantity':return number(row.cantidad);
  case 'reception':return row.estado==='RECIBIDA'?'RECIBIDA':'PENDIENTE POR RECIBIR';
  case 'aluminum':return receptionAluminumStateMeta(states.get(text(row.reserva))).label;
  case 'missing':return number(row.faltantes_abiertos)||0;
  case 'days':return Number((number(row.dias_pendiente)||0).toFixed(1));
  case 'legal':return row.legalizada?'LEGALIZADA':'RECIBIDA SIN LEGALIZAR';
  default:return null;
 }
}
export const receptionValueKey=value=>JSON.stringify(value);
// Nulls stay last in both directions; numeric columns never compare lexically.
export function compareReceptionValues(a,b,direction='asc'){
 if(a===b)return 0;
 if(a===null)return 1;
 if(b===null)return -1;
 const result=typeof a==='number'&&typeof b==='number'?a-b:String(a).localeCompare(String(b),'es',{numeric:true,sensitivity:'base'});
 return direction==='desc'?-result:result;
}
export function receptionOptions(rows,key,states){
 return [...new Map(rows.map(row=>{const value=receptionColumnValue(row,key,states);return [receptionValueKey(value),value];})).entries()].sort((a,b)=>compareReceptionValues(a[1],b[1]));
}
export function filterReceptionRows(rows,state,states){
 const result=rows.filter(row=>Object.entries(state.filters).every(([key,values])=>values.includes(receptionValueKey(receptionColumnValue(row,key,states)))));
 return state.sort?result.sort((a,b)=>compareReceptionValues(receptionColumnValue(a,state.sort,states),receptionColumnValue(b,state.sort,states),state.direction)):result;
}
// One authorized quantity per reservation, never a sum of repeated join rows.
// Conflicting/missing quantities make that card's total unknown (not a partial total).
export function receptionAluminumSummary(rows,states){
 const groups=new Map(),cards=Object.fromEntries(['PENDIENTE_BODEGA','PENDIENTE_ABASTECIMIENTO','ALUMINIO_ENTREGADO'].map(key=>[key,{reservations:0,windows:0,unknownQuantities:0}]));
 let unidentified=0,unclassified=0;
 for(const row of rows){
  const reservation=text(row.reserva);if(!reservation){unidentified++;continue;}
  if(!groups.has(reservation))groups.set(reservation,new Set());
  const quantity=number(row.cantidad);
  groups.get(reservation).add(quantity!==null&&quantity>=0?quantity:null);
 }
 for(const [reservation,quantities] of groups){
  const card=cards[states.get(reservation)];if(!card){unclassified++;continue;}
  card.reservations++;
  if(quantities.size!==1||quantities.has(null))card.unknownQuantities++;
  else card.windows += [...quantities][0];
 }
 for(const card of Object.values(cards))if(card.unknownQuantities)card.windows=null;
 return {cards,unclassified,unidentified,reservations:groups.size};
}

// One quantity per reservation. Physical receipt, not legalisation or tracking,
// partitions the weekly list. Unknown quantities never become partial totals.
export function receptionQuantitySummary(rows,states){
 const empty=()=>({reservations:0,windows:0,unknownQuantities:0});
 const total=empty(),received=empty(),pending=empty(),groups=new Map(),pendingRows=[];
 let unidentified=0,conflictingReception=0;
 const add=(target,quantity)=>{target.reservations++;if(quantity===null)target.unknownQuantities++;else target.windows+=quantity;};
 for(const row of rows){
  const reservation=text(row.reserva);
  if(!reservation){unidentified++;continue;}
  if(!groups.has(reservation))groups.set(reservation,[]);
  groups.get(reservation).push(row);
 }
 for(const group of groups.values()){
  const quantities=new Set(group.map(row=>{const q=number(row.cantidad);return q!==null&&q>=0?q:null;}));
  const quantity=quantities.size===1&&!quantities.has(null)?[...quantities][0]:null;
  add(total,quantity);
  const receiptStates=new Set(group.map(row=>row.estado==='RECIBIDA'));
  if(receiptStates.size!==1){conflictingReception++;continue;}
  if(receiptStates.has(true))add(received,quantity);
  else{add(pending,quantity);pendingRows.push(...group);}
 }
 for(const metric of [total,received,pending])if(metric.unknownQuantities||unidentified)metric.windows=null;
 if(conflictingReception){received.windows=null;pending.windows=null;}
 const tracking=receptionAluminumSummary(pendingRows,states);
 return {total,received,pending,warehouse:tracking.cards.PENDIENTE_BODEGA,
  supply:tracking.cards.PENDIENTE_ABASTECIMIENTO,unclassifiedPending:tracking.unclassified,
  deliveredWithoutReception:tracking.cards.ALUMINIO_ENTREGADO.reservations,
  unidentified,conflictingReception};
}
