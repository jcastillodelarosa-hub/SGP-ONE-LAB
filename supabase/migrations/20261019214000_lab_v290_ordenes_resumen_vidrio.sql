-- LAB v290: datos de vidrio desde el resumen sincronizado por ID+línea.
CREATE OR REPLACE FUNCTION public.sgp_mecanizado_ordenes_programacion(p_token text, p_id_programacion uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_usuario text; v_mp public.sgp_mecanizado_programacion%rowtype; v_json jsonb; v_has_detail boolean;
begin
 v_usuario:=public.sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO','LIDER','LIDER LINEA','CONSULTA']);
 select * into v_mp from public.sgp_mecanizado_programacion where id_programacion=p_id_programacion;
 if not found then return '[]'::jsonb; end if;
 select exists(select 1 from public.sgp_mecanizado_programacion_detalle d where d.id_programacion=p_id_programacion) into v_has_detail;
 if v_has_detail then
   return coalesce((
     select jsonb_agg(jsonb_build_object(
       'key_produccion',sp.key_produccion,'produccion',sp.produccion,'cantidad',sp.cantidad,
       'proyecto',sp.proyecto,'cliente',sp.cliente,'tipo',sp.tipo,'sistema',sp.sistema,'acabado',sp.acabado,
       'semana',coalesce(sp.semana_actual,sp.semana_base),
       'vidrio_preparado',coalesce(g.vidrio_preparado,0)::integer,
       'vidrio_novedad',coalesce(g.vidrio_novedad,0)::integer,
       'vidrio_traslado',coalesce(g.vidrio_traslado,0)::integer,
       'reserva_compartida',public.sgp_es_reserva_compartida(sp.key_produccion),
       'reservas_compartidas',public.sgp_reservas_por_produccion_json(sp.key_produccion)
     ) order by sp.produccion)
     from public.sgp_mecanizado_programacion_detalle d
     join public.sgp_producciones sp on sp.key_produccion=d.key_produccion
     left join public.sgp_vidrio_resumen_produccion g on g.key_produccion=sp.key_produccion
     where d.id_programacion=p_id_programacion
       and not exists(select 1 from public.sgp_mecanizado_reprogramaciones r where r.id_origen=p_id_programacion and r.produccion=sp.produccion)
   ),'[]'::jsonb);
 end if;
 select public.sgp_mecanizado_detalle_reserva(p_token,v_mp.reserva,v_mp.prioridad_semanal) into v_json;
 return coalesce((
   select jsonb_agg(o.value order by o.value->>'produccion')
   from jsonb_array_elements(coalesce(v_json,'[]'::jsonb)) o
   where (v_mp.produccion is null or o.value->>'produccion'=v_mp.produccion)
     and not exists(select 1 from public.sgp_mecanizado_reprogramaciones r where r.id_origen=p_id_programacion and r.produccion=o.value->>'produccion')
 ),'[]'::jsonb);
end $function$
;
