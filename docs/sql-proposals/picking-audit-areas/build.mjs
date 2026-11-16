import {readFile,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
const dir=new URL('./',import.meta.url),read=p=>readFile(new URL(p,dir),'utf8');
const files=['schema.sql','worker.sql','api.sql','legacy-guard.sql'];const parts=await Promise.all(files.map(read));
const header=`-- REVIEW: install only with verified current backup and coordinated compatible frontend.
-- This blocks old Paneles close routes; do not install long before frontend is ready.
begin;
set local lock_timeout='5s';
do $guard$ begin
 if to_regnamespace('sgp_picking_audit_areas') is not null then raise exception 'AUDITORIA_AREAS_YA_EXISTE';end if;
 if md5(pg_get_functiondef('public.sgp_picking_auditoria_guardar(text,uuid,text,uuid,date,text,jsonb,jsonb,text)'::regprocedure))<>'c9270cabd220b3646c98c63c85be6670' then raise exception 'AUDITORIA_BASE_CAMBIO';end if;
 if md5(pg_get_functiondef('public.sgp_picking_auditoria_contexto(text,uuid)'::regprocedure))<>'bab3fe2c5271e33ede98f28b5d6c1249' then raise exception 'AUDITORIA_LECTOR_CAMBIO';end if;
end $guard$;
`;
await writeFile(new URL('install-review.sql',dir),header+parts.join('\n')+'\ncommit;\n');
const all=parts.join('\n'),funcs=[...all.matchAll(/create(?: or replace)? function ([\w.]+)\(([^]*?)\)\s+returns [^]*? as \$\$([^]*?)\$\$;/g)];
const ident=funcs.map(m=>({name:m[1],hash:createHash('md5').update(m[3]).digest('hex')}));
let rollback=`-- Only unused installation can be rolled back. Never delete submitted reviews.
begin;
set local lock_timeout='5s';
lock table sgp_picking_audit_areas.lotes,sgp_picking_audit_areas.revisiones,sgp_picking_audit_areas.configuracion,sgp_picking_audit_areas.config_historial in access exclusive mode;
do $guard$ begin
 if exists(select 1 from sgp_picking_audit_areas.lotes) or exists(select 1 from sgp_picking_audit_areas.revisiones) or exists(select 1 from sgp_picking_audit_areas.config_historial) then raise exception 'AUDITORIA_AREAS_EN_USO_FORWARD_REQUIRED';end if;
`;
for(const x of ident){const [ns,name]=x.name.split('.');rollback+=` if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='${ns}' and p.proname='${name}' and md5(p.prosrc)='${x.hash}') then raise exception 'AUDITORIA_AREAS_CODIGO_CAMBIO: ${x.name}';end if;\n`;}
rollback+='end $guard$;\n'+(await read('legacy-guardar.sql')).replace('create function','create or replace function')+'\n';
rollback+=`drop trigger sgp_picking_audit_areas_cierre on public.sgp_picking_entregas;
drop function sgp_picking_audit_areas.proteger_cierre();
drop function public.sgp_picking_auditoria_nc_consultar(text,text);
drop function sgp_picking_audit_areas.nc_resolver(text);
drop function public.sgp_picking_auditoria_areas_contexto(text,uuid),public.sgp_picking_auditoria_area_guardar(text,uuid,text,uuid,date,text,jsonb,jsonb,text,text,text),public.sgp_picking_auditoria_areas_configuracion(text),public.sgp_picking_auditoria_areas_configurar(text,text,jsonb);
drop function sgp_picking_audit_areas.version(uuid),sgp_picking_audit_areas.resumen(uuid),sgp_picking_audit_areas.procesar(text,uuid,text,uuid,date,text,jsonb,jsonb,text);
drop function sgp_picking_audit_areas.esquema(uuid),sgp_picking_audit_areas.linea(uuid);
drop table sgp_picking_audit_areas.revisiones,sgp_picking_audit_areas.lotes,sgp_picking_audit_areas.config_historial,sgp_picking_audit_areas.configuracion;
drop schema sgp_picking_audit_areas restrict;
commit;\n`;
await writeFile(new URL('rollback-unused.sql',dir),rollback);
console.log('Built installer, guarded unused-only rollback',ident.length,'function fingerprints');
