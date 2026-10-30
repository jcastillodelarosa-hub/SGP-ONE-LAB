/* LP-01 E3: arrange the existing explorer and authenticated planner in one workspace. */
(() => {
  'use strict';
  const root = document.getElementById('productionPlannerPanel');
  const explorer = document.getElementById('sgpPlannerExplorer');
  const operations = root?.querySelector('.sgp-planner-operations');
  if (!root || !explorer || !operations) return;

  const workspace = document.createElement('div');
  workspace.className = 'lp01-workspace';
  workspace.style.setProperty('--lp01-left', '370px');
  const splitter = document.createElement('div');
  splitter.className = 'lp01-splitter';
  splitter.setAttribute('role', 'separator');
  splitter.setAttribute('aria-label', 'Ajustar ancho del explorador de reservas');
  splitter.setAttribute('aria-orientation', 'vertical');
  splitter.setAttribute('aria-valuemin', '280');
  splitter.setAttribute('aria-valuemax', '680');
  splitter.setAttribute('aria-valuenow', '370');
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
      if (!warning) { warning = document.createElement('small'); warning.className = 'lp01-capacity-warning'; element.querySelector('summary')?.append(warning); }
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
  operations.addEventListener('dragover', event => { if (event.target.closest('[data-lp-shift]')) event.preventDefault(); });
  operations.addEventListener('drop', event => {
    const target = event.target.closest('[data-lp-shift]');
    if (!target) return;
    event.preventDefault();
    const key = event.dataTransfer.getData('text/plain');
    if (!key) return;
    if (!window.confirm(`Preparar programación para ${target.dataset.lpDate}, turno ${target.dataset.lpShift}? Revisa cantidad, prioridad y asignaciones antes de guardar.`)) return;
    const result = window.SGPLinePlanner?.selectProduction?.(key);
    if (!result?.ok) { document.getElementById('sgpPlanMessage').textContent = result?.message || 'No se pudo seleccionar la producción.'; return; }
    document.getElementById('sgpPlanDate').value = target.dataset.lpDate;
    document.getElementById('sgpPlanShift').value = target.dataset.lpShift;
    document.getElementById('sgpPlanProduction')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  });

  const style = document.createElement('style');
  style.textContent = `.lp01-workspace{display:grid;grid-template-columns:minmax(280px,var(--lp01-left)) 9px minmax(0,1fr);align-items:start;gap:0;min-width:0}.lp01-workspace #sgpPlannerExplorer{min-width:0;margin:0;max-height:82vh;overflow:auto}.lp01-workspace .sgp-planner-operations{min-width:0;margin:0}.lp01-workspace #sgpExplorerResults{display:grid;grid-template-columns:minmax(0,1fr)}.lp01-workspace .sgp-explorer-filters{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px}.lp01-workspace .sgp-explorer-filters>*{min-width:0!important;width:100%;box-sizing:border-box}.lp01-workspace .sgp-explorer-filters select,.lp01-workspace .sgp-explorer-filters input{min-width:0!important;width:100%;box-sizing:border-box}.lp01-workspace .sgp-explorer-view-actions>*{min-width:0;max-width:100%}.lp01-workspace .sgp-line-days{grid-template-columns:repeat(7,minmax(0,1fr))}.lp01-workspace .sgp-line-day{min-width:0;padding:7px;font-size:11px}.lp01-splitter{height:100%;min-height:500px;cursor:col-resize;background:#dbe8f8;border-left:2px solid #9fc0eb;border-right:2px solid #9fc0eb}.lp01-splitter:focus-visible{outline:3px solid #1264c8;outline-offset:2px}.lp01-line-filter{display:grid;gap:4px}.lp01-capacity{display:flex;gap:8px;align-items:center;justify-content:flex-end;color:#36567e;font-size:12px}.lp01-capacity input{width:72px!important}.lp01-capacity-warning{color:#385b83;font-weight:700}.lp01-assignment-disclosure{margin-top:10px;border:1px solid #d5e1ef;border-radius:9px;padding:10px}.lp01-assignment-disclosure summary{cursor:pointer;font-weight:700;color:#103b73}.lp01-workspace [data-plan-key]{cursor:grab}.lp01-workspace [data-plan-reserve]{display:block;margin-top:8px;border:1px solid #1264c8;border-radius:8px;background:#fff;color:#103b73;min-height:36px}.lp01-workspace [data-lp-shift]{min-height:84px;border:1px dashed #a5c5eb}@media(max-width:900px){.lp01-workspace{display:block}.lp01-splitter{display:none}.lp01-workspace #sgpPlannerExplorer{max-height:none}.lp01-workspace .sgp-planner-operations{margin-top:12px}.lp01-workspace .sgp-line-days{grid-template-columns:repeat(2,minmax(0,1fr))}.lp01-workspace .sgp-explorer-filters{grid-template-columns:1fr!important}}`;
  document.head.append(style);
})();
