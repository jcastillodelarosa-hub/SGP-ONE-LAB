import {executePendingV2} from '../services/aluminum-pending-v2.js';
import {normalizeNcNumbers,validateFabricationDistribution,ncAvailability} from '../domain/aluminum-pending-balances.js';

/** Uses SGP's existing scrollable work modal. Backend is always final authority. */
export async function openPdtV2({row,client,token,role,capabilities,show,escape:esc,reload,close}) {
  if(!capabilities)throw new Error('Backend PDT v2 no disponible');
  const validated=row.contrato_pdt==='V2';
  const validator=['ADMINISTRADOR','COORDINADOR','RECEPCION','LIDER LINEA','SUPERVISOR DE PICKING'].includes(role);
  const machinist=['ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO','LIDER'].includes(role);
  const ncEditor=['ADMINISTRADOR','COORDINADOR','PATINADOR'].includes(role);
  let sources=[];
  if(!validated && validator){
    const result=await client.rpc('sgp_pdt_fuentes_v2',{p_token:token,p_id:row.id_pendiente});
    if(result.error)throw result.error;
    if(!Array.isArray(result.data))throw new Error('Fuentes PDT inválidas');
    sources=result.data;
  }
  let picking={entregas:[],lineas:[]};
  const pickRegister=['ADMINISTRADOR','COORDINADOR','PICKING','SUPERVISOR DE PICKING'].includes(role);
  const pickValidate=['ADMINISTRADOR','COORDINADOR','RECEPCION','SUPERVISOR DE PICKING'].includes(role);
  if(validated && capabilities.picking_cuantitativo && (pickRegister||pickValidate||machinist)){
    const result=await client.rpc('sgp_pdt_picking_v2',{p_token:token,p_id:row.id_pendiente});
    if(result.error)throw result.error;
    if(result.data?.ok!==true || !Array.isArray(result.data.entregas) || !Array.isArray(result.data.lineas))throw new Error('Evidencia Picking inválida');
    picking=result.data;
  }
  const details=row.detalles||[];
  const moves=(row.movimientos||[]).filter(m=>m.tipo==='AVANCE' && !(row.movimientos||[]).some(x=>x.id_movimiento_revertido===m.id_movimiento));
  const ncSummary=ncAvailability(row.ncs);
  const summary='<p><span class="repo-contract-badge">Contrato actual: '+(validated?'V2':'LEGACY')+'</span></p><p>Reportada: <b>'+esc(row.cantidad)+'</b> · Validada: <b>'+esc(row.cantidad_validada??'—')+'</b> · Avance neto: <b>'+esc(row.avance_neto??'—')+'</b> · Saldo: <b>'+esc(row.saldo_mecanizado??'—')+'</b></p><p>NC finalizadas: '+ncSummary.finalizadas+'/'+ncSummary.total+(ncSummary.posibleSolucion?' · REPO OK: posible solución, sin acreditar entrega.':'')+'</p>';
  let form='';
  if(!validated && validator)form+='<section class="repo-modal-section"><h3>Distribución PANEL</h3><p>Confirmar la distribución activa el contrato V2. Se conserva el reporte original y no se podrá redistribuir después de validar.</p>'+sources.map((p,i)=>'<label class="repo-pair-field"><span><input type="checkbox" data-source="'+i+'"> '+esc(p.fabricacion)+' · '+esc(p.longitud)+' · '+esc(p.acabado)+' · Marca '+esc(p.marca||'—')+' · Uso '+esc(p.uso||'—')+'</span><input aria-label="Cantidad '+esc(p.fabricacion)+'" data-source-qty="'+i+'" type="number" min="1" step="1" value="'+esc(p.cantidad)+'"></label>').join('')+'<label>Motivo de corrección<textarea data-note rows="2"></textarea></label><button type="button" data-operation="validate">Validar distribución</button></section>';
  if(validated && machinist)form+='<section class="repo-modal-section"><h3>Avances y reversos</h3><label>Fabricación<select data-detail>'+details.map(d=>'<option value="'+esc(d.id_detalle)+'">'+esc(d.fabricacion)+' · saldo '+esc(d.saldo)+'</option>').join('')+'</select></label><label>Cantidad<input data-qty type="number" min="1" step="1"></label><label>Turno<select data-shift><option>T1</option><option>T2</option></select></label><label>Fecha operativa<input data-date type="date" required></label><label>Observación / motivo<textarea data-note rows="2"></textarea></label><button type="button" data-operation="advance">Registrar avance</button><label>Avance a revertir<select data-movement>'+moves.map(m=>'<option value="'+esc(m.id_movimiento)+'">'+esc(m.cantidad)+' · '+esc(m.fecha_operativa)+' · '+esc(m.usuario)+'</option>').join('')+'</select></label><button type="button" data-operation="reverse" '+(!moves.length?'disabled':'')+'>Revertir avance</button><label>Siguiente etapa<select data-stage>'+({PENDIENTE:['CORTE'],CORTE:['MECANIZADO'],MECANIZADO:['PROCESADO']}[row.estado_repo]||[]).map(x=>'<option>'+x+'</option>').join('')+'</select></label><button type="button" data-operation="stage" '+(row.estado_repo==='PROCESADO'?'disabled':'')+'>Confirmar etapa</button></section>';
  if(ncEditor)form+='<section class="repo-modal-section"><h3>NC vinculadas</h3><p>'+esc((row.ncs||[]).map(n=>(n.referencia||n.consecutivo)+' · '+(n.estado||n.resolucion)).join(' / ')||row.nc||'Sin NC')+'</p><label>Añadir NC (sin reemplazar)<input data-ncs type="text" autocomplete="off"></label><button type="button" data-operation="nc">Añadir NC</button></section>';
  if(validated && capabilities.picking_cuantitativo && (pickRegister||pickValidate)){
    form+='<section class="repo-modal-section"><h3>Entrega Picking por detalle</h3><p>Registrar cantidades efectivamente entregadas. Los faltantes de la orden no calculan estas cantidades.</p>';
    if(pickRegister)form+='<label>Entrega<select data-pick-event>'+picking.entregas.map((e,i)=>'<option value="'+esc(e.id_entrega)+'">Entrega '+(i+1)+' · '+esc(e.produccion)+' · '+esc(e.estado)+' · '+(e.completa?'Orden completa':'Orden parcial')+'</option>').join('')+'</select></label><label>Detalle<select data-pick-detail>'+details.map(d=>'<option value="'+esc(d.id_detalle)+'">'+esc(d.fabricacion)+' · '+esc(d.longitud)+' · '+esc(d.acabado)+'</option>').join('')+'</select></label><label>Cantidad entregada<input type="number" min="1" step="1" data-pick-qty></label><button type="button" data-operation="delivery" '+(!picking.entregas.length?'disabled':'')+'>Registrar cantidad entregada</button>';
    form+='<label>Línea registrada<select data-pick-line>'+picking.lineas.filter(l=>l.estado!=='ANULADA').map(l=>'<option value="'+esc(l.id_linea)+'">'+esc(details.find(d=>d.id_detalle===l.id_detalle)?.fabricacion||'Detalle')+' · '+esc(l.cantidad)+' · '+esc(l.estado)+(l.asignada?' · acreditada':'')+'</option>').join('')+'</select></label>';
    if(pickValidate)form+='<button type="button" data-operation="deliveryValidate" '+(!picking.lineas.length?'disabled':'')+'>Validar línea</button><button type="button" data-operation="assign" '+(!picking.lineas.length?'disabled':'')+'>Acreditar al PDT</button>';
    if(['ADMINISTRADOR','COORDINADOR'].includes(role))form+='<label>Motivo de anulación<textarea data-annul-note rows="2"></textarea></label><button type="button" data-operation="annul" '+(!picking.lineas.length?'disabled':'')+'>Anular línea</button>';
    if(pickRegister && capabilities.cierre_v2)form+='<button type="button" data-operation="close">Solicitar cierre con evidencia</button>';
    form+='</section>';
  }
  const modal=show((validated?'PDT v2 · ':'Preparar PDT v2 · ')+(row.produccion||row.reserva),(row.perfil?esc(row.perfil)+' · ':'')+'Reserva '+esc(row.reserva||''),summary+form+'<p role="status" data-result>'+(capabilities.cierre_v2?'El servidor comprobará la cobertura antes de cerrar.':'Cierre v2 pendiente de evidencia cuantitativa Picking.')+'</p>','<button type="button" data-dismiss>Cerrar</button>');
  modal.querySelector('[data-dismiss]').onclick=close;
  const keys={advance:crypto.randomUUID(),reverse:crypto.randomUUID(),delivery:crypto.randomUUID(),assign:crypto.randomUUID(),close:crypto.randomUUID()};
  modal.querySelectorAll('[data-operation]').forEach(button=>button.onclick=async()=>{
    const buttons=[...modal.querySelectorAll('[data-operation]')];const previous=buttons.map(b=>b.disabled);buttons.forEach(b=>b.disabled=true);
    const val=s=>modal.querySelector(s)?.value||'';
    let operation,args={p_token:token,p_id:row.id_pendiente};
    try{
      switch(button.dataset.operation){
        case 'validate': {
          const rows=[...modal.querySelectorAll('[data-source]:checked')].map(input=>({...sources[+input.dataset.source],cantidad:val('[data-source-qty="'+input.dataset.source+'"]')}));
          validateFabricationDistribution(rows);
          operation='sgp_aluminio_pendiente_validar_detalles_v1';args={...args,p_detalles:rows,p_reserva:row.reserva,p_observacion:val('[data-note]')||null};break;
        }
        case 'advance':operation='sgp_aluminio_pendiente_registrar_avance_v1';args={...args,p_id_detalle:val('[data-detail]'),p_cantidad:Number(val('[data-qty]')),p_turno:val('[data-shift]'),p_fecha_operativa:val('[data-date]'),p_idempotency_key:keys.advance,p_observacion:val('[data-note]')||null};break;
        case 'reverse':operation='sgp_aluminio_pendiente_revertir_avance_v1';args={...args,p_movimiento:val('[data-movement]'),p_clave:keys.reverse,p_motivo:val('[data-note]')};break;
        case 'delivery':operation='sgp_pdt_entrega_registrar_v2';args={p_token:token,p_detalle:val('[data-pick-detail]'),p_entrega:val('[data-pick-event]'),p_cantidad:Number(val('[data-pick-qty]')),p_clave:keys.delivery};break;
        case 'deliveryValidate':operation='sgp_pdt_entrega_validar_v2';args={p_token:token,p_linea:val('[data-pick-line]')};break;
        case 'assign':operation='sgp_pdt_asignar_v2';args={p_token:token,p_linea:val('[data-pick-line]'),p_clave:keys.assign};break;
        case 'annul':operation='sgp_pdt_entrega_anular_v2';args={p_token:token,p_linea:val('[data-pick-line]'),p_motivo:val('[data-annul-note]')};break;
        case 'close':operation='sgp_pdt_cerrar_v2';args={...args,p_clave:keys.close};break;
        case 'nc':operation='sgp_aluminio_pendiente_nc_vincular_v1';args={...args,p_ncs:normalizeNcNumbers(val('[data-ncs]'))};break;
        case 'stage':operation='sgp_pdt_estado_v2';args={...args,p_estado:val('[data-stage]')};break;
      }
      await executePendingV2(client,capabilities,operation,args);
      close();await reload();
    }catch(error){modal.querySelector('[data-result]').textContent=error.message;buttons.forEach((b,i)=>b.disabled=previous[i]);}
  });
}
