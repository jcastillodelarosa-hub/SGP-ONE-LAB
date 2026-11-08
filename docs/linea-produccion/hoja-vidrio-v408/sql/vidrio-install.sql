-- REVIEW ONLY. No data writes. Same signature, owner, grants, role validation and search_path.
BEGIN;
DO $guard$ BEGIN
 IF md5(pg_get_functiondef('public.sgp_detalle_ubicacion_vidrio(text,text)'::regprocedure)) <> '4c851dbf9fd12bac2e42412388f416d2' THEN
 RAISE EXCEPTION 'Glass RPC changed: rebase this scoped delta before installation';
 END IF;
END $guard$;
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
  'produccion',(select to_jsonb(x) from (select p.id,p.produccion,p.sistema,p.cantidad,
    coalesce((select string_agg(distinct nullif(trim(v.datos_origen->>'Orden Oves'),''),' · ' order by nullif(trim(v.datos_origen->>'Orden Oves'),'')) from sgp_vidrio v where v.activo='SI' and v.key_produccion=p_key_produccion),nullif(trim(p.orden_oves),''),(select string_agg(distinct nullif(trim(u.orden_oves),''),' · ' order by nullif(trim(u.orden_oves),'')) from sgp_ubicacion_vidrio_actual u where u.activo=true and u.key_produccion=p_key_produccion)) orden_oves,
    (select string_agg(distinct nullif(trim(v.datos_origen->>'Tipo V'),''),' · ' order by nullif(trim(v.datos_origen->>'Tipo V'),'')) from sgp_vidrio v where v.activo='SI' and v.key_produccion=p_key_produccion) tipo_vidrio
    from sgp_producciones p where p.key_produccion=p_key_produccion limit 1)x),
  'resumen',coalesce((select jsonb_agg(x order by x.orden) from (
    select case when lower(coalesce(estado_orden,''))='preparado' then 'PREPARADO' when lower(coalesce(estado_orden,''))='novedad' then 'NOVEDAD' else 'OTROS' end categoria,
    sum(coalesce(disponible,0)) unidades,count(distinct posicion) burros,
    case when lower(coalesce(estado_orden,''))='preparado' then 1 when lower(coalesce(estado_orden,''))='novedad' then 2 else 3 end orden
    from sgp_ubicacion_vidrio_actual where activo=true and key_produccion=p_key_produccion group by 1,4
  )x),'[]'::jsonb),
  'burros',(select count(distinct posicion) from sgp_ubicacion_vidrio_actual where activo=true and key_produccion=p_key_produccion),
  'unidades',(select coalesce(sum(disponible),0) from sgp_ubicacion_vidrio_actual where activo=true and key_produccion=p_key_produccion),
  'detalle',coalesce((select jsonb_agg(jsonb_build_object('categoria',categoria,'estado',estado_orden,'posicion',posicion,'unidades',unidades,'composiciones',composiciones,
    'piezas',coalesce((select jsonb_agg(jsonb_build_object('unidades',z.unidades,'dimensiones',z.dimensiones,'marca',z.marca) order by z.dimensiones,z.marca) from (
      select u.dimensiones,u.composicion marca,sum(coalesce(u.disponible,0)) unidades
      from sgp_ubicacion_vidrio_actual u
      where u.activo=true and u.key_produccion=p_key_produccion and u.posicion is not distinct from d.posicion
        and (case when lower(coalesce(u.estado_orden,''))='preparado' then 'PREPARADO' when lower(coalesce(u.estado_orden,''))='novedad' then 'NOVEDAD' else 'OTROS' end)=d.categoria
      group by u.dimensiones,u.composicion
    )z),'[]'::jsonb)) order by orden,posicion) from (
    select case when lower(coalesce(estado_orden,''))='preparado' then 'PREPARADO' when lower(coalesce(estado_orden,''))='novedad' then 'NOVEDAD' else 'OTROS' end categoria,
    min(estado_orden) estado_orden,posicion,sum(coalesce(disponible,0)) unidades,string_agg(distinct coalesce(composicion,'—'),' · ' order by coalesce(composicion,'—')) composiciones,
    case when lower(coalesce(estado_orden,''))='preparado' then 1 when lower(coalesce(estado_orden,''))='novedad' then 2 else 3 end orden
    from sgp_ubicacion_vidrio_actual where activo=true and key_produccion=p_key_produccion group by posicion,1,6
  )d),'[]'::jsonb)
 );
end $function$
;
COMMIT;
