// Test harness ONLY: all registry identifiers/evidence below are synthetic.
// This is not a production migration and must never consume a real identity export.
import {readFileSync} from 'node:fs';
import {buildReview} from '../../scripts/build-opt-fence-precheck-review.mjs';
function unwrap(sql){
 const s=sql.replace(/^BEGIN;\s*$/m,'').replace(/^COMMIT;\s*$/m,'');
 if(/^\s*(?:BEGIN|COMMIT|ROLLBACK);\s*$/m.test(s))throw Error('NESTED_TRANSACTION_FRAME');
 return s;
}
export function syntheticAtomicFence(snapshots,{injectFailure=false}={}){
 const root=new URL('../../docs/sql-proposals/opt-shared/',import.meta.url);
 const install=unwrap(readFileSync(new URL('import_uncertainty_fence_REVIEW.sql',root),'utf8'));
 const prechecks=unwrap(buildReview(snapshots));
 return `-- SYNTHETIC DISPOSABLE DATABASE ONLY. No production authorization.\nBEGIN;\nSET LOCAL lock_timeout='1s';\n${install}\n
INSERT INTO sgp_opt_shared.import_uncertainties(incident_id,pdf_sha256,opt,index_sha256,original_identity)
SELECT ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 encode(sha256(convert_to('synthetic-pdf-'||n,'UTF8')),'hex'), 'OPT-SYNTH-'||n,
 encode(sha256(convert_to('synthetic-index','UTF8')),'hex'),
 jsonb_build_object('synthetic',true,'ordinal',n,'scope','SYNTHETIC-NOT-PRODUCTION')
FROM generate_series(1,9) n;
${prechecks}\n
DO $synthetic_assert$ BEGIN
 IF (SELECT count(*) FROM sgp_opt_shared.import_uncertainties WHERE active)<>9
 THEN RAISE EXCEPTION 'SYNTHETIC_REGISTRY_INCOMPLETE'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(ARRAY['anon','authenticated','service_role']) role
 WHERE has_table_privilege(role,'sgp_opt_shared.import_uncertainties','SELECT')
 OR has_table_privilege(role,'sgp_opt_shared.import_uncertainties','INSERT')
 OR has_table_privilege(role,'sgp_opt_shared.import_uncertainties','UPDATE')
 OR has_table_privilege(role,'sgp_opt_shared.import_uncertainties','DELETE')
 OR has_function_privilege(role,'sgp_opt_shared.assert_import_fence(text,text)','EXECUTE'))
 THEN RAISE EXCEPTION 'SYNTHETIC_PRIVATE_ACL'; END IF;
END $synthetic_assert$;
UPDATE sgp_opt_shared.import_fence_control SET expected_active=9,certified=true,
 certificate='SYNTHETIC-ONLY-NOT-CLOSURE-EVIDENCE';
${injectFailure?"DO $injected$ BEGIN RAISE EXCEPTION 'SYNTHETIC_FAILURE_BEFORE_COMMIT'; END $injected$;":''}
COMMIT;\n`;
}
