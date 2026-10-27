/** Isolated server interpretation of versioned fields. NOT a source certificate,
 * authorization endpoint or productive C2 reader. Never import into frontend. */
export const VERSIONED_PRODUCTION_FIELDS=Object.freeze(['key_produccion','id_linea','cantidad','ensamblado','empacado','saldo_ensamble','saldo_empaque','reserva_al']);
const quantity=x=>x===null||x===undefined||x===''?null:(typeof x==='number'||typeof x==='string')&&/^\d+$/.test(String(x))&&Number.isSafeInteger(Number(x))?Number(x):null;
const blocked=(reason,observations=null)=>({status:'SIN_CONCILIAR',available:null,reason,observations});
export function describeVersionedProduction(row,key){
 if(!row||typeof key!=='string'||!key||row.key_produccion!==key||!['PANELES_2','FRAMES_2'].includes(row.id_linea)||!key.endsWith('|'+row.id_linea))return blocked('IDENTIDAD_PRODUCCION_NO_DEMOSTRADA');
 const raw=Object.fromEntries(VERSIONED_PRODUCTION_FIELDS.map(f=>[f,row[f]??null]));
 const quantities=Object.fromEntries(['cantidad','ensamblado','empacado','saldo_ensamble','saldo_empaque'].map(f=>[f,quantity(row[f])]));
 const observations={raw,quantities,sourceContract:'COLUMNAS_VERSIONADAS_NO_CERTIFICACION_INSTALADA',assemblyBasis:'NO_CERTIFICADA',eventInclusion:'NO_DEMOSTRADA',reserveAllocation:'NO_DEMOSTRADA',part:'NO_DEMOSTRADA'};
 if(Object.values(quantities).some(x=>x===null))return blocked('CANTIDADES_INCOMPLETAS_O_NO_ENTERAS',observations);
 // Never infer NET/GROSS, cut inclusion or assembled=total-saldo by arithmetic.
 return blocked('SEMANTICA_CORTE_AMBITOS_Y_ESCRITORES_PENDIENTES',observations);
}
export function describePickingPdtCounts(rows,key){
 if(typeof key!=='string'||!key||!Array.isArray(rows))return blocked('FUENTE_PDT_NO_DISPONIBLE');
 if(rows.some(p=>!p||p.key_produccion!==key||typeof p.id_pendiente!=='string'||!p.id_pendiente))return blocked('COBERTURA_PDT_O_IDENTIDAD_NO_DEMOSTRADA');
 if(new Set(rows.map(p=>p.id_pendiente)).size!==rows.length)return blocked('PDT_DUPLICADO');
 return blocked('VALIDACION_CONSOLIDADA_Y_COBERTURA_REQUERIDAS',{perPending:rows.map(p=>({id:p.id_pendiente,reportedPieces:p.cantidad??null,auditedAffected:p.auditado===true?quantity(p.ventanas_afectadas):null,unverifiedAffected:p.ventanas_afectadas??null,origin:p.origen??null,stage:'NO_CLASIFICADA',replenishmentState:p.estado_repo??null})),consolidatedEstimate:null,validatedAffected:null});
}
export function assessSourceEvidence({production,pdts,exportContract,writerProtocol,scopeEvidence}={}){
 const reasons=[];
 if(production?.status!=='CERTIFICADO_SERVIDOR')reasons.push('CONTABILIDAD_PRODUCCION_NO_CERTIFICADA');
 if(pdts?.status!=='VALIDACION_VIGENTE')reasons.push('VALIDACION_CONSOLIDADA_NO_CERTIFICADA');
 if(exportContract?.status!=='CERTIFICADO_SERVIDOR')reasons.push('INCLUSION_EXPORT_NO_CERTIFICADA');
 if(writerProtocol?.status!=='CERTIFICADO_SERVIDOR')reasons.push('ESCRITORES_NO_CERTIFICADOS');
 if(scopeEvidence?.status!=='CERTIFICADO_SERVIDOR')reasons.push('AMBITOS_NO_CERTIFICADOS');
 // No real producer/certificate authority is installed by2E. Supplied flags
 // cannot replace server registration, even when all claim "CERTIFICADO".
 reasons.push('REGISTRO_SERVIDOR_PRODUCTIVO_NO_IMPLEMENTADO');
 return {status:'SIN_CONCILIAR',available:null,reasons};
}
