/* LP-01 E3: arrange the existing explorer and authenticated planner in one workspace. */
(() => {
  'use strict';
  const root = document.getElementById('productionPlannerPanel');
  const explorer = document.getElementById('sgpPlannerExplorer');
  const operations = root?.querySelector('.sgp-planner-operations');
  if (!root || !explorer || !operations) return;
  const redundantQueue = document.getElementById('sgpPendingAssemblyQueue');
  if (redundantQueue) { redundantQueue.hidden = true; redundantQueue.setAttribute('aria-hidden', 'true'); }

  const workspace = document.createElement('div');
  workspace.className = 'lp01-workspace';
  workspace.style.setProperty('--lp01-left', '320px');
  const splitter = document.createElement('div');
  splitter.className = 'lp01-splitter';
  splitter.setAttribute('role', 'separator');
  splitter.setAttribute('aria-label', 'Ajustar ancho del explorador de reservas');
  splitter.setAttribute('aria-orientation', 'vertical');
  splitter.setAttribute('aria-valuemin', '280');
  splitter.setAttribute('aria-valuemax', '680');
  splitter.setAttribute('aria-valuenow', '320');
  splitter.tabIndex = 0;
  explorer.before(workspace);
  workspace.append(explorer, splitter, operations);
  const assignmentList = document.getElementById('sgpPlanAssignments');
  if (assignmentList) {
    const disclosure = document.createElement('details');
    disclosure.className = 'lp01-assignment-disclosure';
    disclosure.innerHTML = '<summary>Detalle de asignaciones y registro de Ensamble</summary>';
    assignmentList.before(disclosure);
    disclosure.append(assignmentList);
  }

  function setWidth(value) {
    const max = Math.min(680, Math.max(280, workspace.clientWidth - 460));
    const width = Math.min(max, Math.max(280, Math.round(value)));
    workspace.style.setProperty('--lp01-left', `${width}px`);
    splitter.setAttribute('aria-valuenow', String(width));
  }
  let dragging = false;
  splitter.addEventListener('pointerdown', event => { dragging = true; splitter.setPointerCapture(event.pointerId); event.preventDefault(); });
  splitter.addEventListener('pointermove', event => { if (dragging) setWidth(event.clientX - workspace.getBoundingClientRect().left); });
  splitter.addEventListener('pointerup', () => { dragging = false; });
  splitter.addEventListener('pointercancel', () => { dragging = false; });
  splitter.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const current = Number(splitter.getAttribute('aria-valuenow'));
    setWidth(event.key === 'Home' ? 280 : event.key === 'End' ? 680 : current + (event.key === 'ArrowRight' ? 24 : -24));
  });

  const lineFilter = document.createElement('label');
  lineFilter.className = 'lp01-line-filter';
  lineFilter.textContent = 'Línea ';
  const lineSelect = document.createElement('select');
  lineSelect.id = 'lp01Line';
  lineSelect.setAttribute('aria-label', 'Línea de producción de LP-01');
  const assemblyLine = document.getElementById('assemblyLine');
  if (assemblyLine) {
    lineSelect.replaceChildren(...Array.from(assemblyLine.options, option => new Option(option.text, option.value)));
    lineSelect.value = assemblyLine.value;
    lineSelect.addEventListener('change', () => {
      assemblyLine.value = lineSelect.value;
      assemblyLine.dispatchEvent(new Event('change', { bubbles: true }));
      document.getElementById('sgpExplorerLoad')?.click();
      document.getElementById('sgpPlanLoad')?.click();
    });
    assemblyLine.addEventListener('change', () => { lineSelect.value = assemblyLine.value; });
  }
  lineFilter.append(lineSelect);
  explorer.querySelector('.sgp-explorer-filters')?.prepend(lineFilter);

  const capacityLabel = document.createElement('label');
  capacityLabel.className = 'lp01-capacity';
  capacityLabel.innerHTML = 'Capacidad orientativa / turno <input id="lp01Capacity" type="number" min="1" step="1" value="90" aria-label="Capacidad orientativa por turno">';
  operations.querySelector('.sgp-line-views')?.prepend(capacityLabel);
  const capacity = capacityLabel.querySelector('input');
  function markCapacity() {
    const limit = Number(capacity.value);
    const assignments = window.SGPLinePlanner?.getAssignments?.() || [];
    for (const element of operations.querySelectorAll('[data-lp-shift]')) {
      const load = assignments.filter(item => String(item.fecha).slice(0, 10) === element.dataset.lpDate && Number(item.turno) === Number(element.dataset.lpShift))
        .reduce((sum, item) => sum + (Number(item.cantidad) || 0), 0);
      let warning = element.querySelector('.lp01-capacity-warning');
      if (!warning) { warning = document.createElement('small'); warning.className = 'lp01-capacity-warning'; (element.querySelector('.lp-week-cell-head') || element.querySelector('summary'))?.append(warning); }
      const label = Number.isFinite(limit) && limit > 0 ? ` · ${load}/${limit} de capacidad${load > limit ? ' · Sobrecupo (advertencia)' : ''}` : ' · Capacidad no definida';
      if (warning.textContent !== label) warning.textContent = label;
    }
  }
  const observer = new MutationObserver(markCapacity);
  observer.observe(operations.querySelector('.sgp-line-view-content'), { childList: true, subtree: true });
  capacity.addEventListener('input', markCapacity);
  markCapacity();

  // The drop only prepares the existing single-production form. A separate click saves it.
  explorer.addEventListener('dragstart', event => {
    const button = event.target.closest('[data-plan-key]');
    if (!button?.dataset.planKey) return;
    event.dataTransfer.setData('text/plain', button.dataset.planKey);
    event.dataTransfer.effectAllowed = 'copy';
  });
  const makeDraggable = () => {
    explorer.querySelectorAll('[data-plan-key]').forEach(button => { button.draggable = Boolean(button.dataset.planKey); });
    explorer.querySelectorAll('.sgp-explorer-reservation').forEach(reservation => {
      if (reservation.querySelector('[data-plan-reserve]')) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.planReserve = 'true';
      button.textContent = 'Preparar reserva completa';
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        const keys = [...reservation.querySelectorAll('[data-plan-key]')].map(item => item.dataset.planKey).filter(Boolean);
        const reserve = reservation.querySelector('summary strong')?.textContent || 'seleccionada';
        const result = window.SGPLinePlanner?.selectPart?.(keys, { parte: reserve });
        document.getElementById('sgpExplorerSelection').textContent = result?.message || 'No se pudo preparar la reserva.';
        if (result?.ok) operations.scrollIntoView({ block: 'start', behavior: 'smooth' });
      });
      reservation.querySelector('summary')?.append(button);
    });
  };
  new MutationObserver(makeDraggable).observe(explorer.querySelector('#sgpExplorerResults'), { childList: true, subtree: true });
  makeDraggable();
  const confirmation = document.createElement('dialog');
  confirmation.className = 'lp01-drop-dialog';
  confirmation.innerHTML = '<form method="dialog"><h3>Preparar programación</h3><p id="lp01DropContext"></p><label>Cantidad <input id="lp01DropQuantity" type="number" min="1" step="1" required></label><label>Prioridad <input id="lp01DropPriority" type="number" min="1" step="1" required></label><p>La asignación se guardará únicamente después de pulsar Programar en el formulario existente.</p><div class="lp01-drop-actions"><button type="button" id="lp01DropCancel">Cancelar</button><button type="submit">Preparar formulario</button></div></form>';
  document.body.append(confirmation);
  let dropSelection = null;
  confirmation.querySelector('#lp01DropCancel').onclick = () => confirmation.close();
  confirmation.querySelector('form').addEventListener('submit', event => {
    event.preventDefault();
    if (!dropSelection) return;
    const quantity = Number(confirmation.querySelector('#lp01DropQuantity').value);
    const priority = Number(confirmation.querySelector('#lp01DropPriority').value);
    if (!Number.isInteger(quantity) || quantity < 1 || !Number.isInteger(priority) || priority < 1) return;
    const result = window.SGPLinePlanner?.selectProduction?.(dropSelection.key);
    if (!result?.ok) { document.getElementById('sgpPlanMessage').textContent = result?.message || 'No se pudo seleccionar la producción.'; confirmation.close(); return; }
    document.getElementById('sgpPlanDate').value = dropSelection.date;
    document.getElementById('sgpPlanShift').value = dropSelection.shift;
    document.getElementById('sgpPlanQuantity').value = String(quantity);
    document.getElementById('sgpPlanPriority').value = String(priority);
    confirmation.close();
    document.getElementById('sgpPlanMessage').textContent = 'Formulario preparado. Revisa las asignaciones existentes y pulsa Programar para solicitar el guardado.';
    document.getElementById('sgpPlanProduction')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  });
  operations.addEventListener('dragover', event => { if (event.target.closest('[data-lp-shift]')) event.preventDefault(); });
  operations.addEventListener('drop', event => {
    const target = event.target.closest('[data-lp-shift]');
    if (!target) return;
    event.preventDefault();
    const key = event.dataTransfer.getData('text/plain');
    if (!key) return;
    const row = window.SGPPlannerBridge?.getRows?.().find(item => String(item.key_produccion) === key);
    if (!row) { document.getElementById('sgpPlanMessage').textContent = 'Producción no disponible en la hoja cargada.'; return; }
    dropSelection = { key, date: target.dataset.lpDate, shift: target.dataset.lpShift };
    confirmation.querySelector('#lp01DropContext').textContent = `${row.produccion || key} · ${dropSelection.date} · Turno ${dropSelection.shift}`;
    confirmation.querySelector('#lp01DropQuantity').value = Number(row.saldo_ensamble) > 0 ? String(Number(row.saldo_ensamble)) : '';
    confirmation.querySelector('#lp01DropPriority').value = document.getElementById('sgpPlanPriority').value || '1';
    confirmation.showModal();
  });

  const style = document.createElement('style');
  style.textContent = `.lp01-workspace{display:grid;grid-template-columns:minmax(280px,var(--lp01-left)) 9px minmax(0,1fr);align-items:start;gap:0;min-width:0}.lp01-workspace #sgpPlannerExplorer{min-width:0;margin:0;max-height:82vh;overflow:auto}.lp01-workspace .sgp-planner-operations{min-width:0;margin:0}.lp01-workspace #sgpExplorerResults{display:grid;grid-template-columns:minmax(0,1fr)}.lp01-workspace .sgp-explorer-filters{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px}.lp01-workspace .sgp-explorer-filters>*{min-width:0!important;width:100%;box-sizing:border-box}.lp01-workspace .sgp-explorer-filters select,.lp01-workspace .sgp-explorer-filters input{min-width:0!important;width:100%;box-sizing:border-box}.lp01-workspace .sgp-explorer-view-actions>*{min-width:0;max-width:100%}.lp01-workspace .sgp-line-days{grid-template-columns:repeat(7,minmax(0,1fr))}.lp01-workspace .sgp-line-day{min-width:0;padding:7px;font-size:11px}.lp01-splitter{height:100%;min-height:500px;cursor:col-resize;background:#dbe8f8;border-left:2px solid #9fc0eb;border-right:2px solid #9fc0eb}.lp01-splitter:focus-visible{outline:3px solid #1264c8;outline-offset:2px}.lp01-line-filter{display:grid;gap:4px}.lp01-capacity{display:flex;gap:8px;align-items:center;justify-content:flex-end;color:#36567e;font-size:12px}.lp01-capacity input{width:72px!important}.lp01-capacity-warning{color:#385b83;font-weight:700}.lp01-assignment-disclosure{margin-top:10px;border:1px solid #d5e1ef;border-radius:9px;padding:10px}.lp01-assignment-disclosure summary{cursor:pointer;font-weight:700;color:#103b73}.lp01-workspace [data-plan-key]{cursor:grab}.lp01-workspace [data-plan-reserve]{display:block;margin-top:8px;border:1px solid #1264c8;border-radius:8px;background:#fff;color:#103b73;min-height:36px}.lp01-workspace [data-lp-shift]{min-height:84px;border:1px dashed #a5c5eb}@media(max-width:900px){.lp01-workspace{display:block}.lp01-splitter{display:none}.lp01-workspace #sgpPlannerExplorer{max-height:none}.lp01-workspace .sgp-planner-operations{margin-top:12px}.lp01-workspace .sgp-line-days{grid-template-columns:repeat(2,minmax(0,1fr))}.lp01-workspace .sgp-explorer-filters{grid-template-columns:1fr!important}}`;
  style.textContent += '.lp01-workspace #sgpPendingAssemblyQueue[hidden]{display:none!important}.lp-week-toolbar{display:flex;align-items:end;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:8px 0 12px}.lp-week-toolbar h4{margin:0;color:#103b73}.lp-week-toolbar small{color:#526781}.lp-week-controls{display:flex;align-items:end;gap:6px;flex-wrap:wrap}.lp-week-controls label{font-size:12px}.lp-week-controls button,.lp-week-controls input{min-height:38px;padding:6px;border:1px solid #b9cfe9;border-radius:8px;background:#fff;color:#103b73;font-weight:650}.lp-week-scroll{overflow-x:auto;max-width:100%}.lp-week-grid{display:grid;grid-template-columns:64px repeat(7,minmax(0,1fr));gap:5px;min-width:0}.lp-week-corner,.lp-week-day,.lp-week-shift{padding:8px;background:#dceafa;color:#103b73;font-size:12px;font-weight:750;border-radius:7px}.lp-week-day{text-align:center;text-transform:capitalize}.lp-week-shift{display:flex;align-items:center}.lp-week-cell{min-width:0;min-height:132px;padding:7px;border:1px dashed #9fc0eb;border-radius:9px;background:#fff;box-sizing:border-box;overflow-wrap:anywhere}.lp-week-cell-head{display:grid;gap:3px;color:#103b73;font-size:11px}.lp-week-cell-head small,.lp-week-systems{display:block;color:#526781;font-size:11px}.lp-week-empty{display:block;margin-top:16px;color:#68809c}.lp-week-assignment{padding:6px;margin:6px 0;border-left:3px solid #1264c8;border-radius:5px;background:#eef5ff;font-size:11px}.lp-week-assignment strong,.lp-week-assignment small{display:block}.lp-week-legend{font-size:12px;color:#526781}.lp-week-cell:focus-within,.lp-week-cell:hover{border-color:#1264c8;background:#f7fbff}.lp01-drop-dialog{max-width:min(420px,calc(100vw - 24px));border:1px solid #9fc0eb;border-radius:14px;padding:22px;box-shadow:0 20px 55px #102e5366;color:#103b73}.lp01-drop-dialog::backdrop{background:#102e5380}.lp01-drop-dialog form{display:grid;gap:12px}.lp01-drop-dialog h3,.lp01-drop-dialog p{margin:0}.lp01-drop-dialog label{display:grid;gap:4px}.lp01-drop-dialog input{width:100%;box-sizing:border-box;min-height:42px}.lp01-drop-actions{display:flex;justify-content:flex-end;gap:8px}.lp01-drop-actions button{min-height:42px;padding:8px 12px;border-radius:8px;border:1px solid #1264c8;background:#fff;color:#103b73}.lp01-drop-actions button[type=submit]{background:#1264c8;color:white}@media(max-width:900px){.lp-week-grid{grid-template-columns:55px repeat(7,minmax(120px,1fr));min-width:950px}.lp-week-controls{width:100%}.lp-week-controls button{flex:1}}';
  document.head.append(style);
})();
