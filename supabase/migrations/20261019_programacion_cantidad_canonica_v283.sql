-- v283 — cantidad canónica y composición persistida de Programación.
-- Aplicado en Supabase el 2026-10-19 como:
--   lab_v283_cantidad_canonica_programacion
--   lab_v283_programacion_composicion_consumidores
-- Fuente canónica: sgp_producciones.key_produccion + sgp_producciones.cantidad.
-- cantidad_programada se conserva como snapshot histórico.

create table if not exists public.sgp_mecanizado_programacion_detalle (
  id_programacion uuid not null references public.sgp_mecanizado_programacion(id_programacion) on delete cascade,
  key_produccion text not null,
  cantidad_snapshot numeric not null check (cantidad_snapshot >= 0),
  reserva_snapshot text not null,
  prioridad_semanal_snapshot text,
  produccion_snapshot text,
  creado_en timestamptz not null default now(),
  primary key (id_programacion,key_produccion)
);
alter table public.sgp_mecanizado_programacion_detalle enable row level security;
revoke all on public.sgp_mecanizado_programacion_detalle from public,anon,authenticated;

comment on table public.sgp_mecanizado_programacion_detalle is
'Composición inmutable por key_produccion de cada programación. sgp_producciones.cantidad es la fuente canónica actual; cantidad_snapshot conserva auditoría histórica.';

with candidates as (
  select mp.id_programacion,mp.reserva,mp.prioridad_semanal,mp.produccion,mp.cantidad_programada,
         count(*) over(partition by mp.reserva,coalesce(mp.prioridad_semanal,''),coalesce(mp.produccion,'')) nprog
  from public.sgp_mecanizado_programacion mp where mp.estado<>'CANCELADA'
), scope as (
  select c.id_programacion,c.reserva,c.prioridad_semanal,c.produccion,c.cantidad_programada,c.nprog,
         sp.key_produccion,sp.produccion produccion_actual,sp.cantidad
  from candidates c
  join public.sgp_prioridades pr on pr.reserva=c.reserva and pr.id_linea='PANELES_2'
   and (c.prioridad_semanal is null or pr.prioridad=c.prioridad_semanal)
  join public.sgp_producciones sp on sp.key_produccion=pr.key_produccion and sp.id_linea='PANELES_2'
   and (c.produccion is null or sp.produccion=c.produccion)
), exact as (
  select id_programacion from scope
  group by id_programacion,cantidad_programada,nprog
  having nprog=1 and round(sum(coalesce(cantidad,0)))::int=cantidad_programada
)
insert into public.sgp_mecanizado_programacion_detalle(
 id_programacion,key_produccion,cantidad_snapshot,reserva_snapshot,prioridad_semanal_snapshot,produccion_snapshot
)
select s.id_programacion,s.key_produccion,s.cantidad,s.reserva,s.prioridad_semanal,s.produccion_actual
from scope s join exact e using(id_programacion)
on conflict do nothing;

create or replace function public.sgp_mecanizado_cobertura_programacion(p_token text,p_semana integer default null)
returns table(reserva text,prioridad_semanal text,cantidad_canonica integer,cantidad_cubierta integer,
 cantidad_pendiente integer,estado_cobertura text,programaciones integer,detalle_persistido boolean)
