// Pure local PostgreSQL (PGlite), synthetic identity-to-role map. No remote URLs.
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const db=new PGlite();
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
await db.exec(`CREATE TABLE public.qa_identity(token text,role text);
INSERT INTO public.qa_identity VALUES ('picker-token','PICKING'),('admin-token','ADMINISTRADOR'),('coordinator-token','COORDINADOR'),('leader-token','LIDER LINEA'),('reception-token','RECEPCION');
CREATE FUNCTION public.sgp_pdt_validar_rol_real(token text,allowed text[]) RETURNS text LANGUAGE plpgsql AS $$ DECLARE r text; BEGIN SELECT role INTO r FROM public.qa_identity WHERE qa_identity.token=$1; IF r IS NULL OR NOT r=ANY(allowed) THEN RAISE EXCEPTION 'QA_ROLE_DENIED'; END IF; RETURN r; END $$;`);
await db.exec(read('./baseline.sql'));
const states=()=>db.query(`select proname,md5(pg_get_functiondef(oid)) hash,prosecdef,proconfig,proacl from pg_proc where proname like 'sgp_pdt_manual_%' order by 1`);
const before=(await states()).rows;
await db.exec(read('../../docs/sql-proposals/pdt/manual-picking/install.sql'));
async function fails(sql,message){try{await db.exec(sql);assert.fail('Expected '+message);}catch(e){assert.match(e.message,new RegExp(message));}}
const writer=(token,origin)=>`select public.sgp_pdt_manual_registrar_v1('${token}','${origin}','{}','[]',null,null)`;
for(const token of ['picker-token','admin-token','coordinator-token'])await fails(writer(token,'PICKING'),'PDT_MANUAL_SOLICITUD_INVALIDA');
for(const origin of ['ENSAMBLE','EMPAQUE']){
 await fails(writer('picker-token',origin),'QA_ROLE_DENIED');
 for(const token of ['admin-token','coordinator-token','leader-token'])await fails(writer(token,origin),'PDT_MANUAL_SOLICITUD_INVALIDA');
}
for(const token of ['leader-token','reception-token','invalid-token','PICKING'])await fails(writer(token,'PICKING'),'QA_ROLE_DENIED');
for(const token of ['picker-token','admin-token','coordinator-token','leader-token'])await fails(`select public.sgp_pdt_manual_nc_consultar_v1('${token}','')`,'PDT_MANUAL_NC_INVALIDA');
for(const fn of ["sgp_pdt_manual_catalogo_v1('TOKEN')","sgp_pdt_manual_fuentes_v1('TOKEN','K','R')","sgp_pdt_manual_nc_consultar_v1('TOKEN','NC')"]){
 for(const token of ['reception-token','invalid-token','PICKING'])await fails('select public.'+fn.replace('TOKEN',token),'QA_ROLE_DENIED');
 // Missing downstream fixtures prove accepted identity passed the actual auth guard.
 for(const token of ['picker-token','admin-token','coordinator-token','leader-token'])await fails('select public.'+fn.replace('TOKEN',token),'does not exist');
}
await fails(read('../../docs/sql-proposals/pdt/manual-picking/install.sql'),'PICKING_MANUAL_DEFINITION_DRIFT');await db.exec('ROLLBACK');
await db.exec(read('../../docs/sql-proposals/pdt/manual-picking/rollback.sql'));
assert.deepEqual((await states()).rows,before);
await fails(writer('picker-token','PICKING'),'QA_ROLE_DENIED');
await db.close();console.log('PASS actual function auth matrix, spoofed/invalid tokens, scope, unchanged ACL/security, drift guard and exact rollback');
