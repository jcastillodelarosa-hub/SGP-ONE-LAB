begin;
set local lock_timeout='5s';
do $$ begin if md5(pg_get_functiondef('sgp_picking_audit_areas.linea(uuid)'::regprocedure))<>'bf9085c0183b3827b67657748b4ad1d1' then raise exception 'AUDITORIA_LINEA_DEFINITION_CHANGED';end if;end $$;
create or replace function sgp_picking_audit_areas.linea(id uuid) returns text language plpgsql security definer set search_path='' as $$
declare ls text[];
begin
 select array_agg(distinct s.id_linea order by s.id_linea) into ls
 from public.sgp_picking_entregas e join public.sgp_mecanizado_programacion m on m.id_programacion=e.id_programacion
 join public.sgp_prioridades pr on pr.reserva=m.reserva
 join public.sgp_producciones s on s.key_produccion=pr.key_produccion and s.id_linea=pr.id_linea and s.produccion=e.produccion
 where e.id_entrega=$1 and (not exists(select 1 from sgp_mecanizado_parcial.partes pt where pt.id_programacion=e.id_programacion)
 or s.key_produccion=(select pt.key_produccion from sgp_mecanizado_parcial.partes pt where pt.id_programacion=e.id_programacion));
 if cardinality(ls) is distinct from 1 then raise exception 'AUDITORIA_LINEA_NO_UNIVOCA';end if;
 return ls[1];
end $$;
commit;
