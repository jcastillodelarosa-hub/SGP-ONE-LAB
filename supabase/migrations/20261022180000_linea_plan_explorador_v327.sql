create or replace function public.sgp_linea_plan_explorador_v327(p_token text,p_semana integer,p_linea text default 'PANELES_2') returns jsonb language plpgsql security definer set search_path to 'public' as $body$
begin
 perform public.sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR','LIDER','LIDER MECANIZADO','CONSULTA']);
 if p_semana is null or p_semana not between 1 and 53 then raise exception 'SEMANA_INVALIDA'; end if;
 if p_linea not in ('PANELES_2','FRAMES_2') then raise exception 'LINEA_INVALIDA'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('key_produccion',p.key_produccion,'parte',d.parte,'vidrio_preparado',v.vidrio_preparado,'vidrio_novedad',v.vidrio_novedad,'vidrio_traslado',v.vidrio_traslado))
 from public.sgp_producciones p
 left join public.sgp_vidrio_resumen_produccion v on v.key_produccion=p.key_produccion
 left join lateral (select case when count(distinct nullif(trim(x.prioridad_semanal_snapshot),''))=1 then max(nullif(trim(x.prioridad_semanal_snapshot),'')) end parte from public.sgp_mecanizado_programacion_detalle x where x.key_produccion=p.key_produccion) d on true
 where p.id_linea=p_linea and p.activa='SI' and coalesce(p.semana_actual,p.semana_base)=p_semana),'[]'::jsonb);
end $body$;
