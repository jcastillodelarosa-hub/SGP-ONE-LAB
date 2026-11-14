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
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const db=new PGlite();
// Numeric synthetic reservation satisfies the private PROYECTO selector contract.
const body=()=>{const b=fixtureBody();b.index.base64=base64(new TextEncoder().encode(atob(b.index.base64).replaceAll('SYNTH-R','9000001')));return b;};
await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
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
 if(name==='sgp_opt_importar_retail_validado_v3'){writes++;lastWrite=structuredClone(a);if(beforeWrite)await beforeWrite();return {data:(await db.query('SELECT public.sgp_opt_importar_retail_validado_v3($1,$2::text::bytea,$3,$4,$5) AS data',[a.p_token,a.p_pdf,JSON.stringify(a.p_manifest),JSON.stringify(a.p_sources),JSON.stringify(a.p_evidence)])).rows[0].data};}
 throw Error('UNEXPECTED_RPC');
}catch(error){return {error:{code:error.code,message:error.message}};}};
const handler=createOptImportHandler({rpc,readPdf:createOptPdfReader(pdfjs),DOMParser,retailV3:true,retailOnly:true,serializeRetailPlans:(extraction,manifest)=>{const g=retailDocumentPlans(extraction,manifest,'a'.repeat(64));if(corruptGeometry)g.documentary_plans.plans[0].bars[0].cuts.pop();return g;},allowedOrigins:['https://offline.invalid']});
let fixtureOpt='OPT2099-46-5-TEST-3';
function input(){const b=body(),opt=fixtureOpt;b.source.opt=opt;b.pdf.base64=base64(new TextEncoder().encode(atob(b.pdf.base64).replaceAll('OPT-SYNTH',opt)));b.index.base64=base64(new TextEncoder().encode(`OPT,Reserva,Sistema,Proyecto,Acabado\n${opt},9000001,SYNTH-SYS,123456 - Synthetic,FINISH\n`));return b;}
const run=async()=>{const response=await handler(new Request('https://offline.invalid',{method:'POST',headers:{origin:'https://offline.invalid','content-type':'application/json'},body:JSON.stringify(input())}));return {status:response.status,...await response.json()};};
const first=await run();assert.equal(first.status,200,JSON.stringify(first));assert.equal(first.data.cantidad_piezas,4);assert.equal(first.data.sin_asignacion,0);
// A compatible printed discrepancy is preserved in the private approval and manifest.
if(process.env.OPT_RETAIL_SYNTHETIC_REQUEST_PATH)writeFileSync(process.env.OPT_RETAIL_SYNTHETIC_REQUEST_PATH,JSON.stringify(lastWrite));
const exactManifest=structuredClone(lastWrite.p_manifest);
const originalOpt=fixtureOpt;fixtureOpt='OPT2099-46-5-TEST-5';
const rounded=input(),source=pages();source[1].items.find(i=>i.str.startsWith('Longitud de los cortes:')).str=source[1].items.find(i=>i.str.startsWith('Longitud de los cortes:')).str.replace('40 1/8','40 3/32');
for(const page of source)for(const item of page.items)item.str=item.str.replaceAll('OPT-SYNTH',fixtureOpt);
rounded.pdf.base64=base64(fullPdf(source));
const roundedResponse=await handler(new Request('https://offline.invalid',{method:'POST',headers:{origin:'https://offline.invalid','content-type':'application/json'},body:JSON.stringify(rounded)}));
assert.equal(roundedResponse.status,200);const roundedResult=await roundedResponse.json();
assert.equal(roundedResult.validationWarnings[0].code,'OPT_PRINTED_ROUNDING_COMPATIBLE');
assert.deepEqual(lastWrite.p_manifest,exactManifest);
const saved=(await db.query('SELECT a.evidencia FROM sgp_opt_shared.approvals a JOIN sgp_opt_shared.documents d USING(id_aprobacion) WHERE d.id_documento=$1',[roundedResult.data.id_documento])).rows[0].evidencia;
assert.equal(saved.validation_warnings[0].code,'OPT_PRINTED_ROUNDING_COMPATIBLE');assert.equal(saved.rounding_policy.originalPrecisionVerified,false);
assert.equal((await db.query('SELECT sgp_opt_shared.document_validation_warnings($1) AS warnings',[roundedResult.data.id_documento])).rows[0].warnings[0].code,'OPT_PRINTED_ROUNDING_COMPATIBLE');
fixtureOpt=originalOpt;await run();
const persistedPlans=(await db.query('SELECT geometry FROM sgp_opt_shared.document_plans WHERE id_documento=$1',[first.data.id_documento])).rows[0].geometry;
assert.equal(persistedPlans.plans[0].bars.length,2);assert.equal(persistedPlans.plans[0].bars.flatMap(b=>b.cuts).length,4);assert(persistedPlans.plans[0].bars.flatMap(b=>b.cuts).every(c=>c.id_pieza&&c.longitud_mm===254.79375));
async function readScheme(receipt,ref){
 const source={id_documento:receipt.data.id_documento,sha256:receipt.document.sha256,referencia:ref,sistema:'SYNTH-SYS'},reference={...source,documentReference:source};
 const api=createOptDocumentPlans({rpc:async(name,a)=>({data:(await db.query('SELECT public.sgp_opt_esquema_documental_v2($1,$2,$3,$4,$5,$6) AS data',[a.p_token,JSON.stringify(a.p_scope),a.p_reserva,a.p_sistema,a.p_id_documento,a.p_referencia])).rows[0].data})},()=> 'synthetic-token',{documentApi:{ownsReference:()=>true}});
 return api.load({scope,reservation:'9000001',system:'SYNTH-SYS'},reference);
}
const visible=await readScheme(first,'R1');assert.equal(visible.status,'AVAILABLE');assert.equal(visible.plans[0].cuts.length,4);assert(visible.plans[0].cuts.every(c=>c.id_pieza&&c.selectedReservation&&c.length==='10 1/32"'));
const forged=structuredClone(lastWrite);for(const piece of forged.p_manifest)piece.asignacion.key_produccion='700000|FRAMES_2';assert.match((await rpc('sgp_opt_importar_retail_validado_v3',forged)).error.message,/OPT_RETAIL_ASIGNACION_FUERA_AMBITO/);
const repeat=await run();assert.equal(repeat.data.duplicado,true);assert.equal(first.data.id_documento,repeat.data.id_documento);
const geometryReplay=structuredClone(lastWrite);geometryReplay.p_evidence.documentary_plans.plans[0].rest='DIFFERENT';
const approvalsBeforeReplay=(await db.query('SELECT count(*)::int n FROM sgp_opt_shared.approvals')).rows[0].n;
assert.match((await rpc('sgp_opt_importar_retail_validado_v3',geometryReplay)).error.message,/OPT_PLANS_REPLAY_MISMATCH/);
assert.equal((await db.query('SELECT count(*)::int n FROM sgp_opt_shared.approvals')).rows[0].n,approvalsBeforeReplay);
const count=async()=> (await db.query('SELECT count(*)::int n FROM sgp_opt_shared.approvals')).rows[0].n;
for(const sql of ["UPDATE public.sgp_producciones SET activa='NO' WHERE id_linea='PANELES_2'","UPDATE public.sgp_maestro_piezas SET destino_productivo='FRAME'","UPDATE public.sgp_producciones SET produccion='123456 - Other'","UPDATE public.sgp_mecanizado_programacion SET estado='CANCELADA'"]){
 const n=await count();beforeWrite=()=>db.exec(sql);const out=await run();assert.equal(out.code,'OPT_CONTEXTO_CAMBIO_REINTENTAR',JSON.stringify(out));assert.equal(await count(),n);
 beforeWrite=null;await db.exec("UPDATE public.sgp_producciones SET activa='SI',produccion='123456 - Synthetic'; UPDATE public.sgp_maestro_piezas SET destino_productivo='PANEL'; UPDATE public.sgp_mecanizado_programacion SET estado='SIN INICIAR'");
}
// New competing destination committed before final observation invalidates revision.
const n=await count();beforeWrite=()=>db.exec("INSERT INTO public.sgp_producciones SELECT 'competing',id,id_linea,reserva_al,sistema,anio,semana_base,activa,excluida_export,produccion FROM public.sgp_producciones WHERE id_linea='PANELES_2'");
assert.equal((await run()).code,'OPT_CONTEXTO_CAMBIO_REINTENTAR');assert.equal(await count(),n);beforeWrite=null;
await db.exec("DELETE FROM public.sgp_producciones WHERE key_produccion='competing'");
beforeWrite=()=>db.exec('UPDATE fixture_users SET active=false');assert.equal((await run()).code,'OPT_NO_AUTORIZADO');beforeWrite=null;await db.exec('UPDATE fixture_users SET active=true');
for(const role of ['anon','authenticated']){await db.exec('SET ROLE '+role);assert((await rpc('sgp_opt_importar_retail_validado_v3',lastWrite)).error);assert((await rpc('sgp_opt_import_contexto_retail_v3',{p_token:'synthetic-token',p_scope:scope,p_opt:input().source.opt,p_selectores:lastWrite.p_evidence.sgp_binding.selectores,p_referencias:['R1']})).error);await db.exec('RESET ROLE');}
// Another original week is retained documentarily, but cannot register in selected week.
fixtureOpt='OPT2099-46-5-TEST-6';await db.exec("UPDATE public.sgp_producciones SET semana_base=47");
const otherWeek=await run();assert.equal(otherWeek.status,200,JSON.stringify(otherWeek));
const otherIds=(await db.query('SELECT id_pieza FROM sgp_opt_shared.pieces WHERE id_documento=$1',[otherWeek.data.id_documento])).rows.map(r=>r.id_pieza);
await assert.rejects(db.query('SELECT sgp_opt_shared.assert_units($1,$2)',[otherIds,JSON.stringify(scope)]),/OPT_UNIDAD_FUERA_AMBITO/);
await db.query('SELECT sgp_opt_shared.assert_units($1,$2)',[otherIds,JSON.stringify({...scope,semana:47})]);
await db.exec("UPDATE public.sgp_producciones SET semana_base=46");fixtureOpt=originalOpt;
// A single original PDF mixes two valid original weeks: preserve both assignments,
// while registration in week46 still rejects the week47 units.
await db.exec("INSERT INTO public.sgp_maestro_piezas VALUES('R2','PANEL','PANEL','SI'); INSERT INTO public.sgp_producciones VALUES('800000|PANELES_2','800000','PANELES_2','9000002','SYNTH-SYS',2026,47,'SI',false,'654321 - Second'); INSERT INTO public.sgp_mecanizado_programacion VALUES('00000000-0000-0000-0000-000000000002','9000002','SIN INICIAR'); INSERT INTO public.sgp_mecanizado_programacion_detalle VALUES('00000000-0000-0000-0000-000000000002','800000|PANELES_2','9000002',1);");
fixtureOpt='OPT2099-46-5-TEST-7';const mixed=input(),mixedPages=[...pages(),...pages()];
for(let n=0;n<mixedPages.length;n++)for(const item of mixedPages[n].items){item.str=item.str.replaceAll('OPT-SYNTH',fixtureOpt);if(n>=3)item.str=item.str.replaceAll('R1','R2').replaceAll('123456 - Synthetic','654321 - Second');}
mixed.pdf.base64=base64(fullPdf(mixedPages));mixed.index.base64=base64(new TextEncoder().encode(`OPT,Reserva,Sistema,Proyecto,Acabado\n${fixtureOpt},9000001,SYNTH-SYS,123456 - Synthetic,FINISH\n${fixtureOpt},9000002,SYNTH-SYS,654321 - Second,FINISH\n`));
const mixedResponse=await handler(new Request('https://offline.invalid',{method:'POST',headers:{origin:'https://offline.invalid','content-type':'application/json'},body:JSON.stringify(mixed)}));const mixedResult=await mixedResponse.json();assert.equal(mixedResponse.status,200,JSON.stringify(mixedResult));assert.equal(mixedResult.data.cantidad_piezas,8);
const foreignScheme=await readScheme(mixedResult,'R2');assert.equal(foreignScheme.status,'AVAILABLE');assert(foreignScheme.plans[0].cuts.every(c=>c.id_pieza===null&&c.selectedReservation===false&&c.project===''));