language plpgsql security definer set search_path=''
as $$
begin
 perform public.sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO','LIDER','LIDER LINEA','CONSULTA']);
 return query
 with actual as (
   select pr.reserva,pr.prioridad,sum(sp.cantidad)::int cantidad_canonica
   from public.sgp_prioridades pr join public.sgp_producciones sp on sp.key_produccion=pr.key_produccion
   where pr.id_linea='PANELES_2' and sp.id_linea='PANELES_2'
     and (p_semana is null or coalesce(sp.semana_actual,sp.semana_base)=p_semana)
   group by pr.reserva,pr.prioridad
 ), sched as (
   select mp.reserva,mp.prioridad_semanal,count(*)::int programaciones,
          coalesce(sum(mp.cantidad_programada),0)::int snapshot_programado,
          bool_or(exists(select 1 from public.sgp_mecanizado_programacion_detalle d where d.id_programacion=mp.id_programacion)) tiene_detalle
   from public.sgp_mecanizado_programacion mp where mp.estado<>'CANCELADA'
   group by mp.reserva,mp.prioridad_semanal
 ), covered as (
   select mp.reserva,mp.prioridad_semanal,coalesce(sum(sp.cantidad),0)::int cantidad_cubierta
   from public.sgp_mecanizado_programacion mp
   join public.sgp_mecanizado_programacion_detalle d on d.id_programacion=mp.id_programacion
   join public.sgp_producciones sp on sp.key_produccion=d.key_produccion
   where mp.estado<>'CANCELADA' group by mp.reserva,mp.prioridad_semanal
 )
 select a.reserva,a.prioridad,a.cantidad_canonica,
   case when coalesce(s.tiene_detalle,false) then least(a.cantidad_canonica,coalesce(c.cantidad_cubierta,0))
        when coalesce(s.snapshot_programado,0)=a.cantidad_canonica then a.cantidad_canonica
        else least(a.cantidad_canonica,coalesce(s.snapshot_programado,0)) end::int,
   case when coalesce(s.tiene_detalle,false) then greatest(a.cantidad_canonica-coalesce(c.cantidad_cubierta,0),0)
        when coalesce(s.snapshot_programado,0)=a.cantidad_canonica then 0
        else greatest(a.cantidad_canonica-coalesce(s.snapshot_programado,0),0) end::int,
   case when coalesce(s.programaciones,0)=0 then 'SIN_PROGRAMAR'
        when coalesce(s.tiene_detalle,false) and coalesce(c.cantidad_cubierta,0)>=a.cantidad_canonica then 'PROGRAMADA'
        when coalesce(s.tiene_detalle,false) then 'PARCIAL'
        when s.snapshot_programado=a.cantidad_canonica then 'PROGRAMADA_LEGACY'
        else 'LEGACY_REVISAR' end,
   coalesce(s.programaciones,0)::int,coalesce(s.tiene_detalle,false)
 from actual a
 left join sched s on s.reserva=a.reserva and s.prioridad_semanal is not distinct from a.prioridad
 left join covered c on c.reserva=a.reserva and c.prioridad_semanal is not distinct from a.prioridad;
end $$;
revoke all on function public.sgp_mecanizado_cobertura_programacion(text,integer) from public;
grant execute on function public.sgp_mecanizado_cobertura_programacion(text,integer) to anon,authenticated,service_role;

create or replace function public.sgp_mecanizado_programar(
 p_token text,p_reserva text,p_produccion text,p_cantidad integer,p_fecha date,p_turno text,
 p_prioridad integer,p_observacion text,p_observacion_orden text,p_prioridad_semanal text
) returns uuid language plpgsql security definer set search_path=''
as $$
declare u text;rid uuid;v_sistema text;v_acabado text;v_pct numeric;v_vidrio numeric;
 total_disponible integer;total_cubierto integer;v_scope_qty integer;
