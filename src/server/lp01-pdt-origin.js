/** Inspector for native PDT evidence. No endpoint, credentials, receipt insertion or SALE writes. */
export function inspectPdtOrigin(snapshot){
 if(!['LEGACY','V2','V4'].includes(snapshot?.contract))throw Error('Contrato PDT no reconocido');
 const missing=[];
 if(!snapshot.key||!['PANELES_2','FRAMES_2'].includes(snapshot.line)||!snapshot.key.endsWith('|'+snapshot.line))missing.push('canonical_production_line');
 if(!snapshot.deliveryId||snapshot.deliveryState!=='VALIDADA')missing.push('validated_physical_delivery');
 if(snapshot.lineState!=='VALIDADA'||snapshot.assigned!==true)missing.push('validated_assigned_material_line');
 if(snapshot.coverage!==true||!snapshot.closeId)missing.push('accredited_material_coverage');
 if(snapshot.cancelled===true)missing.push('source_annulment_requires_reconciliation');
 // Current native contracts have no authoritative mapping for these fields.
 // Never promote client-provided roots/counts/verified flags to a SQL07 receipt.
 missing.push('authoritative_LP_root_stage_binding','source_event_and_delivery_versions','production_stage_window_union_before_after');
 return {contract:'LP-PDT-ORIGIN-INSPECTION/1',status:'PENDIENTE_COORDINADOR',credit:0,canEmitReceipt:false,origin:{contract:snapshot.contract,key:snapshot.key??null,delivery:snapshot.deliveryId??null,close:snapshot.closeId??null},missing};
}
