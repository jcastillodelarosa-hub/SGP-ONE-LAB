import {advancesForm,renderPdtWorkspace,bindPdtNavigation} from './pdt-v2-presentation.js';
import {distributionState,renderSourceDistribution} from './pdt-source-distribution.js';
import {executePendingV2} from '../services/aluminum-pending-v2.js';
import {normalizeNcNumbers} from '../domain/aluminum-pending-balances.js';

/** Uses SGP's existing scrollable work modal. Backend is always final authority. */
export async function openPdtV2({row,client,token,role,capabilities,show,escape:esc,reload,close,initialSection='distribution'}) {
  const opener=document.activeElement;const originalClose=close;close=()=>{originalClose();if(opener?.isConnected)opener.focus();};
  if(!capabilities)throw new Error('Backend PDT v2 no disponible');
  const validated=row.contrato_pdt==='V2';
  const editable=row.estado!=='RESUELTO'&&row.estado_repo!=='PICKING';
  const validator=['ADMINISTRADOR','COORDINADOR','RECEPCION','LIDER LINEA','SUPERVISOR DE PICKING'].includes(role);
  const machinist=['ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO','LIDER'].includes(role);
  const ncEditor=['ADMINISTRADOR','COORDINADOR','PATINADOR'].includes(role);
  let sources=[],sourceError=null;
  if(!validated && validator){
    try{
      const result=await client.rpc('sgp_pdt_fuentes_v2',{p_token:token,p_id:row.id_pendiente});
      if(result.error)throw result.error;
      if(!Array.isArray(result.data))throw new Error('Respuesta de fuentes V2 inválida');
      sources=result.data;
    }catch(error){sourceError=error.message||'Consulta de fuentes no disponible';}
  }
  let picking={entregas:[],lineas:[]};
  const pickRegister=['ADMINISTRADOR','COORDINADOR','PICKING','SUPERVISOR DE PICKING'].includes(role);
  const pickValidate=['ADMINISTRADOR','COORDINADOR','RECEPCION','SUPERVISOR DE PICKING'].includes(role);
  if(validated && capabilities.picking_cuantitativo && (pickRegister||pickValidate||machinist)){
    try{
    const result=await client.rpc('sgp_pdt_picking_v2',{p_token:token,p_id:row.id_pendiente});
    if(result.error)throw result.error;
    if(result.data?.ok!==true || !Array.isArray(result.data.entregas) || !Array.isArray(result.data.lineas))throw new Error('Evidencia Picking inválida');
    picking=result.data;
    }catch(error){picking={entregas:[],lineas:[],error:error.message||'Consulta no disponible'};}
  }
  const details=row.detalles||[];
  const moves=(row.movimientos||[]).filter(m=>m.tipo==='AVANCE' && !(row.movimientos||[]).some(x=>x.id_movimiento_revertido===m.id_movimiento));
  let form='';
  if(!validated && validator)form+=renderSourceDistribution(sources,row.cantidad,sourceError,esc);
  if(validated && editable && machinist)form+=advancesForm(details,moves,row,esc);
  if(editable && ncEditor)form+='<section class="repo-modal-section"><h3>NC vinculadas</h3><p>'+esc((row.ncs||[]).map(n=>(n.referencia||n.consecutivo)+' · '+(n.estado||n.resolucion)).join(' / ')||row.nc||'Sin NC')+'</p><label>Añadir NC (sin reemplazar)<input data-ncs type="text" autocomplete="off"></label><button type="button" data-operation="nc">Añadir NC</button></section>';
  if(validated && editable && capabilities.picking_cuantitativo && (pickRegister||pickValidate) && !picking.error){
    form+='<section class="repo-modal-section"><h3>Entrega Picking por detalle</h3><p>Registrar cantidades efectivamente entregadas. Los faltantes de la orden no calculan estas cantidades.</p>';
    if(pickRegister)form+='<label>Entrega<select data-pick-event>'+picking.entregas.map((e,i)=>'<option value="'+esc(e.id_entrega)+'">Entrega '+(i+1)+' · '+esc(e.produccion)+' · '+esc(e.estado)+' · '+(e.completa?'Orden completa':'Orden parcial')+'</option>').join('')+'</select></label><label>Detalle<select data-pick-detail>'+details.map(d=>'<option value="'+esc(d.id_detalle)+'">'+esc(d.fabricacion)+' · '+esc(d.longitud)+' · '+esc(d.acabado)+'</option>').join('')+'</select></label><label>Cantidad entregada<input type="number" min="1" step="1" data-pick-qty></label><button type="button" data-operation="delivery" '+(!picking.entregas.length?'disabled':'')+'>Registrar cantidad entregada</button>';
    form+='<label>Línea registrada<select data-pick-line>'+picking.lineas.filter(l=>l.estado!=='ANULADA').map(l=>'<option value="'+esc(l.id_linea)+'">'+esc(details.find(d=>d.id_detalle===l.id_detalle)?.fabricacion||'Detalle')+' · '+esc(l.cantidad)+' · '+esc(l.estado)+(l.asignada?' · acreditada':'')+'</option>').join('')+'</select></label>';
    if(pickValidate)form+='<button type="button" data-operation="deliveryValidate" '+(!picking.lineas.length?'disabled':'')+'>Validar línea</button><button type="button" data-operation="assign" '+(!picking.lineas.length?'disabled':'')+'>Acreditar al PDT</button>';
    if(['ADMINISTRADOR','COORDINADOR'].includes(role))form+='<label>Motivo de anulación<textarea data-annul-note rows="2"></textarea></label><button type="button" data-operation="annul" '+(!picking.lineas.length?'disabled':'')+'>Anular línea</button>';
    if(pickRegister && capabilities.cierre_v2 && !picking.error)form+='<button type="button" data-operation="close">Solicitar cierre con evidencia</button>';
    form+='</section>';
  }
  const modal=show((validated?'PDT v2 · ':'Preparar PDT v2 · ')+(row.produccion||row.reserva),(row.perfil?esc(row.perfil)+' · ':'')+'Reserva '+esc(row.reserva||''),renderPdtWorkspace({form,row,picking,validated,esc})+'<p role="status" data-result>'+(validated?(capabilities.cierre_v2?'El servidor comprobará la cobertura antes de cerrar.':'Cierre v2 pendiente de evidencia cuantitativa Picking.'):'')+'</p>','<button type="button" data-pdt-primary>Ir a la acción</button><button type="button" data-dismiss>Cerrar</button>');
  let historyLoaded=false,historyPending=false,missingLoaded=false;
  const loadHistory=async()=>{
    if(historyLoaded||historyPending)return;historyPending=true;
    const status=modal.querySelector('[data-pdt-history-status]'),host=modal.querySelector('[data-pdt-history]'),retry=modal.querySelector('[data-pdt-history-retry]');retry.disabled=true;status.textContent='Consultando historial…';
    try{const result=await client.rpc('sgp_aluminio_pendiente_historial',{p_token:token,p_id:row.id_pendiente});if(result.error)throw result.error;if(!Array.isArray(result.data))throw new Error('Historial inválido');host.innerHTML='<ol class="pdt-history">'+result.data.map(event=>'<li><b>'+esc(event.accion||event.tipo_evento||'Evento')+'</b><span>'+esc(event.fecha||event.creado_en||'—')+' · '+esc(event.usuario||'—')+'</span><p>'+esc(event.detalle||event.observacion||[event.estado_anterior,event.estado_nuevo].filter(Boolean).join(' → '))+'</p></li>').join('')+'</ol>';status.textContent=result.data.length?'Historial completo recibido del servidor.':'Sin eventos adicionales.';historyLoaded=true;}catch(error){status.textContent='No fue posible consultar el historial: '+(error.message||'Error de consulta');status.setAttribute('role','alert');}finally{historyPending=false;retry.disabled=false;}
  };
  const loadMissing=async()=>{
    if(missingLoaded)return;missingLoaded=true;
    const status=modal.querySelector('[data-pdt-missing-status]'),host=modal.querySelector('[data-pdt-missing]');
    if(!validated||!capabilities.picking_cuantitativo||(!pickRegister&&!pickValidate)){status.textContent='Faltantes de orden no disponibles para este contrato/rol. No equivalen al saldo del PDT.';return;}
    status.textContent='Consultando faltantes de las entregas…';
    try{const result=await client.rpc('sgp_picking_recepcion_cola',{p_token:token});if(result.error)throw result.error;if(!Array.isArray(result.data))throw new Error('Cola de recepción inválida');const ids=new Set(picking.entregas.map(e=>String(e.id_entrega)));const events=result.data.filter(e=>ids.has(String(e.id_entrega)));const lines=events.flatMap(e=>Array.isArray(e.faltantes)?e.faltantes:[]);host.innerHTML='<ul>'+lines.map(line=>'<li>'+esc(line.fabricacion||line.perfil||'Pieza')+' · '+esc(line.cantidad??'—')+' · '+esc(line.acabado||'')+'</li>').join('')+'</ul>';status.textContent=lines.length?'Faltantes registrados para las entregas consultadas; no son cantidades entregadas.':'No se recibieron faltantes en la cola para estas entregas. Esto no confirma una orden completa.';}catch(error){status.textContent='Faltantes no disponibles: '+(error.message||'Error de consulta')+'. No se calculan por diferencia con la orden.';}
  };
  modal.querySelector('[data-pdt-history-retry]').onclick=()=>{historyLoaded=false;loadHistory();};
  const navigation=bindPdtNavigation(modal,initialSection,key=>{if(key==='history')loadHistory();if(key==='picking')loadMissing();});
  modal.querySelector('[data-dismiss]').focus();
  modal.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();close();}if(e.key==='Tab'){const items=[...modal.querySelectorAll('button,input,select,textarea,summary,[tabindex="0"]')].filter(n=>!n.disabled&&n.getClientRects().length);const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};
  modal.querySelector('[data-dismiss]').onclick=close;
  const headerClose=modal.querySelector('#repoWorkClose');if(headerClose)headerClose.onclick=close;
  if(!validated&&validator){
    const footer=modal.querySelector('.repo-work-footer');
    if(footer){
      const panel=document.createElement('div');panel.className='pdt-distribution-footer';
      modal.querySelector('[data-pdt-primary]')?.remove();
      const total=modal.querySelector('.pdt-distribution-total'),status=modal.querySelector('[data-source-status]'),actions=modal.querySelector('.pdt-distribution-actions');
      actions.append(modal.querySelector('[data-dismiss]'));panel.append(total,status,actions);footer.replaceChildren(panel);
    }
  }

  let operationPending=false;
  const selectedSources=()=>[...modal.querySelectorAll('[data-source]:checked')].map(input=>({...sources[+input.dataset.source],cantidad:modal.querySelector('[data-source-qty="'+input.dataset.source+'"]')?.value||''}));
  const updateDistribution=()=>{
    const button=modal.querySelector('[data-operation="validate"]');if(!button)return;
    const state=distributionState(sources,selectedSources(),row.cantidad,modal.querySelector('[data-note]')?.value||'');
    button.disabled=operationPending||button.dataset.unavailable==='true'||!state.valid;
    const note=modal.querySelector('[data-note]');if(note)note.required=selectedSources().length>0&&state.total!==Number(row.cantidad);
    modal.querySelector('[data-assigned-total]').textContent=String(state.total);
    modal.querySelector('[data-distribution-label]').textContent=state.valid?(state.corrected?'Corrección justificada':'Coincide con el reporte'):'Distribución pendiente';
    modal.querySelector('[data-source-status]').textContent=sourceError?'Consulta fallida. Reintenta para recuperar fuentes verificables.':state.reason;
    modal.querySelector('.pdt-distribution-total').dataset.valid=String(state.valid);
  };
  modal.querySelectorAll('[data-source],[data-source-qty],[data-note]').forEach(input=>input.addEventListener('input',updateDistribution));
  modal.querySelectorAll('[data-source]').forEach(input=>input.addEventListener('change',updateDistribution));
  const retry=modal.querySelector('[data-source-retry]');if(retry)retry.onclick=async()=>{
    operationPending=true;retry.disabled=true;retry.textContent='Consultando…';modal.querySelector('[data-operation=validate]').disabled=true;
    try{await openPdtV2({row,client,token,role,capabilities,show,escape:esc,reload,close});}
    catch(error){operationPending=false;updateDistribution();modal.querySelector('[data-source-status]').textContent=error.message;retry.disabled=false;retry.textContent='Reintentar consulta';}
  };
  updateDistribution();

  const rpcByAction={validate:'sgp_aluminio_pendiente_validar_detalles_v1',advance:'sgp_aluminio_pendiente_registrar_avance_v1',reverse:'sgp_aluminio_pendiente_revertir_avance_v1',stage:'sgp_pdt_estado_v2',nc:'sgp_aluminio_pendiente_nc_vincular_v1',delivery:'sgp_pdt_entrega_registrar_v2',deliveryValidate:'sgp_pdt_entrega_validar_v2',assign:'sgp_pdt_asignar_v2',annul:'sgp_pdt_entrega_anular_v2',close:'sgp_pdt_cerrar_v2'};
  modal.querySelectorAll('[data-operation]').forEach(button=>{if(!capabilities.operations?.includes(rpcByAction[button.dataset.operation])){button.disabled=true;button.dataset.unavailable='true';button.title='Operación no disponible en este backend';}});
  const lineInput=modal.querySelector('[data-pick-line]');
  const updateLineActions=()=>{const line=picking.lineas.find(l=>l.id_linea===lineInput?.value);for(const action of ['deliveryValidate','assign','annul']){const button=modal.querySelector('[data-operation="'+action+'"]');if(button)button.disabled=operationPending||button.dataset.unavailable==='true'||!line||line.estado==='ANULADA'||(action==='assign'&&(line.estado!=='VALIDADA'||line.asignada));}};
  lineInput?.addEventListener('change',updateLineActions);updateLineActions();
  navigation.updatePrimary();
  const keys={advance:crypto.randomUUID(),reverse:crypto.randomUUID(),delivery:crypto.randomUUID(),assign:crypto.randomUUID(),close:crypto.randomUUID()};
  modal.querySelectorAll('[data-operation]').forEach(button=>button.onclick=async()=>{
    if(['reverse','stage','annul','close'].includes(button.dataset.operation)&&!window.confirm({reverse:'¿Confirmas revertir este avance? Se conservará la trazabilidad.',stage:'¿Confirmas el cambio de etapa? El servidor validará sus condiciones.',annul:'¿Confirmas anular esta línea de entrega?',close:'¿Solicitar cierre del PDT con evidencia Picking?'}[button.dataset.operation]))return;
    const buttons=[...modal.querySelectorAll('[data-operation]')];const previous=buttons.map(b=>b.disabled);operationPending=true;buttons.forEach(b=>b.disabled=true);if(retry)retry.disabled=true;
    const val=s=>modal.querySelector(s)?.value||'';
    let operation,args={p_token:token,p_id:row.id_pendiente};
    try{
      switch(button.dataset.operation){
        case 'validate': {
          const state=distributionState(sources,selectedSources(),row.cantidad,val('[data-note]'));
          if(!state.valid)throw new Error(state.reason);
          operation='sgp_aluminio_pendiente_validar_detalles_v1';args={...args,p_detalles:state.details,p_reserva:row.reserva,p_observacion:val('[data-note]')||null};break;
        }
        case 'advance':operation='sgp_aluminio_pendiente_registrar_avance_v1';args={...args,p_id_detalle:details[Number(button.dataset.detailIndex)]?.id_detalle,p_cantidad:Number(val('[data-advance-qty="'+button.dataset.detailIndex+'"]')),p_turno:val('[data-shift]'),p_fecha_operativa:val('[data-date]'),p_idempotency_key:keys.advance,p_observacion:val('[data-note]')||null};break;
        case 'reverse':operation='sgp_aluminio_pendiente_revertir_avance_v1';args={...args,p_movimiento:val('[data-movement]'),p_clave:keys.reverse,p_motivo:val('[data-note]')};break;
        case 'delivery':operation='sgp_pdt_entrega_registrar_v2';args={p_token:token,p_detalle:val('[data-pick-detail]'),p_entrega:val('[data-pick-event]'),p_cantidad:Number(val('[data-pick-qty]')),p_clave:keys.delivery};break;
        case 'deliveryValidate':operation='sgp_pdt_entrega_validar_v2';args={p_token:token,p_linea:val('[data-pick-line]')};break;
        case 'assign':operation='sgp_pdt_asignar_v2';args={p_token:token,p_linea:val('[data-pick-line]'),p_clave:keys.assign};break;
        case 'annul':operation='sgp_pdt_entrega_anular_v2';args={p_token:token,p_linea:val('[data-pick-line]'),p_motivo:val('[data-annul-note]')};break;
        case 'close':operation='sgp_pdt_cerrar_v2';args={...args,p_clave:keys.close};break;
        case 'nc':operation='sgp_aluminio_pendiente_nc_vincular_v1';args={...args,p_ncs:normalizeNcNumbers(val('[data-ncs]'))};break;
        case 'stage':operation='sgp_pdt_estado_v2';args={...args,p_estado:val('[data-stage]')};break;
      }
      if(button.dataset.operation==='advance'){const detail=details[Number(button.dataset.detailIndex)];if(!detail||!Number.isSafeInteger(args.p_cantidad)||args.p_cantidad<=0||args.p_cantidad>Number(detail.saldo))throw new Error('Cantidad de avance inválida o superior al saldo');if(!args.p_fecha_operativa)throw new Error('Selecciona la fecha operativa');}
      if(button.dataset.operation==='reverse'&&!args.p_motivo.trim())throw new Error('Indica el motivo del reverso');
      await executePendingV2(client,capabilities,operation,args);
      close();await reload();
    }catch(error){operationPending=false;const result=modal.querySelector('[data-result]');result.textContent=error.message;result.setAttribute('role','alert');result.tabIndex=-1;result.focus();result.scrollIntoView({block:'nearest'});buttons.forEach((b,i)=>b.disabled=previous[i]);if(retry)retry.disabled=false;updateDistribution();updateLineActions();}
  });
}
