// Focused catalog query and ACL checks only. All users/data and the database are isolated.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createOptSharedCatalog} from '../../../src/services/opt-shared-catalog.js';
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const db=new PGlite();let checks=0;const ok=(actual,expected)=>{assert.deepEqual(actual,expected);checks++;};
const id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`,scope={linea:'PANELES_2',anio:2026,semana:45,modo:'BASE'};
await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
 CREATE TABLE public.sgp_producciones(key_produccion text PRIMARY KEY,id_linea text,reserva_al text,sistema text,anio integer,semana_base integer,semana_actual integer,activa text,excluida_export boolean);
 CREATE TABLE public.sgp_mecanizado_programacion(id_programacion uuid PRIMARY KEY,reserva text,estado text);
 CREATE TABLE public.sgp_mecanizado_programacion_detalle(id_programacion uuid,key_produccion text,reserva_snapshot text,cantidad_snapshot numeric);
 CREATE VIEW public.sgp_produccion_reservas_v AS SELECT sp.key_produccion,trim(r) reserva,split_part(sp.reserva_al,',',1) reserva_principal FROM public.sgp_producciones sp CROSS JOIN LATERAL unnest(string_to_array(sp.reserva_al,',')) r WHERE sp.activa='SI';
 CREATE FUNCTION public.sgp_pdt_validar_rol_real(token text,roles text[]) RETURNS text LANGUAGE plpgsql AS $$ BEGIN IF token NOT IN ('alice','bob') OR NOT 'CONSULTA'=ANY(roles) THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF; RETURN token; END $$;
 CREATE FUNCTION public.sgp_mis_accesos(token text) RETURNS TABLE(ventana text) LANGUAGE sql AS $$SELECT 'mecanizado'::text$$;`);
