begin read only;
with mapped as (
 select f.id_faltante,f.id_entrega,e.estado,count(distinct p.id_pendiente) as candidates
 from public.sgp_picking_faltantes f join public.sgp_picking_entregas e using(id_entrega)
 left join public.sgp_aluminio_pendientes p on p.id_pieza is not distinct from f.id_pieza
 and p.reserva=coalesce(f.reserva_pendiente,p.reserva)
 and exists(select 1 from sgp_mecanizado_parcial.contextos_pdt c where c.id_pendiente=p.id_pendiente and c.id_entrega=f.id_entrega)
 group by f.id_faltante,f.id_entrega,e.estado
), active as (
 select p.contrato_pdt,count(*) total,count(*) filter(where not exists(select 1 from sgp_mecanizado_parcial.contextos_pdt c where c.id_pendiente=p.id_pendiente)) sin_vinculo
 from public.sgp_aluminio_pendientes p where p.estado='PENDIENTE' and p.origen in ('PICKING','PICKING_AUDITORIA') group by p.contrato_pdt
)
select jsonb_build_object('captured_at',clock_timestamp(),'project','ocvxbwzqxbrfndkvjmfx',
'faltantes_total',(select count(*) from mapped),
'faltantes_sin_origen',(select count(*) from mapped where candidates=0),
'faltantes_ambiguos',(select count(*) from mapped where candidates>1),
'entregas_bloqueadas_total',(select count(distinct id_entrega) from mapped where candidates<>1),
'entregas_por_auditar_bloqueadas',(select count(distinct id_entrega) from mapped where candidates<>1 and estado='PENDIENTE_VALIDACION'),
'faltantes_por_auditar_sin_origen',(select count(*) from mapped where candidates=0 and estado='PENDIENTE_VALIDACION'),
'faltantes_por_auditar_ambiguos',(select count(*) from mapped where candidates>1 and estado='PENDIENTE_VALIDACION'),
'pendientes_picking_activos_por_contrato',(select jsonb_agg(to_jsonb(a)) from active a)) as counts;
rollback;
