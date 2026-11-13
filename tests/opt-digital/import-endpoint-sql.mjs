// Real PDF parser + manifest validator + in-memory PostgreSQL. No product data/network.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as pdfjs from 'pdfjs-dist/build/pdf.mjs';
import {DOMParser} from '@xmldom/xmldom';
import {createOptImportHandler} from '../../src/server/opt-import-handler.js';
import {createOptPdfReader} from '../../src/server/opt-pdf-reader.js';
import {body as fixtureBody,program,scope,fullPdf,base64} from './import-fixtures.mjs';
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
for(const file of ['install_REVIEW.sql','import_context_REVIEW.sql','import_channel_REVIEW.sql','import_context_proyecto_v2_REVIEW.sql','import_channel_proyecto_v2_REVIEW.sql'])await db.exec(readFileSync(new URL('../../docs/sql-proposals/opt-shared/'+file,import.meta.url),'utf8'));
let beforeWrite=null,lastWrite=null,writes=0;
const rpc=async(name,a)=>{
 try{
  if(name==='sgp_mis_accesos')return {data:(await db.query('SELECT * FROM public.sgp_mis_accesos($1)',[a.p_token])).rows};
  let sql,params;
  if(name==='sgp_sesion_actual'){sql='SELECT public.sgp_sesion_actual($1) AS data';params=[a.p_token];}
  else if(name==='sgp_opt_import_contexto_v1'){sql='SELECT public.sgp_opt_import_contexto_v1($1,$2,$3) AS data';params=[a.p_token,JSON.stringify(a.p_scope),a.p_producciones];}
  else if(name==='sgp_opt_import_contexto_proyecto_v2'){sql='SELECT public.sgp_opt_import_contexto_proyecto_v2($1,$2,$3,$4,$5) AS data';params=[a.p_token,JSON.stringify(a.p_scope),a.p_opt,JSON.stringify(a.p_selectores),a.p_referencias];}
  else if(name==='sgp_opt_importar_proyecto_validado_v2'){writes++;lastWrite=structuredClone(a);if(beforeWrite)await beforeWrite();sql='SELECT public.sgp_opt_importar_proyecto_validado_v2($1,$2::text::bytea,$3,$4,$5) AS data';params=[a.p_token,a.p_pdf,JSON.stringify(a.p_manifest),JSON.stringify(a.p_sources),JSON.stringify(a.p_evidence)];}
  else if(name==='sgp_opt_importar_validado_v1'){writes++;lastWrite=structuredClone(a);if(beforeWrite)await beforeWrite();sql='SELECT public.sgp_opt_importar_validado_v1($1,$2::text::bytea,$3,$4,$5) AS data';params=[a.p_token,a.p_pdf,JSON.stringify(a.p_manifest),JSON.stringify(a.p_sources),JSON.stringify(a.p_evidence)];}
  else throw Error('Unexpected RPC');
  return {data:(await db.query(sql,params)).rows[0].data};
 }catch(error){return {error:{code:error.code,message:error.message}};}
};
const handler=createOptImportHandler({rpc,readPdf:createOptPdfReader(pdfjs),DOMParser,allowedOrigins:['https://sgp-one-lab.web.app']});
const run=async(b=body())=>{const res=await handler(new Request('https://example.invalid',{method:'POST',headers:{origin:'https://sgp-one-lab.web.app','content-type':'application/json'},body:JSON.stringify(b)}));return {status:res.status,...await res.json()};};
assert.equal((await run()).code,'OPT_NO_HABILITADO');assert.equal(writes,0);
await db.exec("UPDATE sgp_opt_shared.config SET enabled=true,access_window='mecanizado',read_roles=ARRAY['LIDER MECANIZADO'],write_roles=ARRAY['LIDER MECANIZADO']");
const first=await run();assert.equal(first.status,200,JSON.stringify(first));assert.equal(first.data.cantidad_piezas,4);assert.equal(first.data.duplicado,false);
const again=await run();assert.equal(again.data.id_documento,first.data.id_documento);assert.equal(again.data.duplicado,true);
const anotherWeek=body();anotherWeek.scope.semana=47;assert.equal((await run(anotherWeek)).data.duplicado,true);
const individual=body();individual.source={origin:'DESCONOCIDO',mode:'INDIVIDUAL',opt:'uploaded-name'};delete individual.index;const importedIndividual=await run(individual);assert.equal(importedIndividual.data.id_documento,first.data.id_documento);assert.equal(importedIndividual.data.duplicado,true);
assert.deepEqual((await db.query('SELECT (SELECT count(*)::int FROM sgp_opt_shared.pieces) AS pieces,(SELECT count(*)::int FROM sgp_opt_shared.cuts) AS cuts,(SELECT count(*)::int FROM sgp_opt_shared.events) AS events,(SELECT count(*)::int FROM sgp_opt_shared.sources) AS sources')).rows[0],{pieces:4,cuts:0,events:0,sources:2});
assert.equal((await db.query('SELECT sum(longitud_mm)::text AS length FROM sgp_opt_shared.pieces')).rows[0].length,'1019.17500');
const approvalCount=async()=>(await db.query('SELECT count(*)::int AS n FROM sgp_opt_shared.approvals')).rows[0].n;
const changed=body(),changedBytes=new Uint8Array([...fullPdf(),...new TextEncoder().encode('%changed-original\n')]);changed.pdf.base64=base64(changedBytes);
const beforeChanged=await approvalCount();const rejectedReplacement=await run(changed);assert.equal(rejectedReplacement.code,'OPT_CONSECUTIVO_REQUIERE_RECONCILIACION');assert.equal(await approvalCount(),beforeChanged);
assert.equal((await db.query('SELECT count(*)::int AS n FROM sgp_opt_shared.documents')).rows[0].n,1);
const changedIndividual=structuredClone(changed);changedIndividual.source={origin:'DESCONOCIDO',mode:'INDIVIDUAL',opt:'arbitrary-name'};delete changedIndividual.index;
assert.equal((await run(changedIndividual)).code,'OPT_CONSECUTIVO_REQUIERE_RECONCILIACION');assert.equal(await approvalCount(),beforeChanged);
// Reverse ordering on a fresh synthetic OPT: individual first, then changed index.
const renamed=(opt,origin='RETAIL')=>{const b=body();b.source.opt=opt;b.source.origin=origin;b.pdf.name=opt+'.pdf';b.pdf.base64=base64(new TextEncoder().encode(new TextDecoder().decode(fullPdf()).replaceAll('OPT-SYNTH',opt)));b.index.base64=base64(new TextEncoder().encode(`OPT,Reserva,Sistema\n${opt},9000001,SYNTH-SYS\n`));return b;};
const reverse=renamed('OPT-REVER');const firstIndividual=structuredClone(reverse);firstIndividual.source.mode='INDIVIDUAL';firstIndividual.source.origin='DESCONOCIDO';delete firstIndividual.index;
assert.equal((await run(firstIndividual)).status,200);reverse.pdf.base64=base64(new TextEncoder().encode(atob(reverse.pdf.base64)+'%changed\n'));
assert.equal((await run(reverse)).code,'OPT_CONSECUTIVO_REQUIERE_RECONCILIACION');
// Equal consecutive across two explicit operational origins is not silently merged.
const retail=renamed('OPT2099-46-4-TEST-2'),project=renamed('OPT2099-46-4-TEST-2','PROYECTO');project.pdf.base64=base64(new TextEncoder().encode(atob(project.pdf.base64)+'%project-source\n'));
const retailReceipt=await run(retail),projectReceipt=await run(project);assert.equal(retailReceipt.status,200);assert.equal(projectReceipt.status,200,JSON.stringify(projectReceipt));assert.equal(projectReceipt.data.cantidad_piezas,4);
assert.equal(lastWrite.p_evidence.contract,'OPT-SERVER-VALIDATION-PROYECTO-2');
assert.deepEqual(lastWrite.p_evidence.sgp_binding.referencias,['R1']);
const savedProject=(await db.query('SELECT a.evidencia FROM sgp_opt_shared.documents d JOIN sgp_opt_shared.approvals a USING(id_aprobacion) WHERE d.id_documento=$1',[projectReceipt.data.id_documento])).rows[0].evidencia;
assert.equal(savedProject.rounding_policy.version,'OPT-PRINTED-ROUNDING-1');
assert.deepEqual(savedProject.profile_destinations,[{referencia:'R1',tipo_pieza:'PANEL',destino_productivo:'PANEL',activa:'SI'}]);assert.notEqual(retailReceipt.data.id_documento,projectReceipt.data.id_documento);
const unknown=structuredClone(retail);unknown.source.mode='INDIVIDUAL';unknown.source.origin='DESCONOCIDO';delete unknown.index;
assert.equal((await run(unknown)).code,'OPT_CONSECUTIVO_REQUIERE_RECONCILIACION');


