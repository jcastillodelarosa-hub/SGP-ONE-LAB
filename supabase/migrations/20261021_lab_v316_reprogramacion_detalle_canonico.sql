-- LAB v316 · SGP_ONE. NO EJECUTAR sin autorización explícita de Supabase.
-- Reprogramación atómica: valida composición de origen y copia las key_produccion.
-- Mantiene firma, roles, SECURITY DEFINER, search_path y transacción existentes.
CREATE OR REPLACE FUNCTION public.sgp_mecanizado_reprogramar_orden(p_token text, p_id_programacion uuid, p_produccion text, p_fecha date, p_turno text, p_prioridad integer, p_motivo text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_usuario text; v_origen public.sgp_mecanizado_programacion%rowtype; v_destino uuid; v_cantidad integer; v_parte text; v_estado text; v_detalle_count integer; v_detalle_cantidad numeric; v_inserted integer;
begin
 v_usuario:=public.sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR']);
 if p_fecha is null or p_turno not in ('TURNO 1','TURNO 2') or p_prioridad<1 or p_prioridad is null or length(trim(coalesce(p_motivo,'')))<5 then
   raise exception 'Indica fecha, turno, prioridad y motivo (mínimo 5 caracteres)';
 end if;
 select * into v_origen from public.sgp_mecanizado_programacion where id_programacion=p_id_programacion for update;
 if not found or v_origen.estado='CANCELADA' then raise exception 'Programación de origen no disponible'; end if;
 if (v_origen.fecha_programacion,v_origen.turno)=(p_fecha,p_turno) then raise exception 'Selecciona una fecha o turno diferente'; end if;
 if exists(select 1 from public.sgp_mecanizado_reprogramaciones where id_origen=p_id_programacion and produccion=p_produccion) then raise exception 'La orden ya fue reprogramada'; end if;
 if v_origen.produccion is not null and v_origen.produccion<>p_produccion then raise exception 'Orden no pertenece a esta programación'; end if;
 -- La composición canónica determina la producción, no un nombre potencialmente repetido.
 -- El join por key_produccion impide tomar cantidad/prioridad de otra reserva o sistema.
 select min(pr.prioridad),round(sum(d.cantidad_snapshot))::int into v_parte,v_cantidad
 from public.sgp_mecanizado_programacion_detalle d
 join public.sgp_producciones sp on sp.key_produccion=d.key_produccion
 left join public.sgp_prioridades pr on pr.key_produccion=d.key_produccion and pr.id_linea='PANELES_2'
 where d.id_programacion=p_id_programacion
   and d.reserva_snapshot=v_origen.reserva
   and d.produccion_snapshot=p_produccion
   and sp.reserva_al=v_origen.reserva and sp.id_linea='PANELES_2'
   and sp.produccion=p_produccion
   and (v_origen.prioridad_semanal is null or d.prioridad_semanal_snapshot=v_origen.prioridad_semanal);
 if v_cantidad is null then raise exception 'Orden no pertenece a la reserva / parte'; end if;
 if v_cantidad>v_origen.cantidad_programada then raise exception 'La orden tiene % ventanas pero solo % programadas en el origen; no se permite mover parcialmente',v_cantidad,v_origen.cantidad_programada; end if;
 select eo.estado into v_estado from public.sgp_mecanizado_ejecucion_orden eo where eo.id_programacion=p_id_programacion and eo.produccion=p_produccion;
 if v_estado in ('PROCESADO','REPROGRAMADO') then raise exception 'No se puede reprogramar una orden procesada o ya reprogramada'; end if;

 -- Preflight canónico: no crear destinos sin key_produccion exacta.
 select count(*),coalesce(sum(d.cantidad_snapshot),0) into v_detalle_count,v_detalle_cantidad
 from public.sgp_mecanizado_programacion_detalle d
 where d.id_programacion=p_id_programacion
   and d.produccion_snapshot=p_produccion
   and d.reserva_snapshot=v_origen.reserva;
 if v_detalle_count=0 or v_detalle_cantidad<>v_cantidad then
   raise exception 'Composición de programación ausente o inconsistente para producción % (detalle %, cantidad %, esperada %)',
    p_produccion,v_detalle_count,v_detalle_cantidad,v_cantidad;
 end if;
 insert into public.sgp_mecanizado_programacion(reserva,produccion,cantidad_programada,fecha_programacion,turno,prioridad,prioridad_semanal,observacion,observacion_orden,sistema,acabado,porc_vidrio_snapshot,cant_vidrio_snapshot,usuario_programa)
 values(v_origen.reserva,p_produccion,v_cantidad,p_fecha,p_turno,p_prioridad,coalesce(v_origen.prioridad_semanal,v_parte),'Reprogramada desde '||v_origen.fecha_programacion||' '||v_origen.turno||'. Motivo: '||trim(p_motivo),v_origen.observacion_orden,v_origen.sistema,v_origen.acabado,v_origen.porc_vidrio_snapshot,v_origen.cant_vidrio_snapshot,v_usuario) returning id_programacion into v_destino;
 -- Transferencia atómica de identidad de producción, semana y vidrio.
 insert into public.sgp_mecanizado_programacion_detalle
 (id_programacion,key_produccion,cantidad_snapshot,reserva_snapshot,prioridad_semanal_snapshot,produccion_snapshot,origen)
 select v_destino,d.key_produccion,d.cantidad_snapshot,d.reserva_snapshot,d.prioridad_semanal_snapshot,d.produccion_snapshot,'REPROGRAMACION'
 from public.sgp_mecanizado_programacion_detalle d
 where d.id_programacion=p_id_programacion and d.produccion_snapshot=p_produccion
   and d.reserva_snapshot=v_origen.reserva;
 get diagnostics v_inserted=row_count;
 if v_inserted<>v_detalle_count then raise exception 'La composición de la reprogramación no coincide con el origen'; end if;
 insert into public.sgp_mecanizado_reprogramaciones(id_origen,id_destino,produccion,cantidad,motivo,usuario)
 values(p_id_programacion,v_destino,p_produccion,v_cantidad,trim(p_motivo),v_usuario);
 update public.sgp_mecanizado_programacion set cantidad_programada=cantidad_programada-v_cantidad,
 estado=case when cantidad_programada=v_cantidad then 'CANCELADA' else estado end,
 fecha_actualizacion=now() where id_programacion=p_id_programacion;
 perform public.sgp_mecanizado_guardar_estado_orden(p_token,p_id_programacion,p_produccion,'REPROGRAMADO','Reprogramada a '||p_fecha||' '||p_turno||'. '||trim(p_motivo));
 return v_destino;
end $function$