begin
 u:=public.sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR']);
 with scope as (
   select sp.* from public.sgp_prioridades pr join public.sgp_producciones sp on sp.key_produccion=pr.key_produccion
   where pr.reserva=p_reserva and pr.id_linea='PANELES_2' and sp.id_linea='PANELES_2'
    and (p_prioridad_semanal is null or pr.prioridad=p_prioridad_semanal)
    and (p_produccion is null or sp.produccion=p_produccion)
 ), covered_keys as (
   select distinct d.key_produccion from public.sgp_mecanizado_programacion mp
   join public.sgp_mecanizado_programacion_detalle d on d.id_programacion=mp.id_programacion
   where mp.reserva=p_reserva and mp.estado<>'CANCELADA'
    and mp.prioridad_semanal is not distinct from p_prioridad_semanal
 )
 select coalesce(sum(s.cantidad),0)::int,
        coalesce(sum(s.cantidad) filter(where ck.key_produccion is not null),0)::int
 into total_disponible,total_cubierto from scope s left join covered_keys ck on ck.key_produccion=s.key_produccion;
 if total_cubierto=0 then
   select coalesce(sum(mp.cantidad_programada),0)::int into total_cubierto
   from public.sgp_mecanizado_programacion mp where mp.reserva=p_reserva and mp.estado<>'CANCELADA'
    and mp.prioridad_semanal is not distinct from p_prioridad_semanal
    and (p_produccion is null or mp.produccion=p_produccion);
 end if;
 if p_cantidad<1 or p_cantidad>greatest(total_disponible-total_cubierto,0) then
   raise exception 'Cantidad supera el saldo pendiente por programar (% ventanas)',greatest(total_disponible-total_cubierto,0);
 end if;
 select sp.sistema,sp.acabado,
  case when sum(sp.cantidad)>0 then round(100*sum(least(coalesce(sa.vent_cant_vidrio,0),sp.cantidad))/sum(sp.cantidad),1) else 0 end,
  sum(least(coalesce(sa.vent_cant_vidrio,0),sp.cantidad))
 into v_sistema,v_acabado,v_pct,v_vidrio
 from public.sgp_prioridades pr join public.sgp_producciones sp on sp.key_produccion=pr.key_produccion
 left join public.sgp_seguimiento_aluminio sa on sa.id=sp.id and sa.reserva=p_reserva and coalesce(sa.activo,'SI')='SI' and sa.linea_prog='PANELES 2'
 where pr.reserva=p_reserva and pr.id_linea='PANELES_2' and sp.id_linea='PANELES_2'
  and (p_prioridad_semanal is null or pr.prioridad=p_prioridad_semanal)
  and (p_produccion is null or sp.produccion=p_produccion)
 group by sp.sistema,sp.acabado order by count(*) desc limit 1;
 insert into public.sgp_mecanizado_programacion(
  reserva,produccion,cantidad_programada,fecha_programacion,turno,prioridad,prioridad_semanal,
  observacion,observacion_orden,sistema,acabado,porc_vidrio_snapshot,cant_vidrio_snapshot,usuario_programa
 ) values(p_reserva,p_produccion,p_cantidad,p_fecha,p_turno,p_prioridad,p_prioridad_semanal,
  p_observacion,p_observacion_orden,v_sistema,v_acabado,v_pct,v_vidrio,u) returning id_programacion into rid;
 with already as (
  select distinct d.key_produccion from public.sgp_mecanizado_programacion mp
  join public.sgp_mecanizado_programacion_detalle d on d.id_programacion=mp.id_programacion
  where mp.reserva=p_reserva and mp.id_programacion<>rid and mp.estado<>'CANCELADA'
   and mp.prioridad_semanal is not distinct from p_prioridad_semanal
 ), scope as (
  select sp.key_produccion,sp.cantidad,sp.produccion
  from public.sgp_prioridades pr join public.sgp_producciones sp on sp.key_produccion=pr.key_produccion
  left join already a on a.key_produccion=sp.key_produccion
  where pr.reserva=p_reserva and pr.id_linea='PANELES_2' and sp.id_linea='PANELES_2'
   and (p_prioridad_semanal is null or pr.prioridad=p_prioridad_semanal)
   and (p_produccion is null or sp.produccion=p_produccion) and a.key_produccion is null
 )
 select coalesce(sum(cantidad),0)::int into v_scope_qty from scope;
 if v_scope_qty=p_cantidad then
  insert into public.sgp_mecanizado_programacion_detalle(id_programacion,key_produccion,cantidad_snapshot,reserva_snapshot,prioridad_semanal_snapshot,produccion_snapshot)
  select rid,key_produccion,cantidad,p_reserva,p_prioridad_semanal,produccion from scope;
 else
  delete from public.sgp_mecanizado_programacion where id_programacion=rid;
  raise exception 'La composición canónica pendiente suma % ventanas y no coincide con la cantidad solicitada %. Recargue Programación antes de guardar.',v_scope_qty,p_cantidad;
 end if;
 return rid;
