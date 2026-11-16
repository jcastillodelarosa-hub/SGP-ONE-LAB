// Dedicated local PostgreSQL only, synthetic PDF/index/users. No hosted connections.
// Real PDF parser + manifest validator + in-memory PostgreSQL. No product data/network.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import * as pdfjs from 'pdfjs-dist/build/pdf.mjs';
import {DOMParser} from '@xmldom/xmldom';
import {createOptDocumentPlans} from '../../src/services/opt-document-plans.js';
import {retailDocumentPlans} from '../../src/server/opt-retail-geometry-contract.js';
import {createOptImportHandler} from '../../src/server/opt-import-handler.js';
import {createOptPdfReader} from '../../src/server/opt-pdf-reader.js';
import {body as fixtureBody,program,scope,fullPdf,base64,pages} from './import-fixtures.mjs';
const {default:pg}=await import(process.env.PG_MODULE||'pg');const {Client}=pg;
const config={host:'127.0.0.1',port:55439,user:'postgres',database:'postgres'};
const admin=new Client(config);await admin.connect();await admin.query("DO $$BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon;END IF;IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated;END IF;IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role;END IF;END$$");config.database='opt_resolution_'+process.pid;await admin.query('CREATE DATABASE '+config.database);const db=new Client(config);await db.connect();db.exec=q=>db.query(q);

// Numeric synthetic reservation satisfies the private PROYECTO selector contract.
const body=()=>{const b=fixtureBody();b.index.base64=base64(new TextEncoder().encode(atob(b.index.base64).replaceAll('SYNTH-R','9000001')));return b;};
await db.exec(`
CREATE TABLE public.sgp_maestro_piezas(codigo_sap text PRIMARY KEY,tipo_pieza text,destino_productivo text,activo text);
INSERT INTO public.sgp_maestro_piezas VALUES('R1','PANEL','PANEL','SI');
CREATE TABLE public.sgp_producciones(key_produccion text PRIMARY KEY,id text,id_linea text,reserva_al text,sistema text,anio integer,semana_base integer,activa text,excluida_export boolean);
CREATE TABLE public.sgp_mecanizado_programacion(id_programacion uuid PRIMARY KEY,reserva text,estado text);
CREATE TABLE public.sgp_mecanizado_programacion_detalle(id_programacion uuid,key_produccion text,reserva_snapshot text,cantidad_snapshot numeric);
CREATE VIEW public.sgp_produccion_reservas_v AS SELECT key_produccion,trim(r) reserva,split_part(reserva_al,',',1) reserva_principal FROM public.sgp_producciones CROSS JOIN LATERAL unnest(string_to_array(reserva_al,',')) r;
CREATE TABLE fixture_users(token text,role_name text,active boolean,access text[]);
INSERT INTO fixture_users VALUES('synthetic-token','LIDER MECANIZADO',true,ARRAY['mecanizado.proceso']);
CREATE FUNCTION public.sgp_sesion_actual(p_token text) RETURNS jsonb LANGUAGE sql AS $$SELECT jsonb_build_object('valida',active,'rol',role_name) FROM public.fixture_users WHERE token=p_token$$;
CREATE FUNCTION public.sgp_pdt_validar_rol_real(token text,roles text[]) RETURNS text LANGUAGE plpgsql AS $$BEGIN IF NOT EXISTS(SELECT 1 FROM public.fixture_users u WHERE u.token=$1 AND active AND role_name=ANY(roles)) THEN RAISE EXCEPTION 'OPT_NO_AUTORIZADO'; END IF;RETURN token;END$$;
CREATE FUNCTION public.sgp_mis_accesos(p_token text) RETURNS TABLE(ventana text) LANGUAGE sql AS $$SELECT unnest(access) FROM public.fixture_users WHERE token=p_token AND active$$;
INSERT INTO public.sgp_producciones VALUES('123456|PANELES_2','123456','PANELES_2','9000001','SYNTH-SYS',2026,46,'SI',false);
INSERT INTO public.sgp_mecanizado_programacion VALUES('${program}','9000001','SIN INICIAR');
INSERT INTO public.sgp_mecanizado_programacion_detalle VALUES('${program}','123456|PANELES_2','9000001',1);`);

