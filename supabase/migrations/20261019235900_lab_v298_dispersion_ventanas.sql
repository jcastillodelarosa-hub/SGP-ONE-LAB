-- LAB v295: normalizar reserva principal sólo para presentación y vincular partes por key_produccion.
create or replace function public.sgp_reporte_dispersion_vidrio(p_token text)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
begin
 perform public.sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR','LIDER','CONSULTA']);
 return coalesce((
  select jsonb_agg(to_jsonb(q) order by q.reserva,q.parte,q.produccion,q.posicion)
  from (
   select coalesce(nullif(btrim(split_part(p.reserva_al,',',1)),''),'SIN RESERVA') as reserva,
          p.reserva_al as reservas_origen,
          p.key_produccion,p.id_linea,p.produccion,p.sistema,p.acabado,p.cantidad as ventanas,
          coalesce((select string_agg(distinct pr.prioridad,', ' order by pr.prioridad)
             from public.sgp_prioridades pr
             where pr.key_produccion=p.key_produccion
               and pr.reserva=coalesce(nullif(btrim(split_part(p.reserva_al,',',1)),''),'SIN RESERVA')
               and pr.id_linea=p.id_linea),nullif(p.prioridad_programacion,''),'SIN PARTE') as parte,
          coalesce(nullif(btrim(u.posicion),''),'SIN UBICACIÓN') as posicion,
          sum(coalesce(u.disponible,0)) as unidades,
          coalesce(sum(u.disponible) filter(where lower(coalesce(u.estado_orden,'')) like 'preparado%' and upper(coalesce(u.posicion,'')) not like 'T%' and upper(coalesce(u.posicion,'')) not like 'L%'),0) as preparadas,
          coalesce(sum(u.disponible) filter(where lower(coalesce(u.estado_orden,'')) like 'novedad%' and upper(coalesce(u.posicion,'')) not like 'T%' and upper(coalesce(u.posicion,'')) not like 'L%'),0) as novedad,
          coalesce(sum(u.disponible) filter(where upper(coalesce(u.posicion,'')) like 'T%' or upper(coalesce(u.posicion,'')) like 'L%'),0) as traslado
   from public.sgp_ubicacion_vidrio_actual u
   join public.sgp_producciones p on p.key_produccion=u.key_produccion
   where u.activo=true and coalesce(u.disponible,0)>0
   group by p.reserva_al,p.key_produccion,p.id_linea,p.produccion,p.sistema,p.acabado,p.cantidad,p.prioridad_programacion,coalesce(nullif(btrim(u.posicion),''),'SIN UBICACIÓN')
  ) q
 ),'[]'::jsonb);
end $function$;
revoke all on function public.sgp_reporte_dispersion_vidrio(text) from public;
grant execute on function public.sgp_reporte_dispersion_vidrio(text) to anon,authenticated;
