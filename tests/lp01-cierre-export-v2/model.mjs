import {PGlite} from '@electric-sql/pglite';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {xlsx} from './fixture.mjs';
const root=new URL('../../',import.meta.url), read=p=>readFile(new URL(p,root),'utf8');
const db=new PGlite();await db.waitReady;const results=[];
const run=q=>db.exec(q), val=async q=>(await db.query(q)).rows[0]?.v;
const lit=v=>"'"+v.replaceAll("'","''")+"'";
const schemaFingerprint=`SELECT md5(jsonb_build_object(
 'perimeter',(SELECT jsonb_agg(jsonb_build_array(c.relname,pg_get_userbyid(c.relowner),c.relacl::text,c.relrowsecurity,c.relforcerowsecurity) ORDER BY c.relname) FROM pg_class c WHERE c.relnamespace='sgp_lp_export_v2_qa'::regnamespace AND c.relkind='r'),
 'namespace',(SELECT jsonb_build_array(pg_get_userbyid(nspowner),nspacl::text) FROM pg_namespace WHERE nspname='sgp_lp_export_v2_qa'),
 'columns',(SELECT jsonb_agg(jsonb_build_array(c.relname,a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,a.attgenerated,pg_get_expr(d.adbin,d.adrelid)) ORDER BY c.relname,a.attnum) FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE c.relnamespace='sgp_lp_export_v2_qa'::regnamespace AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped),
 'constraints',(SELECT jsonb_agg(jsonb_build_array(c.conname,pg_get_constraintdef(c.oid)) ORDER BY c.conname,pg_get_constraintdef(c.oid)) FROM pg_constraint c WHERE c.connamespace='sgp_lp_export_v2_qa'::regnamespace),
 'functions',(SELECT jsonb_agg(jsonb_build_array(p.proname,p.prosrc,p.prosecdef,p.proconfig) ORDER BY p.proname) FROM pg_proc p WHERE p.pronamespace='sgp_lp_export_v2_qa'::regnamespace),
 'triggers',(SELECT jsonb_agg(pg_get_triggerdef(t.oid) ORDER BY pg_get_triggerdef(t.oid)) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='sgp_lp_export_v2_qa'::regnamespace AND NOT t.tgisinternal)
 )::text) AS v`;
