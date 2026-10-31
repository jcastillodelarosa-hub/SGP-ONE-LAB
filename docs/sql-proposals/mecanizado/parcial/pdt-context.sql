-- Both actual V4 registration and the legacy audit-difference writer retain their real paths.
create view sgp_mecanizado_parcial.contextos_pdt with (security_invoker=true) as
 select id_pendiente,id_entrega from sgp_pdt_multiorigen.detalles
 union all select id_pendiente,id_entrega from sgp_mecanizado_parcial.origenes_pdt;
revoke all on sgp_mecanizado_parcial.contextos_pdt from public,anon,authenticated;
-- Private predicate: preserve the historical finish rule, bind new part evidence to its key and origin.
create function sgp_mecanizado_parcial.material_pdt(p_pendiente uuid,p_entrega uuid,p_acabado text)
returns boolean language sql stable set search_path='' as $$
 select case when pt.id_programacion is null then upper(btrim(mp.acabado))=upper(btrim(p_acabado))
 else pt.key_produccion=p.key_produccion and mp.estado<>'CANCELADA'
  and exists(select 1 from public.sgp_produccion_reservas_v r
   where r.key_produccion=p.key_produccion and r.reserva=p.reserva and r.reserva_principal=mp.reserva
    and (r.acabado_reserva is null or upper(btrim(r.acabado_reserva))=upper(btrim(p_acabado))))
  and not exists(select 1 from sgp_mecanizado_parcial.contextos_pdt src
   join public.sgp_picking_entregas original on original.id_entrega=src.id_entrega
   join sgp_mecanizado_parcial.partes origen on origen.id_programacion=original.id_programacion
   where src.id_pendiente=p.id_pendiente
   and (original.id_entrega=p_entrega or origen.id_programacion<>pt.id_programacion))
 end
 from public.sgp_picking_entregas pe
 join public.sgp_mecanizado_programacion mp using(id_programacion)
 left join sgp_mecanizado_parcial.partes pt using(id_programacion)
 join public.sgp_aluminio_pendientes p on p.id_pendiente=p_pendiente
 where pe.id_entrega=p_entrega
$$;
