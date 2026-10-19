-- LAB v291: semana real desde el detalle persistido de cada programación.
create or replace function public.sgp_mecanizado_semanas_programacion(p_token text,p_ids uuid[])
returns table(id_programacion uuid,semana integer)
language plpgsql security definer set search_path=''
as $$
begin
 perform public.sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO','LIDER_MECANIZADO','CONSULTA']);
 return query
 select d.id_programacion, max(coalesce(sp.semana_actual,sp.semana_base))::integer
 from public.sgp_mecanizado_programacion_detalle d
 join public.sgp_mecanizado_programacion mp on mp.id_programacion=d.id_programacion
 join public.sgp_producciones sp on sp.key_produccion=d.key_produccion
 where d.id_programacion=any(p_ids) and mp.estado<>'CANCELADA'
 group by d.id_programacion;
end $$;
revoke all on function public.sgp_mecanizado_semanas_programacion(text,uuid[]) from public;
grant execute on function public.sgp_mecanizado_semanas_programacion(text,uuid[]) to anon,authenticated;
