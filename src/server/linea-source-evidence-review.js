/** Stage2F audit-only adapter. Never an authorization decision, C2 reader or
 * productive source certificate. A reported catalog fact has a limited scope.
 */
import {assessSourceEvidence} from './linea-real-source-contracts.js';
const names=new Set(['sgp_previsualizar_export_diario','sgp_aplicar_export_diario','sgp_picking_validar_recepcion','sgp_sesion_actual']);
const tables=new Set(['sgp_export_diario_historial','sgp_pdt_entrega_lineas']);
export function reviewSourceEvidence(packet){
 if(packet?.schemaVersion!==1||packet?.evidenceKind!=='CHATGPT_REPORTED_PRODUCTION_READ_ONLY'||!Array.isArray(packet.functions)||!Array.isArray(packet.relations))throw Error('INVALID_EVIDENCE_PROVENANCE');
 const seen=new Set();
 const functions=packet.functions.map(f=>{
  if(!f||!names.has(f.name)||seen.has(f.name))throw Error('INVALID_FUNCTION_EVIDENCE');
  seen.add(f.name);
  return {name:f.name,status:f.exists===true?'VERIFICADO_CON_FUENTE_REAL':'PENDIENTE',method:'REPORTADO_POR_CHATGPT',scope:'EXISTENCIA_Y_METADATA_REPORTADA_POR_NOMBRE',securityDefiner:typeof f.securityDefiner==='boolean'?f.securityDefiner:null,knownExecuteGrantees:Array.isArray(f.executeGrantees)?['anon','authenticated'].filter(r=>f.executeGrantees.includes(r)):null,grantListExhaustive:false,signatureVerified:false,currentControlReview:'PENDIENTE_CUERPO_O_HUELLA_VIGENTE',securityConclusion:'NO_DEDUCIBLE_DE_SECURITY_DEFINER_O_EXECUTE'};
 });
 const seenRelations=new Set();
 const relations=packet.relations.map(t=>{
  if(!t||!tables.has(t.name)||seenRelations.has(t.name))throw Error('INVALID_RELATION_EVIDENCE');
  seenRelations.add(t.name);
  return {name:t.name,status:t.structureConfirmed===true?'VERIFICADO_CON_FUENTE_REAL':'PENDIENTE',method:'REPORTADO_POR_CHATGPT',confirmedColumnNames:Array.isArray(t.confirmedColumnNames)?t.confirmedColumnNames.filter(n=>typeof n==='string'):null,fullDefinitionReviewed:false,typesVerified:false,foreignKeysVerified:false,pdtCoverageCertified:false};
 });
 const blocked=assessSourceEvidence();
 return {...blocked,certificationComplete:false,authorizationDecision:null,verificationByThisSession:false,functions,relations,
  pending:['EXPORT_CURRENT_BODIES_AND_OVERLOAD_SIGNATURES','AUTH_PICKING_CURRENT_HASH_CONTRAST','EXPORT_SEMANTICS_AND_EXPLICIT_EVENT_INCLUSION','PDT_COVERAGE_PRODUCTION_RESERVE_PART','FUNCTIONAL_CARGO_BINDINGS_AND_SCOPES','ALL_EFFECTIVE_WRITERS_LOCK_PROTOCOL'],
  roleProposals:[
   {cargo:'LIDER_PICKING',versionedCandidates:['SUPERVISOR DE PICKING','LIDER LINEA','LIDER'],installedBinding:null,requiredScope:['production','stage'],source:'CODIGO_Y_CAPTURA_PREVIA_NO_EQUIVALENCIA_AUTOMATICA'},
   {cargo:'LIDER_ENSAMBLE',versionedCandidates:['LIDER LINEA','LIDER'],installedBinding:null,requiredScope:['production','stage'],source:'CODIGO_Y_CAPTURA_PREVIA_NO_EQUIVALENCIA_AUTOMATICA'},
   {cargo:'COORDINADOR',versionedCandidates:['COORDINADOR'],installedBinding:null,requiredScope:['production','stage'],source:'CODIGO_Y_CAPTURA_PREVIA_NO_AMBITO_VERIFICADO'}]};
}
