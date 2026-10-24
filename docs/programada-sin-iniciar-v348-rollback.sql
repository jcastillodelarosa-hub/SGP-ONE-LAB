-- SGP_ONE LAB v348 - referencia de reversión SOLO si se necesita volver a v347.
-- Uso manual con respaldo previo y aprobación; ejecutar tras revertir frontend.
-- Fuente: definiciones RPC originales consultadas en Supabase antes de migrar, 2026-10-24.
-- Esta reversión no elimina datos de programación, detalle, reprogramación ni historial.
BEGIN;
SET LOCAL lock_timeout = '2s';
DO $guard$
BEGIN
 IF EXISTS(SELECT 1 FROM public.sgp_mecanizado_ejecucion WHERE estado='SIN INICIAR') THEN
  RAISE EXCEPTION 'Reversión detenida: existen registros de ejecución general SIN INICIAR posteriores a v348. Conciliar antes de revertir.';
 END IF;
END $guard$;

UPDATE public.sgp_mecanizado_programacion SET estado='PROGRAMADA' WHERE estado='SIN INICIAR';
UPDATE public.sgp_mecanizado_ejecucion_orden SET estado='PROGRAMADA' WHERE estado='SIN INICIAR';
ALTER TABLE public.sgp_mecanizado_ejecucion ALTER COLUMN estado SET DEFAULT 'CORTE';
ALTER TABLE public.sgp_mecanizado_ejecucion DROP CONSTRAINT IF EXISTS sgp_mecanizado_ejecucion_estado_check;
ALTER TABLE public.sgp_mecanizado_ejecucion ADD CONSTRAINT sgp_mecanizado_ejecucion_estado_check CHECK (estado IN ('PICKING','CORTE','MECANIZADO','PROCESADO','REPROGRAMADO'));
ALTER TABLE public.sgp_mecanizado_ejecucion_orden ALTER COLUMN estado SET DEFAULT 'PROGRAMADA';
ALTER TABLE public.sgp_mecanizado_ejecucion_orden DROP CONSTRAINT IF EXISTS sgp_mecanizado_ejecucion_orden_estado_check;
ALTER TABLE public.sgp_mecanizado_ejecucion_orden ADD CONSTRAINT sgp_mecanizado_ejecucion_orden_estado_check CHECK (estado IN ('PROGRAMADA','PICKING','CORTE','MECANIZADO','PROCESADO','REPROGRAMADO'));
ALTER TABLE public.sgp_mecanizado_programacion ALTER COLUMN estado SET DEFAULT 'PROGRAMADA';
DROP TRIGGER IF EXISTS trg_sgp_mecanizado_programada_insert ON public.sgp_mecanizado_programacion;
DROP TRIGGER IF EXISTS trg_sgp_mecanizado_programada_update ON public.sgp_mecanizado_programacion;
DROP FUNCTION IF EXISTS public.sgp_mecanizado_programada_al_insertar();
DROP FUNCTION IF EXISTS public.sgp_mecanizado_programada_al_actualizar();
ALTER TABLE public.sgp_mecanizado_programacion DROP COLUMN IF EXISTS programada;

