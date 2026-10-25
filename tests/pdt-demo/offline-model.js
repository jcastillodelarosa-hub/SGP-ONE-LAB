/* VISUAL SIMULATION ONLY. No SQL, authentication, RPC, network or production state.
 * Uses the real controller with an in-memory teaching model, not a backend oracle. */
function createOfflineModel(){
 const A='91000000-0000-0000-0000-000000000001',B='91000000-0000-0000-0000-000000000002';
 const id=()=>crypto.randomUUID();
 const source=(prefix)=>[5,4].map((cantidad,i)=>({id_pieza:prefix+'-'+i,fabricacion:i?'E17-1':'E17',longitud:'109.9375',acabado:'DS',cantidad,marca:'M'+(i+1),uso:'PANEL'}));
 const pending=(key,production)=>({id_pendiente:key,produccion:production,perfil:'PERFIL-DEMO',reserva:'DEMO-RES',estado:'PENDIENTE',estado_repo:'PENDIENTE',contrato_pdt:'LEGACY',cantidad_reportada:9,detalles:[],movimientos:[],ncs:[]});
 let model={rows:[pending(A,'DEMO-A'),pending(B,'DEMO-B')],sources:{[A]:source('demo-a'),[B]:source('demo-b')},lines:[],delivery:{id_entrega:'demo-delivery',produccion:'DEMO-B',estado:'PENDIENTE_VALIDACION',completa:false},other_open:1,retries:{}};
 const now=()=>new Date().toISOString();
 const nc=reference=>({referencia:reference,consecutivo:reference,estado:reference.endsWith('1')?'ABIERTA':'EN_PROCESO',resolucion:'ACTIVA'});
 const b=model.rows[1];b.contrato_pdt='V2';b.estado_repo='PROCESADO';b.ncs=['DEMO-NC-1','DEMO-NC-2'].map(nc);
 b.detalles=model.sources[B].map(s=>({...s,id_detalle:id(),cantidad_validada:s.cantidad,avance_neto:s.cantidad,saldo:0}));
 for(const d of b.detalles)b.movimientos.push({id_movimiento:id(),id_detalle:d.id_detalle,tipo:'AVANCE',cantidad:d.cantidad_validada,fecha_operativa:now().slice(0,10),usuario:'DEMO'});
 const writers=['sgp_aluminio_pendiente_validar_detalles_v1','sgp_aluminio_pendiente_registrar_avance_v1','sgp_aluminio_pendiente_revertir_avance_v1','sgp_aluminio_pendiente_nc_vincular_v1','sgp_pdt_estado_v2','sgp_pdt_entrega_registrar_v2','sgp_pdt_entrega_validar_v2','sgp_pdt_asignar_v2','sgp_pdt_entrega_anular_v2','sgp_pdt_cerrar_v2'];
 function simulate(name,args){
  const m=structuredClone(model),user=args.p_token;
  const check=(yes,message)=>{if(!yes)throw new Error(message);};
  const authorize=roles=>check(roles.includes(user),'Simulación: rol sin permiso para esta operación.');
  const row=m.rows.find(r=>r.id_pendiente===args.p_id);
  const byDetail=()=>{const owner=m.rows.find(r=>r.detalles.some(d=>d.id_detalle===args.p_detalle));check(owner,'Detalle desconocido');return [owner,owner.detalles.find(d=>d.id_detalle===args.p_detalle)];};
  const line=()=>{const l=m.lines.find(l=>l.id_linea===args.p_linea);check(l,'Línea desconocida');return l;};
  const active=r=>check(r&&r.estado==='PENDIENTE','PDT no activo');
  const key=args.p_idempotency_key||args.p_clave;
  const signature=JSON.stringify([name,args]);
  if(key&&m.retries[key]){check(m.retries[key].signature===signature,'Clave de reintento reutilizada con otros datos');return structuredClone(m.retries[key].result);}
  let result={ok:true};
  switch(name){
   case 'sgp_pdt_capacidades_v2':return {ok:true,contract_version:2,picking_cuantitativo:true,cierre_v2:true,operations:writers};
   case 'sgp_aluminio_pendientes_listar_v2':return {ok:true,contract_version:2,pendientes:structuredClone(m.rows)};
   case 'sgp_pdt_fuentes_v2':authorize(['COORDINADOR','RECEPCION']);return structuredClone(m.sources[args.p_id]||[]);
   case 'sgp_pdt_picking_v2':return {ok:true,entregas:row?.produccion==='DEMO-B'?[m.delivery]:[],lineas:m.lines.filter(l=>row?.detalles.some(d=>d.id_detalle===l.id_detalle))};
   case 'sgp_aluminio_pendiente_validar_detalles_v1':{
    authorize(['COORDINADOR','RECEPCION']);active(row);check(row.contrato_pdt==='LEGACY','Distribución ya validada');
    const distribution=validateFabricationDistribution(args.p_detalles);
    check(distribution.total===row.cantidad_reportada||String(args.p_observacion||'').trim(),'La corrección requiere una observación');
    for(const d of distribution.details){const s=m.sources[row.id_pendiente].find(s=>s.id_pieza===d.id_pieza);check(s&&s.fabricacion===d.fabricacion&&Number(s.longitud)===d.longitud&&s.acabado===d.acabado,'Fuente PANEL no reconocida');}
    row.detalles=distribution.details.map(d=>({...d,id_detalle:id(),cantidad_validada:d.cantidad,avance_neto:0,saldo:d.cantidad}));row.contrato_pdt='V2';break;
   }
   case 'sgp_aluminio_pendiente_registrar_avance_v1':{
    authorize(['COORDINADOR','LIDER MECANIZADO']);active(row);const d=row.detalles.find(d=>d.id_detalle===args.p_id_detalle);
    check(d&&Number.isSafeInteger(args.p_cantidad)&&args.p_cantidad>0&&args.p_cantidad<=d.saldo,'Avance superior al saldo o cantidad inválida');check(args.p_fecha_operativa,'Indica la fecha operativa');
    const move={id_movimiento:id(),id_detalle:d.id_detalle,tipo:'AVANCE',cantidad:args.p_cantidad,fecha_operativa:args.p_fecha_operativa,usuario:user};row.movimientos.push(move);d.avance_neto+=args.p_cantidad;d.saldo-=args.p_cantidad;result.id_movimiento=move.id_movimiento;break;
   }
   case 'sgp_aluminio_pendiente_revertir_avance_v1':{
    authorize(['COORDINADOR','LIDER MECANIZADO']);active(row);check(String(args.p_motivo||'').trim(),'El reverso requiere motivo');
    const move=row.movimientos.find(m=>m.id_movimiento===args.p_movimiento&&m.tipo==='AVANCE');check(move&&!row.movimientos.some(m=>m.id_movimiento_revertido===move.id_movimiento),'Avance inexistente o ya revertido');
    check(!m.lines.some(l=>l.id_detalle===move.id_detalle&&l.asignada&&l.estado!=='ANULADA'),'No revertir evidencia ya acreditada');
    const d=row.detalles.find(d=>d.id_detalle===move.id_detalle);d.avance_neto-=move.cantidad;d.saldo+=move.cantidad;row.movimientos.push({id_movimiento:id(),id_detalle:d.id_detalle,id_movimiento_revertido:move.id_movimiento,tipo:'REVERSO',cantidad:move.cantidad,usuario:user,motivo:args.p_motivo});break;
   }
   case 'sgp_aluminio_pendiente_nc_vincular_v1':authorize(['COORDINADOR','PATINADOR']);active(row);check(args.p_ncs.every(n=>['DEMO-NC-1','DEMO-NC-2'].includes(n)),'Utiliza DEMO-NC-1 y DEMO-NC-2 en esta simulación');for(const n of args.p_ncs)if(!row.ncs.some(x=>x.referencia===n))row.ncs.push(nc(n));break;
   case 'sgp_pdt_estado_v2':authorize(['COORDINADOR','LIDER MECANIZADO']);active(row);check(({PENDIENTE:['CORTE'],CORTE:['MECANIZADO'],MECANIZADO:['PROCESADO']}[row.estado_repo]||[]).includes(args.p_estado),'Transición de demostración no permitida');if(args.p_estado==='PROCESADO')check(row.detalles.every(d=>d.saldo===0),'Quedan cantidades por mecanizar');row.estado_repo=args.p_estado;break;
   case 'sgp_pdt_entrega_registrar_v2':{
    authorize(['COORDINADOR','PICKING']);const [r,d]=byDetail();active(r);check(r.produccion===m.delivery.produccion&&args.p_entrega===m.delivery.id_entrega,'La demo solo tiene entrega para DEMO-B');
    check(Number.isSafeInteger(args.p_cantidad)&&args.p_cantidad>0&&args.p_cantidad<=d.avance_neto,'Cantidad no entregable');check(!m.lines.some(l=>l.id_detalle===d.id_detalle&&l.estado!=='ANULADA'),'Ya existe una línea para este detalle');
    const l={id_linea:id(),id_detalle:d.id_detalle,id_entrega:args.p_entrega,cantidad:args.p_cantidad,estado:'REGISTRADA',asignada:false};m.lines.push(l);result.id_linea=l.id_linea;break;
   }
   case 'sgp_picking_validar_recepcion':authorize(['COORDINADOR','RECEPCION']);m.delivery.estado=args.p_diferencias?.length?'AUDITADA_DIFERENCIA':'VALIDADA';result.estado=m.delivery.estado;break;
   case 'sgp_pdt_entrega_validar_v2':authorize(['COORDINADOR','RECEPCION']);check(m.delivery.estado==='VALIDADA','Solo VALIDADA permite acreditar cantidades');check(line().estado!=='ANULADA','Línea anulada');line().estado='VALIDADA';break;
   case 'sgp_pdt_asignar_v2':authorize(['COORDINADOR','RECEPCION']);check(m.delivery.estado==='VALIDADA'&&line().estado==='VALIDADA','La línea necesita validación de recepción');check(!line().asignada,'Línea ya acreditada: no admite doble consumo');line().asignada=true;break;
   case 'sgp_pdt_entrega_anular_v2':authorize(['COORDINADOR']);check(String(args.p_motivo||'').trim(),'La anulación requiere motivo');check(m.rows.find(r=>r.detalles.some(d=>d.id_detalle===line().id_detalle))?.estado!=='RESUELTO','PDT ya cerrado');line().estado='ANULADA';line().asignada=false;break;
   case 'sgp_pdt_cerrar_v2':authorize(['COORDINADOR','PICKING']);active(row);check(row.detalles.length&&row.estado_repo==='PROCESADO'&&row.detalles.every(d=>d.saldo===0),'Falta completar mecanizado y etapas');check(m.delivery.estado==='VALIDADA'&&row.detalles.every(d=>m.lines.filter(l=>l.id_detalle===d.id_detalle&&l.estado==='VALIDADA'&&l.asignada).reduce((n,l)=>n+l.cantidad,0)===d.cantidad_validada),'Falta evidencia cuantitativa validada y acreditada');row.estado='RESUELTO';row.estado_repo='PICKING';break;
   default:throw new Error('Operación no incluida en la simulación visual');
  }
  if(key)m.retries[key]={signature,result:structuredClone(result)};
  model=m;return result;
 }
 return {rpc:async(name,args)=>{try{return {data:simulate(name,args)};}catch(error){return {error};}},snapshot:()=>({delivery:structuredClone(model.delivery),faltantes:[],other_open:model.other_open})};
}
