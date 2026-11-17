import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const {PGlite}=await import(process.env.PGLITE_MODULE);const db=new PGlite();await db.waitReady;
const read=p=>readFileSync(new URL(p.endsWith('-review.sql')?'../../docs/sql-proposals/picking-impact/'+p:p,import.meta.url),'utf8');const id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
try{
await db.exec(`create schema sgp_picking_audit_areas;create schema sgp_picking_audit;create schema sgp_pdt_multiorigen;create schema sgp_mecanizado_parcial;
create table public.sgp_picking_entregas(id_entrega uuid primary key,id_programacion uuid,produccion text,estado text);
create table public.sgp_producciones(key_produccion text primary key,id_linea text,cantidad numeric);
create table sgp_mecanizado_parcial.partes(id_programacion uuid primary key,cantidad numeric);
create table public.sgp_picking_faltantes(id_faltante uuid primary key,id_entrega uuid,id_pieza text,ventanas_afectadas integer,nc text,auditado boolean,usuario_auditoria text,fecha_auditoria timestamptz);
create table public.sgp_aluminio_pendientes(id_pendiente uuid primary key,key_produccion text,id_pieza text,ventanas_afectadas integer,cantidad numeric,estado text,estado_repo text,validacion_estado text,nc text,fecha_cierre timestamptz,auditado boolean,contrato_pdt text,reserva text,acabado_pendiente text,perfil text,produccion text,longitud numeric,fabricacion text);
create table sgp_picking_audit.eventos(id_entrega uuid,solicitud uuid,payload jsonb,respuesta jsonb,usuario text);
create table sgp_picking_audit.contextos(transaccion text,usuario text);
create table sgp_picking_audit.correcciones(id_pendiente uuid,transaccion text,anterior numeric,nueva numeric);
create table sgp_mecanizado_parcial.contextos_pdt(id_pendiente uuid,id_entrega uuid);
create table public.sgp_aluminio_pendiente_ncs(id_pendiente uuid,consecutivo text,enlazado_por text,snapshot jsonb);
create table public.sgp_aluminio_pendiente_detalles(id_pendiente uuid,id_detalle uuid);
create table public.sgp_aluminio_pendiente_movimientos(id_pendiente uuid,id_detalle uuid,tipo text,cantidad numeric);
create table sgp_picking_audit.decisiones(id_faltante uuid primary key,id_pendiente uuid,id_entrega uuid,accion text,motivo text,anterior jsonb,nuevo jsonb,usuario text,fecha_recepcion date,turno_recepcion text);
create table public.sgp_aluminio_pendientes_historial(id_pendiente uuid,usuario text,estado_anterior text,estado_nuevo text,tipo_evento text,observacion text,datos_anteriores jsonb,datos_nuevos jsonb);
create function public.sgp_pdt_validar_rol_real(t text,r text[]) returns text language plpgsql as $$begin if not t=any(r) then raise exception 'DENIED';end if;return t;end$$;
create function sgp_picking_audit.pendiente(f public.sgp_picking_faltantes) returns uuid language sql as $$select id_pendiente from public.sgp_aluminio_pendientes where id_pieza=f.id_pieza$$;
create function sgp_picking_audit.snapshot(uuid) returns jsonb language sql as $$select '{}'::jsonb$$;
create function sgp_picking_audit_areas.nc_resolver(text) returns jsonb language sql as $$select null::jsonb$$;
create function sgp_pdt_multiorigen.fuentes(text,text,jsonb) returns jsonb language sql as $$select '[]'::jsonb$$;
create function public.sgp_pdt_cierre_acreditado(uuid) returns boolean language sql as $$select false$$;
insert into public.sgp_producciones values('P','PANELES_2',10),('O','OTHER',10);
`);
for(let n=1;n<=22;n++)await db.exec(`insert into public.sgp_picking_entregas values('${id(n)}','${id(n)}','SYNTHETIC','PENDIENTE_VALIDACION');insert into public.sgp_picking_faltantes values('${id(100+n)}','${id(n)}','piece${n}',${n===4?2:'null'},null,false,null,null);insert into public.sgp_aluminio_pendientes(id_pendiente,key_produccion,id_pieza,cantidad,estado,estado_repo,validacion_estado,contrato_pdt,ventanas_afectadas) values('${id(200+n)}','${n===5?'O':'P'}','piece${n}',1,'${n===6?'RESUELTO':'PENDIENTE'}','PENDIENTE','POR_VALIDAR','V2',${n===4?2:'null'});insert into sgp_mecanizado_parcial.contextos_pdt values('${id(200+n)}','${id(n)}');`);
// Install unchanged production guards AFTER synthetic fixtures; their update paths are exercised.
await db.exec(read('live-guards-test-only.sql'));
await db.exec(`create trigger guard_contract before update on public.sgp_aluminio_pendientes for each row execute function public.sgp_pdt_guardar_contrato();create trigger guard_identity before update on public.sgp_aluminio_pendientes for each row execute function public.sgp_pdt_proteger_identidad_v3();`);
let proposed=read('accept-missing-impact-review.sql');const start=proposed.indexOf('CREATE OR REPLACE FUNCTION sgp_picking_audit_areas.procesar');const end=proposed.indexOf('end $function$',start)+'end $function$'.length;
await db.exec(proposed.slice(start,end)+';');
const accept=async(n,value,role='RECEPCION')=>db.query(`select sgp_picking_audit_areas.procesar($1,$2,md5('{}'::jsonb::text),$3,'2026-11-17','TURNO 1',$4,'[]',null)`,[role,id(n),id(500+n),[{id_faltante:id(100+n),accion:'ACEPTAR',ventanas_afectadas:value}]]);
for(const v of [null,0,-1,1.5,11,'2'])await assert.rejects(()=>accept(1,v),/IMPACTO_/);
await accept(1,3);const ledger=(await db.query('select anterior,nuevo from sgp_picking_audit.decisiones where id_faltante=$1',[id(101)])).rows[0];assert.equal(ledger.anterior.faltante.ventanas_afectadas,null);assert.equal(ledger.nuevo.faltante.ventanas_afectadas,3);assert.equal(ledger.nuevo.pendiente.ventanas_afectadas,3);assert.equal(ledger.nuevo.pendiente.cantidad,1);
await assert.rejects(()=>accept(1,3),/FALTANTE_YA_REVISADO/);await accept(4,null);assert.equal((await db.query('select ventanas_afectadas from public.sgp_aluminio_pendientes where id_pendiente=$1',[id(204)])).rows[0].ventanas_afectadas,2);
await accept(5,null);assert.equal((await db.query('select ventanas_afectadas from public.sgp_aluminio_pendientes where id_pendiente=$1',[id(205)])).rows[0].ventanas_afectadas,null);
await assert.rejects(()=>accept(6,2),/PDT_CERRADO_INMUTABLE/);assert.equal((await db.query('select count(*) n from sgp_picking_audit.decisiones where id_faltante=$1',[id(106)])).rows[0].n,0);
await assert.rejects(()=>accept(7,2,'invalid'),/DENIED/);

for(const [index,role] of ['RECEPCION','LIDER LINEA','LIDER','PICKING','SUPERVISOR DE PICKING','ADMINISTRADOR','COORDINADOR'].entries()){
 await accept(8+index,2,role);
 const audit=(await db.query('select usuario,nuevo from sgp_picking_audit.decisiones where id_faltante=$1',[id(108+index)])).rows[0];
 assert.equal(audit.usuario,role);assert.equal(audit.nuevo.faltante.ventanas_afectadas,2);
}
for(const role of ['OPERARIO','ENSAMBLE','EMPAQUE','invalid'])await assert.rejects(()=>accept(18,2,role),/DENIED/);
assert.equal((await db.query('select count(*) n from sgp_picking_audit.decisiones where id_faltante=$1',[id(118)])).rows[0].n,0);
await db.exec(`insert into sgp_mecanizado_parcial.partes values('${id(20)}',2)`);
await assert.rejects(()=>accept(20,3),/IMPACTO_PANEL_INVALIDO/);await accept(20,2);
await assert.rejects(()=>accept(21,99,'RECEPCION'),/IMPACTO_PANEL_INVALIDO/);
assert.equal((await db.query('select ventanas_afectadas from public.sgp_picking_faltantes where id_faltante=$1',[id(121)])).rows[0].ventanas_afectadas,null);
await accept(21,2,'RECEPCION');await assert.rejects(()=>accept(21,3,'LIDER'),/FALTANTE_YA_REVISADO/);
assert.equal((await db.query('select count(*) n from sgp_picking_audit.decisiones where id_faltante=$1',[id(121)])).rows[0].n,1);
console.log('PASS acceptance role matrix and serial conflict recovery; actual multi-connection locks not simulated');
console.log('PASS full proposed area processor ACEPTAR with unchanged live guards: null fill, old/new snapshot, quantity preserved, reject absent/fraction/bounds, known unchanged, other line unchanged, closed blocked atomically, role denied');
}finally{await db.close()}
