-- v284 — cobertura de Programación por key_produccion.
-- Aplicado en Supabase como lab_v284_cobertura_ordenes_base,
-- lab_v284_reconciliar_programacion_legacy y lab_v284_backfill_evidencia_ejecucion.
-- Regla: no inferir órdenes pendientes por diferencia de cantidades.

alter table public.sgp_mecanizado_programacion_detalle
  add column if not exists origen text not null default 'CANONICA';

create or replace function public.sgp_mecanizado_cobertura_ordenes(p_token text,p_semana integer default null)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform public.sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO','LIDER','LIDER LINEA','CONSULTA']);
 return coalesce((with a as (
  select pr.reserva,pr.prioridad,sp.key_produccion,sp.produccion,round(coalesce(sp.cantidad,0))::int cantidad
  from public.sgp_prioridades pr join public.sgp_producciones sp on sp.key_produccion=pr.key_produccion
  where pr.id_linea='PANELES_2' and sp.id_linea='PANELES_2' and (p_semana is null or coalesce(sp.semana_actual,sp.semana_base)=p_semana)
 ), p as (
  select mp.reserva,mp.prioridad_semanal,count(*)::int n,
   count(*) filter(where exists(select 1 from public.sgp_mecanizado_programacion_detalle d where d.id_programacion=mp.id_programacion))::int nd,
   min(mp.id_programacion::text)::uuid legacy_id
  from public.sgp_mecanizado_programacion mp where mp.estado<>'CANCELADA' group by mp.reserva,mp.prioridad_semanal
 ), c as (
  select distinct mp.reserva,mp.prioridad_semanal,d.key_produccion,d.id_programacion,d.origen
  from public.sgp_mecanizado_programacion mp join public.sgp_mecanizado_programacion_detalle d on d.id_programacion=mp.id_programacion where mp.estado<>'CANCELADA'
 )
 select jsonb_agg(jsonb_build_object('reserva',a.reserva,'prioridad_semanal',a.prioridad,'key_produccion',a.key_produccion,'produccion',a.produccion,'cantidad',a.cantidad,
 'estado_orden',case when c.key_produccion is not null then 'PROGRAMADA' when coalesce(p.n,0)=0 or coalesce(p.nd,0)>0 then 'PENDIENTE' else 'REVISAR' end,
 'id_programacion',c.id_programacion,'origen_cobertura',c.origen,'id_programacion_legacy',case when coalesce(p.n,0)=1 and coalesce(p.nd,0)=0 then p.legacy_id else null end,
 'reconciliable',coalesce(p.n,0)=1 and coalesce(p.nd,0)=0) order by a.reserva,a.prioridad,a.produccion)
 from a left join p on p.reserva=a.reserva and p.prioridad_semanal is not distinct from a.prioridad
 left join c on c.reserva=a.reserva and c.prioridad_semanal is not distinct from a.prioridad and c.key_produccion=a.key_produccion),'[]'::jsonb);
end $$;
revoke all on function public.sgp_mecanizado_cobertura_ordenes(text,integer) from public;
grant execute on function public.sgp_mecanizado_cobertura_ordenes(text,integer) to anon,authenticated,service_role;

create or replace function public.sgp_mecanizado_reconciliar_programacion_legacy(p_token text,p_id_programacion uuid,p_keys_programadas text[])
returns jsonb language plpgsql security definer set search_path='' as $$
declare u text;m public.sgp_mecanizado_programacion%rowtype;bad int;n int;
begin
 u:=public.sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR']);
 select * into m from public.sgp_mecanizado_programacion where id_programacion=p_id_programacion and estado<>'CANCELADA';
 if not found then raise exception 'Programación histórica no encontrada o cancelada'; end if;
 if exists(select 1 from public.sgp_mecanizado_programacion_detalle where id_programacion=p_id_programacion) then raise exception 'La programación ya fue reconciliada'; end if;
 if p_keys_programadas is null or cardinality(p_keys_programadas)=0 then raise exception 'Seleccione al menos una orden histórica'; end if;
 select count(*) into bad from unnest(p_keys_programadas) k where not exists(select 1 from public.sgp_prioridades pr join public.sgp_producciones sp on sp.key_produccion=pr.key_produccion where sp.key_produccion=k and pr.reserva=m.reserva and pr.id_linea='PANELES_2' and sp.id_linea='PANELES_2' and pr.prioridad is not distinct from m.prioridad_semanal);
 if bad>0 then raise exception 'Hay órdenes fuera de la reserva/parte'; end if;
 insert into public.sgp_mecanizado_programacion_detalle(id_programacion,key_produccion,cantidad_snapshot,reserva_snapshot,prioridad_semanal_snapshot,produccion_snapshot,origen)
 select m.id_programacion,sp.key_produccion,sp.cantidad,m.reserva,m.prioridad_semanal,sp.produccion,'RECONCILIADA_USUARIO'
 from public.sgp_producciones sp where sp.key_produccion=any(p_keys_programadas) on conflict do nothing;
 get diagnostics n=row_count;
 return jsonb_build_object('id_programacion',m.id_programacion,'ordenes_reconciliadas',n,'usuario',u);
end $$;
revoke all on function public.sgp_mecanizado_reconciliar_programacion_legacy(text,uuid,text[]) from public;
grant execute on function public.sgp_mecanizado_reconciliar_programacion_legacy(text,uuid,text[]) to anon,authenticated,service_role;

-- El backfill aplicado en vivo solo incorporó programaciones donde TODAS las órdenes
-- actuales tenían evidencia inequívoca en ejecución/historial para el mismo id_programacion.
