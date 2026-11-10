const deliveryErrors = {
  PDT_SIMPLE_ENTREGAS_PREVIAS_POR_CONCILIAR: 'Este PDT tiene entregas anteriores pendientes de conciliar. Revisa el historial antes de confirmar otra cantidad.',
  PDT_SIMPLE_COBERTURA_ANTERIOR_NO_ACREDITADA: 'La entrega anterior no coincide con este PDT. Revisa el historial antes de confirmar otra cantidad.',
  PDT_SIMPLE_SUPERA_PROCESADO_O_TOTAL: 'La cantidad supera las piezas procesadas disponibles. Actualiza el PDT.',
  PDT_SIMPLE_NO_APTO: 'El PDT cambió o aún no está listo para entregar. Actualiza sus datos.',
  PDT_SIMPLE_CLAVE_REUTILIZADA: 'La operación pendiente corresponde a otra cantidad. Actualiza el PDT y revisa el historial.',
  PDT_SIMPLE_SALDOS_INCONSISTENTES: 'Las cantidades anteriores no coinciden. Revisa el historial antes de registrar otra entrega.',
};
function readableDeliveryError(error) {
  const message = ['55P03','40P01'].includes(error.code) ? 'Otra operación está actualizando esta entrega. Vuelve a confirmar con la misma cantidad.' : deliveryErrors[error.message];
  return message ? Object.assign(new Error(message), {code: error.code}) : error;
}

/** Direct PDT delivery. All quantities and completion come from the server. */
export function adaptPdtPickingSimple(payload, details) {
  if (payload?.ok !== true || payload.contract_version !== 1 ||
      !Array.isArray(payload.detalles) || !Array.isArray(payload.entregas) ||
      typeof payload.finalizado !== 'boolean') throw new Error('Estado de entrega PDT no disponible');
  if (payload.modo === 'ANTERIOR_PENDIENTE') {
    if (payload.detalles.length || payload.entregas.length) throw new Error('Cobertura anterior no verificable');
    return {...payload, legacy: true};
  }
  const expected = new Map(details.map(detail => [String(detail.id_detalle), detail]));
  const seen = new Set();
  const rows = payload.detalles.map(detail => {
    const id = String(detail.id_detalle || ''), original = expected.get(id);
    if (!original || seen.has(id)) throw new Error('Detalle de entrega no reconocido');
    seen.add(id);
    for (const field of ['cantidad_validada', 'procesada', 'entregada', 'saldo_entrega', 'disponible_entrega']) {
      if (detail[field] === null || detail[field] === '' || !Number.isSafeInteger(Number(detail[field])) || Number(detail[field]) < 0)
        throw new Error('Cantidad de entrega no válida');
    }
    const amounts = Object.fromEntries(['cantidad_validada', 'procesada', 'entregada', 'saldo_entrega', 'disponible_entrega'].map(key => [key, Number(detail[key])]));
    if (amounts.cantidad_validada !== Number(original.cantidad_validada) ||
        amounts.procesada !== Number(original.avance_neto) || amounts.entregada > amounts.procesada ||
        amounts.procesada > amounts.cantidad_validada ||
        amounts.saldo_entrega !== amounts.cantidad_validada - amounts.entregada ||
        amounts.disponible_entrega !== amounts.procesada - amounts.entregada)
      throw new Error('Las cantidades cambiaron. Actualiza el PDT');
    return {...original, ...detail, ...amounts};
  });
  if (seen.size !== expected.size || !rows.length) throw new Error('Cobertura de detalles incompleta');
  if (payload.finalizado && rows.some(row => row.saldo_entrega !== 0)) throw new Error('Cierre de entrega incoherente');
  return {...payload, detalles: rows};
}

export async function loadPdtPickingSimple(client, token, id, details) {
  const result = await client.rpc('sgp_pdt_picking_simple_estado_v1', {p_token: token, p_id: id});
  if (result.error) throw readableDeliveryError(result.error);
  return adaptPdtPickingSimple(result.data, details);
}

export async function confirmPdtPickingSimple(client, args) {
  if (!args.p_id_detalle || !Number.isSafeInteger(args.p_cantidad) || args.p_cantidad <= 0 || !args.p_idempotency_key)
    throw new Error('Indica una fabricación y una cantidad entera positiva');
  const result = await client.rpc('sgp_pdt_picking_simple_v1', args);
  if (result.error) throw readableDeliveryError(result.error);
  if (result.data?.ok !== true || typeof result.data.finalizado !== 'boolean') throw new Error('No se pudo confirmar la entrega');
  return result.data;
}
