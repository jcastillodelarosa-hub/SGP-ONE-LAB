// Synthetic PostgreSQL/PGlite fixture only. No external connection or operational data.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
const {PGlite}=await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db=new PGlite(); await db.waitReady;
const root=new URL('../../',import.meta.url),read=p=>readFile(new URL(p,root),'utf8');
const checks=[];const check=(label,fn)=>{fn();checks.push(label);};
const id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const q=async (args="'ok','2026-11-10','2026-11-10',null,null,500,0")=>(await db.query(`select public.sgp_picking_reporte_recepciones_v1(${args}) result`)).rows[0].result;
const reject=async(args,pattern)=>{await assert.rejects(()=>q(args),pattern);checks.push(pattern.source);};
try {
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
 CREATE SCHEMA sgp_picking_audit;CREATE SCHEMA sgp_mecanizado_parcial;
 CREATE TABLE public.sgp_usuarios(usuario text primary key,nombre text);
 CREATE TABLE public.sgp_mecanizado_programacion(id_programacion uuid primary key,reserva text,sistema text,cantidad_programada numeric);
 CREATE TABLE public.sgp_picking_entregas(id_entrega uuid primary key,id_programacion uuid,produccion text,usuario_entrega text,usuario_validacion text,fecha_validacion timestamptz,estado text);
 CREATE TABLE sgp_mecanizado_parcial.partes(id_programacion uuid primary key,key_produccion text);
 CREATE TABLE sgp_picking_audit.eventos(id_entrega uuid primary key,payload jsonb,respuesta jsonb,usuario text,fecha_recepcion date,turno_recepcion text,ejecutado_en timestamptz);
 CREATE TABLE sgp_picking_audit.decisiones(id_faltante uuid primary key,id_pendiente uuid,id_entrega uuid,accion text,nuevo jsonb);
 CREATE FUNCTION public.sgp_validar_sesion_rol(token text,roles text[]) RETURNS text LANGUAGE plpgsql AS $$BEGIN
 IF roles<>ARRAY['ADMINISTRADOR','COORDINADOR','PICKING','SUPERVISOR DE PICKING'] THEN RAISE EXCEPTION 'ACL_CHANGED'; END IF;
 IF token IS DISTINCT FROM 'ok' THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF; RETURN 'receiver';END $$;
 CREATE FUNCTION public.sgp_picking_reporte_entregas_v1(p_token text,date,date,text,text,integer,integer) RETURNS jsonb LANGUAGE plpgsql AS $$BEGIN
 PERFORM public.sgp_validar_sesion_rol(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','PICKING','SUPERVISOR DE PICKING']);RETURN '{}';END $$;
 REVOKE ALL ON FUNCTION public.sgp_picking_reporte_entregas_v1(text,date,date,text,text,integer,integer) FROM PUBLIC;
 GRANT EXECUTE ON FUNCTION public.sgp_picking_reporte_entregas_v1(text,date,date,text,text,integer,integer) TO anon,authenticated,service_role;
 INSERT INTO public.sgp_usuarios VALUES('giver','Entrega QA'),('receiver','Recibe QA');
 INSERT INTO public.sgp_mecanizado_programacion VALUES('${id(100)}','RES-01','S1',999),('${id(101)}','RES-02','S2',888);
 INSERT INTO sgp_mecanizado_parcial.partes VALUES('${id(100)}','KEY-01');
 `);
 for(let n=1;n<=6;n++) {
  await db.query(`insert into public.sgp_picking_entregas values($1,$2,'ORD-1','giver','receiver','2026-11-11T03:00:00Z',$3)`,[id(n),id(n===2?101:100),n===6?'PENDIENTE_VALIDACION':'VALIDADA']);
  if(n>=5)continue; // 5 confirmed legacy, 6 waiting: neither is an operative receipt.
  const payload={decisiones:n===1?[{},{}]:n===3?[{}]:[],diferencias:n===1?[{perfil:'NEW',cantidad:3,ventanas_afectadas:2}]:[],observacion:'QA'};
  await db.query(`insert into sgp_picking_audit.eventos values($1,$2,$3,'receiver','2026-11-10',$4,'2026-11-11T03:00:00Z')`,[id(n),payload,{ok:n!==4,id_entrega:id(n)},n===2?'TURNO 2':'TURNO 1']);
 }
 await db.query(`insert into sgp_picking_audit.decisiones values($1,$2,$3,'MODIFICAR',$4),($5,$6,$3,'ELIMINAR',$7)`,[id(20),id(30),id(1),{faltante:{perfil:'SNAPSHOT',cantidad:7,reserva_pendiente:'RES-01'}},id(21),id(31),{faltante:{perfil:'ELIMINADO',cantidad:99}}]);
 await db.exec(await read('docs/sql-proposals/picking-reception-report/install-review.sql'));
 let r=await q();
 check('only explicit successful ledger receipts',()=>assert.equal(r.total_rows,3));
 check('version',()=>assert.equal(r.contract_version,1));
 check('legacy excluded and pending not counted',()=>assert.equal(r.coverage.recepciones_sin_fecha_operativa,1));
 const first=r.rows.find(x=>x.id_entrega===id(1));
 check('operational date differs from real timestamp',()=>{assert.equal(first.fecha_recepcion,'2026-11-10');assert.match(first.registrado_en,/2026-11-11/);});
 check('both responsible names',()=>{assert.equal(first.nombre_entrego,'Entrega QA');assert.equal(first.nombre_recibio,'Recibe QA');});
 check('historic modified and new pending retained; removed absent',()=>assert.deepEqual(first.pendientes_al_recibir.map(x=>x.cantidad),[7,3]));
 check('state at receipt independent of current VALIDADA',()=>assert.equal(first.estado_al_recibir,'AUDITADA_DIFERENCIA'));
 check('unknown windows not scheduled quantities',()=>assert.ok(r.rows.every(x=>x.cantidad_ventanas_recibidas===null)));
 check('incomplete historical snapshot is null not empty',()=>assert.equal(r.rows.find(x=>x.id_entrega===id(3)).pendientes_al_recibir,null));
 check('zero pending explicit vs no information',()=>assert.equal(r.rows.find(x=>x.id_entrega===id(2)).completa_al_recibir,true));
 check('full summary before pagination',()=>{assert.equal(r.summary.recepciones,3);assert.equal(r.summary.filas_pendientes,2);assert.equal(r.summary.pendientes_no_constan,1);});
 let page=await q("'ok','2026-11-10','2026-11-10',null,null,1,1");check('stable pagination full totals',()=>{assert.equal(page.rows.length,1);assert.equal(page.rows[0].id_entrega,r.rows[1].id_entrega);assert.deepEqual(page.summary,r.summary);});
 check('turn filter',()=>{});assert.equal((await q("'ok','2026-11-10','2026-11-10','TURNO 2',null,500,0")).total_rows,1);
 assert.equal((await q("'ok','2026-11-10','2026-11-10',null,'S2',500,0")).total_rows,1);checks.push('system filter');
 assert.equal((await q("'ok','2026-11-11','2026-11-11',null,null,500,0")).total_rows,0);checks.push('never filter by actual registration day');
 await db.exec(`UPDATE public.sgp_picking_entregas SET estado='OTHER';UPDATE public.sgp_mecanizado_programacion SET cantidad_programada=0;`);
 const after=await q();check('mutable delivery state and schedule do not change historical pending/state',()=>assert.deepEqual(after.rows,r.rows));
 await reject("'denied','2026-11-10','2026-11-10'",/UNAUTHORIZED/);
 await reject("null,'2026-11-10','2026-11-10'",/UNAUTHORIZED/);
 await reject("'ok',null,'2026-11-10'",/RANGO_FECHAS_INVALIDO/);
 await reject("'ok','2026-11-10','2026-11-09'",/RANGO_FECHAS_INVALIDO/);
 await reject("'ok','2026-10-10','2026-11-10'",/RANGO_FECHAS_INVALIDO/);
 await q("'ok','2026-10-11','2026-11-10'");checks.push('31 days inclusive accepted');
 await reject("'ok','2026-11-10','2026-11-10','NIGHT'",/TURNO_INVALIDO/);
 for(const pair of ['0,0','501,0','null,0','1,-1','1,null']) await reject(`'ok','2026-11-10','2026-11-10',null,null,${pair}`,/PAGINACION_INVALIDA/);
 const acl=(await db.query(`select proacl::text acl,proconfig from pg_proc where proname='sgp_picking_reporte_recepciones_v1'`)).rows[0];
 check('ACL no PUBLIC and same grantees',()=>{assert.ok(!acl.acl.includes('{=')&&!acl.acl.includes(',='));for(const role of ['postgres','anon','authenticated','service_role'])assert.ok(acl.acl.includes(role+'=X/'));});
 await db.exec('SET ROLE anon;');await q();await assert.rejects(()=>db.query('select * from sgp_picking_audit.eventos'),/permission denied/);await db.exec('RESET ROLE;');checks.push('anon RPC works without direct ledger access');
 await db.exec(await read('docs/sql-proposals/picking-reception-report/rollback-review.sql'));
 assert.equal((await db.query("select to_regprocedure('public.sgp_picking_reporte_recepciones_v1(text,date,date,text,text,integer,integer)') v")).rows[0].v,null);checks.push('rollback removes only new RPC');
 await writeFile(new URL('tests/picking-reception-report/sql-results.json',root),JSON.stringify({environment:'PGlite isolated synthetic; auth helper stub checks exact role list, not real session implementation',checks:checks.length,passed:checks},null,2)+'\n');
 console.log(`PASS ${checks.length} isolated SQL checks`);
}finally{await db.close();}
