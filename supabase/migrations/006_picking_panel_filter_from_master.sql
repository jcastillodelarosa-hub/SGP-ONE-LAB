-- Picking: fuente autoritativa de referencias PANEL
-- La selección se consolida contra sgp_maestro_piezas por codigo_sap.
-- No usa destino_productivo, id_linea_destino ni descripción como criterio.
create or replace function public.sgp_picking_piezas_panel(
  p_token text,
  p_id_programacion uuid,
  p_produccion text default null
)
returns jsonb
language sql
security definer
set search_path to 'public'
as $function$
  with piezas as (
    select x
    from jsonb_array_elements(
      public.sgp_picking_piezas(p_token, p_id_programacion, p_produccion)
    ) as x
  )
  select coalesce(jsonb_agg(p.x), '[]'::jsonb)
  from piezas p
  join public.sgp_maestro_piezas m
    on trim(m.codigo_sap) = trim(coalesce(p.x->>'codigo_sap', p.x->>'perfil'))
   and m.activo = 'SI'
   and m.tipo_pieza = 'PANEL';
$function$;