for(const sql of ["UPDATE public.sgp_producciones SET activa='NO'","UPDATE public.sgp_producciones SET excluida_export=true","UPDATE public.sgp_producciones SET semana_base=45","UPDATE public.sgp_mecanizado_programacion SET estado='CANCELADA'","UPDATE public.sgp_mecanizado_programacion_detalle SET cantidad_snapshot=2"]){
 const count=await approvalCount();beforeWrite=()=>db.exec(sql);const out=await run();assert.equal(out.code,'OPT_CONTEXTO_CAMBIO_REINTENTAR',JSON.stringify(out));assert.equal(out.definitive,true);assert.equal(await approvalCount(),count);
 beforeWrite=null;await db.exec("UPDATE public.sgp_producciones SET activa='SI',excluida_export=false,semana_base=46;UPDATE public.sgp_mecanizado_programacion SET estado='SIN INICIAR';UPDATE public.sgp_mecanizado_programacion_detalle SET cantidad_snapshot=1");
}
const beforeInsert=await approvalCount();
beforeWrite=()=>db.exec(`INSERT INTO public.sgp_mecanizado_programacion VALUES('33333333-3333-4333-8333-333333333333','9000001','SIN INICIAR');INSERT INTO public.sgp_mecanizado_programacion_detalle VALUES('33333333-3333-4333-8333-333333333333','123456|PANELES_2','9000001',1)`);
assert.equal((await run()).code,'OPT_CONTEXTO_CAMBIO_REINTENTAR');assert.equal(await approvalCount(),beforeInsert);beforeWrite=null;
await db.exec("DELETE FROM public.sgp_mecanizado_programacion_detalle WHERE id_programacion='33333333-3333-4333-8333-333333333333';DELETE FROM public.sgp_mecanizado_programacion WHERE id_programacion='33333333-3333-4333-8333-333333333333'");
beforeWrite=()=>db.exec("UPDATE fixture_users SET active=false");assert.equal((await run()).code,'OPT_NO_AUTORIZADO');beforeWrite=null;await db.exec('UPDATE fixture_users SET active=true');
// The caller's public role cannot invoke either private channel, even with a valid SGP token.
for(const role of ['anon','authenticated']){
 await db.exec('SET ROLE '+role);assert((await rpc('sgp_opt_import_contexto_v1',{p_token:'synthetic-token',p_scope:scope,p_producciones:['123456']})).error);assert((await rpc('sgp_opt_importar_validado_v1',lastWrite)).error);await db.exec('RESET ROLE');
}
await db.exec('SET ROLE service_role');assert.equal((await rpc('sgp_opt_importar_validado_v1',lastWrite)).data.ok,true);await db.exec('RESET ROLE');
await db.exec(`INSERT INTO public.sgp_mecanizado_programacion VALUES('22222222-2222-4222-8222-222222222222','9000001','SIN INICIAR');INSERT INTO public.sgp_mecanizado_programacion_detalle VALUES('22222222-2222-4222-8222-222222222222','123456|PANELES_2','9000001',1)`);
const prior=writes;const ambiguous=await run(individual);assert(ambiguous.blockers.some(b=>b.code==='SGP_BINDING_AMBIGUOUS'));assert.equal(writes,prior);
await db.close();console.log('PASS: real PDF -> original CSV -> exact manifest -> SQL context -> atomic SQL import. Same PDF idempotent across weeks and individual/index; original assignments unchanged; stale/revoked context rolls back; private roles enforced; zero physical cut events. In-memory PostgreSQL, not live Supabase.');
