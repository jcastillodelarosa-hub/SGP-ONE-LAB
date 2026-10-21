// Isolated presentation model. Not wired into production navigation or Supabase.
import { summarizeDeliveryEvents, flattenDeliveryDetails } from '../domain/picking-delivery-report.js';
export function buildPickingReportViewModel(events = [], filters = {}) {
 const totals = summarizeDeliveryEvents(events);
 const deliveries = events.map(event => ({
  id_entrega:event.id_entrega,
  fecha_operativa:event.fecha_operativa,
  turno_entrega:event.turno_entrega,
  reserva:event.reserva,
  parte:event.parte,
  produccion:event.produccion,
  sistema:event.sistema,
  acabado:event.acabado,
  responsable:event.usuario_entrega,
  estado:event.completa===true?'COMPLETA':'PARCIAL'
 }));
 return {filters,totals,systems:totals.porSistema,deliveries,missing:flattenDeliveryDetails(events),
  notice:'Los movimientos no representan cantidades físicas de ventanas entregadas.'};
}
