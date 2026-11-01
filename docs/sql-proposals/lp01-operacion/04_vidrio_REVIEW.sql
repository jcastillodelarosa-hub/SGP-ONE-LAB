-- PROPUESTA. Misma RPC y permisos; clasifica como sgp_reporte_dispersion_vidrio vigente.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $$ BEGIN IF md5(pg_get_functiondef('public.sgp_detalle_ubicacion_vidrio(text,text)'::regprocedure))<>'4c851dbf9fd12bac2e42412388f416d2' THEN RAISE EXCEPTION 'VIDRIO_CAMBIO_REVISAR_COMPATIBILIDAD'; END IF; END $$;
CREATE OR REPLACE FUNCTION public.sgp_detalle_ubicacion_vidrio(p_token text, p_key_produccion text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_user text;
begin
 v_user:=public.sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR','LIDER','CONSULTA']);
 return jsonb_build_object('categorias_version',2,
  'produccion',(select to_jsonb(x) from (select id,produccion,sistema,cantidad from sgp_producciones where key_produccion=p_key_produccion limit 1)x),
  'resumen',coalesce((select jsonb_agg(x order by x.orden) from (
    select case when upper(coalesce(posicion,'')) like 'T%' or upper(coalesce(posicion,'')) like 'L%' then 'TRASLADO' when lower(coalesce(estado_orden,'')) like 'preparado%' then 'PREPARADO' when lower(coalesce(estado_orden,'')) like 'novedad%' then 'NOVEDAD' else 'OTROS' end categoria,
    sum(coalesce(disponible,0)) unidades,count(distinct posicion) burros,
    case when upper(coalesce(posicion,'')) like 'T%' or upper(coalesce(posicion,'')) like 'L%' then 3 when lower(coalesce(estado_orden,'')) like 'preparado%' then 1 when lower(coalesce(estado_orden,'')) like 'novedad%' then 2 else 4 end orden
    from sgp_ubicacion_vidrio_actual where activo=true and key_produccion=p_key_produccion group by 1,4
  )x),'[]'::jsonb),
  'burros',(select count(distinct posicion) from sgp_ubicacion_vidrio_actual where activo=true and key_produccion=p_key_produccion),
  'unidades',(select coalesce(sum(disponible),0) from sgp_ubicacion_vidrio_actual where activo=true and key_produccion=p_key_produccion),
  'detalle',coalesce((select jsonb_agg(jsonb_build_object('categoria',categoria,'estado',estado_orden,'posicion',posicion,'unidades',unidades,'composiciones',composiciones) order by orden,posicion) from (
    select case when upper(coalesce(posicion,'')) like 'T%' or upper(coalesce(posicion,'')) like 'L%' then 'TRASLADO' when lower(coalesce(estado_orden,'')) like 'preparado%' then 'PREPARADO' when lower(coalesce(estado_orden,'')) like 'novedad%' then 'NOVEDAD' else 'OTROS' end categoria,
    min(estado_orden) estado_orden,posicion,sum(coalesce(disponible,0)) unidades,string_agg(distinct coalesce(composicion,'—'),' · ' order by coalesce(composicion,'—')) composiciones,
    case when upper(coalesce(posicion,'')) like 'T%' or upper(coalesce(posicion,'')) like 'L%' then 3 when lower(coalesce(estado_orden,'')) like 'preparado%' then 1 when lower(coalesce(estado_orden,'')) like 'novedad%' then 2 else 4 end orden
    from sgp_ubicacion_vidrio_actual where activo=true and key_produccion=p_key_produccion group by posicion,1,6
  )d),'[]'::jsonb)
 );
end $function$
;
COMMIT;