await db.exec(readFileSync(new URL('./install_REVIEW.sql',import.meta.url),'utf8'));
await db.exec(readFileSync(new URL('./catalog_REVIEW.sql',import.meta.url),'utf8'));
const read=(token='alice',s=scope)=>db.query('SELECT public.sgp_opt_catalogo_v2($1,$2) result',[token,s]).then(r=>r.rows[0].result);
await assert.rejects(read(),/OPT_NO_HABILITADO/);checks++;
await db.exec("UPDATE sgp_opt_shared.config SET enabled=true,access_window='mecanizado',read_roles=ARRAY['CONSULTA']");
// The read-only catalog works while write roles remain empty.
ok((await db.query('SELECT write_roles FROM sgp_opt_shared.config')).rows[0].write_roles,[]);
ok((await read()).totales,{grupos:0,documentos:0,piezas:0});
await db.query(`INSERT INTO sgp_opt_shared.approvals(id_aprobacion,sha256,manifest_sha256,fuentes,evidencia) VALUES($1,$2,$3,'[{"origen":"RETAIL","source_key":"SOURCE-1","consecutivo":"OPT-1","modo_carga":"INDICE"}]','{"sgp_binding":"synthetic-catalog-only"}')`,[id(100),'a'.repeat(64),'b'.repeat(64)]);
await db.query('INSERT INTO sgp_opt_shared.documents(id_documento,sha256,manifest_sha256,id_aprobacion) VALUES($1,$2,$3,$4)',[id(101),'a'.repeat(64),'b'.repeat(64),id(100)]);
await db.query("INSERT INTO sgp_opt_shared.sources(origen,source_key,consecutivo,modo_carga,id_documento,id_aprobacion) VALUES('RETAIL','SOURCE-1','OPT-1','INDICE',$1,$2)",[id(101),id(100)]);
const variants=[['K1','PANELES_2',2026,45,46,'SI',false,'R','PANEL'],['K2','PANELES_2',2026,45,45,'SI',false,'R2','PANEL'],['K3','PANELES_2',2026,46,46,'SI',false,'LATER','PANEL'],['K4','PANELES_2',2027,45,45,'SI',false,'YEAR','PANEL'],['K5','FRAMES_2',2026,45,45,'SI',false,'LINE','PANEL'],['K6','PANELES_2',2026,45,45,'NO',false,'INACTIVE','PANEL'],['K7','PANELES_2',2026,45,45,'SI',true,'EXCLUDED','PANEL'],['K8','PANELES_2',2026,45,45,'SI',false,'R','SYSTEM-B']];
for(let i=0;i<variants.length;i++){
 const [key,line,year,week,current,active,excluded,reservation,system]=variants[i];
 await db.query('INSERT INTO public.sgp_producciones VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[key,line,reservation,system,year,week,current,active,excluded]);
 await db.query("INSERT INTO sgp_opt_shared.pieces(id_pieza,id_documento,referencia,pagina,patron,barra,corte,longitud_mm) VALUES($1,$2,'REF',1,1,1,$3,500)",[id(i+1),id(101),i+1]);
 await db.query('INSERT INTO sgp_opt_shared.assignments VALUES($1,$2,$3,$4,$5,$6)',[id(i+1),reservation,system,key,id(500+i),id(100)]);
}

await db.exec(`CREATE TABLE sgp_opt_shared.document_plans(id_documento uuid,sha256 text,id_aprobacion uuid,manifest_sha256 text,evidence_sha256 text,geometry jsonb);`);
await db.exec(readFileSync(new URL('./document_read_REVIEW.sql',import.meta.url),'utf8'));
const refs=async(token='alice',s=scope,res='R',system='PANEL')=>(await db.query('SELECT public.sgp_opt_referencias_documentales_v1($1,$2,$3,$4) result',[token,s,res,system])).rows[0].result;
const plans=async(reference='REF',doc=id(101),token='alice',s=scope)=>(await db.query('SELECT public.sgp_opt_esquema_documental_v2($1,$2,$3,$4,$5,$6) result',[token,s,'R','PANEL',doc,reference])).rows[0].result;
ok((await refs()).references[0].piezas_documento,8); // includes other lines/weeks/reserves only in the authorized document
ok((await refs()).references[0].sistema,null); // conflicting systems cannot invent a matrix match
ok((await refs('alice',scope,'OTHER')).references,[]);
await assert.rejects(refs('bad'),/UNAUTHORIZED/);checks++;
await assert.rejects(refs('alice',{...scope,linea:'FRAMES_2'}),/SCOPE/);checks++;
await assert.rejects(plans('REF',id(999)),/SCOPE_DENIED/);checks++;
await assert.rejects(plans('MISSING'),/SCOPE_DENIED/);checks++;
ok((await plans()).status,'NOT_PERSISTED');
// A distinct reference with no assignment is visible but has no registration identity.
await db.query("INSERT INTO sgp_opt_shared.pieces(id_pieza,id_documento,referencia,pagina,patron,barra,corte,longitud_mm) VALUES($1,$2,'UNASSIGNED',2,2,1,1,500)",[id(90),id(101)]);
const geometry={plans:[{id:'qa',ref:'REF',finish:'QA',length:'100',page:1,barqty:1,bars:[{cuts:[1,2,5,8].map(n=>({id_pieza:id(n),length:'10',profileInstance:1,project:'PRIVATE-'+n,corte:n,longitud_mm:254}))}]},{id:'qa2',ref:'UNASSIGNED',finish:'QA',length:'100',page:2,barqty:1,bars:[{cuts:[{id_pieza:id(90),length:'10',profileInstance:1,project:'PRIVATE'}]}]}]};
await db.query("INSERT INTO sgp_opt_shared.document_plans SELECT d.id_documento,d.sha256,d.id_aprobacion,d.manifest_sha256,encode(sha256(convert_to(a.evidencia::text,'UTF8')),'hex'),$1 FROM sgp_opt_shared.documents d JOIN sgp_opt_shared.approvals a USING(id_aprobacion)",[geometry]);
ok((await refs()).references.length,2);ok((await refs()).references[1].sistema,null);
// v452: authoritative library metadata can resolve an unassigned documentary reference.
await db.exec(`CREATE SCHEMA sgp_opt_matrices; CREATE TABLE sgp_opt_matrices.entries(sistema text,referencia text,status text);
GRANT EXECUTE ON FUNCTION public.sgp_opt_referencias_documentales_v1(text,jsonb,text,text) TO anon;`);
const aclBefore=(await db.query("SELECT proacl::text acl FROM pg_proc WHERE oid='public.sgp_opt_referencias_documentales_v1(text,jsonb,text,text)'::regprocedure")).rows[0].acl;
await db.exec(readFileSync(new URL('./document_matrix_link_REVIEW.sql',import.meta.url),'utf8'));
ok((await db.query("SELECT proacl::text acl FROM pg_proc WHERE oid='public.sgp_opt_referencias_documentales_v1(text,jsonb,text,text)'::regprocedure")).rows[0].acl,aclBefore);
const unassigned=async()=>(await refs()).references.find(r=>r.referencia==='UNASSIGNED');
ok((await unassigned()).sistema,null);
await db.exec("INSERT INTO sgp_opt_matrices.entries VALUES('FRAME-QA','UNASSIGNED','APPROVED')");
ok((await unassigned()).sistema,'FRAME-QA');ok((await unassigned()).piezas_documento,1);
await db.exec("INSERT INTO sgp_opt_matrices.entries VALUES('OTHER','UNASSIGNED','PENDING')");
ok((await unassigned()).sistema,null);
await db.exec("UPDATE sgp_opt_matrices.entries SET status='RETIRED' WHERE sistema='OTHER'");
ok((await unassigned()).sistema,'FRAME-QA');
await db.exec("UPDATE sgp_opt_matrices.entries SET status='PENDING' WHERE sistema='FRAME-QA'");
ok((await unassigned()).sistema,null);
await db.exec("UPDATE sgp_opt_matrices.entries SET status='APPROVED' WHERE sistema='FRAME-QA'; INSERT INTO sgp_opt_matrices.entries VALUES('FRAME-QA','UNASSIGNED','APPROVED'),('FRAME-QA','REF','APPROVED')");
ok((await unassigned()).sistema,null); // even same-system conflicting versions block
ok((await refs()).references.find(r=>r.referencia==='REF').sistema,null); // conflicting assignments never overridden
await db.exec("REVOKE EXECUTE ON FUNCTION public.sgp_opt_referencias_documentales_v1(text,jsonb,text,text) FROM anon");
const readPlan=await plans();ok(readPlan.plans[0].cuts.map(c=>c.id_pieza),[id(1),null,null,null]);
ok(readPlan.plans[0].cuts.slice(1).every(c=>c.project===''&&!c.selectedReservation),true);
ok((await plans('UNASSIGNED')).plans[0].cuts[0].id_pieza,null);
// Real binding exists for assigned units: rejection below must still enforce scope.
for(let i=0;i<variants.length;i++){
 const [key,,,,,,,reservation]=variants[i];
 await db.query("INSERT INTO public.sgp_mecanizado_programacion VALUES($1,$2,'SIN INICIAR')",[id(500+i),reservation]);
 await db.query('INSERT INTO public.sgp_mecanizado_programacion_detalle VALUES($1,$2,$3,5)',[id(500+i),key,reservation]);
}
ok((await db.query('SELECT sgp_opt_shared.bound($1) result',[id(5)])).rows[0].result,true);
// Actual unchanged writer and actual scope/binding functions reject documentary-only pieces.
await db.exec("UPDATE sgp_opt_shared.config SET write_roles=ARRAY['LIDER MECANIZADO']; CREATE OR REPLACE FUNCTION public.sgp_pdt_validar_rol_real(token text,roles text[]) RETURNS text LANGUAGE plpgsql AS $$ BEGIN IF token='writer' AND 'LIDER MECANIZADO'=ANY(roles) OR token='alice' AND 'CONSULTA'=ANY(roles) THEN RETURN token; END IF; RAISE EXCEPTION 'UNAUTHORIZED'; END $$;");
for(const [n,res] of [[5,'LINE'],[3,'LATER'],[4,'YEAR'],[6,'INACTIVE'],[7,'EXCLUDED'],[90,'R']]){
 await assert.rejects(db.query('SELECT public.sgp_opt_cortes_registrar_v2($1,$2,$3,$4,$5)',['writer',res,[id(n)],id(900+n),scope]),/OPT_UNIDAD_FUERA_AMBITO|OPT_PIEZA_RESERVA_NO_VALIDADA/);checks++;
}
await assert.rejects(db.query('SELECT public.sgp_opt_cortes_registrar_v2($1,$2,$3,$4,$5)',['alice','R',[id(1)],id(990),scope]),/UNAUTHORIZED/);checks++;
for(const role of ['anon','authenticated','service_role'])for(const signature of ['public.sgp_opt_referencias_documentales_v1(text,jsonb,text,text)','public.sgp_opt_esquema_documental_v2(text,jsonb,text,text,uuid,text)'])ok((await db.query("SELECT has_function_privilege($1,$2,'EXECUTE') allowed",[role,signature])).rows[0].allowed,false);
ok((await db.query('SELECT count(*) n FROM sgp_opt_shared.events')).rows[0].n,0);
ok((await db.query('SELECT count(*) n FROM sgp_opt_shared.cuts')).rows[0].n,0);
await db.close();console.log(`PASS: ${checks} isolated documentary SQL checks: full document, masked foreign identities, unchanged writer rejects other line/week/year/inactive/excluded/unassigned and read-only user; ACL closed; zero writes.`);
