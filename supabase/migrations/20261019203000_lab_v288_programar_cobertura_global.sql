-- LAB v288: cobertura global por orden, independiente de cambios de prioridad. Se preserva fallback legacy por prioridad.
CREATE OR REPLACE FUNCTION public.sgp_mecanizado_programar(p_token text, p_reserva text, p_produccion text, p_cantidad integer, p_fecha date, p_turno text, p_prioridad integer, p_observacion text, p_observacion_orden text, p_prioridad_semanal text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 u text; rid uuid; v_sistema text; v_acabado text; v_pct numeric; v_vidrio numeric;
 total_disponible integer; total_cubierto integer; v_scope_qty integer;
begin
 u:=public.sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR']);

 with scope as (
   select sp.*
   from public.sgp_prioridades pr
   join public.sgp_producciones sp on sp.key_produccion=pr.key_produccion
   where pr.reserva=p_reserva and pr.id_linea='PANELES_2' and sp.id_linea='PANELES_2'
     and (p_prioridad_semanal is null or pr.prioridad=p_prioridad_semanal)
     and (p_produccion is null or sp.produccion=p_produccion)
 ), covered_keys as (
   select distinct d.key_produccion
   from public.sgp_mecanizado_programacion mp
   join public.sgp_mecanizado_programacion_detalle d on d.id_programacion=mp.id_programacion
   where mp.reserva=p_reserva and mp.estado<>'CANCELADA'
     
 )
 select coalesce(sum(s.cantidad),0)::int,
        coalesce(sum(s.cantidad) filter(where ck.key_produccion is not null),0)::int
 into total_disponible,total_cubierto
 from scope s left join covered_keys ck on ck.key_produccion=s.key_produccion;

 if total_cubierto=0 then
   select coalesce(sum(mp.cantidad_programada),0)::int into total_cubierto
   from public.sgp_mecanizado_programacion mp
   where mp.reserva=p_reserva and mp.estado<>'CANCELADA'
     and mp.prioridad_semanal is not distinct from p_prioridad_semanal
     and (p_produccion is null or mp.produccion=p_produccion);
 end if;

 if p_cantidad<1 or p_cantidad>greatest(total_disponible-total_cubierto,0) then
   raise exception 'Cantidad supera el saldo pendiente por programar (% ventanas)',greatest(total_disponible-total_cubierto,0);
 end if;

 select sp.sistema,sp.acabado,
   case when sum(sp.cantidad)>0 then round(100*sum(least(coalesce(sa.vent_cant_vidrio,0),sp.cantidad))/sum(sp.cantidad),1) else 0 end,
   sum(least(coalesce(sa.vent_cant_vidrio,0),sp.cantidad))
 into v_sistema,v_acabado,v_pct,v_vidrio
 from public.sgp_prioridades pr
 join public.sgp_producciones sp on sp.key_produccion=pr.key_produccion
 left join public.sgp_seguimiento_aluminio sa on sa.id=sp.id and sa.reserva=p_reserva and coalesce(sa.activo,'SI')='SI' and sa.linea_prog='PANELES 2'
 where pr.reserva=p_reserva and pr.id_linea='PANELES_2' and sp.id_linea='PANELES_2'
   and (p_prioridad_semanal is null or pr.prioridad=p_prioridad_semanal)
   and (p_produccion is null or sp.produccion=p_produccion)
 group by sp.sistema,sp.acabado order by count(*) desc limit 1;

 insert into public.sgp_mecanizado_programacion(
   reserva,produccion,cantidad_programada,fecha_programacion,turno,prioridad,prioridad_semanal,
   observacion,observacion_orden,sistema,acabado,porc_vidrio_snapshot,cant_vidrio_snapshot,usuario_programa
 ) values(
   p_reserva,p_produccion,p_cantidad,p_fecha,p_turno,p_prioridad,p_prioridad_semanal,
   p_observacion,p_observacion_orden,v_sistema,v_acabado,v_pct,v_vidrio,u
 ) returning id_programacion into rid;

 with already as (
   select distinct d.key_produccion
   from public.sgp_mecanizado_programacion mp
   join public.sgp_mecanizado_programacion_detalle d on d.id_programacion=mp.id_programacion
   where mp.reserva=p_reserva and mp.id_programacion<>rid and mp.estado<>'CANCELADA'
     
 ), scope as (
   select sp.key_produccion,sp.cantidad,sp.produccion
   from public.sgp_prioridades pr
   join public.sgp_producciones sp on sp.key_produccion=pr.key_produccion
   left join already a on a.key_produccion=sp.key_produccion
   where pr.reserva=p_reserva and pr.id_linea='PANELES_2' and sp.id_linea='PANELES_2'
     and (p_prioridad_semanal is null or pr.prioridad=p_prioridad_semanal)
     and (p_produccion is null or sp.produccion=p_produccion)
     and a.key_produccion is null
 )
 select coalesce(sum(cantidad),0)::int into v_scope_qty from scope;

 if v_scope_qty=p_cantidad then
   insert into public.sgp_mecanizado_programacion_detalle(
     id_programacion,key_produccion,cantidad_snapshot,reserva_snapshot,prioridad_semanal_snapshot,produccion_snapshot
   )
   with already as (
   select distinct d.key_produccion
   from public.sgp_mecanizado_programacion mp
   join public.sgp_mecanizado_programacion_detalle d on d.id_programacion=mp.id_programacion
   where mp.reserva=p_reserva and mp.id_programacion<>rid and mp.estado<>'CANCELADA'
     
 ), scope as (
   select sp.key_produccion,sp.cantidad,sp.produccion
   from public.sgp_prioridades pr
   join public.sgp_producciones sp on sp.key_produccion=pr.key_produccion
   left join already a on a.key_produccion=sp.key_produccion
   where pr.reserva=p_reserva and pr.id_linea='PANELES_2' and sp.id_linea='PANELES_2'
     and (p_prioridad_semanal is null or pr.prioridad=p_prioridad_semanal)
     and (p_produccion is null or sp.produccion=p_produccion)
     and a.key_produccion is null
 )

   select rid,key_produccion,cantidad,p_reserva,p_prioridad_semanal,produccion from scope;
 else
   delete from public.sgp_mecanizado_programacion where id_programacion=rid;
   raise exception 'La composición canónica pendiente suma % ventanas y no coincide con la cantidad solicitada %. Recargue Programación antes de guardar.',v_scope_qty,p_cantidad;
 end if;

 return rid;
end $function$
;
