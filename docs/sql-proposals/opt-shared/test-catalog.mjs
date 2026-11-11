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
const before=(await db.query('SELECT count(*) n FROM sgp_opt_shared.events')).rows[0].n;
const alice=await read(),bob=await read('bob');ok(alice,bob);ok(alice.totales,{grupos:3,documentos:1,piezas:3});ok(alice.grupos.map(g=>[g.reserva,g.sistema]),[['R','PANEL'],['R','SYSTEM-B'],['R2','PANEL']]);
ok((await read('alice',{...scope,semana:46})).grupos.map(g=>g.reserva),['LATER']);ok((await read('alice',{...scope,anio:2027})).grupos.map(g=>g.reserva),['YEAR']);
const adapter=createOptSharedCatalog({rpc:async(name,args)=>({data:await read(args.p_token,args.p_scope)})},()=> 'bob');const snapshot=await adapter.load(scope);ok(snapshot.groups.length,3);ok(snapshot.groups.every(g=>adapter.ownsGroup(g)&&!g.canRegister),true);
// Current bound() is false here (no live programming rows): catalog discovery never grants registration.
const state=(await db.query("SELECT public.sgp_opt_cortes_estado_v2('bob','R',$1) result",[scope])).rows[0].result;ok(state.puede_registrar,false);ok(state.referencias.every(r=>r.piezas.every(p=>!p.registrable)),true);
await assert.rejects(read('unauthorized'),/UNAUTHORIZED/);checks++;await assert.rejects(read('alice',{...scope,linea:'FRAMES_2'}),/OPT_SCOPE_INVALIDO/);checks++;
for(const role of ['anon','authenticated','service_role'])ok((await db.query("SELECT has_function_privilege($1,'public.sgp_opt_catalogo_v2(text,jsonb)','EXECUTE') allowed",[role])).rows[0].allowed,false);
ok((await db.query('SELECT count(*) n FROM sgp_opt_shared.events')).rows[0].n,before);ok((await db.query('SELECT count(*) n FROM sgp_opt_shared.cuts')).rows[0].n,0);
await db.close();console.log(`PASS: ${checks} focused isolated catalog SQL/adapter checks. Original BASE scope, roles, exact identities and no grants/writes. No production connection.`);
