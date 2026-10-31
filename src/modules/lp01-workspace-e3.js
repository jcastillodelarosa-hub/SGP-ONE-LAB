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

  // Every interaction prepares the existing single-production form; none writes data.
  const results = explorer.querySelector('#sgpExplorerResults');
  const viewContent = operations.querySelector('.sgp-line-view-content');
  const selectedStatus = document.createElement('p');
  selectedStatus.className = 'lp01-selection-status';
  selectedStatus.setAttribute('role', 'status');
  selectedStatus.textContent = 'Selecciona una producción y toca una celda, o arrástrala desde su tarjeta.';
  operations.querySelector('.sgp-line-views')?.insertBefore(selectedStatus, viewContent);
  let selectedKey = null;
  let dragKey = null;
  let dragSelection = null;
  let activeCell = null;
  const cards = () => [...results.querySelectorAll('.sgp-explorer-order[data-lp-key]')];
  const cells = () => [...operations.querySelectorAll('.lp-week-cell[data-lp-date][data-lp-shift]')];
  const rowFor = key => (window.SGPPlannerBridge?.getRows?.() || []).find(item => String(item.key_produccion) === String(key));
  function markReady(ready) { cells().forEach(cell => cell.classList.toggle('lp01-drop-ready', ready)); }
  function highlight(cell) {
    if (activeCell === cell) return;
    activeCell?.classList.remove('lp01-drop-active');
    activeCell = cell;
    activeCell?.classList.add('lp01-drop-active');
  }
  function selectCard(key) {
    const row = rowFor(key);
    if (!row) return false;
    selectedKey = key;
    cards().forEach(card => { const selected = card.dataset.lpKey === key; card.classList.toggle('lp01-card-selected', selected); card.setAttribute('aria-selected', String(selected)); });
    selectedStatus.textContent = `${row.produccion || key} seleccionada. Toca una celda de día y turno, o arrastra la tarjeta.`;
    markReady(true);
    return true;
  }
  function clearDragVisual() { dragKey = null; dragSelection = null; cards().forEach(card => card.classList.remove('lp01-drag-source')); highlight(null); markReady(Boolean(selectedKey)); }
  const confirmation = document.createElement('dialog');
  confirmation.className = 'lp01-drop-dialog';
  confirmation.innerHTML = '<form><h3 id="lp01DropTitle">Confirmar programación</h3><p id="lp01DropContext"></p><p id="lp01DropWarning"></p><div id="lp01DropGroup" hidden></div><label id="lp01QuantityLabel">Cantidad <input id="lp01DropQuantity" type="number" min="1" step="1" required></label><label>Prioridad <input id="lp01DropPriority" type="number" min="1" step="1" required></label><p id="lp01DropMessage" role="status"></p><div class="lp01-drop-actions"><button type="button" id="lp01DropCancel">Cancelar</button><button type="button" id="lp01DropPrepare">Preparar formulario</button><button type="submit" id="lp01DropSubmit">Confirmar y programar</button></div></form>';
  document.body.append(confirmation);
  let dropSelection = null;
  let groupRequest = null;
  const input = id => confirmation.querySelector('#'+id);
  const keysFor = element => [...new Set([...element.querySelectorAll('[data-plan-key]')].map(item => item.dataset.planKey).filter(Boolean))];
  function groupPreview(keys) {
    const assignments=window.SGPLinePlanner?.getAssignments?.()||[];
    return keys.map(key=>{const row=rowFor(key);const relevant=assignments.filter(a=>String(a.key_produccion||'')===String(key));const programmed=relevant.reduce((total,a)=>total+(Number(a.cantidad)||0),0);const official=Number(row?.saldo_ensamble);return {key,name:row?.produccion||key,programmed,official,known:Boolean(row)&&Number.isFinite(official)&&official>=0&&relevant.every(a=>Number.isFinite(Number(a.cantidad)))};});
  }
  function openDrop(key, target) {
    if (confirmation.open || !target?.dataset.lpDate || !['1', '2'].includes(target.dataset.lpShift)) return;
    const selection=typeof key==='string'?{kind:'production',key}:key;
    if(selection.kind==='production'&&!rowFor(selection.key))return;
    dropSelection = { ...selection, date: target.dataset.lpDate, shift: target.dataset.lpShift };
    const group=selection.kind==='group';
    input('lp01DropTitle').textContent=group?'Vista previa de programación · '+selection.label:selection.kind==='move'?'Confirmar movimiento':'Confirmar programación';
    input('lp01DropContext').textContent=(group?selection.label:selection.kind==='move'?selection.assignment.produccion||'Asignación':rowFor(selection.key)?.produccion||selection.key)+' · '+dropSelection.date+' · Turno '+dropSelection.shift;
    input('lp01DropMessage').textContent='';input('lp01DropWarning').textContent=group?(window.SGPLP01_GROUP_RPC_ENABLED?'Revisa cantidades por producción. El servidor validará saldo global y podría aceptar solo una parte.':'Solo vista previa: la RPC agrupada no está habilitada. No se enviará ninguna escritura.'):selection.kind==='move'?'Asignación original: '+selection.assignment.fecha+' · turno '+selection.assignment.turno+' · '+selection.assignment.cantidad+' unidades. El movimiento no programa otra producción.':'Comprueba la cantidad pendiente y las asignaciones existentes. El servidor validará permisos y saldo.';
    input('lp01DropGroup').hidden=!group;
    if(group){const preview=groupPreview(selection.keys);input('lp01DropGroup').replaceChildren();const summary=document.createElement('p');summary.textContent=preview.length+' producciones · saldo Export '+preview.filter(p=>p.known).reduce((n,p)=>n+p.official,0)+' · ya programadas en semana consultada '+preview.reduce((n,p)=>n+p.programmed,0)+'. Las cantidades pendientes requieren conciliación servidor con todas las asignaciones.';input('lp01DropGroup').append(summary);for(const item of preview){const line=document.createElement('p');line.textContent=item.name+' · saldo Export '+(item.known?item.official:'sin dato')+' · programadas visibles '+item.programmed;input('lp01DropGroup').append(line);if(window.SGPLP01_GROUP_RPC_ENABLED){const label=document.createElement('label');label.textContent='Cantidad a programar para '+item.name;const qty=document.createElement('input');qty.type='number';qty.min='0';qty.step='1';qty.value='0';qty.dataset.lpGroupQuantity=item.key;label.append(qty);input('lp01DropGroup').append(label)}}groupRequest=crypto.randomUUID();}
    input('lp01QuantityLabel').hidden=group;input('lp01DropPriority').closest('label').hidden=group&&!window.SGPLP01_GROUP_RPC_ENABLED;input('lp01DropPrepare').hidden=group||selection.kind==='move';input('lp01DropSubmit').hidden=group&&!window.SGPLP01_GROUP_RPC_ENABLED;
    input('lp01DropQuantity').required=!group;input('lp01DropQuantity').value=selection.kind==='move'?String(selection.assignment.cantidad):'';
    input('lp01DropPriority').value=selection.kind==='move'?String(selection.assignment.prioridad||1):document.getElementById('sgpPlanPriority').value||'1';
    if(group&&window.SGPLP01_GROUP_RPC_ENABLED){input('lp01DropSubmit').disabled=true;input('lp01DropMessage').textContent='Consultando saldos globales…';const selectionRef=dropSelection;window.SGPLinePlanner.groupBalances(selection.keys).then(balances=>{if(dropSelection!==selectionRef||!confirmation.open)return;for(const item of balances){const field=[...input('lp01DropGroup').querySelectorAll('[data-lp-group-quantity]')].find(node=>node.dataset.lpGroupQuantity===item.key_produccion);if(!field)continue;const pending=Number(item.pendiente);field.value=Number.isInteger(pending)&&pending>0?String(pending):'0';field.max=Number.isInteger(pending)&&pending>=0?String(pending):'0';field.disabled=!Number.isInteger(pending)||pending<=0||Boolean(item.inconsistente);const line=document.createElement('small');line.textContent='Saldo global '+(item.pendiente===null?'no disponible':item.pendiente)+' · asignadas '+item.asignado_global+(item.inconsistente?' · revisar inconsistencia':'');field.closest('label').append(line)}input('lp01DropSubmit').disabled=false;input('lp01DropMessage').textContent='Saldo global consultado. Las cantidades se revalidarán al confirmar.'}).catch(error=>{if(dropSelection===selectionRef){input('lp01DropMessage').textContent='No se pudo consultar el saldo global: '+error.message;input('lp01DropSubmit').disabled=true}})}
    confirmation.showModal();
  }
  input('lp01DropGroup').addEventListener('input',()=>{groupRequest=crypto.randomUUID()});
  input('lp01DropPriority').addEventListener('input',()=>{if(dropSelection?.kind==='group')groupRequest=crypto.randomUUID()});
  input('lp01DropCancel').onclick=()=>confirmation.close();
  confirmation.addEventListener('close',()=>{if(confirmation.open)return;dropSelection=null;groupRequest=null;input('lp01DropSubmit').disabled=false});
  input('lp01DropPrepare').onclick=()=>{if(!dropSelection||dropSelection.kind!=='production')return;const result=window.SGPLinePlanner?.selectProduction?.(dropSelection.key);if(!result?.ok){input('lp01DropMessage').textContent=result?.message||'Producción no disponible';return}document.getElementById('sgpPlanDate').value=dropSelection.date;document.getElementById('sgpPlanShift').value=dropSelection.shift;document.getElementById('sgpPlanQuantity').value=input('lp01DropQuantity').value;document.getElementById('sgpPlanPriority').value=input('lp01DropPriority').value;confirmation.close();document.getElementById('sgpPlanMessage').textContent='Formulario preparado. Pulsa Programar para guardar.'};
  confirmation.querySelector('form').addEventListener('submit',async event=>{
    event.preventDefault();if(!dropSelection||input('lp01DropSubmit').disabled)return;
    if(dropSelection.kind==='group'){const fields=[...input('lp01DropGroup').querySelectorAll('[data-lp-group-quantity]')];const priority=Number(input('lp01DropPriority').value);const items=fields.map(field=>({key_produccion:field.dataset.lpGroupQuantity,cantidad:Number(field.value),prioridad:priority})).filter(item=>item.cantidad>0);if(!items.length||items.some(item=>!Number.isInteger(item.cantidad))||!Number.isInteger(priority)||priority<1){input('lp01DropMessage').textContent='Selecciona cantidades enteras positivas y una prioridad válida.';return}input('lp01DropSubmit').disabled=true;try{const result=await window.SGPLinePlanner.programGroup({requestId:groupRequest,day:dropSelection.date,shift:dropSelection.shift,items});input('lp01DropMessage').textContent=result.aceptadas.length+' aceptadas · '+result.rechazadas.length+' rechazadas · '+result.ventanas_programadas+' programadas · '+result.ventanas_pendientes+' pendientes. '+result.rechazadas.map(item=>item.key_produccion+': '+item.motivo).join(' · ');input('lp01DropSubmit').hidden=true;}catch(error){input('lp01DropMessage').textContent='Grupo rechazado: '+error.message;input('lp01DropSubmit').disabled=false}return}
    const quantity=Number(input('lp01DropQuantity').value),priority=Number(input('lp01DropPriority').value);
    if(!Number.isInteger(quantity)||quantity<1||!Number.isInteger(priority)||priority<1){input('lp01DropMessage').textContent='Cantidad y prioridad deben ser enteros positivos.';return}
    input('lp01DropSubmit').disabled=true;input('lp01DropMessage').textContent='Validando con el servidor…';
    try{if(dropSelection.kind==='move')await window.SGPLinePlanner.moveDirect({assignment:dropSelection.assignment.id,day:dropSelection.date,shift:dropSelection.shift,quantity,priority});else await window.SGPLinePlanner.programDirect({key:dropSelection.key,day:dropSelection.date,shift:dropSelection.shift,quantity,priority});confirmation.close();selectedStatus.textContent='Operación confirmada por el servidor. Calendario actualizado.'}
    catch(error){input('lp01DropMessage').textContent='Operación rechazada: '+error.message;input('lp01DropSubmit').disabled=false}
  });
  const makeDraggable = () => {
    results.querySelectorAll('.sgp-explorer-order').forEach(card => {
      const key = card.querySelector('[data-plan-key]')?.dataset.planKey;
      if (!key) return;
      card.dataset.lpKey = key;
      card.draggable = true;
      card.tabIndex = 0;
      card.setAttribute('role', 'option');
      card.setAttribute('aria-selected', String(key === selectedKey));
      card.classList.toggle('lp01-card-selected', key === selectedKey);
    });
    results.querySelectorAll('.sgp-explorer-part').forEach(part => { const header=part.querySelector('.sgp-part-header'); if(header){header.draggable=true;header.tabIndex=0;header.dataset.lpGroup='part';} });
    explorer.querySelectorAll('.sgp-explorer-reservation').forEach(reservation => { const summary=reservation.querySelector('summary'); if(summary){summary.draggable=true;summary.tabIndex=0;summary.dataset.lpGroup='reserve';}
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
  new MutationObserver(makeDraggable).observe(results, { childList: true, subtree: true });
  makeDraggable();
  explorer.addEventListener('click', event => { const group=event.target.closest('[data-lp-group]');if(group&&!event.target.closest('button')){const container=group.dataset.lpGroup==='part'?group.closest('.sgp-explorer-part'):group.closest('.sgp-explorer-reservation');const keys=keysFor(container);if(keys.length){selectedKey=null;dragSelection={kind:'group',keys,label:group.querySelector('strong')?.textContent||'Grupo'};selectedStatus.textContent=dragSelection.label+' seleccionada. Toca una celda para ver el desglose.';markReady(true);}return;}
    const card = event.target.closest('.sgp-explorer-order[data-lp-key]');
    if (!card || event.target.closest('button')) return;
    selectCard(card.dataset.lpKey);
  });
  explorer.addEventListener('keydown', event => {
    const card = event.target.closest('.sgp-explorer-order[data-lp-key]');
    if (card && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); selectCard(card.dataset.lpKey); }
  });
  operations.addEventListener('click', event => { const cell = event.target.closest('.lp-week-cell'); if (cell && (selectedKey||dragSelection?.kind==='group') && !event.target.closest('.lp-week-assignment')) openDrop(dragSelection?.kind==='group'?dragSelection:selectedKey, cell); });
  operations.addEventListener('dragstart', event => { const card=event.target.closest('.lp-week-assignment[data-lp-assignment]'); if(!card)return; const assignment=window.SGPLinePlanner?.getAssignments?.().find(a=>String(a.id)===card.dataset.lpAssignment);if(!assignment)return;dragSelection={kind:'move',assignment};event.dataTransfer.setData('text/plain','assignment:'+assignment.id);event.dataTransfer.effectAllowed='move';markReady(true); });
  operations.addEventListener('dragend',clearDragVisual);
  explorer.addEventListener('dragstart', event => {
    const card = event.target.closest('.sgp-explorer-order[data-lp-key]');
    if (!card) {const group=event.target.closest('[data-lp-group]');if(!group||event.target.closest('button'))return;const container=group.dataset.lpGroup==='part'?group.closest('.sgp-explorer-part'):group.closest('.sgp-explorer-reservation');const keys=keysFor(container);if(!keys.length)return;dragSelection={kind:'group',keys,label:group.querySelector('strong')?.textContent||'Grupo'};event.dataTransfer.setData('text/plain','group');event.dataTransfer.effectAllowed='copy';markReady(true);return;}
    dragKey = card.dataset.lpKey;
    selectCard(dragKey);
    card.classList.add('lp01-drag-source');
    event.dataTransfer.setData('text/plain', dragKey);
    event.dataTransfer.effectAllowed = 'copy';
    markReady(true);
  });
  explorer.addEventListener('dragend', clearDragVisual);
  operations.addEventListener('dragover', event => {
    const cell = event.target.closest('.lp-week-cell');
    if (!cell || (!dragKey&&!dragSelection)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = dragSelection?.kind==='move'?'move':'copy';
    highlight(cell);
  });
  operations.addEventListener('dragleave', event => { if (!operations.contains(event.relatedTarget)) highlight(null); });
  operations.addEventListener('drop', event => {
    const cell = event.target.closest('.lp-week-cell');
    if (!cell || (!dragKey&&!dragSelection)) return;
    event.preventDefault();
    const key = dragSelection||dragKey;
    clearDragVisual();
    openDrop(key, cell);
  });
  // Touch events remain passive until the long press starts. Normal scrolling is untouched.
  let touch = null;
  const ghost = document.createElement('div');
  ghost.className = 'lp01-touch-ghost';
  ghost.hidden = true;
  document.body.append(ghost);
  function endTouch() {
    if (touch?.timer) clearTimeout(touch.timer);
    if (touch?.scrollTimer) clearInterval(touch.scrollTimer);
    touch = null;
    ghost.hidden = true;
    clearDragVisual();
  }
  function touchCell(point) { return document.elementFromPoint(point.clientX ?? point.x, point.clientY ?? point.y)?.closest('.lp-week-cell') || null; }
  explorer.addEventListener('touchstart', event => {
    const card = event.target.closest('.sgp-explorer-order[data-lp-key], [data-lp-group]');
    if (!card || event.touches.length !== 1) return;
    const group=card.dataset.lpGroup;const container=group==='part'?card.closest('.sgp-explorer-part'):group==='reserve'?card.closest('.sgp-explorer-reservation'):null;const selection=group?{kind:'group',keys:keysFor(container),label:card.querySelector('strong')?.textContent||'Grupo'}:card.dataset.lpKey;
    const point = event.touches[0];
    touch = { key: selection, x: point.clientX, y: point.clientY, active: false, timer: setTimeout(() => {
      if (!touch) return;
      touch.active = true;
      if(typeof touch.key==='string')selectCard(touch.key);else markReady(true);
      card.classList.add('lp01-drag-source');
      ghost.textContent = typeof touch.key==='string'?(rowFor(touch.key)?.produccion||'Producción'):touch.key.label;
      ghost.hidden = false;
      ghost.style.transform = `translate(${touch.x + 12}px,${touch.y + 12}px)`;
      touch.scrollTimer = setInterval(() => {
        if (!touch?.active) return;
        if (touch.y > window.innerHeight - 70) window.scrollBy(0, 16);
        else if (touch.y < 70) window.scrollBy(0, -16);
        const scroll = operations.querySelector('.lp-week-scroll');
        if (scroll) { const box = scroll.getBoundingClientRect(); if (touch.y >= box.top && touch.y <= box.bottom) { if (touch.x > box.right - 45) scroll.scrollLeft += 18; else if (touch.x < box.left + 45) scroll.scrollLeft -= 18; } }
        highlight(touchCell(touch));
      }, 24);
    }, 380) };
  }, { passive: true });
  document.addEventListener('touchmove', event => {
    if (!touch || event.touches.length !== 1) return;
    const point = event.touches[0];
    if (!touch.active) { if (Math.hypot(point.clientX - touch.x, point.clientY - touch.y) > 12) endTouch(); return; }
    event.preventDefault();
    touch.x = point.clientX; touch.y = point.clientY;
    ghost.style.transform = `translate(${touch.x + 12}px,${touch.y + 12}px)`;
    if (point.clientY > window.innerHeight - 70) window.scrollBy(0, 26);
    else if (point.clientY < 70) window.scrollBy(0, -26);
    const scroll = operations.querySelector('.lp-week-scroll');
    if (scroll) { const box = scroll.getBoundingClientRect(); if (point.clientY >= box.top && point.clientY <= box.bottom) { if (point.clientX > box.right - 45) scroll.scrollLeft += 25; else if (point.clientX < box.left + 45) scroll.scrollLeft -= 25; } }
    highlight(touchCell(point));
  }, { passive: false });
  document.addEventListener('touchend', event => {
    if (!touch) return;
    if (touch.active) { event.preventDefault(); const point = event.changedTouches[0]; const cell = point && touchCell(point); const key = touch.key; endTouch(); if (cell) openDrop(key, cell); else selectedStatus.textContent = 'Producción seleccionada. Desplázate al calendario y toca una celda.'; }
    else endTouch();
  }, { passive: false });
  document.addEventListener('touchcancel', endTouch, { passive: true });

  const style = document.createElement('style');
  style.textContent = `.lp01-workspace{display:grid;grid-template-columns:minmax(280px,var(--lp01-left)) 9px minmax(0,1fr);align-items:start;gap:0;min-width:0}.lp01-workspace #sgpPlannerExplorer{min-width:0;margin:0;max-height:82vh;overflow:auto}.lp01-workspace .sgp-planner-operations{min-width:0;margin:0}.lp01-workspace #sgpExplorerResults{display:grid;grid-template-columns:minmax(0,1fr)}.lp01-workspace .sgp-explorer-filters{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px}.lp01-workspace .sgp-explorer-filters>*{min-width:0!important;width:100%;box-sizing:border-box}.lp01-workspace .sgp-explorer-filters select,.lp01-workspace .sgp-explorer-filters input{min-width:0!important;width:100%;box-sizing:border-box}.lp01-workspace .sgp-explorer-view-actions>*{min-width:0;max-width:100%}.lp01-workspace .sgp-line-days{grid-template-columns:repeat(7,minmax(0,1fr))}.lp01-workspace .sgp-line-day{min-width:0;padding:7px;font-size:11px}.lp01-splitter{height:100%;min-height:500px;cursor:col-resize;background:#dbe8f8;border-left:2px solid #9fc0eb;border-right:2px solid #9fc0eb}.lp01-splitter:focus-visible{outline:3px solid #1264c8;outline-offset:2px}.lp01-line-filter{display:grid;gap:4px}.lp01-capacity{display:flex;gap:8px;align-items:center;justify-content:flex-end;color:#36567e;font-size:12px}.lp01-capacity input{width:72px!important}.lp01-capacity-warning{color:#385b83;font-weight:700}.lp01-assignment-disclosure{margin-top:10px;border:1px solid #d5e1ef;border-radius:9px;padding:10px}.lp01-assignment-disclosure summary{cursor:pointer;font-weight:700;color:#103b73}.lp01-workspace [data-plan-key]{cursor:grab}.lp01-workspace [data-plan-reserve]{display:block;margin-top:8px;border:1px solid #1264c8;border-radius:8px;background:#fff;color:#103b73;min-height:36px}.lp01-workspace [data-lp-shift]{min-height:84px;border:1px dashed #a5c5eb}@media(max-width:900px){.lp01-workspace{display:block}.lp01-splitter{display:none}.lp01-workspace #sgpPlannerExplorer{max-height:none}.lp01-workspace .sgp-planner-operations{margin-top:12px}.lp01-workspace .sgp-line-days{grid-template-columns:repeat(2,minmax(0,1fr))}.lp01-workspace .sgp-explorer-filters{grid-template-columns:1fr!important}}`;
  style.textContent += '.lp01-workspace #sgpPendingAssemblyQueue[hidden]{display:none!important}.lp-week-toolbar{display:flex;align-items:end;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:8px 0 12px}.lp-week-toolbar h4{margin:0;color:#103b73}.lp-week-toolbar small{color:#526781}.lp-week-controls{display:flex;align-items:end;gap:6px;flex-wrap:wrap}.lp-week-controls label{font-size:12px}.lp-week-controls button,.lp-week-controls input{min-height:38px;padding:6px;border:1px solid #b9cfe9;border-radius:8px;background:#fff;color:#103b73;font-weight:650}.lp-week-scroll{overflow-x:auto;max-width:100%}.lp-week-grid{display:grid;grid-template-columns:64px repeat(7,minmax(0,1fr));gap:5px;min-width:0}.lp-week-corner,.lp-week-day,.lp-week-shift{padding:8px;background:#dceafa;color:#103b73;font-size:12px;font-weight:750;border-radius:7px}.lp-week-day{text-align:center;text-transform:capitalize}.lp-week-shift{display:flex;align-items:center}.lp-week-cell{min-width:0;min-height:132px;padding:7px;border:1px dashed #9fc0eb;border-radius:9px;background:#fff;box-sizing:border-box;overflow-wrap:anywhere}.lp-week-cell-head{display:grid;gap:3px;color:#103b73;font-size:11px}.lp-week-cell-head small,.lp-week-systems{display:block;color:#526781;font-size:11px}.lp-week-empty{display:block;margin-top:16px;color:#68809c}.lp-week-assignment{padding:6px;margin:6px 0;border-left:3px solid #1264c8;border-radius:5px;background:#eef5ff;font-size:11px}.lp-week-assignment strong,.lp-week-assignment small{display:block}.lp-week-legend{font-size:12px;color:#526781}.lp-week-cell:focus-within,.lp-week-cell:hover{border-color:#1264c8;background:#f7fbff}.lp01-drop-dialog{max-width:min(520px,calc(100vw - 24px));max-height:85vh;overflow:auto;border:1px solid #9fc0eb;border-radius:14px;padding:22px;box-shadow:0 20px 55px #102e5366;color:#103b73}.lp01-drop-dialog::backdrop{background:#102e5380}.lp01-drop-dialog form{display:grid;gap:12px}.lp01-drop-dialog h3,.lp01-drop-dialog p{margin:0}.lp01-drop-dialog label{display:grid;gap:4px}.lp01-drop-dialog input{width:100%;box-sizing:border-box;min-height:42px}.lp01-drop-actions{display:flex;justify-content:flex-end;gap:8px}.lp01-drop-actions button{min-height:42px;padding:8px 12px;border-radius:8px;border:1px solid #1264c8;background:#fff;color:#103b73}.lp01-drop-actions button[type=submit]{background:#1264c8;color:white}@media(max-width:900px){.lp-week-grid{grid-template-columns:55px repeat(7,minmax(120px,1fr));min-width:950px}.lp-week-controls{width:100%}.lp-week-controls button{flex:1}}';
  style.textContent += '.lp01-workspace .sgp-explorer-order[data-lp-key]{cursor:grab;touch-action:auto}.lp01-workspace .sgp-explorer-order[data-lp-key]:focus-visible{outline:3px solid #1264c8}.lp01-workspace .sgp-explorer-order.lp01-card-selected{border:2px solid #1264c8;background:#e9f3ff}.lp01-workspace .sgp-explorer-order.lp01-drag-source{opacity:.58}.lp01-workspace .lp-week-cell.lp01-drop-ready{border:2px dashed #1264c8;background:#eef6ff}.lp01-workspace .lp-week-cell.lp01-drop-active{border:3px solid #0a8d69;background:#dff9ee;box-shadow:inset 0 0 0 2px #fff}.lp01-selection-status{margin:4px 0 10px;padding:8px 10px;border-radius:8px;background:#e9f3ff;color:#103b73;font-size:12px}.lp01-touch-ghost{position:fixed;top:0;left:0;z-index:9999;max-width:180px;padding:8px 12px;border-radius:9px;background:#103b73;color:#fff;box-shadow:0 6px 20px #102e5366;pointer-events:none;font-weight:700;font-size:12px}.lp01-touch-ghost[hidden]{display:none}';
  document.head.append(style);
})();
