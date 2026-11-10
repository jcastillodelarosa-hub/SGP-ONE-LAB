import {programmingPartsPlan, programmingPlanSignature, validateProgrammingDestination} from '../domain/programming-part-selection.js';

async function within(promise, timeoutMs) {
  let timer;
  try {return await Promise.race([promise, new Promise((_, reject) => {timer=setTimeout(() => reject(Error('Tiempo de espera agotado; el servidor podría seguir procesando la solicitud')), timeoutMs);})]);}
  finally {clearTimeout(timer);}
}

// Existing RPC commits each part separately. Never imply an atomic batch or retry a write.
export async function saveProgrammingParts({client, token, isCurrent = () => true, reserva, plan, date, shift, priority, observation = '', orderObservation = '', notes = {}, timeoutMs = 25000}) {
  validateProgrammingDestination({date, shift, priority}, plan.length);
  if (!token || !isCurrent()) throw Error('La sesión cambió. Abre de nuevo Programación.');
  const readPlan = async priorities => {
    const [available, coverage] = await within(Promise.all([
      client.rpc('sgp_mecanizado_disponibles', {p_token: token, p_semana: null}),
      client.rpc('sgp_mecanizado_cobertura_ordenes', {p_token: token, p_semana: null})
    ]), timeoutMs);
    if (available.error || coverage.error) throw Error('No se pudo verificar el saldo antes de guardar: ' + (available.error || coverage.error).message);
    if (!Array.isArray(available.data) || !Array.isArray(coverage.data)) throw Error('Respuesta incompleta al verificar las partes. Actualiza Programación.');
    const reserves = available.data.filter(r => String(r.reserva) === String(reserva));
    if (reserves.length !== 1) throw Error('La reserva cambió o ya no está disponible. Actualiza Programación.');
    return programmingPartsPlan(reserva, reserves[0].partes || [], priorities, coverage.data);
  };
  const fresh = await readPlan(plan.map(p => p.priority));
  const verify = (actual, expected) => {
    if (programmingPlanSignature(actual) !== programmingPlanSignature(expected)) throw Error('La composición o el saldo de las partes cambió. Actualiza Programación y vuelve a seleccionar.');
  };
  verify(fresh, plan);
  const completed = [];
  for (const part of fresh) {
    // Refresh again after each prior write; do not silently adopt a changed part.
    if (completed.length) {
      try {verify(await readPlan([part.priority]), [part]);}
      catch (error) {return {completed, failed: part.priority, uncertain: false, message: error?.message || String(error)};}
    }
    if (!isCurrent()) return {completed, failed: part.priority, uncertain: false, message: 'La sesión cambió. Se detuvo el lote.'};
    try {
      const response = await within(client.rpc('sgp_mecanizado_programar', {
        p_token: token, p_reserva: reserva, p_produccion: null, p_cantidad: part.quantity,
        p_fecha: date, p_turno: shift, p_prioridad: priority + completed.length,
        p_prioridad_semanal: part.priority, p_observacion: observation,
        p_observacion_orden: [orderObservation, ...part.orders.map(o => notes[o.key] ? o.production + ': ' + notes[o.key] : '')].filter(Boolean).join(' | ')
      }), timeoutMs);
      if (response.error) return {completed, failed: part.priority, uncertain: !/^(P\d{4}|22\w{3}|23\w{3}|42501)$/.test(response.error.code || ''), message: response.error.message || 'No se recibió confirmación.'};
      if (!response.data || typeof response.data !== 'string') return {completed, failed: part.priority, uncertain: true, message: 'El servidor no devolvió el identificador de la programación.'};
      completed.push({priority: part.priority, id: response.data});
    } catch (error) {
      return {completed, failed: part.priority, uncertain: true, message: error?.message || String(error)};
    }
  }
  return {completed, failed: null, uncertain: false};
}
