-- LAB v294: lectura de distribución de vidrio por reserva, orden y ubicación.
-- Sólo lectura, acceso sujeto a sesión funcional. key_produccion preserva la línea.
create or replace function public.sgp_reporte_dispersion_vidrio(p_token text)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
begin
 perform public.sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR','LIDER','CONSULTA']);
 return coalesce((
  select jsonb_agg(to_jsonb(q) order by q.reserva,q.produccion,q.posicion)
  from (
   select coalesce(p.reserva_al,'SIN RESERVA') as reserva,
          p.key_produccion,p.id_linea,p.produccion,
          coalesce(nullif(btrim(u.posicion),''),'SIN UBICACIÓN') as posicion,
          sum(coalesce(u.disponible,0)) as unidades,
          coalesce(sum(u.disponible) filter(where lower(coalesce(u.estado_orden,'')) like 'preparado%' and upper(coalesce(u.posicion,'')) not like 'T%' and upper(coalesce(u.posicion,'')) not like 'L%'),0) as preparadas,
          coalesce(sum(u.disponible) filter(where lower(coalesce(u.estado_orden,'')) like 'novedad%' and upper(coalesce(u.posicion,'')) not like 'T%' and upper(coalesce(u.posicion,'')) not like 'L%'),0) as novedad,
          coalesce(sum(u.disponible) filter(where upper(coalesce(u.posicion,'')) like 'T%' or upper(coalesce(u.posicion,'')) like 'L%'),0) as traslado
   from public.sgp_ubicacion_vidrio_actual u
   join public.sgp_producciones p on p.key_produccion=u.key_produccion
   where u.activo=true and coalesce(u.disponible,0)>0
   group by p.reserva_al,p.key_produccion,p.id_linea,p.produccion,coalesce(nullif(btrim(u.posicion),''),'SIN UBICACIÓN')
  ) q
 ),'[]'::jsonb);
end $function$;
revoke all on function public.sgp_reporte_dispersion_vidrio(text) from public;
grant execute on function public.sgp_reporte_dispersion_vidrio(text) to anon,authenticated;
