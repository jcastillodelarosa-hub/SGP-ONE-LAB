-- Picking: desambiguar producciones con el mismo nombre usando la programacion seleccionada.
-- Conserva el filtro autoritativo PANEL contra sgp_maestro_piezas.
create or replace function public.sgp_picking_piezas_panel(
  p_token text,
  p_id_programacion uuid,
  p_produccion text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_sistema text;
  v_acabado text;
begin
  select sistema, acabado into v_sistema, v_acabado
  from public.sgp_mecanizado_programacion
  where id_programacion = p_id_programacion;

  return coalesce((
    select jsonb_agg(x)
    from jsonb_array_elements(public.sgp_picking_piezas(p_token,p_id_programacion,p_produccion)) x
    join public.sgp_maestro_piezas m
      on trim(m.codigo_sap)=trim(coalesce(x->>'codigo_sap',x->>'perfil'))
     and m.activo='SI'
     and m.tipo_pieza='PANEL'
    where (v_sistema is null or trim(v_sistema)='' or upper(trim(coalesce(x->>'sistema','')))=upper(trim(v_sistema)))
      and (v_acabado is null or trim(v_acabado)='' or upper(trim(coalesce(x->>'acabado','')))=upper(trim(v_acabado)))
  ), '[]'::jsonb);
end
$function$;