const week47=(await db.query("SELECT p.id_pieza FROM sgp_opt_shared.pieces p JOIN sgp_opt_shared.assignments a USING(id_pieza) WHERE p.id_documento=$1 AND a.key_produccion='800000|PANELES_2'",[mixedResult.data.id_documento])).rows.map(r=>r.id_pieza);assert.equal(week47.length,4);
await assert.rejects(db.query('SELECT sgp_opt_shared.assert_units($1,$2)',[week47,JSON.stringify(scope)]),/OPT_UNIDAD_FUERA_AMBITO/);
await db.query('SELECT sgp_opt_shared.assert_units($1,$2)',[week47,JSON.stringify({...scope,semana:47})]);fixtureOpt=originalOpt;
fixtureOpt='OPT2099-46-5-TEST-8';const beforeGeometryFailure=await count(),beforeDocFailure=(await db.query('SELECT count(*)::int n FROM sgp_opt_shared.documents')).rows[0].n;corruptGeometry=true;assert.equal((await run()).code,'OPT_PLANS_COVERAGE_MISMATCH');corruptGeometry=false;assert.equal(await count(),beforeGeometryFailure);assert.equal((await db.query('SELECT count(*)::int n FROM sgp_opt_shared.documents')).rows[0].n,beforeDocFailure);fixtureOpt=originalOpt;
// Classification as Frame remains documentary-only, with no cut assignment.
await db.exec("UPDATE public.sgp_maestro_piezas SET tipo_pieza='FRAME',destino_productivo='FRAME'");
assert.equal((await run()).code,'OPT_DOCUMENTO_REQUIERE_RECONCILIACION');
fixtureOpt='OPT2099-46-5-TEST-4';const frames=await run();assert.equal(frames.status,200,JSON.stringify(frames));assert(lastWrite.p_manifest.every(p=>p.asignacion===null));
assert.deepEqual((await db.query('SELECT (SELECT count(*)::int FROM sgp_opt_shared.cuts) cuts,(SELECT count(*)::int FROM sgp_opt_shared.events) events')).rows[0],{cuts:0,events:0});
await db.close();console.log('PASS Retail v3 real parser -> SQL context -> private writer; exact identity, idempotency, stale observations, revoked session, role denial, Frame unassigned, zero cut events. Synthetic local only.');
