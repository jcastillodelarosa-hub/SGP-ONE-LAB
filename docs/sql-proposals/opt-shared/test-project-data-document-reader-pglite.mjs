import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const {PGlite}=await import(process.env.OPT_PGLITE_MODULE||'@electric-sql/pglite');const db=new PGlite();
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,hash=b=>createHash('sha256').update(b).digest('hex');
await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA sgp_opt_shared;
CREATE TABLE sgp_opt_shared.documents(id_documento uuid PRIMARY KEY,sha256 text,manifest_sha256 text,id_aprobacion uuid);
CREATE TABLE sgp_opt_shared.approvals(id_aprobacion uuid,evidencia jsonb);
CREATE TABLE sgp_opt_shared.sources(id_documento uuid,consecutivo text);
CREATE TABLE sgp_opt_shared.pieces(id_documento uuid,id_pieza uuid);
CREATE TABLE sgp_opt_shared.assignments(id_pieza uuid,reserva text,sistema text,key_produccion text);
CREATE TABLE sgp_opt_shared.cuts(id_pieza uuid);
CREATE TABLE sgp_opt_shared.document_summaries(id_documento uuid,sha256 text,id_aprobacion uuid,manifest_sha256 text,evidence_sha256 text,summary jsonb);
CREATE FUNCTION sgp_opt_shared.actor(t text,w boolean) RETURNS text LANGUAGE plpgsql AS $$BEGIN IF t IS NULL OR t NOT IN ('valid-user-a','valid-user-b') THEN RAISE EXCEPTION 'DENIED';END IF;RETURN t;END$$;
CREATE FUNCTION sgp_opt_shared.validate_scope(s jsonb) RETURNS void LANGUAGE plpgsql AS $$BEGIN IF s->>'linea' IS DISTINCT FROM 'PANELES_2' OR s->>'anio' IS DISTINCT FROM '2099' OR s->>'semana' IS DISTINCT FROM '1' THEN RAISE EXCEPTION 'SCOPE';END IF;END$$;
CREATE FUNCTION sgp_opt_shared.in_scope(k text,s jsonb) RETURNS boolean LANGUAGE sql AS $$SELECT k=s->>'key'$$;`);
const summary={contract:'OPT-DOCUMENT-SUMMARY-1',scope:'DOCUMENTO',cutRows:[{original:'PROFILE SUMMARY'}],materialRows:[{original:'MATERIAL SUMMARY'}],projectData:{unverified:'INLINE MUST NOT LEAK'}};
const batch=[];
for(let n=1;n<=4;n++){
 const pdf=Buffer.from('%PDF-SYNTH-'+n),sha=hash(pdf),manifest='b'.repeat(64);
 await db.query('INSERT INTO sgp_opt_shared.documents VALUES($1,$2,$3,$4)',[id(n),sha,manifest,id(10+n)]);
 await db.query('INSERT INTO sgp_opt_shared.approvals VALUES($1,$2)',[id(10+n),n===1?{documentary_summary:summary}:{historical:'unchanged'}]);
 await db.query('INSERT INTO sgp_opt_shared.sources VALUES($1,$2)',[id(n),'SYNTH-'+n]);await db.query('INSERT INTO sgp_opt_shared.pieces VALUES($1,$2)',[id(n),id(20+n)]);
 await db.query('INSERT INTO sgp_opt_shared.assignments VALUES($1,$2,$3,$4)',[id(20+n),n===4?'OTHER':'RES','SYS',n===4?'OTHER':'KEY']);
 if(n===2)await db.query("INSERT INTO sgp_opt_shared.document_summaries SELECT d.id_documento,d.sha256,d.id_aprobacion,d.manifest_sha256,encode(sha256(convert_to(a.evidencia::text,'UTF8')),'hex'),$1 FROM sgp_opt_shared.documents d JOIN sgp_opt_shared.approvals a USING(id_aprobacion) WHERE d.id_documento=$2",[summary,id(n)]);
 const projectData={contract:'OPT-PROJECT-DATA-1',scope:'DOCUMENTO',rows:[{item:6,profile:'SYNTH',code:'FINISH A/\nFINISH B',length:'132 5/16"',reference:'COMPLETE FOREIGN ORDER / LINE / FINAL',quantity:16,sourcePage:1,sourceId:'project-p1-item6'}],totalQuantity:16};
 batch.push({id_documento:id(n),pdf_hex:pdf.toString('hex'),expected_sha256:sha,expected_manifest_sha256:manifest,extractor_sha256:'c'.repeat(64),projectData});
}
const baseline=readFileSync(new URL('fixtures/document-summary-before-inline-guard.sql',import.meta.url),'utf8');await db.exec(baseline);
await db.exec("REVOKE ALL ON FUNCTION public.sgp_opt_resumen_documental_v1(text,jsonb,text,text) FROM PUBLIC,service_role;GRANT EXECUTE ON FUNCTION public.sgp_opt_resumen_documental_v1(text,jsonb,text,text) TO anon,authenticated;");
const config=async()=>(await db.query("SELECT proacl::text,proowner,prosecdef,proconfig FROM pg_proc WHERE oid='public.sgp_opt_resumen_documental_v1(text,jsonb,text,text)'::regprocedure")).rows;
const originalConfig=await config(),scope={linea:'PANELES_2',anio:2099,semana:1,key:'KEY'};
const read=async(t='valid-user-a',s=scope,r='RES',sys='SYS')=>(await db.query('SELECT public.sgp_opt_resumen_documental_v1($1,$2,$3,$4) r',[t,s,r,sys])).rows[0].r;
const snapshots=async()=>{const out={};for(const table of ['documents','approvals','sources','pieces','assignments','cuts','document_summaries'])out[table]=hash(JSON.stringify((await db.query(`SELECT to_jsonb(t) r FROM sgp_opt_shared.${table} t ORDER BY to_jsonb(t)::text`)).rows));return out;};
const originalSnapshots=await snapshots();await db.exec(readFileSync(new URL('project_data_store_REVIEW.sql',import.meta.url),'utf8'));
const install=readFileSync(new URL('project_data_document_reader_REVIEW.sql',import.meta.url),'utf8');await db.exec(install);
let result=await read();assert.equal(result.documents.length,3);assert(result.documents.every(d=>!d.summary?.projectData));assert.equal(result.documents[2].status,'NOT_PERSISTED');assert(!JSON.stringify(result).includes('INLINE MUST NOT LEAK'));
await db.query('SELECT sgp_opt_shared.recover_project_data_reviewed($1)',[batch]);
for(const token of ['valid-user-a','valid-user-b']){
 result=await read(token);assert.equal(result.documents.length,3);
 for(const d of result.documents){assert.deepEqual(d.summary.projectData,batch[0].projectData);assert.equal(d.scope,'DOCUMENTO');}
 assert.equal(result.documents[0].status,'AVAILABLE');assert.equal(result.documents[1].status,'AVAILABLE');assert.equal(result.documents[2].status,'PARTIAL');assert.deepEqual(result.documents[2].summary.cutRows,[]);
 for(const d of result.documents.slice(0,2)){assert.deepEqual(d.summary.cutRows,summary.cutRows);assert.deepEqual(d.summary.materialRows,summary.materialRows);}
}
for(const role of ['anon','authenticated']){await db.exec('SET ROLE '+role);assert.equal((await read('valid-user-b')).documents.length,3);await assert.rejects(read(null),/DENIED/);await db.exec('RESET ROLE');}
for(const token of [null,'expired','unauthorized-role'])await assert.rejects(read(token),/DENIED/);
for(const s of [{...scope,linea:'FRAMES_2'},{...scope,semana:2},{...scope,anio:2098}])await assert.rejects(read('valid-user-a',s),/SCOPE/);
for(const args of [['valid-user-a',scope,'OTHER'],['valid-user-a',scope,'RES','OTHER'],['valid-user-a',{...scope,key:'OTHER'}]])assert.equal((await read(...args)).documents.length,0);
// Integrity failure never serves the sidecar and never falls back to unverified inline detail.
for(const column of ['sha256','manifest_sha256']){await db.exec('BEGIN');await db.query(`UPDATE sgp_opt_shared.documents SET ${column}=$1 WHERE id_documento=$2`,['e'.repeat(64),id(1)]);assert.equal((await read()).documents[0].summary.projectData,undefined);await db.exec('ROLLBACK');}
await db.exec('BEGIN');await db.exec('ALTER TABLE sgp_opt_shared.project_data_metadata DISABLE TRIGGER project_data_no_mutation');await db.query('UPDATE sgp_opt_shared.project_data_metadata SET metadata_sha256=$1 WHERE id_documento=$2',['f'.repeat(64),id(1)]);assert.equal((await read()).documents[0].summary.projectData,undefined);await db.exec('ROLLBACK');
assert.deepEqual(await config(),originalConfig);assert.deepEqual(await snapshots(),originalSnapshots);await db.exec(install);assert.deepEqual(await config(),originalConfig);
// Containment is idempotent, retains private metadata/legacy summaries, and can resume.
const metadataBefore=JSON.stringify((await db.query('SELECT * FROM sgp_opt_shared.project_data_metadata ORDER BY id_documento')).rows);
const contain=readFileSync(new URL('project_data_containment_REVIEW.sql',import.meta.url),'utf8');
await db.exec(contain);await db.exec(contain);
const contained=await read();assert(contained.documents.every(d=>!d.summary?.projectData));assert.equal(contained.documents[2].status,'NOT_PERSISTED');
for(const d of contained.documents.slice(0,2)){assert.deepEqual(d.summary.cutRows,summary.cutRows);assert.deepEqual(d.summary.materialRows,summary.materialRows);}
assert.deepEqual(await config(),originalConfig);assert.deepEqual(await snapshots(),originalSnapshots);
assert.equal(JSON.stringify((await db.query('SELECT * FROM sgp_opt_shared.project_data_metadata ORDER BY id_documento')).rows),metadataBefore);
await assert.rejects(read(null),/DENIED/);await db.exec(install);assert.equal((await read()).documents[0].summary.projectData.totalQuantity,16);
// Accept previously staged guard, preserving grants; reject unknown source.
await db.exec(baseline);await db.exec(readFileSync(new URL('project_data_inline_guard_REVIEW.sql',import.meta.url),'utf8'));await db.exec(install);assert.equal((await read()).documents[0].summary.projectData.totalQuantity,16);
await db.exec(baseline.replace('DECLARE docs jsonb;','DECLARE docs jsonb; -- unknown revision'));await assert.rejects(db.exec(install),/READER_CHANGED/);await db.exec('ROLLBACK');
await db.close();console.log('PASS: both legitimate users see complete verified document references; null/invalid session, scope and unrelated document denied; inline bypass ignored; sidecar integrity enforced; old summaries, ACL and operational hashes unchanged. Synthetic actor/scope fixtures.');
