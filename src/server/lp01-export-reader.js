import {prepareExportReconciliation} from './lp01-export-reconciliation.js';
/** Private server primitive. Caller supplies a server-controlled DB pool, never a browser client/token.
 * No endpoint, credentials, identity provisioning or writes. Current native contract cannot emit a manifest. */
export const EXPORT_CUT_SQL=`SELECT p.key_produccion AS key,p.id_linea AS line,p.ultima_carga_diaria::text AS cut,
p.saldos_inicializados,p.presente_ultimo_export,c.tipo_fuente,c.id_linea AS load_line,
h.registro_id::text AS history,h.presente,
CASE WHEN $3='ENSAMBLE' THEN h.saldo_ensamble ELSE h.saldo_empaque END AS balance,
CASE WHEN $3='ENSAMBLE' THEN p.saldo_ensamble ELSE p.saldo_empaque END AS current_balance
FROM public.sgp_producciones p LEFT JOIN public.sgp_cargas_diarias c ON c.id_carga_diaria=p.ultima_carga_diaria
LEFT JOIN public.sgp_export_diario_historial h ON h.id_carga_diaria=p.ultima_carga_diaria AND h.key_produccion=p.key_produccion AND h.id_linea=p.id_linea
WHERE p.key_produccion=$1 AND p.id_linea=$2`;
export async function readExportReconciliation(pool,scope){
 if(!scope||Object.keys(scope).some(k=>!['key','line','stage','expectedCut'].includes(k))||typeof scope.key!=='string'||!['PANELES_2','FRAMES_2'].includes(scope.line)||!scope.key.endsWith('|'+scope.line)||!['ENSAMBLE','EMPAQUE'].includes(scope.stage))throw Error('Ámbito de lectura Export inválido');
 const client=await pool.connect();let begun=false;
 try{
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');begun=true;
  const {rows}=await client.query(EXPORT_CUT_SQL,[scope.key,scope.line,scope.stage]);
  let reason='source_has_no_event_revision_mapping';const r=rows[0];
  if(rows.length!==1||!r?.cut||!r.history||r.saldos_inicializados!==true||r.presente_ultimo_export!==true||r.presente!==true||r.tipo_fuente!=='EXPORT'||r.load_line!==scope.line)reason='missing_ambiguous_or_unconfirmed_cut';
  else if(r.balance===null||r.current_balance===null||!Number.isSafeInteger(Number(r.balance))||Number(r.balance)<0||Number(r.balance)!==Number(r.current_balance))reason='cut_balance_mismatch';
  else if(scope.expectedCut&&scope.expectedCut!==r.cut)reason='stale_cut';
  // Native writer stores input JSON/history, not an accredited LP inclusion ledger.
  // Do not hash arbitrary input JSON and present it as an official source hash.
  const preview=prepareExportReconciliation({key:scope.key,stage:scope.stage,cut:{key:r?.key,stage:scope.stage,id:r?.cut,hash:null,balance:r?.balance},events:[],manifest:null});
  const result={...preview,status:'PENDIENTE_EVIDENCIA',blocker:'BLOQUEADO_EN_FUENTE',reason,apply:false,observed:{cut:r?.cut??null,history:r?.history??null,line:scope.line,stage:scope.stage},missing:['official_inclusion_hash','LP_event_ids_and_revisions','per_root_complete_inclusion_scope']};
  await client.query('COMMIT');begun=false;return result;
 }catch(e){if(begun)await client.query('ROLLBACK');throw e;}finally{client.release();}
}
