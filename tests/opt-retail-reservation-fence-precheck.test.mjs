import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {targets,patchDefinition,buildReview,digest} from '../scripts/build-opt-fence-precheck-review.mjs';
const base='docs/sql-proposals/opt-shared/';
const fixtures={
 'public.sgp_opt_importar_validado_v1':base+'import_channel_REVIEW.sql',
 'public.sgp_opt_importar_proyecto_validado_v2':base+'import_channel_proyecto_v2_REVIEW.sql',
 'public.sgp_opt_importar_retail_validado_v3':base+'import_channel_retail_v3_REVIEW.sql',
 'public.sgp_opt_importar_retail_validado_v4':base+'import_channel_retail_v4_REVIEW.sql',
 'public.sgp_opt_importar_retail_resuelto_v1':'docs/opt-recovery/installed-resolution-20261114221005.sql'
};
for(const [name,path] of Object.entries(fixtures))test('precheck after authentication before all branches: '+name,()=>{
 const all=readFileSync(path,'utf8');const start=all.indexOf('CREATE FUNCTION '+name+'(');
 const end=all.indexOf('END $$;',start)+7;const original=all.slice(start,end);
 const patched=patchDefinition(name,original);
 assert.equal(patched.split('assert_import_request').length,2);
 assert.ok(patched.indexOf('assert_import_request')<patched.indexOf('RETURN '));
 if(name.endsWith('resuelto_v1')) assert.ok(patched.indexOf('assert_import_request')<patched.indexOf('resolution_gate(false)'));
 assert.throws(()=>patchDefinition(name,patched),/ALREADY_PATCHED/);
 assert.throws(()=>patchDefinition(name,original.replace('actor(p_token,true)','actor(p_token,false)')),/ANCHOR_DRIFT/);
});
test('owner core precheck precedes duplicate branch',()=>{
 const s="CREATE FUNCTION sgp_opt_shared.import_manifest(p_approval uuid,p_pdf bytea,p_manifest jsonb) RETURNS jsonb AS $$ BEGIN SELECT * INTO approval FROM sgp_opt_shared.approvals WHERE id_aprobacion=p_approval FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'OPT_APROBACION_REQUERIDA'; END IF; RETURN '{}'::jsonb; END $$";
 const p=patchDefinition('sgp_opt_shared.import_manifest',s);assert.ok(p.includes('assert_import_request(p_pdf,approval.fuentes)'));assert.ok(p.indexOf('assert_import_request')<p.indexOf('RETURN '));
});
test('generator requires complete inventory and hashes',()=>{
 assert.throws(()=>buildReview([]),/INCOMPLETE/);
 const ss=Object.keys(targets).map(name=>({name,signature:name+'(text)',definition:'x',sha256:digest('wrong')}));
 assert.throws(()=>buildReview(ss),/HASH_MISMATCH/);
 assert.throws(()=>patchDefinition('public.unknown',''),/UNKNOWN/);
});
