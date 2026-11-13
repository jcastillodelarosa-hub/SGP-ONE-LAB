// Isolated PostgreSQL/WASM only. No remote connection, production data or network.
// OPT_PGLITE_MODULE may point to an already installed reputable npm PGlite module.
import {readFileSync,readdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const {PGlite}=await import(process.env.OPT_PGLITE_MODULE || '@electric-sql/pglite');
const db=new PGlite();let assertions=0;
const ok=(v)=>{assert.ok(v);assertions++;};
const eq=(a,b)=>{assert.deepEqual(a,b);assertions++;};
const query=(q,p=[])=>db.query(q,p);
const reject=async(fn,code)=>{await assert.rejects(fn,e=>e.message.includes(code));assertions++;};
await db.exec(`
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA sgp_opt_shared;
CREATE TABLE public.sgp_maestro_piezas(codigo_sap text PRIMARY KEY,tipo_pieza text,destino_productivo text,activo text);
CREATE TABLE public.sgp_producciones(id text,key_produccion text PRIMARY KEY,sistema text,id_linea text,anio int,semana_base int,activa text,excluida_export boolean,reserva_al text);
CREATE TABLE public.fixture_reservas(key_produccion text,reserva text,reserva_principal text);
CREATE VIEW public.sgp_produccion_reservas_v AS SELECT * FROM public.fixture_reservas;
CREATE TABLE public.sgp_mecanizado_programacion(id_programacion uuid PRIMARY KEY,reserva text,estado text);
CREATE TABLE public.sgp_mecanizado_programacion_detalle(key_produccion text,id_programacion uuid,reserva_snapshot text,cantidad_snapshot numeric);
CREATE TABLE sgp_opt_shared.config(singleton bool PRIMARY KEY);
CREATE TABLE sgp_opt_shared.documents(id_documento uuid PRIMARY KEY,sha256 text);
CREATE TABLE sgp_opt_shared.sources(id_documento uuid,consecutivo text,origen text);
CREATE TABLE sgp_opt_shared.approvals(id_aprobacion uuid DEFAULT gen_random_uuid(),sha256 text,manifest_sha256 text,fuentes jsonb,evidencia jsonb,reviewed_by text);
CREATE FUNCTION sgp_opt_shared.actor(t text,w boolean) RETURNS text LANGUAGE plpgsql AS $$ BEGIN IF t<>'fixture-actor' THEN RAISE EXCEPTION 'OPT_NO_AUTORIZADO'; END IF; RETURN 'fixture-only'; END $$;
CREATE FUNCTION sgp_opt_shared.validate_scope(s jsonb) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF s->>'linea'<>'PANELES_2' OR s->>'modo'<>'BASE' THEN RAISE EXCEPTION 'OPT_SCOPE_INVALID'; END IF; END $$;
-- Mock ONLY the downstream base import; actual new channel/context execute verbatim.
CREATE FUNCTION sgp_opt_shared.import_manifest(a uuid,p bytea,m jsonb) RETURNS jsonb LANGUAGE sql AS $$ SELECT jsonb_build_object('fixture_only',true,'pieces',jsonb_array_length(m),'approval',a) $$;
INSERT INTO sgp_opt_shared.config VALUES(true);
INSERT INTO public.sgp_maestro_piezas VALUES('PROFILE-P','PANEL','PANEL','SI'),('PROFILE-F','FRAME','FRAME','SI'),('PROFILE-OFF','PANEL','PANEL','NO');
INSERT INTO public.sgp_producciones VALUES('100','100|PANELES_2','SYSTEM','PANELES_2',2099,46,'SI',false,'9000001'),('100','100|FRAMES_2','SYSTEM','FRAMES_2',2099,46,'SI',false,'9000001');
INSERT INTO public.fixture_reservas VALUES('100|PANELES_2','9000001','9000001'),('100|FRAMES_2','9000001','9000001');
INSERT INTO public.sgp_mecanizado_programacion VALUES('11111111-1111-4111-8111-111111111111','9000001','SIN INICIAR');
INSERT INTO public.sgp_mecanizado_programacion_detalle VALUES('100|PANELES_2','11111111-1111-4111-8111-111111111111','9000001',60);
`);
const sql=n=>readFileSync(new URL(n,import.meta.url),'utf8');
await db.exec(sql('import_context_proyecto_v2_REVIEW.sql'));
await db.exec(sql('import_channel_proyecto_v2_REVIEW.sql'));
const scope={linea:'PANELES_2',anio:2099,semana:46,modo:'BASE'};
const opt='OPT2099-46-4-TEST-1';
const selectors=[{reserva:'9000001',sistema:'SYSTEM'}];
const refs=['PROFILE-P','PROFILE-F','MISSING','PROFILE-OFF'];
const context=async(sel=selectors,rr=refs,oo=opt,token='fixture-actor')=>(await query('select public.sgp_opt_import_contexto_proyecto_v2($1,$2,$3,$4,$5) c',[token,scope,oo,sel,rr])).rows[0].c;
const c=await context();eq(c.contract,'OPT-IMPORT-CONTEXT-PROYECTO-2');eq(c.bindings.length,2);eq(c.profileDestinations.length,3);
eq(c.bindings.find(b=>b.id_linea==='FRAMES_2').id_programacion,null);
eq(c.profileDestinations.find(b=>b.referencia==='PROFILE-OFF').activa,'NO');
eq(c.referencias,['MISSING','PROFILE-F','PROFILE-OFF','PROFILE-P']);
eq((await context([...selectors,...selectors],[...refs].reverse())).revision,c.revision);
await reject(()=>context([],refs),'OPT_SELECTORES_INVALIDOS');
await reject(()=>context([{reserva:'9000001,999',sistema:'SYSTEM'}]),'OPT_SELECTORES_INVALIDOS');
await reject(()=>context(selectors,[]),'OPT_REFERENCIAS_INVALIDAS');
await reject(()=>context(selectors,[' PROFILE-P']),'OPT_REFERENCIAS_INVALIDAS');
await reject(()=>context(selectors,refs,opt,'bad'),'OPT_NO_AUTORIZADO');
const missing=await context([{reserva:'999',sistema:'SYSTEM'}]);eq(missing.bindings.length,0);eq(missing.selectores.length,1);
await query("update public.sgp_maestro_piezas set activo='NO' where codigo_sap='PROFILE-P'");ok((await context()).revision!==c.revision);
await query("update public.sgp_maestro_piezas set activo='SI' where codigo_sap='PROFILE-P'");eq((await context()).revision,c.revision);
const pdf=Buffer.from('%PDF fixture');
const sha=(await query('select encode(sha256($1::bytea),\'hex\') h',[pdf])).rows[0].h;
const evidence={contract:'OPT-SERVER-VALIDATION-PROYECTO-2',algorithm:'opt-import-manifest-project-v2',pdf_sha256:sha,validation:'DOCUMENTARY_MANIFEST_READY',physical_completion_verified:false,sgp_binding:{contract:c.contract,opt,scope,revision:c.revision,selectores:selectors,referencias:refs},original_index:{sha256:'a'.repeat(64),sheet:'Optimizaciones'},documentary_source_groups:[]};
evidence.profile_destinations=[{referencia:'UNTRUSTED_COPY_MUST_BE_IGNORED'}];
evidence.original_document_title=opt+'_Fixture';
evidence.rounding_policy={version:'OPT-PRINTED-ROUNDING-1',model:'INDEPENDENT_NEAREST_1_32_CLOSED_ENVELOPE',originalPrecisionVerified:false,originalsPreserved:true};
evidence.rounding_evidence=[{reference:'PROFILE-P',finish:'WHITE',page:1,printedSummary:{stockLength:'100',cutLength:'90',reusedLength:'5',wasteLength:'5'},diagnostic:{schema:'sgp.opt.rounding-diagnostic.v1',model:'INDEPENDENT_NEAREST_1_32_CLOSED_ENVELOPE',physicalCompletionVerified:false,status:'PRINTED_EQUALITY',intervals:{},printedDelta32:{stock:'0',cuts:'0',balance:'0'},originalPrecisionVerified:false,authorizesImport:false}}];
evidence.validation_warnings=[];
const sources=[{origen:'PROYECTO',source_key:`OPT:${opt}`,consecutivo:opt,modo_carga:'INDICE'}];
const manifest=[{referencia:'PROFILE-P',pagina:1,patron:1,barra:1,corte:1,longitud_mm:100,asignacion:null}];
const imported=async(ev=evidence,src=sources)=>(await query('select public.sgp_opt_importar_proyecto_validado_v2($1,$2,$3,$4,$5) r',['fixture-actor',pdf,manifest,src,ev])).rows[0].r;
const count=async()=>Number((await query('select count(*) n from sgp_opt_shared.approvals')).rows[0].n);
await db.exec('BEGIN');const receipt=await imported();eq(receipt.import_contract,'OPT-IMPORT-1');eq(receipt.contract_version,2);eq(receipt.fixture_only,true);eq(await count(),1);
const stored=(await query('select evidencia e from sgp_opt_shared.approvals')).rows[0].e;eq(stored.documentary_source_groups,[]);eq(stored.original_document_title,evidence.original_document_title);eq(stored.profile_destinations,c.profileDestinations);eq(stored.rounding_policy,evidence.rounding_policy);eq(stored.rounding_evidence,evidence.rounding_evidence);eq(stored.validation_warnings,[]);
await db.exec('ROLLBACK');eq(await count(),0);
await reject(()=>imported({...evidence,original_document_title:1}),'OPT_VALIDACION_SERVIDOR_REQUERIDA');
await reject(()=>imported({...evidence,rounding_policy:{...evidence.rounding_policy,version:'BAD'}}),'OPT_REDONDEO_EVIDENCIA_INVALIDA');
const compat=structuredClone(evidence);compat.rounding_evidence[0].diagnostic.status='ROUNDING_COMPATIBLE';
await reject(()=>imported(compat),'OPT_REDONDEO_ADVERTENCIA_REQUERIDA');
compat.validation_warnings=[{code:'OPT_PRINTED_ROUNDING_COMPATIBLE',message:'Printed rounding only, original precision not verified.'}];
await db.exec('BEGIN');eq((await imported(compat)).ok,true);await db.exec('ROLLBACK');
await reject(()=>imported({...evidence,documentary_source_groups:{}}),'OPT_VALIDACION_SERVIDOR_REQUERIDA');
await reject(()=>imported({...evidence,sgp_binding:{...evidence.sgp_binding,revision:'a'.repeat(32)}}),'OPT_CONTEXTO_CAMBIO_REINTENTAR');eq(await count(),0);
await reject(()=>imported(evidence,[{...sources[0],origen:'RETAIL'}]),'OPT_FUENTE_INVALIDA');
await query("update public.sgp_maestro_piezas set destino_productivo='FRAME' where codigo_sap='PROFILE-P'");
await reject(()=>imported(),'OPT_CONTEXTO_CAMBIO_REINTENTAR');eq(await count(),0);
await query("update public.sgp_maestro_piezas set destino_productivo='PANEL' where codigo_sap='PROFILE-P'");
const acl=(await query("select has_function_privilege('anon','public.sgp_opt_import_contexto_proyecto_v2(text,jsonb,text,jsonb,text[])','EXECUTE') a,has_function_privilege('service_role','public.sgp_opt_import_contexto_proyecto_v2(text,jsonb,text,jsonb,text[])','EXECUTE') s")).rows[0];eq(acl,{a:false,s:true});
// Optional read contracts execute unchanged except sanitized warning projection.
await db.exec(`
ALTER TABLE sgp_opt_shared.documents ADD COLUMN id_aprobacion uuid;
ALTER TABLE sgp_opt_shared.sources ADD COLUMN source_key text, ADD COLUMN modo_carga text;
CREATE TABLE sgp_opt_shared.pieces(id_pieza uuid PRIMARY KEY,id_documento uuid,referencia text,pagina int,patron int,barra int,corte int,longitud_mm numeric);
CREATE TABLE sgp_opt_shared.assignments(id_pieza uuid,reserva text,sistema text,key_produccion text);
CREATE TABLE sgp_opt_shared.events(clave uuid PRIMARY KEY,usuario text,registrado_en timestamptz,periodo jsonb);
CREATE TABLE sgp_opt_shared.cuts(id_pieza uuid,clave uuid);
CREATE FUNCTION sgp_opt_shared.in_scope(k text,s jsonb) RETURNS boolean LANGUAGE sql AS $$ SELECT k='100|PANELES_2' $$;
CREATE FUNCTION sgp_opt_shared.bound(p uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
`);
await db.exec(sql('rounding_read_warnings_REVIEW.sql'));
await db.exec('BEGIN');await imported(compat);
await db.exec(`
INSERT INTO sgp_opt_shared.documents SELECT '22222222-2222-4222-8222-222222222222',sha256,id_aprobacion FROM sgp_opt_shared.approvals LIMIT 1;
INSERT INTO sgp_opt_shared.pieces VALUES('33333333-3333-4333-8333-333333333333','22222222-2222-4222-8222-222222222222','PROFILE-P',1,1,1,1,100);
INSERT INTO sgp_opt_shared.assignments VALUES('33333333-3333-4333-8333-333333333333','9000001','SYSTEM','100|PANELES_2');
`);
const warning=[{code:'OPT_PRINTED_ROUNDING_COMPATIBLE'}];
let catalog=(await query('select public.sgp_opt_catalogo_v2($1,$2) c',['fixture-actor',scope])).rows[0].c;
eq(catalog.grupos[0].referencias[0].validationWarnings,warning);
let state=(await query('select public.sgp_opt_cortes_estado_v2($1,$2,$3) c',['fixture-actor','9000001',scope])).rows[0].c;
eq(state.referencias[0].validationWarnings,warning);ok(!JSON.stringify(state).includes('original_index'));
await db.exec("update sgp_opt_shared.approvals set evidencia='{}'::jsonb");
catalog=(await query('select public.sgp_opt_catalogo_v2($1,$2) c',['fixture-actor',scope])).rows[0].c;
eq(catalog.grupos[0].referencias[0].validationWarnings,[]);
await db.exec('ROLLBACK');
await db.exec(sql('rounding_read_warnings_ROLLBACK_REVIEW.sql'));
if(process.env.OPT_REAL_FIXTURES){
 const dir=process.env.OPT_REAL_FIXTURES;
 const json=n=>JSON.parse(readFileSync(`${dir}/${n}.json`,'utf8'));
 await db.exec('BEGIN');
 await db.exec('TRUNCATE public.sgp_maestro_piezas,public.sgp_producciones,public.fixture_reservas,public.sgp_mecanizado_programacion,public.sgp_mecanizado_programacion_detalle');
 for(const m of json('profiles'))await query('insert into public.sgp_maestro_piezas values($1,$2,$3,$4)',[m.referencia,m.tipo_pieza,m.destino_productivo,m.activa]);
 for(const b of json('bindings')){
  await query('insert into public.sgp_producciones values($1,$2,$3,$4,$5,$6,$7,$8,$9)',[b.documentProduction,b.key_produccion,b.sistema,b.id_linea,b.anio,b.semana_base,b.activa,b.excluida_export,b.reserva_principal]);
  await query('insert into public.fixture_reservas values($1,$2,$3)',[b.key_produccion,b.reserva,b.reserva_principal]);
  if(b.id_programacion){await query('insert into public.sgp_mecanizado_programacion values($1,$2,$3)',[b.id_programacion,b.programacion_reserva,b.estado_programacion]);await query('insert into public.sgp_mecanizado_programacion_detalle values($1,$2,$3,$4)',[b.key_produccion,b.id_programacion,b.reserva_snapshot,Number(b.cantidad_snapshot)]);}
 }
 for(const file of readdirSync(dir).filter(name=>/^import-[A-Za-z0-9_-]+\.json$/.test(name)).sort()){
  const id=file.slice(7,-5);
  const args=json(`import-${id}`),bind=args.p_evidence.sgp_binding;
  const actual=(await query('select public.sgp_opt_import_contexto_proyecto_v2($1,$2,$3,$4,$5) c',['fixture-actor',bind.scope,bind.opt,bind.selectores,bind.referencias])).rows[0].c;
  // Only the mock credential and mock revision are replaced. PDF, pieces,
  // source and original rounding evidence are passed unchanged from handler.
  args.p_evidence.sgp_binding.revision=actual.revision;
  const data=Buffer.from(args.p_pdf.replace(/^\\x/,''),'hex');
  const rr=(await query('select public.sgp_opt_importar_proyecto_validado_v2($1,$2,$3,$4,$5) r',['fixture-actor',data,args.p_manifest,args.p_sources,args.p_evidence])).rows[0].r;
  eq(rr.ok,true);eq(rr.pieces,args.p_manifest.length);
  const ev=(await query('select evidencia e from sgp_opt_shared.approvals where id_aprobacion=$1',[rr.approval])).rows[0].e;
  eq(ev.original_document_title,args.p_evidence.original_document_title);eq(ev.profile_destinations,actual.profileDestinations);eq(ev.rounding_evidence,args.p_evidence.rounding_evidence);eq(ev.validation_warnings,args.p_evidence.validation_warnings);
  console.log(`LOCAL OPT-IN FILE ${id}: ${rr.pieces} documentary units, ${ev.validation_warnings.length} warning(s), private channel PASS (downstream import mocked)`);
 }
 await db.exec('ROLLBACK');
}
await db.exec(sql('import_proyecto_v2_ROLLBACK_REVIEW.sql'));
eq((await query("select count(*) n from pg_proc where proname in ('sgp_opt_import_contexto_proyecto_v2','sgp_opt_importar_proyecto_validado_v2')")).rows[0].n,0);
await db.close();console.log(JSON.stringify({engine:'PGlite local PostgreSQL/WASM',assertions,status:'PASS',production:false,limitations:['base actor/scope/import mocked','single session: no intersession lock contention test']},null,2));
