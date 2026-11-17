// Offline proposal generator. No database/network access; never executes generated SQL.
import {createHash} from 'node:crypto';
export const targets = Object.freeze({
 'public.sgp_opt_importar_validado_v1': 'actor',
 'public.sgp_opt_importar_proyecto_validado_v2': 'actor',
 'public.sgp_opt_importar_retail_validado_v3': 'actor',
 'public.sgp_opt_importar_retail_validado_v4': 'actor',
 'public.sgp_opt_importar_retail_resuelto_v1': 'a',
 'sgp_opt_shared.import_manifest': 'approval'
});
export const digest = text => createHash('sha256').update(text).digest('hex');
export function patchDefinition(name, definition) {
 const actor=targets[name];
 if(!actor) throw Error('UNKNOWN_WRITER');
 if(definition.includes('assert_import_request')) throw Error('ALREADY_PATCHED');
 const header=new RegExp(`^CREATE(?: OR REPLACE)? FUNCTION ${name.replaceAll('.','\\.')}\\(`,'i');
 if(!header.test(definition)) throw Error('WRITER_HEADER_MISMATCH');
 // Fail closed on drift, including a renamed actor or a different authorization expression.
 const anchor=actor==='approval'
  ? /IF NOT FOUND THEN RAISE EXCEPTION 'OPT_APROBACION_REQUERIDA'; END IF;/g
  : new RegExp(`${actor}\\s*:=\\s*sgp_opt_shared\\.actor\\(p_token,\\s*true\\);`,'g');
 if([...definition.matchAll(anchor)].length!==1) throw Error('AUTHORIZATION_ANCHOR_DRIFT');
 const call=actor==='approval'
  ? 'PERFORM sgp_opt_shared.assert_import_request(p_pdf,approval.fuentes);'
  : 'PERFORM sgp_opt_shared.assert_import_request(p_pdf,p_sources);';
 return definition.replace(/^CREATE(?: OR REPLACE)? FUNCTION/i,'CREATE OR REPLACE FUNCTION')
  .replace(anchor, match=>`${match}\n ${call}`);
}
export function buildReview(snapshots) {
 if(snapshots.length!==Object.keys(targets).length || new Set(snapshots.map(s=>s.name)).size!==snapshots.length) throw Error('INCOMPLETE_WRITER_INVENTORY');
 const statements=snapshots.map(s=>{
  if(!/^[a-f0-9]{64}$/.test(s.sha256)||digest(s.definition)!==s.sha256) throw Error('SNAPSHOT_HASH_MISMATCH');
  if(!/^[a-z_0-9.]+\([a-z_0-9, ]+\)$/.test(s.signature)) throw Error('INVALID_SIGNATURE');
  if(!s.signature.startsWith(s.name+'(')) throw Error('SIGNATURE_NAME_MISMATCH');
  const patched=patchDefinition(s.name,s.definition);
  return `DO $fence_review$ BEGIN\n IF encode(sha256(convert_to(pg_get_functiondef('${s.signature}'::regprocedure),'UTF8')),'hex') <> '${s.sha256}' THEN RAISE EXCEPTION 'OPT_FENCE_WRITER_DRIFT'; END IF;\nEND $fence_review$;\n${patched};`;
 });
 return `-- REVIEW ONLY. PRIVATE SNAPSHOT OUTPUT. Do not commit to public repositories.\n-- Requires explicit authorization, closed prior operations, atomic certified registry install.\nBEGIN;\nSET LOCAL lock_timeout='1s';\nLOCK TABLE sgp_opt_shared.approvals,sgp_opt_shared.documents,sgp_opt_shared.sources IN SHARE ROW EXCLUSIVE MODE;\n${statements.join('\n')}\nCOMMIT;\n`;
}