await db.exec("ALTER TABLE public.sgp_producciones ADD COLUMN produccion text; UPDATE public.sgp_producciones SET id='700000',produccion='123456 - Synthetic'; INSERT INTO public.sgp_producciones SELECT '700000|FRAMES_2',id,'FRAMES_2',reserva_al,sistema,anio,semana_base,activa,excluida_export,produccion FROM public.sgp_producciones;");
for(const file of ['install_REVIEW.sql','import_context_retail_v3_REVIEW.sql','import_channel_retail_v3_REVIEW.sql','rounding_read_warnings_REVIEW.sql'])await db.exec(readFileSync(new URL('../../docs/sql-proposals/opt-shared/'+file,import.meta.url),'utf8'));
await db.exec("UPDATE sgp_opt_shared.config SET enabled=true,access_window='mecanizado',read_roles=ARRAY['LIDER MECANIZADO'],write_roles=ARRAY['LIDER MECANIZADO']");
await db.exec("CREATE TABLE sgp_opt_shared.document_plans(id_documento uuid PRIMARY KEY,sha256 text,id_aprobacion uuid,manifest_sha256 text,evidence_sha256 text,extractor_sha256 text,geometry jsonb);");
await db.exec(readFileSync(new URL('./fixtures/persist-document-plans-receiver.sql',import.meta.url),'utf8'));
await db.exec(readFileSync(new URL('./fixtures/document-plans-reader.sql',import.meta.url),'utf8'));
let writes=0,lastWrite=null,beforeWrite=null,corruptGeometry=false;
const rpc=async(name,a)=>{try{
 if(name==='sgp_sesion_actual')return {data:(await db.query('SELECT public.sgp_sesion_actual($1) AS data',[a.p_token])).rows[0].data};
 if(name==='sgp_mis_accesos')return {data:(await db.query('SELECT * FROM public.sgp_mis_accesos($1)',[a.p_token])).rows};
 if(name==='sgp_opt_import_contexto_retail_v3')return {data:(await db.query('SELECT public.sgp_opt_import_contexto_retail_v3($1,$2,$3,$4,$5) AS data',[a.p_token,JSON.stringify(a.p_scope),a.p_opt,JSON.stringify(a.p_selectores),a.p_referencias])).rows[0].data};
 if(name==='sgp_opt_importar_retail_resuelto_v1'){writes++;return {data:(await db.query('SELECT public.sgp_opt_importar_retail_resuelto_v1($1,$2,$3,$4,$5,$6,$7::text::bytea,$8,$9,$10) data',[a.p_token,a.p_identity,a.p_request_hash,a.p_decision,a.p_generation,a.p_attempt,a.p_pdf,JSON.stringify(a.p_manifest),JSON.stringify(a.p_sources),JSON.stringify(a.p_evidence)])).rows[0].data};}
 if(name==='sgp_opt_importar_retail_validado_v3'){writes++;lastWrite=structuredClone(a);if(beforeWrite)await beforeWrite();return {data:(await db.query('SELECT public.sgp_opt_importar_retail_validado_v3($1,$2::text::bytea,$3,$4,$5) AS data',[a.p_token,a.p_pdf,JSON.stringify(a.p_manifest),JSON.stringify(a.p_sources),JSON.stringify(a.p_evidence)])).rows[0].data};}
 throw Error('UNEXPECTED_RPC');
}catch(error){return {error:{code:error.code,message:error.message}};}};
const handler=createOptImportHandler({rpc,readPdf:createOptPdfReader(pdfjs),DOMParser,retailV3:true,retailOnly:true,retailResolution:true,serializeRetailPlans:(extraction,manifest)=>{const g=retailDocumentPlans(extraction,manifest,'a'.repeat(64));if(corruptGeometry)g.documentary_plans.plans[0].bars[0].cuts.pop();return g;},allowedOrigins:['https://offline.invalid']});
let fixtureOpt='OPT2099-46-5-TEST-3';
function input(){const b=body(),opt=fixtureOpt;b.source.opt=opt;b.pdf.base64=base64(new TextEncoder().encode(atob(b.pdf.base64).replaceAll('OPT-SYNTH',opt)));b.index.base64=base64(new TextEncoder().encode(`OPT,Reserva,Sistema,Proyecto,Acabado\n${opt},9000001,SYNTH-SYS,123456 - Synthetic,FINISH\n`));return b;}
const ordinaryRun=async()=>{const response=await handler(new Request('https://offline.invalid',{method:'POST',headers:{origin:'https://offline.invalid','content-type':'application/json'},body:JSON.stringify(input())}));return {status:response.status,...await response.json()};};

