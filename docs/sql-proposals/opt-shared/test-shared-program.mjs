import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const base=new URL('./',import.meta.url),id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const query=readFileSync(new URL('shared_program_candidates.sql',base),'utf8').trim().replace(/;$/,'');
const apply=readFileSync(new URL('shared_program_reconcile.sql',base),'utf8');
const db=new PGlite();
await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
CREATE TABLE public.sgp_producciones(key_produccion text PRIMARY KEY,id_linea text,reserva_al text,sistema text,anio integer,semana_base integer,activa text,excluida_export boolean);
CREATE TABLE public.sgp_mecanizado_programacion(id_programacion uuid PRIMARY KEY,reserva text,estado text);
CREATE TABLE public.sgp_mecanizado_programacion_detalle(id_programacion uuid,key_produccion text,reserva_snapshot text,cantidad_snapshot numeric);
CREATE TABLE public.sgp_maestro_piezas(codigo_sap text PRIMARY KEY,tipo_pieza text,destino_productivo text,activo text);
CREATE VIEW public.sgp_produccion_reservas_v AS SELECT sp.key_produccion,trim(r) reserva,split_part(sp.reserva_al,',',1) reserva_principal FROM public.sgp_producciones sp CROSS JOIN LATERAL unnest(string_to_array(sp.reserva_al,',')) r WHERE sp.activa='SI';`);
const schema=readFileSync(new URL('install_REVIEW.sql',base),'utf8').split('CREATE FUNCTION sgp_opt_shared.validate_scope')[0];await db.exec(schema+'COMMIT;');
await db.query(`INSERT INTO sgp_opt_shared.approvals(id_aprobacion,sha256,manifest_sha256,fuentes,evidencia) VALUES($1,$2,$3,'[{"origen":"PROYECTO"}]',$4)`,[id(1),'a'.repeat(64),'b'.repeat(64),JSON.stringify({sgp_binding:{selectores:[{reserva:'RES',sistema:'SYS'}]},profile_destinations:[{referencia:'FRAME',destino_productivo:'FRAME',tipo_pieza:'FRAME',activa:'SI'}]})]);
await db.query('INSERT INTO sgp_opt_shared.documents VALUES($1,$2,$3,$4)',[id(2),'a'.repeat(64),'b'.repeat(64),id(1)]);
await db.query(`INSERT INTO sgp_opt_shared.pieces VALUES($1,$3,'PANEL',1,1,1,1,500),($2,$3,'FRAME',1,1,1,2,600)`,[id(3),id(4),id(2)]);
await db.exec(`INSERT INTO public.sgp_producciones VALUES('KEY','PANELES_2','RES','SYS',2026,46,'SI',false);INSERT INTO public.sgp_maestro_piezas VALUES('FRAME','FRAME','FRAME','SI')`);
await db.query(`INSERT INTO public.sgp_mecanizado_programacion VALUES($1,'RES','PROGRAMADA')`,[id(5)]);
await db.query(`INSERT INTO public.sgp_mecanizado_programacion_detalle VALUES($1,'KEY','RES',10)`,[id(5)]);
await db.query(`INSERT INTO sgp_opt_shared.assignments VALUES($1,'RES','SYS','KEY',$2,$3)`,[id(3),id(5),id(1)]);
assert.equal((await db.query(query)).rows.length,1);
for(const [change,restore] of [
 ["UPDATE sgp_mecanizado_programacion SET estado='CANCELADA'","UPDATE sgp_mecanizado_programacion SET estado='PROGRAMADA'"],
 ["UPDATE sgp_maestro_piezas SET activo='NO'","UPDATE sgp_maestro_piezas SET activo='SI'"],
 ["UPDATE sgp_producciones SET sistema='OTHER'","UPDATE sgp_producciones SET sistema='SYS'"],
 ["UPDATE sgp_producciones SET excluida_export=true","UPDATE sgp_producciones SET excluida_export=false"]]){
 await db.exec(change);assert.equal((await db.query(query)).rows.length,0);await db.exec(restore);
}
await db.exec('BEGIN');
await db.query("INSERT INTO sgp_opt_shared.pieces VALUES($1,$2,'PANEL',1,1,1,3,500)",[id(6),id(2)]);
await db.query("INSERT INTO public.sgp_mecanizado_programacion VALUES($1,'RES','PROGRAMADA')",[id(7)]);
await db.query("INSERT INTO public.sgp_mecanizado_programacion_detalle VALUES($1,'KEY','RES',10)",[id(7)]);
await db.query("INSERT INTO sgp_opt_shared.assignments VALUES($1,'RES','SYS','KEY',$2,$3)",[id(6),id(7),id(1)]);
assert.equal((await db.query(query)).rows.length,0);
await db.exec('ROLLBACK');
const fingerprint=(await db.query(`select md5(string_agg(id_pieza::text||'|'||key_produccion||'|'||id_programacion::text,',' order by id_pieza)) hash from (${query}) c`)).rows[0].hash;
const migration=apply.replace('total<>1253','total<>1').replace('cc05c6a147521c8b3808a726c11a34cd',fingerprint);
const before=(await db.query('SELECT to_jsonb(p) row FROM sgp_opt_shared.pieces p ORDER BY id_pieza')).rows;
await assert.rejects(db.exec(apply),/PRECONDITION_CHANGED/);
await db.exec('ROLLBACK');
assert.equal((await db.query('select count(*) n from sgp_opt_shared.assignments')).rows[0].n,1);
await db.exec(migration);
assert.equal((await db.query('select count(*) n from sgp_opt_shared.assignments')).rows[0].n,2);
assert.equal((await db.query("select count(*) n from sgp_opt_shared.approvals where evidencia->>'contract'='OPT-SHARED-PROGRAM-20261116'")).rows[0].n,1);
assert.deepEqual((await db.query('SELECT to_jsonb(p) row FROM sgp_opt_shared.pieces p ORDER BY id_pieza')).rows,before);
assert.equal((await db.query('select count(*) n from sgp_opt_shared.cuts')).rows[0].n,0);
await db.exec(migration);assert.equal((await db.query('select count(*) n from sgp_opt_shared.assignments')).rows[0].n,2);
await db.close();console.log('PASS shared program: exact join, canceled/inactive/wrong system/excluded rejection, immutable units, no cuts, idempotency');
