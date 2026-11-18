// Synthetic only. Does not contain or retrieve real pending-attempt identifiers.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const db=new PGlite();
await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
CREATE SCHEMA sgp_opt_shared;
CREATE TABLE sgp_opt_shared.approvals(sha256 text,fuentes jsonb);
CREATE TABLE sgp_opt_shared.documents(id_documento uuid PRIMARY KEY,sha256 text NOT NULL);
CREATE TABLE sgp_opt_shared.sources(id_documento uuid,consecutivo text,origen text);
INSERT INTO sgp_opt_shared.documents VALUES('00000000-0000-4000-8000-000000000010',repeat('f',64));`);
const sql=file=>readFileSync(new URL('../../docs/sql-proposals/opt-shared/'+file,import.meta.url),'utf8');
await db.exec(sql('import_uncertainty_fence_REVIEW.sql'));
const doc=(id,hash)=>db.query('INSERT INTO sgp_opt_shared.documents VALUES($1,$2)',[id,hash]);
const id='00000000-0000-4000-8000-000000000020';
await assert.rejects(doc(id,'a'.repeat(64)),/FENCE_CLOSED/);
await db.exec(`INSERT INTO sgp_opt_shared.import_uncertainties(incident_id,pdf_sha256,opt,original_identity) VALUES
('00000000-0000-4000-8000-000000000001',repeat('1',64),'OPT-SYNTH-1','{"synthetic":true}'),
('00000000-0000-4000-8000-000000000002',repeat('2',64),'OPT-SYNTH-2','{"synthetic":true}');
UPDATE sgp_opt_shared.import_fence_control SET certified=true,certificate='SYNTHETIC-CERTIFICATE-ONLY';`);
await assert.rejects(doc(id,'1'.repeat(64)),/PREVIOUS_OUTCOME_UNRESOLVED/);
await doc(id,'a'.repeat(64));
await assert.rejects(db.query("INSERT INTO sgp_opt_shared.approvals VALUES(repeat('a',64),'[{\"consecutivo\":\"OPT-SYNTH-1\",\"origen\":\"PROYECTO\"}]')"),/PREVIOUS_OUTCOME_UNRESOLVED/);
await db.query("INSERT INTO sgp_opt_shared.approvals VALUES(repeat('a',64),'[{\"consecutivo\":\"PROJECT-SAFE\",\"origen\":\"PROYECTO\"}]')");
for(const origin of ['RETAIL','PROYECTO','DESCONOCIDO'])await assert.rejects(db.query('INSERT INTO sgp_opt_shared.sources VALUES($1,$2,$3)',[id,'OPT-SYNTH-2',origin]),/PREVIOUS_OUTCOME_UNRESOLVED/);
await db.query('INSERT INTO sgp_opt_shared.sources VALUES($1,$2,$3)',[id,'OPT-SYNTH-SAFE','RETAIL']);
await assert.rejects(db.query('UPDATE sgp_opt_shared.documents SET sha256=$1 WHERE id_documento=$2',['2'.repeat(64),id]),/PREVIOUS_OUTCOME_UNRESOLVED/);
await assert.rejects(db.query("UPDATE sgp_opt_shared.sources SET consecutivo='OPT-SYNTH-1'"),/PREVIOUS_OUTCOME_UNRESOLVED/);
for(const role of ['anon','authenticated','service_role']){
 await db.exec('SET ROLE '+role);
 await assert.rejects(db.query('SELECT * FROM sgp_opt_shared.import_uncertainties'),/permission denied/);
 await assert.rejects(db.query('UPDATE sgp_opt_shared.import_fence_control SET certified=true'),/permission denied/);
 await db.exec('RESET ROLE');
}
await db.exec('UPDATE sgp_opt_shared.import_fence_control SET expected_active=3');
await assert.rejects(db.query("UPDATE sgp_opt_shared.sources SET origen='PROYECTO'"),/REGISTRY_MISMATCH/);
await db.exec('UPDATE sgp_opt_shared.import_fence_control SET expected_active=2');
const before=await db.query('SELECT * FROM sgp_opt_shared.documents ORDER BY id_documento');
await db.exec(sql('import_uncertainty_fence_CLOSE_REVIEW.sql'));
await assert.rejects(db.query("UPDATE sgp_opt_shared.sources SET origen='PROYECTO'"),/FENCE_CLOSED/);
assert.deepEqual((await db.query('SELECT * FROM sgp_opt_shared.documents ORDER BY id_documento')).rows,before.rows);
assert.equal((await db.query('SELECT count(*)::int n FROM sgp_opt_shared.import_uncertainties')).rows[0].n,2);
await db.close();console.log('PASS synthetic global fence: closed default, two persistent identities, hash OR consecutive across origins, updates, role denial, count mismatch, fail-closed rollback without data deletion. Concurrency not certified.');