await db.exec(readFileSync(new URL('../../docs/opt-recovery/installed-resolution-20261114221005.sql',import.meta.url),'utf8'));
const {prepareOptImport}=await import('../../src/services/opt-import.js');
const b=input();b.pdf.name=fixtureOpt+'.pdf';b.index.sheet='ARCHIVOS';
const f=(name,encoded)=>new File([Uint8Array.from(atob(encoded),c=>c.charCodeAt(0))],name);
const prepared=await prepareOptImport({scope:b.scope,source:b.source,pdf:f(b.pdf.name,b.pdf.base64),index:{file:f(b.index.name,b.index.base64),format:b.index.format,sheet:b.index.sheet}});
const identityText=JSON.stringify(prepared.identity),requestHash=prepared.requestHash,evidence='e'.repeat(64);
const certify=()=>db.query('SELECT sgp_opt_shared.certify_import_absence($1,$2,$3,$4) id',['synthetic-token',identityText,requestHash,evidence]);
// In-flight legacy INSERT lock prevents certification; no certificate is inferred from absence.
const other=new Client(config);await other.connect();await other.query('BEGIN; LOCK TABLE sgp_opt_shared.approvals IN ROW EXCLUSIVE MODE');
await assert.rejects(certify(),e=>e.code==='55P03');await other.query('ROLLBACK');
const decision=(await certify()).rows[0].id;assert.equal((await certify()).rows[0].id,decision);
for(const role of ['anon','authenticated','service_role']){
 await db.exec('SET ROLE '+role);
 await assert.rejects(db.query('SELECT * FROM sgp_opt_shared.import_resolution_decisions'),e=>e.code==='42501');
 await assert.rejects(certify(),e=>e.code==='42501');await db.exec('RESET ROLE');
}
await db.exec('BEGIN ISOLATION LEVEL REPEATABLE READ');await assert.rejects(db.query('SELECT sgp_opt_shared.resolution_gate(false)'),/ISOLATION/);await db.exec('ROLLBACK');
await db.exec('SET ROLE anon');
const resolution=(await db.query('SELECT public.sgp_opt_import_resolucion_v1($1,$2,$3) data',['synthetic-token',prepared.identity,requestHash])).rows[0].data;
await assert.rejects(db.query('SELECT public.sgp_opt_import_resolucion_v1($1,$2,$3)',['wrong-token',prepared.identity,requestHash]),/AUTORIZADO/);
await db.exec('RESET ROLE');for(const role of ['anon','authenticated'])assert.equal((await db.query("SELECT has_function_privilege($1,'public.sgp_opt_importar_retail_resuelto_v1(text,jsonb,text,uuid,uuid,uuid,bytea,jsonb,jsonb,jsonb)','EXECUTE') allowed",[role])).rows[0].allowed,false);assert.equal(resolution.status,'ABSENT_FINAL');
// Old handler still reaches original v3, but installed guards reject the fenced original.
const send=async body=>{const response=await handler(new Request('https://offline.invalid',{method:'POST',headers:{origin:'https://offline.invalid','content-type':'application/json'},body:JSON.stringify(body)}));return {status:response.status,...await response.json()};};
const old=await send(b);assert.notEqual(old.status,200);assert.match(JSON.stringify(old),/OPT_/);
assert.equal((await db.query('SELECT count(*)::int n FROM sgp_opt_shared.documents')).rows[0].n,0);
b.resolution={identity:prepared.identity,requestHash,decisionId:decision,retryGeneration:resolution.retryGeneration,attemptId:crypto.randomUUID()};
// Edge rejects tampering before any write RPC.
const before=writes;const tampered=structuredClone(b);tampered.resolution.identity.scope.semana=45;assert.equal((await send(tampered)).status,422);assert.equal(writes,before);
await db.exec('GRANT SELECT ON fixture_users TO service_role');await db.exec('SET ROLE service_role');const first=await send(b);await db.exec('RESET ROLE');assert.equal(first.status,200,JSON.stringify(first));
const duplicate=await send(b);assert.equal(duplicate.status,200,JSON.stringify(duplicate));assert.deepEqual(duplicate.data,first.data);
const changed=structuredClone(b);changed.resolution.attemptId=crypto.randomUUID();assert.notEqual((await send(changed)).status,200);
const counts=(await db.query('SELECT (SELECT count(*)::int FROM sgp_opt_shared.documents) documents,(SELECT count(*)::int FROM sgp_opt_shared.import_resolution_consumption) consumed,(SELECT count(*)::int FROM sgp_opt_shared.import_resolution_permit) permits,(SELECT count(*)::int FROM sgp_opt_shared.cuts) cuts')).rows[0];assert.deepEqual(counts,{documents:1,consumed:1,permits:0,cuts:0});
assert.notEqual((await send(input())).status,200);
console.log(JSON.stringify({engine:(await db.query('SELECT version() v')).rows[0].v,tests:'real PDF → Edge validator → installed SQL → unchanged Retail v3; active legacy lock; ACL; isolation; certification idempotence; old writer fencing; tamper rejection; single consumption; same attempt replay; different attempt denied',counts,hostedWrites:0}));
await other.end();await db.end();await admin.query('DROP DATABASE '+config.database);await admin.end();
