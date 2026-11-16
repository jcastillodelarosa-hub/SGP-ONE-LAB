-- SELECT only; rerun before installation. No backup contents or credentials.
select p.oid::regprocedure::text signature,md5(pg_get_functiondef(p.oid)) definition_md5,pg_get_userbyid(p.proowner) owner,p.prosecdef,p.proconfig,p.proacl from pg_proc p where p.oid in('public.sgp_picking_auditoria_guardar(text,uuid,text,uuid,date,text,jsonb,jsonb,text)'::regprocedure,'public.sgp_picking_auditoria_contexto(text,uuid)'::regprocedure);
with mapped as (
 select e.id_entrega,(select array_agg(distinct s.id_linea order by s.id_linea)
 from public.sgp_producciones s join public.sgp_prioridades pr on pr.key_produccion=s.key_produccion and pr.id_linea=s.id_linea and pr.reserva=m.reserva
 where s.produccion=e.produccion and (not exists(select 1 from sgp_mecanizado_parcial.partes pt where pt.id_programacion=e.id_programacion) or s.key_produccion=(select pt.key_produccion from sgp_mecanizado_parcial.partes pt where pt.id_programacion=e.id_programacion))) lineas
 from public.sgp_picking_entregas e join public.sgp_mecanizado_programacion m using(id_programacion) where e.estado='PENDIENTE_VALIDACION'
) select lineas,count(*) from mapped group by lineas;
select coalesce(s.semana_actual,s.semana_base) semana,count(distinct e.id_entrega) ordenes
from public.sgp_picking_entregas e join public.sgp_mecanizado_programacion m using(id_programacion)
join public.sgp_prioridades pr on pr.reserva=m.reserva join public.sgp_producciones s on s.key_produccion=pr.key_produccion and s.id_linea=pr.id_linea and s.produccion=e.produccion
where e.estado='PENDIENTE_VALIDACION' and s.activa='SI' and (not exists(select 1 from sgp_mecanizado_parcial.partes pt where pt.id_programacion=e.id_programacion) or s.key_produccion=(select pt.key_produccion from sgp_mecanizado_parcial.partes pt where pt.id_programacion=e.id_programacion)) group by 1;