end $$;
revoke all on function public.sgp_mecanizado_programar(text,text,text,integer,date,text,integer,text,text,text) from public;
grant execute on function public.sgp_mecanizado_programar(text,text,text,integer,date,text,integer,text,text,text) to anon,authenticated,service_role;

create or replace function public.sgp_mecanizado_ordenes_programacion(p_token text,p_id_programacion uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_usuario text;v_mp public.sgp_mecanizado_programacion%rowtype;v_json jsonb;v_has_detail boolean;
begin
 v_usuario:=public.sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO','LIDER','LIDER LINEA','CONSULTA']);
 select * into v_mp from public.sgp_mecanizado_programacion where id_programacion=p_id_programacion;
 if not found then return '[]'::jsonb; end if;
 select exists(select 1 from public.sgp_mecanizado_programacion_detalle d where d.id_programacion=p_id_programacion) into v_has_detail;
 if v_has_detail then
  return coalesce((select jsonb_agg(jsonb_build_object(
   'key_produccion',sp.key_produccion,'produccion',sp.produccion,'cantidad',sp.cantidad,'proyecto',sp.proyecto,
   'cliente',sp.cliente,'tipo',sp.tipo,'sistema',sp.sistema,'acabado',sp.acabado,
   'semana',coalesce(sp.semana_actual,sp.semana_base),'reserva_compartida',public.sgp_es_reserva_compartida(sp.key_produccion),
   'reservas_compartidas',public.sgp_reservas_por_produccion_json(sp.key_produccion)) order by sp.produccion)
   from public.sgp_mecanizado_programacion_detalle d join public.sgp_producciones sp on sp.key_produccion=d.key_produccion
   where d.id_programacion=p_id_programacion
    and not exists(select 1 from public.sgp_mecanizado_reprogramaciones r where r.id_origen=p_id_programacion and r.produccion=sp.produccion)),'[]'::jsonb);
 end if;
 select public.sgp_mecanizado_detalle_reserva(p_token,v_mp.reserva,v_mp.prioridad_semanal) into v_json;
 return coalesce((select jsonb_agg(o.value order by o.value->>'produccion')
  from jsonb_array_elements(coalesce(v_json,'[]'::jsonb)) o
  where (v_mp.produccion is null or o.value->>'produccion'=v_mp.produccion)
   and not exists(select 1 from public.sgp_mecanizado_reprogramaciones r where r.id_origen=p_id_programacion and r.produccion=o.value->>'produccion')),'[]'::jsonb);
end $$;
revoke all on function public.sgp_mecanizado_ordenes_programacion(text,uuid) from public;
grant execute on function public.sgp_mecanizado_ordenes_programacion(text,uuid) to anon,authenticated,service_role;

create or replace function public.sgp_mecanizado_pendientes_turno(p_token text,p_fecha date,p_turno text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_usuario text;v_inicio timestamptz;v_habilitado timestamptz;v_ahora timestamptz:=now();
begin
 v_usuario:=public.sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO','LIDER','LIDER LINEA','CONSULTA']);
 if upper(trim(p_turno)) not in ('TURNO 1','TURNO 2') then raise exception 'Turno no válido'; end if;
 v_inicio:=(p_fecha::text||case when upper(trim(p_turno))='TURNO 1' then ' 07:00 America/Bogota' else ' 19:00 America/Bogota' end)::timestamptz;
 v_habilitado:=v_inicio+interval '5 minutes'; if v_ahora<v_habilitado then return '[]'::jsonb; end if;
 return coalesce((
 with legacy_scope as (
  select mp.id_programacion,sp.key_produccion from public.sgp_mecanizado_programacion mp
  join public.sgp_prioridades pr on pr.reserva=mp.reserva and pr.id_linea='PANELES_2'
   and (mp.prioridad_semanal is null or pr.prioridad=mp.prioridad_semanal)
  join public.sgp_producciones sp on sp.key_produccion=pr.key_produccion and sp.id_linea='PANELES_2'
   and (mp.produccion is null or mp.produccion=sp.produccion)
  where not exists(select 1 from public.sgp_mecanizado_programacion_detalle d where d.id_programacion=mp.id_programacion)
 ), scope as (
  select d.id_programacion,d.key_produccion from public.sgp_mecanizado_programacion_detalle d
  union all select l.id_programacion,l.key_produccion from legacy_scope l
 ), base as (
  select mp.id_programacion,mp.reserva,coalesce(mp.prioridad_semanal,pr.prioridad) prioridad_semanal,mp.sistema,mp.acabado,mp.fecha_programacion,mp.turno,
   sp.key_produccion,sp.produccion,sp.proyecto,sp.cliente,sp.tipo,round(coalesce(sp.cantidad,0))::int cantidad,
   coalesce(sp.semana_actual,sp.semana_base)::int semana,public.sgp_es_reserva_compartida(sp.key_produccion) reserva_compartida,
   public.sgp_reservas_por_produccion_json(sp.key_produccion) reservas_compartidas,
   coalesce(eo.estado,me.estado,'PROGRAMADA') estado_actual,eo.observacion,
   (select min(h.fecha_evento) from public.sgp_mecanizado_historial_orden h where h.id_programacion=mp.id_programacion and h.produccion=sp.produccion and h.estado_nuevo='PROCESADO') procesado_en,
   (select max(h.fecha_evento) from public.sgp_mecanizado_historial_orden h where h.id_programacion=mp.id_programacion and h.produccion=sp.produccion and h.estado_nuevo='REPROGRAMADO') reprogramado_en,
   (select min(r.creado_en) from public.sgp_mecanizado_reprogramaciones r where r.id_origen=mp.id_programacion and r.produccion=sp.produccion) movido_en
  from public.sgp_mecanizado_programacion mp join scope sc on sc.id_programacion=mp.id_programacion
  join public.sgp_producciones sp on sp.key_produccion=sc.key_produccion
  left join public.sgp_prioridades pr on pr.key_produccion=sp.key_produccion and pr.reserva=mp.reserva and pr.id_linea='PANELES_2'
  left join public.sgp_mecanizado_ejecucion me on me.id_programacion=mp.id_programacion
  left join public.sgp_mecanizado_ejecucion_orden eo on eo.id_programacion=mp.id_programacion and eo.produccion=sp.produccion
  where (mp.fecha_programacion::text||case when upper(trim(mp.turno))='TURNO 1' then ' 07:00 America/Bogota' else ' 19:00 America/Bogota' end)::timestamptz<v_inicio
   and mp.estado<>'CANCELADA'
 ), eligible as (
  select *,row_number() over(partition by reserva,produccion order by fecha_programacion desc,
   case when upper(trim(turno))='TURNO 2' then 2 else 1 end desc,id_programacion desc) rn
  from base where estado_actual<>'PROCESADO' and procesado_en is null
   and (movido_en is null or movido_en>=v_inicio) and (reprogramado_en is null or reprogramado_en>=v_inicio)
 )
 select jsonb_agg(jsonb_build_object(
  'id_programacion_origen',id_programacion,'reserva',reserva,'key_produccion',key_produccion,'produccion',produccion,
  'proyecto',coalesce(proyecto,cliente),'tipo',coalesce(tipo,''),'cantidad',cantidad,'semana',semana,
  'prioridad_semanal',prioridad_semanal,'sistema',sistema,'acabado',acabado,'estado',estado_actual,'observacion',observacion,
  'reserva_compartida',reserva_compartida,'reservas_compartidas',reservas_compartidas,
  'turno_origen',turno,'fecha_origen',fecha_programacion,'arrastre',true,'culminado_en_turno',false,'fecha_culminacion',null)
  order by fecha_programacion,turno,reserva,produccion) from eligible where rn=1
 ),'[]'::jsonb);
end $$;
revoke all on function public.sgp_mecanizado_pendientes_turno(text,date,text) from public;
grant execute on function public.sgp_mecanizado_pendientes_turno(text,date,text) to anon,authenticated,service_role;
