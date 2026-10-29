/** Explicit read adapter. Never falls back from a failed new write to legacy RPCs. */
function count(value, label) {
  if (value === null || value === undefined || value === '') throw new Error(label);
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 0) throw new Error(label);
  return n;
}

export function adaptPendingListV2(payload) {
  if (payload?.ok !== true || payload.contract_version !== 2 || !Array.isArray(payload.pendientes)) {
    throw new Error('Contrato PDT v2 inválido');
  }
  return payload.pendientes.map(row => {
    if (!row.id_pendiente || !Array.isArray(row.detalles) || !Array.isArray(row.ncs)) {
      throw new Error('PDT v2 incompleto');
    }
    if(row.contrato_pdt==='LEGACY')return {...row,cantidad:row.cantidad_reportada,cantidad_validada:null,avance_neto:null,saldo_mecanizado:null,cierre_habilitado:false};
    const details = row.detalles.map(d => {
      const validada = count(d.cantidad_validada, 'Cantidad validada inválida');
      const avanzada = count(d.avance_neto, 'Avance inválido');
      const saldo = count(d.saldo, 'Saldo inválido');
      if (!d.id_detalle || validada === 0 || validada - avanzada !== saldo) throw new Error('Saldo incoherente');
      return {...d, cantidad_validada: validada, avance_neto: avanzada, saldo};
    });
    if (new Set(details.map(d => d.id_detalle)).size !== details.length) throw new Error('Detalle duplicado');
    return {...row, cantidad: count(row.cantidad_reportada, 'Cantidad reportada inválida'),
      cantidad_validada: details.length ? details.reduce((n,d) => n+d.cantidad_validada,0) : null,
      avance_neto: details.length ? details.reduce((n,d) => n+d.avance_neto,0) : null,
      saldo_mecanizado: details.length ? details.reduce((n,d) => n+d.saldo,0) : null,
      detalles: details, picking: {cobertura: 'NO_VERIFICADA'}, cierre_habilitado: false};
  });
}

const NEW_WRITES = new Set(['sgp_aluminio_pendiente_validar_detalles_v1',
  'sgp_aluminio_pendiente_registrar_avance_v1', 'sgp_aluminio_pendiente_revertir_avance_v1',
  'sgp_aluminio_pendiente_nc_vincular_v1','sgp_pdt_estado_v2','sgp_pdt_entrega_registrar_v2','sgp_pdt_entrega_validar_v2',
  'sgp_pdt_asignar_v2','sgp_pdt_entrega_anular_v2','sgp_pdt_cerrar_v2']);
const MANUAL_WRITES = new Set(['sgp_pdt_manual_entrega_registrar_v1','sgp_pdt_manual_entrega_validar_v1',
  'sgp_pdt_manual_asignar_v1','sgp_pdt_manual_entrega_anular_v1','sgp_pdt_manual_cerrar_v1']);

export async function executeManualPdt(client, operation, args) {
  if (!MANUAL_WRITES.has(operation)) throw new Error('Operación PDT manual no permitida');
  const result=await client.rpc(operation,args);
  if(result.error)throw result.error;
  if(result.data?.ok!==true)throw new Error('Respuesta PDT manual inválida');
  return result.data;
}

export async function executePendingV2(client, capabilities, operation, args) {
  if (!NEW_WRITES.has(operation) || capabilities?.contract_version !== 2 ||
      !Array.isArray(capabilities.operations) || !capabilities.operations.includes(operation)) {
    throw new Error('Operación PDT no disponible en este backend');
  }
  const result = await client.rpc(operation, args);
  if (result.error) throw result.error;
  if (result.data?.ok !== true) throw new Error('Respuesta PDT inválida');
  return result.data;
}

export async function discoverPendingV2(client, token) {
  const {data,error}=await client.rpc('sgp_pdt_capacidades_v2',{p_token:token});
  if (error) {
    if (['PGRST202','42883'].includes(error.code)) return null;
    throw error;
  }
  if(data?.ok!==true || data.contract_version!==2 || !Array.isArray(data.operations)) {
    throw new Error('Capacidades PDT inválidas');
  }
  return data;
}

export async function loadPendingRows(client,token,role) {
  const capabilities=await discoverPendingV2(client,token);
  const [legacy,modern]=await Promise.all([capabilities && ['RECEPCION','PICKING'].includes(role)?Promise.resolve({data:[],error:null}):client.rpc('sgp_aluminio_pendientes_listar',{p_token:token,p_solo_abiertos:false}),capabilities?client.rpc('sgp_aluminio_pendientes_listar_v2',{p_token:token,p_solo_abiertos:false}):Promise.resolve(null)]);
  const {data,error}=legacy;
  if(error)throw error;
  if(!Array.isArray(data))throw new Error('Lista legacy inválida');
  if(!capabilities)return {rows:data,capabilities:null};
  if(modern.error)throw modern.error;
  const adapted=adaptPendingListV2(modern.data);
  let manualResponse=await client.rpc('sgp_pdt_manual_listar_v1',{p_token:token});
  if(manualResponse.error&&['PGRST202','42883'].includes(manualResponse.error.code))manualResponse=await client.rpc('sgp_pdt_manual_ids_v1',{p_token:token});
  if(manualResponse.error&&!['PGRST202','42883'].includes(manualResponse.error.code))throw manualResponse.error;
  if(!manualResponse.error&&(manualResponse.data?.ok!==true||!Array.isArray(manualResponse.data.ids??manualResponse.data.pendientes)
    ||(manualResponse.data.pendientes&&manualResponse.data.contract_version!=='pdt-manual-3')))throw new Error('Identidades PDT manual inválidas');
  const manualMeta=new Map((manualResponse.data?.pendientes||[]).map(r=>[String(r.id_pendiente),r]));
  const manualIds=new Set(manualResponse.error?[]:(manualResponse.data.ids||manualResponse.data.pendientes.map(r=>r.id_pendiente)).map(String));
  const original=new Map(data.map(r=>[r.id_pendiente,r]));
  const rows=adapted.map(r=>({...original.get(r.id_pendiente),...r,...manualMeta.get(String(r.id_pendiente)),
    semana:manualMeta.get(String(r.id_pendiente))?.semana??r.semana??original.get(r.id_pendiente)?.semana,
    manual_pdt:manualIds.has(String(r.id_pendiente))}));
  const present=new Set(rows.map(r=>r.id_pendiente));
  for(const r of data)if(!present.has(r.id_pendiente))rows.push(r);
  return {rows,capabilities};
}

/** Fresh authoritative read after a mutation; no legacy fallback or optimistic balance. */
export async function refreshPendingV2(client,token,id){
 const result=await client.rpc('sgp_aluminio_pendientes_listar_v2',{p_token:token,p_solo_abiertos:false});
 if(result.error)throw result.error;
 const data=result.data;
 if(data?.ok!==true||data.contract_version!==2||!Array.isArray(data.pendientes))throw new Error('No se pudo comprobar el estado actualizado del PDT');
 const matches=data.pendientes.filter(row=>String(row.id_pendiente)===String(id));
 if(matches.length!==1)throw new Error('PDT no disponible o ambiguo en la consulta actualizada');
 return adaptPendingListV2({...data,pendientes:matches})[0];
}
