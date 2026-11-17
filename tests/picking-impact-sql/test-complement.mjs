import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const {PGlite}=await import(process.env.PGLITE_MODULE);const db=new PGlite();await db.waitReady;
const read=p=>readFileSync(new URL(p.endsWith('-review.sql')?'../../docs/sql-proposals/picking-impact/'+p:p,import.meta.url),'utf8');const id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
try{
await db.exec(`create role anon;create role authenticated;create role service_role;create schema sgp_picking_audit;
create table public.sgp_picking_entregas(id_entrega uuid primary key);
create table sgp_picking_audit.eventos(id_entrega uuid,fecha_recepcion date);
create table public.sgp_producciones(key_produccion text primary key,id_linea text);
create table public.sgp_usuarios(usuario text primary key,nombre text);
create table public.synthetic_receipts(id_entrega uuid primary key,row jsonb);
create function public.sgp_pdt_validar_rol_real(t text,roles text[]) returns text language plpgsql as $$begin if not t=any(roles) then raise exception 'DENIED';end if;return t;end$$;
create function public.sgp_picking_reporte_recepciones_v1(t text,a date,b date,c text,d text,e integer,f integer) returns jsonb language sql as $$select jsonb_build_object('rows',coalesce(jsonb_agg(row),'[]'),'total_rows',count(*)) from public.synthetic_receipts$$;
insert into public.sgp_producciones values('K1','PANELES_2'),('K2','OTHER');insert into public.sgp_usuarios values('ADMINISTRADOR','Synthetic Admin');
`);
for(let n=1;n<=5;n++){
 const pending=n===2?[{id_faltante:id(100+n),id_pendiente:id(200+n),ventanas_afectadas:2},{id_faltante:id(300+n),id_pendiente:id(400+n),ventanas_afectadas:null}]:[{id_faltante:id(100+n),id_pendiente:id(200+n),ventanas_afectadas:null}];
 const row={id_entrega:id(n),produccion:'SYNTHETIC',key_produccion:n===5?'K2':'K1',cantidad_programada:10,pendientes_al_recibir:pending};
 await db.query('insert into public.sgp_picking_entregas values($1);',[id(n)]);await db.query('insert into sgp_picking_audit.eventos values($1,$2)',[id(n),'2026-11-17']);await db.query('insert into public.synthetic_receipts values($1,$2)',[id(n),row]);
}
await db.exec(read('complement-history-review.sql'));
const context=async(role,n)=>(await db.query('select public.sgp_picking_impacto_contexto($1,$2) result',[role,id(n)])).rows[0].result;
const save=async(role,n,request,detail,motive='Completar dato faltante')=>(await db.query('select public.sgp_picking_impacto_complementar($1,$2,$3,$4,$5) result',[role,id(n),id(request),detail,motive])).rows[0].result;
const detail=n=>({faltantes:[{id_faltante:id(100+n),id_pendiente:id(200+n),ventanas_afectadas:3}],total_consolidado:null});
assert.equal((await context('PICKING',1)).can_complement,false);assert.equal((await context('ADMINISTRADOR',1)).can_complement,true);
await assert.rejects(()=>save('PICKING',1,701,detail(1)),/DENIED/);await assert.rejects(()=>context('invalid',1),/DENIED/);
for(const value of [null,0,-1,1.5,11,'3'])await assert.rejects(()=>save('ADMINISTRADOR',1,701,{faltantes:[{...detail(1).faltantes[0],ventanas_afectadas:value}]}),/IMPACTO_/);
await assert.rejects(()=>save('ADMINISTRADOR',1,701,{faltantes:[{...detail(1).faltantes[0],id_pendiente:id(999)}]}),/AJENO/);
const before=JSON.stringify((await db.query('select * from public.synthetic_receipts order by id_entrega')).rows);
const result=await save('ADMINISTRADOR',1,701,detail(1));assert.equal(result.cantidad_efectiva,7);assert.equal(result.total_consolidado,3);
assert.equal((await save('ADMINISTRADOR',1,701,detail(1))).duplicado,true);await assert.rejects(()=>save('ADMINISTRADOR',1,701,detail(1),'changed'),/IDEMPOTENCIA/);await assert.rejects(()=>save('ADMINISTRADOR',1,702,detail(1)),/YA_COMPLEMENTADO/);
assert.equal((await context('ADMINISTRADOR',1)).can_complement,false);assert.equal((await context('PICKING',1)).complemento.fuente,'COMPLEMENTO_POSTERIOR');
const two={faltantes:[{id_faltante:id(302),id_pendiente:id(402),ventanas_afectadas:3}],total_consolidado:null};const multi=await save('COORDINADOR',2,703,two);assert.equal(multi.cantidad_efectiva,null);assert.equal(multi.total_consolidado,null);
await assert.rejects(()=>save('ADMINISTRADOR',3,704,{...detail(3),total_consolidado:1}),/CONSOLIDADO/);
assert.equal((await context('ADMINISTRADOR',5)).can_complement,false);await assert.rejects(()=>save('ADMINISTRADOR',5,705,detail(5)),/NO_COMPLEMENTABLE/);
assert.equal(JSON.stringify((await db.query('select * from public.synthetic_receipts order by id_entrega')).rows),before);
const duplicateKnown={id_faltante:id(800),id_pendiente:id(801),ventanas_afectadas:2};
await db.query("update public.synthetic_receipts set row=jsonb_set(row,'{pendientes_al_recibir}',$1::jsonb) where id_entrega=$2",[[duplicateKnown,duplicateKnown,{id_faltante:id(104),id_pendiente:id(204),ventanas_afectadas:null}],id(4)]);
await assert.rejects(()=>save('ADMINISTRADOR',4,706,{...detail(4),total_consolidado:6}),/CONSOLIDADO/);

await db.exec('set role anon');await assert.rejects(()=>db.query('select * from sgp_picking_impacto.complementos'),/permission denied/);await context('PICKING',1);await db.exec('reset role');
console.log('PASS: known history unchanged; explicit missing impact; bounds; no sum for multiple rows; token/role denial; idempotency; one complement; other line unchanged; no direct ledger access');
}finally{await db.close()}
