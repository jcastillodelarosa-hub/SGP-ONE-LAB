-- Applied 2026-10-22 to SGP-ONE-LAB via migration sgp_maestro_piezas_admin_listar_20261022.
create or replace function public.sgp_admin_maestro_piezas_listar(p_token text)
returns table(codigo_sap text,tipo_pieza text,destino_productivo text,observacion text,activo text,fecha_actualizacion timestamptz,lineas_aplicables text[])
language plpgsql security definer set search_path=public,extensions as $$
begin
 perform public.sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR']::text[]);
 return query select m.codigo_sap,m.tipo_pieza,m.destino_productivo,m.observacion,m.activo,m.fecha_actualizacion,m.lineas_aplicables from public.sgp_maestro_piezas m order by m.codigo_sap;
end $$;
revoke all on function public.sgp_admin_maestro_piezas_listar(text) from public,anon,authenticated;
grant execute on function public.sgp_admin_maestro_piezas_listar(text) to anon,authenticated;