async function reject(sql,pattern){let error;try{await run(sql);}catch(e){error=e;}assert(error);assert.match(error.message,pattern);await run('ROLLBACK;');}
try {
 const model=await read('docs/sql-proposals/lp01-cierre-export-v2/01_model_ISOLATED.sql');
 await reject(model,/ISOLATED_DATABASE/);assert.equal(await val("SELECT to_regnamespace('sgp_lp_export_v2_qa') AS v"),null);
 await run("SET sgp.export_v2_test='ISOLATED_ONLY';");await run(model);assert.equal(await val("SELECT to_regnamespace('sgp_lp_export_v2_qa') AS v"),null);
 results.push('Default file is gated and always rolls back, leaving no schema');
 const install=model.replace(/ROLLBACK;\s*$/,'COMMIT;');await run(install);assert.equal(await val('SELECT enabled AS v FROM sgp_lp_export_v2_qa.artifact'),false);
 await reject(install,/MODEL_ALREADY_EXISTS/);const fingerprint=await val(schemaFingerprint);
 const rollback=`-- Exact empty-model rollback only. Never destroy imported evidence.\nBEGIN;\nDO $restore$\nDECLARE actual text;t text;n bigint;\nBEGIN\n IF current_setting('sgp.export_v2_test',true) IS DISTINCT FROM 'ISOLATED_ONLY' THEN RAISE EXCEPTION 'V2_ISOLATED_DATABASE_REQUIRED'; END IF;\n IF to_regnamespace('sgp_lp_export_v2_qa') IS NULL THEN RAISE EXCEPTION 'V2_MODEL_NOT_FOUND'; END IF;\n IF NOT EXISTS(SELECT 1 FROM sgp_lp_export_v2_qa.artifact WHERE id AND version='LP-EXPORT-PRODUCTION-2.0.0-ISOLATED' AND enabled=false) THEN RAISE EXCEPTION 'V2_MODEL_VERSION_CHANGED'; END IF;\n ${schemaFingerprint.replace('SELECT md5','SELECT md5').replace(' AS v',' INTO actual')};\n IF actual IS DISTINCT FROM '${fingerprint}' THEN RAISE EXCEPTION 'V2_MODEL_SOURCE_CHANGED'; END IF;\n FOREACH t IN ARRAY ARRAY['periods','imports','import_rows','closures','closure_rows','receipts'] LOOP\n  EXECUTE format('SELECT count(*) FROM sgp_lp_export_v2_qa.%I',t) INTO n;\n  IF n<>0 THEN RAISE EXCEPTION 'V2_HISTORY_PRESERVE_NOT_EMPTY'; END IF;\n END LOOP;\nEND $restore$;\nALTER TABLE sgp_lp_export_v2_qa.periods DROP CONSTRAINT period_current_import;\nALTER TABLE sgp_lp_export_v2_qa.periods DROP CONSTRAINT period_current_closure;\nDROP TABLE sgp_lp_export_v2_qa.receipts,sgp_lp_export_v2_qa.closure_rows,sgp_lp_export_v2_qa.closures,sgp_lp_export_v2_qa.import_rows,sgp_lp_export_v2_qa.imports,sgp_lp_export_v2_qa.periods,sgp_lp_export_v2_qa.artifact;\nDROP FUNCTION sgp_lp_export_v2_qa.immutable_history(),sgp_lp_export_v2_qa.validate_closure_source();\nDROP SCHEMA sgp_lp_export_v2_qa;\nCOMMIT;\n`;
 // Generator is separate from verification: subsequent runs verify exact source.
 const rollbackPath='docs/sql-proposals/lp01-cierre-export-v2/02_restore_empty_model_ISOLATED.sql';
 if(process.argv.includes('--generate-rollback'))await writeFile(new URL(rollbackPath,root),rollback);else assert.equal(await read(rollbackPath),rollback);
 await run(rollback);assert.equal(await val("SELECT to_regnamespace('sgp_lp_export_v2_qa') AS v"),null);await reject(rollback,/MODEL_NOT_FOUND/);
 await run(install);await run('ALTER TABLE sgp_lp_export_v2_qa.periods ADD COLUMN unexpected text;');await reject(rollback,/MODEL_SOURCE_CHANGED/);await run('ALTER TABLE sgp_lp_export_v2_qa.periods DROP COLUMN unexpected;');
 // A dropped column is also drift: recreate a fresh in-process database is not
 // required for this test; rollback guards ignore already dropped attributes.
 await run(rollback);await run(install);results.push('Exact source/version rollback succeeds; stale/repeated/drifted rollback rejected');
 const bytes=xlsx([['A',0]]),hex=Buffer.from(bytes).toString('hex'),sha=createHash('sha256').update(bytes).digest('hex');
 await run(`INSERT INTO sgp_lp_export_v2_qa.periods(stage,line,work_date,shift) VALUES('ENSAMBLE','PANELES_2','2026-11-07',1);`);
 const importSQL=`INSERT INTO sgp_lp_export_v2_qa.imports VALUES('00000000-0000-0000-0000-000000000001','ENSAMBLE','PANELES_2','2026-11-07',1,1,repeat('a',64),'Export.xlsx',decode('${hex}','hex'),'${sha}','LP-PBI-XLSX-1','synthetic','2026-11-07T12:00Z');`;
 await reject(importSQL.replace(sha,'b'.repeat(64)),/check constraint/);await run(importSQL);
 await run(`INSERT INTO sgp_lp_export_v2_qa.import_rows VALUES('00000000-0000-0000-0000-000000000001','A|PANELES_2','PRESENT',0,'[2]'),('00000000-0000-0000-0000-000000000001','B|PANELES_2','ABSENT',NULL,'[]');`);
 for(const sql of ["INSERT INTO sgp_lp_export_v2_qa.import_rows VALUES('00000000-0000-0000-0000-000000000001','C|PANELES_2','ABSENT',0,'[]');","UPDATE sgp_lp_export_v2_qa.imports SET filename='replace.xlsx';","DELETE FROM sgp_lp_export_v2_qa.import_rows;"] )await reject(sql,/check constraint|APPEND_ONLY/);
 await run(`INSERT INTO sgp_lp_export_v2_qa.closures VALUES('00000000-0000-0000-0000-000000000002','ENSAMBLE','PANELES_2','2026-11-07',1,2,repeat('a',64),'EXPORT_PRODUCTION_V2','CON_ACTIVIDAD','00000000-0000-0000-0000-000000000001','synthetic','2026-11-07T13:00Z');
 INSERT INTO sgp_lp_export_v2_qa.closure_rows(closure_id,import_id,key,coverage,plan,realized,reason,assignment_refs,manual_history) VALUES
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','A|PANELES_2','PRESENT',10,0,'Cero explícito','[]','{"authority":"HISTORICAL_ONLY"}'),
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','B|PANELES_2','ABSENT',5,NULL,'Export filtrado','[]','{"authority":"HISTORICAL_ONLY"}');
 UPDATE sgp_lp_export_v2_qa.periods SET status='CERRADO',revision=2,current_import='00000000-0000-0000-0000-000000000001',current_closure='00000000-0000-0000-0000-000000000002';`);
 await reject(`INSERT INTO sgp_lp_export_v2_qa.closure_rows(closure_id,import_id,key,coverage,plan,realized,reason,assignment_refs,manual_history) VALUES('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','A|PANELES_2','PRESENT',10,99,'Forged','[]','{"authority":"HISTORICAL_ONLY"}');`,/MUST_MATCH_IMPORT/);
 await reject(`UPDATE sgp_lp_export_v2_qa.periods SET revision=3;`,/foreign key constraint/);
 await reject(`TRUNCATE sgp_lp_export_v2_qa.closure_rows;`,/APPEND_ONLY/);
 const rows=(await db.query('SELECT key,realized,difference,pending_against_plan FROM sgp_lp_export_v2_qa.closure_rows ORDER BY key')).rows;
 assert.deepEqual(rows.map(r=>[r.realized,r.difference,r.pending_against_plan]),[[0,-10,10],[null,null,null]]);
 await reject(rollback,/HISTORY_PRESERVE/);assert.equal(await val('SELECT count(*)::int AS v FROM sgp_lp_export_v2_qa.imports'),1);
 results.push('Original SHA/bytes tied; zero distinct from absence; reasons/keys/FKs checked; immutable evidence and nonempty rollback protected');
 const report={status:'PASS',engine:await val('SELECT version() AS v'),checks:results,modelFingerprint:fingerprint,
  limits:['Synthetic in-process PostgreSQL only, no Supabase access.','Schema model is not an authorization adapter or full import/close transaction.','No concurrency or production RLS/ACL verification is claimed.']};
 await writeFile(new URL('tests/lp01-cierre-export-v2/sql-results.json',root),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await db.close();}
