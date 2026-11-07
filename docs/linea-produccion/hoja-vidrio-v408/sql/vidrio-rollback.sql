CREATE OR REPLACE FUNCTION public.sgp_detalle_ubicacion_vidrio(p_token text, p_key_produccion text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_user text;
begin
 v_user:=public.sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR','LIDER','CONSULTA']);
 return jsonb_build_object(
  'produccion',(select to_jsonb(x) from (select id,produccion,sistema,cantidad from sgp_producciones where key_produccion=p_key_produccion limit 1)x),
  'resumen',coalesce((select jsonb_agg(x order by x.orden) from (
    select case when lower(coalesce(estado_orden,''))='preparado' then 'PREPARADO' when lower(coalesce(estado_orden,''))='novedad' then 'NOVEDAD' else 'OTROS' end categoria,
    sum(coalesce(disponible,0)) unidades,count(distinct posicion) burros,
    case when lower(coalesce(estado_orden,''))='preparado' then 1 when lower(coalesce(estado_orden,''))='novedad' then 2 else 3 end orden
    from sgp_ubicacion_vidrio_actual where activo=true and key_produccion=p_key_produccion group by 1,4
  )x),'[]'::jsonb),
  'burros',(select count(distinct posicion) from sgp_ubicacion_vidrio_actual where activo=true and key_produccion=p_key_produccion),
  'unidades',(select coalesce(sum(disponible),0) from sgp_ubicacion_vidrio_actual where activo=true and key_produccion=p_key_produccion),
  'detalle',coalesce((select jsonb_agg(jsonb_build_object('categoria',categoria,'estado',estado_orden,'posicion',posicion,'unidades',unidades,'composiciones',composiciones) order by orden,posicion) from (
    select case when lower(coalesce(estado_orden,''))='preparado' then 'PREPARADO' when lower(coalesce(estado_orden,''))='novedad' then 'NOVEDAD' else 'OTROS' end categoria,
    min(estado_orden) estado_orden,posicion,sum(coalesce(disponible,0)) unidades,string_agg(distinct coalesce(composicion,'—'),' · ' order by coalesce(composicion,'—')) composiciones,
    case when lower(coalesce(estado_orden,''))='preparado' then 1 when lower(coalesce(estado_orden,''))='novedad' then 2 else 3 end orden
    from sgp_ubicacion_vidrio_actual where activo=true and key_produccion=p_key_produccion group by posicion,1,6
  )d),'[]'::jsonb)
 );
end $function$
;
