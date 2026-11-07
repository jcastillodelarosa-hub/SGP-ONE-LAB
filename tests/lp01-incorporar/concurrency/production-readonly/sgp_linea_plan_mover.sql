CREATE OR REPLACE FUNCTION public.sgp_linea_plan_mover(p_token text, p_asignacion uuid, p_fecha date, p_turno integer, p_cantidad integer, p_prioridad integer DEFAULT 50)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_user text;v_a public.sgp_linea_plan_asignaciones%rowtype;v_ejecutado integer;v_id uuid;
begin
 v_user:=public.sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR']);
 if p_fecha is null or p_turno is null or p_turno not in(1,2) or p_cantidad is null or p_cantidad<=0 or p_prioridad is null or p_prioridad<=0 then raise exception 'PARAMETROS_INVALIDOS';end if;
 select * into v_a from public.sgp_linea_plan_asignaciones where id=p_asignacion for update;
 if not found or v_a.estado<>'PROGRAMADA' then raise exception 'ASIGNACION_NO_MOVIBLE';end if;
 select coalesce(sum(cantidad),0)::integer into v_ejecutado from public.sgp_linea_plan_ejecuciones where asignacion_id=p_asignacion;
 if v_ejecutado>0 or p_cantidad>v_a.cantidad then raise exception 'CANTIDAD_NO_DISPONIBLE';end if;
 if p_cantidad=v_a.cantidad then
 update public.sgp_linea_plan_asignaciones set fecha=p_fecha,turno=p_turno,prioridad=p_prioridad,actualizado_en=now() where id=p_asignacion;return p_asignacion;
 end if;
 update public.sgp_linea_plan_asignaciones set cantidad=cantidad-p_cantidad,actualizado_en=now() where id=p_asignacion;
 insert into public.sgp_linea_plan_asignaciones(key_produccion,fecha,turno,cantidad,prioridad,origen_id,creado_por)
 values(v_a.key_produccion,p_fecha,p_turno,p_cantidad,p_prioridad,p_asignacion,v_user) returning id into v_id;
 return v_id;
end $function$
