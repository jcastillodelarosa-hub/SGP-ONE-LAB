/**
 * LAB v311: estado logístico de la reserva según Seguimiento de Aluminio.
 * No es el estado de recepción física ni el estado operativo combinado.
 * La identidad de seguimiento es ID|RESERVA; la vista de Recepción agrupa
 * por RESERVA, por lo que se consolidan solo estados canónicos coincidentes.
 */
const STATE_META=Object.freeze({
 ALUMINIO_ENTREGADO:Object.freeze({label:'ALUMINIO ENTREGADO',css:'rec-al-delivered'}),
 PENDIENTE_BODEGA:Object.freeze({label:'PEND. BODEGA',css:'rec-al-warehouse'}),
 PENDIENTE_ABASTECIMIENTO:Object.freeze({label:'PEND. ABASTECIMIENTO',css:'rec-al-supply'}),
 CONFLICTO:Object.freeze({label:'ESTADO MIXTO',css:'rec-al-neutral'}),
 SIN_DATO:Object.freeze({label:'SIN DATO',css:'rec-al-neutral'})
});
export function indexReceptionAluminumStates(rows){
 const byReservation=new Map();
 for(const row of Array.isArray(rows)?rows:[]){
  const reserva=String(row?.reserva??'').trim();
  if(!reserva)continue;
  const value=String(row?.estado_reserva??'').trim().toUpperCase();
  const state=Object.hasOwn(STATE_META,value)&&value!=='CONFLICTO'&&value!=='SIN_DATO'?value:'SIN_DATO';
  const previous=byReservation.get(reserva);
  if(!previous)byReservation.set(reserva,state);
  else if(previous!==state)byReservation.set(reserva,'CONFLICTO');
 }
 return byReservation;
}
export function receptionAluminumStateMeta(state){
 return STATE_META[state]||STATE_META.SIN_DATO;
}