-- Restaurar RPC original sgp_mecanizado_guardar_estado_orden
CREATE OR REPLACE FUNCTION public.sgp_mecanizado_guardar_estado_orden(p_token text, p_id_programacion uuid, p_produccion text, p_estado text, p_observacion text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare u text; old_state text;
begin
 u:=sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO','LIDER','LIDER LINEA']);
 select estado into old_state from sgp_mecanizado_ejecucion_orden where id_programacion=p_id_programacion and produccion=p_produccion;
 insert into sgp_mecanizado_ejecucion_orden(id_programacion,produccion,estado,observacion,usuario,actualizado_en)
 values(p_id_programacion,p_produccion,p_estado,p_observacion,u,now())
 on conflict(id_programacion,produccion) do update set estado=excluded.estado,observacion=coalesce(excluded.observacion,sgp_mecanizado_ejecucion_orden.observacion),usuario=excluded.usuario,actualizado_en=now();
 if old_state is distinct from p_estado or p_observacion is not null then
  insert into sgp_mecanizado_historial_orden(id_programacion,produccion,estado_anterior,estado_nuevo,observacion,usuario)
  values(p_id_programacion,p_produccion,old_state,p_estado,p_observacion,u);
 end if;
 return true;
end $function$;

-- Restaurar RPC original sgp_mecanizado_pendientes_turno
CREATE OR REPLACE FUNCTION public.sgp_mecanizado_pendientes_turno(p_token text, p_fecha date, p_turno text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_usuario text; v_inicio timestamptz; v_habilitado timestamptz; v_fin timestamptz; v_activado timestamptz; v_ahora timestamptz:=now();
begin
 v_usuario:=public.sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO','LIDER','LIDER LINEA','CONSULTA']);
 if upper(trim(p_turno)) not in ('TURNO 1','TURNO 2') then raise exception 'Turno no válido'; end if;
 v_inicio:=(p_fecha::text||case when upper(trim(p_turno))='TURNO 1' then ' 07:00 America/Bogota' when extract(isodow from p_fecha)=7 then ' 18:00 America/Bogota' else ' 19:00 America/Bogota' end)::timestamptz;
 v_habilitado:=v_inicio+interval '5 minutes';
 -- End of the requested shift, including the different Sunday schedule.
 v_fin := case
   when upper(trim(p_turno))='TURNO 1' and extract(isodow from p_fecha)=7
     then (p_fecha::text||' 18:00 America/Bogota')::timestamptz
   when upper(trim(p_turno))='TURNO 1'
     then (p_fecha::text||' 19:00 America/Bogota')::timestamptz
   when extract(isodow from p_fecha)=7
     then ((p_fecha+1)::text||' 05:00 America/Bogota')::timestamptz
   else ((p_fecha+1)::text||' 07:00 America/Bogota')::timestamptz
 end;
 select activado_en into strict v_activado from public.sgp_mecanizado_arrastre_activacion where id=true;
 if v_ahora<v_habilitado then return '[]'::jsonb; end if;
 return coalesce((
 with legacy_scope as (
   select mp.id_programacion,sp.key_produccion
   from public.sgp_mecanizado_programacion mp
   join public.sgp_prioridades pr on pr.reserva=mp.reserva and pr.id_linea='PANELES_2'
     and (mp.prioridad_semanal is null or pr.prioridad=mp.prioridad_semanal)
   join public.sgp_producciones sp on sp.key_produccion=pr.key_produccion and sp.id_linea='PANELES_2'
     and (mp.produccion is null or mp.produccion=sp.produccion)
   where not exists(select 1 from public.sgp_mecanizado_programacion_detalle d where d.id_programacion=mp.id_programacion)
 ), scope as (
   select d.id_programacion,d.key_produccion from public.sgp_mecanizado_programacion_detalle d
   union all
   select l.id_programacion,l.key_produccion from legacy_scope l
 ), base as (
  select mp.id_programacion,mp.reserva,coalesce(mp.prioridad_semanal,pr.prioridad) prioridad_semanal,mp.sistema,mp.acabado,mp.fecha_programacion,mp.turno,
   sp.key_produccion,sp.produccion,sp.proyecto,sp.cliente,sp.tipo,round(coalesce(sp.cantidad,0))::int cantidad,
   coalesce(sp.semana_actual,sp.semana_base)::int semana,
   public.sgp_es_reserva_compartida(sp.key_produccion) reserva_compartida,
   public.sgp_reservas_por_produccion_json(sp.key_produccion) reservas_compartidas,
   coalesce(eo.estado,me.estado,'PROGRAMADA') estado_actual,eo.observacion,
   (select max(h.fecha_evento) from public.sgp_mecanizado_historial_orden h where h.id_programacion=mp.id_programacion and h.produccion=sp.produccion and h.estado_nuevo='PROCESADO') procesado_en,
   (select max(h.fecha_evento) from public.sgp_mecanizado_historial_orden h where h.id_programacion=mp.id_programacion and h.produccion=sp.produccion and h.estado_nuevo='REPROGRAMADO') reprogramado_en,
   (select min(r.creado_en) from public.sgp_mecanizado_reprogramaciones r where r.id_origen=mp.id_programacion and r.produccion=sp.produccion) movido_en
  from public.sgp_mecanizado_programacion mp
  join scope sc on sc.id_programacion=mp.id_programacion
  join public.sgp_producciones sp on sp.key_produccion=sc.key_produccion
  left join public.sgp_prioridades pr on pr.key_produccion=sp.key_produccion and pr.reserva=mp.reserva and pr.id_linea='PANELES_2'
  left join public.sgp_mecanizado_ejecucion me on me.id_programacion=mp.id_programacion
  left join public.sgp_mecanizado_ejecucion_orden eo on eo.id_programacion=mp.id_programacion and eo.produccion=sp.produccion
  where (mp.fecha_programacion::text||case when upper(trim(mp.turno))='TURNO 1' then ' 07:00 America/Bogota' else ' 19:00 America/Bogota' end)::timestamptz < v_inicio
    and mp.estado<>'CANCELADA'
 ), eligible as (
  select *,row_number() over(partition by reserva,key_produccion order by fecha_programacion desc,case when upper(trim(turno))='TURNO 2' then 2 else 1 end desc,id_programacion desc) rn
  from base where (
      ((procesado_en is null and estado_actual<>'PROCESADO')
       and (movido_en is null or movido_en>=v_inicio)
       and (reprogramado_en is null or reprogramado_en>=v_inicio))
      or (procesado_en>=greatest(v_inicio,v_activado) and procesado_en<v_fin)
    )
 )
 select jsonb_agg(jsonb_build_object(
   'id_programacion_origen',id_programacion,'reserva',reserva,'key_produccion',key_produccion,'produccion',produccion,
   'proyecto',coalesce(proyecto,cliente),'tipo',coalesce(tipo,''),'cantidad',cantidad,'semana',semana,
   'prioridad_semanal',prioridad_semanal,'sistema',sistema,'acabado',acabado,'estado',case when procesado_en>=greatest(v_inicio,v_activado) and procesado_en<v_fin then 'PROCESADO' else estado_actual end,'observacion',observacion,
   'reserva_compartida',reserva_compartida,'reservas_compartidas',reservas_compartidas,
   'turno_origen',turno,'fecha_origen',fecha_programacion,'arrastre',true,'culminado_en_turno',(procesado_en>=greatest(v_inicio,v_activado) and procesado_en<v_fin),'fecha_culminacion',case when procesado_en>=greatest(v_inicio,v_activado) and procesado_en<v_fin then procesado_en else null end
 ) order by fecha_programacion,turno,reserva,produccion)
 from eligible where rn=1
 ),'[]'::jsonb);
end $function$;

-- Restaurar RPC original sgp_picking_cola
CREATE OR REPLACE FUNCTION public.sgp_picking_cola(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare u text;
begin
 u:=public.sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO','LIDER','PATINADOR','PICKING','SUPERVISOR DE PICKING','LIDER LINEA']);
 return coalesce((with base as (
   select p.*,e.estado estado_ejecucion
   from public.sgp_mecanizado_programacion p
   left join public.sgp_mecanizado_ejecucion e on e.id_programacion=p.id_programacion
   where p.estado<>'CANCELADA'
 ), partes as (
   select b.id_programacion,b.reserva,b.produccion,b.fecha_programacion,b.turno,b.prioridad,
          b.sistema,b.acabado,b.observacion,b.observacion_orden,b.estado_ejecucion,
          pr.prioridad parte,min(coalesce(sp.semana_actual,sp.semana_base))::int semana,sum(sp.cantidad)::int cantidad_ventanas
   from base b
   join public.sgp_prioridades pr on pr.reserva=b.reserva and pr.id_linea='PANELES_2'
      and (b.prioridad_semanal is null or pr.prioridad=b.prioridad_semanal)
   join public.sgp_producciones sp on sp.key_produccion=pr.key_produccion and sp.id_linea='PANELES_2' and sp.activa='SI'
   group by b.id_programacion,b.reserva,b.produccion,b.fecha_programacion,b.turno,b.prioridad,b.sistema,b.acabado,b.observacion,b.observacion_orden,b.estado_ejecucion,pr.prioridad
 ), filas as (
   select p.id_programacion,p.reserva,p.parte,p.produccion,p.fecha_programacion,p.turno,p.prioridad,
          p.cantidad_ventanas,p.sistema,p.acabado,p.observacion,p.observacion_orden,
          coalesce(p.estado_ejecucion,'PROGRAMADA') estado,
          (select count(*) from public.sgp_mecanizado_novedades n where n.id_programacion=p.id_programacion and n.estado<>'RESUELTA') novedades,
          (select pe.estado from public.sgp_picking_entregas pe where pe.id_programacion=p.id_programacion order by pe.fecha_entrega desc limit 1) estado_entrega,
          case coalesce(p.estado_ejecucion,'PROGRAMADA') when 'PROCESADO' then 0 when 'MECANIZADO' then 1 when 'CORTE' then 2 when 'PROGRAMADA' then 3 else 4 end orden_estado,
          p.semana,case when p.parte ~ '^[0-9]+([.][0-9]+)?$' then p.parte::numeric when p.parte ~ '^[0-9]+([.][0-9]+){2}$' then (split_part(p.parte,'.',1)||'.'||split_part(p.parte,'.',2))::numeric else 999999::numeric end parte_num,
          coalesce((select jsonb_agg(jsonb_build_object(
             'key_produccion',z.key_produccion,'produccion',z.produccion,'proyecto',z.proyecto,'cantidad',z.cantidad,
             'observacion_mecanizado',z.observacion_mecanizado,'novedades',z.novedades,'entrega_estado',z.entrega_estado,
             'entrega_completa',z.entrega_completa,'fecha_entrega',z.fecha_entrega,'turno_entrega',z.turno_entrega,
             'estado_mecanizado',z.estado_mecanizado,'reserva_compartida',z.reserva_compartida,'reservas_compartidas',z.reservas_compartidas
           ) order by z.produccion)
           from (
             select distinct pr.key_produccion,sp.produccion,sp.proyecto,sp.cantidad,coalesce(eo.observacion,'') observacion_mecanizado,
               (select count(*) from public.sgp_mecanizado_novedades n where n.id_programacion=p.id_programacion and n.produccion=sp.produccion and n.estado<>'RESUELTA') novedades,
               le.estado entrega_estado,le.completa entrega_completa,le.fecha_operativa fecha_entrega,le.turno_entrega,
               coalesce(eo.estado,coalesce(p.estado_ejecucion,'PROGRAMADA')) estado_mecanizado,
               public.sgp_es_reserva_compartida(pr.key_produccion) reserva_compartida,
               public.sgp_reservas_por_produccion_json(pr.key_produccion) reservas_compartidas
             from public.sgp_prioridades pr join public.sgp_producciones sp on sp.key_produccion=pr.key_produccion
             left join public.sgp_mecanizado_ejecucion_orden eo on eo.id_programacion=p.id_programacion and eo.produccion=sp.produccion
             left join lateral (select pe.estado,pe.completa,pe.fecha_operativa,pe.turno_entrega from public.sgp_picking_entregas pe where pe.id_programacion=p.id_programacion and pe.produccion=sp.produccion order by pe.fecha_entrega desc limit 1) le on true
             where pr.reserva=p.reserva and pr.id_linea='PANELES_2' and pr.prioridad=p.parte
           ) z),'[]'::jsonb) ordenes
   from partes p
 )
 select jsonb_agg(f order by f.orden_estado,f.reserva,lpad(coalesce(nullif(split_part(f.parte,'.',1),''),'999999'),12,'0'),lpad(coalesce(nullif(split_part(f.parte,'.',2),''),'0'),12,'0'),lpad(coalesce(nullif(split_part(f.parte,'.',3),''),'0'),12,'0'),f.fecha_programacion,f.prioridad) from filas f),'[]'::jsonb);
end $function$;

COMMIT;
