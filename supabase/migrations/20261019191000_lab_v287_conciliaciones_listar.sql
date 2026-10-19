-- LAB v287: consulta de confirmaciones, sin modificar órdenes ni estados productivos.
create or replace function public.sgp_mecanizado_conciliaciones_listar(p_token text)
returns table(reserva text,cantidad_canonica integer,cantidad_confirmada integer,estado text,fecha_confirmacion timestamptz)
language plpgsql security definer set search_path = ''
as $$
begin
 perform public.sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO','LIDER','LIDER LINEA','CONSULTA']);
 return query select c.reserva,c.cantidad_canonica,c.cantidad_confirmada,c.estado,c.fecha_confirmacion
 from public.sgp_mecanizado_conciliaciones_operativas c
 where c.estado='CONFIRMADA_OPERACION';
end $$;
revoke all on function public.sgp_mecanizado_conciliaciones_listar(text) from public;
grant execute on function public.sgp_mecanizado_conciliaciones_listar(text) to authenticated,anon;
