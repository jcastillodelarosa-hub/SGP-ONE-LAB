// Focused authorization delta only. In-memory SQL, no productive users or grants.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const {PGlite}=await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db=new PGlite();
await db.exec(`CREATE SCHEMA sgp_opt_shared;
CREATE TABLE sgp_opt_shared.config(singleton boolean,enabled boolean,access_window text,read_roles text[],write_roles text[]);
INSERT INTO sgp_opt_shared.config VALUES(true,true,'mecanizado',ARRAY['LIDER MECANIZADO'],ARRAY['LIDER MECANIZADO']);
CREATE TABLE public.fixture_users(token text,role_name text,active boolean,access text[]);
CREATE FUNCTION public.sgp_pdt_validar_rol_real(p_token text,p_roles text[]) RETURNS text LANGUAGE plpgsql AS $$
BEGIN IF NOT EXISTS(SELECT 1 FROM public.fixture_users WHERE token=p_token AND active AND role_name=ANY(p_roles)) THEN RAISE EXCEPTION 'AUTH_DENIED'; END IF; RETURN p_token; END $$;
CREATE FUNCTION public.sgp_mis_accesos(p_token text) RETURNS TABLE(ventana text) LANGUAGE sql AS $$SELECT unnest(access) FROM public.fixture_users WHERE token=p_token AND active$$;
INSERT INTO public.fixture_users VALUES
('parent','LIDER MECANIZADO',true,ARRAY['mecanizado']),
('process','LIDER MECANIZADO',true,ARRAY['mecanizado.proceso']),
('production','LIDER MECANIZADO',true,ARRAY['mecanizado.produccion']),
('receiving','LIDER MECANIZADO',true,ARRAY['mecanizado.recepcion']),
('none','LIDER MECANIZADO',true,ARRAY[]::text[]),
('revoked','LIDER MECANIZADO',false,ARRAY['mecanizado.proceso']),
('wrong-role','PATINADOR',true,ARRAY['mecanizado.proceso']);`);
const sql=readFileSync(new URL('../../docs/sql-proposals/opt-shared/install_REVIEW.sql',import.meta.url),'utf8');
const start=sql.indexOf('CREATE FUNCTION sgp_opt_shared.actor(');assert(start>=0);await db.exec(sql.slice(start,sql.indexOf('END $$;',start)+7));
const actor=(token,write=true)=>db.query('SELECT sgp_opt_shared.actor($1,$2) AS actor',[token,write]);
for(const token of ['parent','process','production'])assert.equal((await actor(token)).rows[0].actor,token);
for(const token of ['receiving','none','revoked','wrong-role','unknown'])await assert.rejects(actor(token),/OPT_NO_AUTORIZADO|AUTH_DENIED/);
await db.exec("UPDATE sgp_opt_shared.config SET write_roles='{}'");await assert.rejects(actor('process'),/OPT_NO_AUTORIZADO/);assert.equal((await actor('process',false)).rows[0].actor,'process');
await db.exec('UPDATE sgp_opt_shared.config SET enabled=false');await assert.rejects(actor('parent',false),/OPT_NO_HABILITADO/);
await db.exec("UPDATE sgp_opt_shared.config SET enabled=true,access_window='other'");await assert.rejects(actor('process',false),/OPT_NO_HABILITADO/);
// Apply the exact activation/containment scripts to signature-only RPC stubs.
// This checks ACL/config changes, not the already separately tested RPC behavior.
await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
UPDATE sgp_opt_shared.config SET enabled=false,access_window=NULL,read_roles='{}',write_roles='{}';
INSERT INTO public.fixture_users VALUES
('admin','ADMINISTRADOR',true,ARRAY['mecanizado']),
('coord','COORDINADOR',true,ARRAY['mecanizado.produccion']),
('generic-leader','LIDER',true,ARRAY['mecanizado.proceso']);`);
const signatures=['sgp_opt_cortes_estado_v2(text,text,jsonb)','sgp_opt_cortes_registrar_v2(text,text,uuid[],uuid,jsonb)','sgp_opt_cortes_reporte_v2(text,jsonb,text[])','sgp_opt_catalogo_v2(text,jsonb)','sgp_opt_import_contexto_v1(text,jsonb,text[])','sgp_opt_importar_validado_v1(text,bytea,jsonb,jsonb,jsonb)'];
for(const signature of signatures)await db.exec(`CREATE FUNCTION public.${signature} RETURNS void LANGUAGE sql AS 'SELECT'; REVOKE ALL ON FUNCTION public.${signature} FROM PUBLIC,anon,authenticated,service_role;`);
const execute=async(role,signature)=>(await db.query("SELECT has_function_privilege($1,$2,'EXECUTE') AS allowed",[role,'public.'+signature])).rows[0].allowed;
await db.exec(readFileSync(new URL('../../docs/sql-proposals/opt-shared/activate_REVIEW.sql',import.meta.url),'utf8'));
assert.deepEqual((await db.query('SELECT * FROM sgp_opt_shared.config')).rows,[{singleton:true,enabled:true,access_window:'mecanizado',read_roles:['ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO'],write_roles:['ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO']}]);
for(const token of ['admin','coord','process'])assert.equal((await actor(token)).rows[0].actor,token);
for(const token of ['generic-leader','wrong-role','receiving','revoked','none'])await assert.rejects(actor(token),/OPT_NO_AUTORIZADO|AUTH_DENIED/);
for(const role of ['anon','authenticated'])for(const signature of signatures)assert.equal(await execute(role,signature),signatures.indexOf(signature)<4);
await assert.rejects(db.exec(readFileSync(new URL('../../docs/sql-proposals/opt-shared/activate_REVIEW.sql',import.meta.url),'utf8')),/OPT_ACTIVATION_STATE_CHANGED/);await db.exec('ROLLBACK');
await db.exec(readFileSync(new URL('../../docs/sql-proposals/opt-shared/contain_REVIEW.sql',import.meta.url),'utf8'));
assert.equal((await db.query('SELECT enabled FROM sgp_opt_shared.config')).rows[0].enabled,false);
for(const role of ['anon','authenticated','service_role'])for(const signature of signatures)assert.equal(await execute(role,signature),false);
await db.close();console.log('PASS: exact Mecanizado authorization and approved three-role activation, stale activation rejected, public RPC ACLs limited, containment revokes access without deleting data.');
