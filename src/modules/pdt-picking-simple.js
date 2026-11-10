/** Reuses the PDT layout. A confirmation records only the quantity entered. */
export function pdtPickingSimpleForm(state, canRegister, esc) {
  if (state.error) return '<section class="repo-modal-section" data-pdt-section="picking"><h3>Entrega Picking</h3><p role="alert">No se pudo consultar la entrega: '+esc(state.error)+'. Usa Actualizar PDT. No registres de nuevo una operación sin confirmar.</p></section>';
  const details = state.detalles || [];
  let html = '<section class="repo-modal-section" data-pdt-section="picking"><h3>Entrega Picking</h3><p>Confirma la cantidad que entregas ahora. Al completar todas las piezas, el PDT finalizará y saldrá de Pendientes de aluminio. Las entregas parciales quedan abiertas y conservan su historial.</p><div class="pdt-table-wrap"><table><thead><tr><th>Fabricación</th><th>Longitud</th><th>Acabado</th><th>Procesadas</th><th>Entregadas</th><th>Por entregar</th></tr></thead><tbody>'+details.map(d=>'<tr>'+[d.fabricacion,d.longitud,d.acabado,d.procesada,d.entregada,d.saldo_entrega].map(value=>'<td>'+esc(value)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
  if (state.finalizado) html += '<p role="status"><b>PDT finalizado.</b> Las cantidades entregadas y el historial se conservan.</p>';
  else if (canRegister && details.length && details.every(d=>d.saldo_entrega===0)) html += '<p>La entrega anterior ya cubre todas las piezas; no registres otra cantidad.</p><button type="button" data-operation="close">Finalizar PDT ya entregado</button>';
  else if (canRegister) html += '<label>Fabricación<select data-pick-detail>'+details.map(d=>'<option value="'+esc(d.id_detalle)+'" '+(!d.disponible_entrega?'disabled':'')+'>'+esc(d.fabricacion)+' · '+esc(d.longitud)+' · '+esc(d.acabado)+' · listas para entregar: '+esc(d.disponible_entrega)+'</option>').join('')+'</select></label><label>Cantidad que entregas ahora<input type="number" min="1" step="1" inputmode="numeric" data-pick-qty></label><p data-pick-help role="status">Indica la cantidad efectivamente entregada.</p><button type="button" data-operation="delivery" disabled>Confirmar entrega</button>';
  else html += '<p>Modo consulta · sin permiso para confirmar entregas.</p>';
  html += '<details><summary>Entregas registradas</summary><ol class="pdt-history">'+(state.entregas||[]).map(e=>'<li><b>'+esc(details.find(d=>d.id_detalle===e.id_detalle)?.fabricacion||'Detalle')+' · '+esc(e.cantidad)+'</b><span>'+esc(e.creado_en||'—')+' · '+esc(e.usuario||'—')+'</span></li>').join('')+'</ol>'+(!state.entregas?.length?'<p>Sin nuevas entregas directas. La tabla conserva la cobertura anterior acreditada.</p>':'')+'</details></section>';
  return html;
}

export function pdtDeliveryInput(state, detailId, value) {
  const detail = state.detalles?.find(d=>String(d.id_detalle)===String(detailId));
  const quantity = Number(value), limit = detail?.disponible_entrega ?? 0;
  const valid = !state.error && !state.finalizado && Boolean(detail) && Number.isSafeInteger(quantity) && quantity > 0 && quantity <= limit;
  return {valid, quantity, limit, message: !limit ? 'No hay piezas procesadas pendientes de entregar en esta fabricación.' : value === '' ? 'Puedes entregar hasta '+limit+' piezas procesadas.' : valid ? 'Se registrarán '+quantity+' piezas entregadas ahora.' : 'Indica una cantidad entera entre 1 y '+limit+'.'};
}
