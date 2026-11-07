CREATE OR REPLACE FUNCTION public.sgp_linea_plan_registrar(p_token text, p_asignacion uuid, p_cantidad integer, p_observacion text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_user text;v_a public.sgp_linea_plan_asignaciones%rowtype;v_total integer;v_remaining integer;
begin
 v_user:=public.sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR','LIDER']);
 if p_cantidad is null or p_cantidad<=0 then raise exception 'CANTIDAD_INVALIDA';end if;
 select * into v_a from public.sgp_linea_plan_asignaciones where id=p_asignacion for update;
 if not found or v_a.estado in ('CANCELADA','FINALIZADA') then raise exception 'ASIGNACION_NO_DISPONIBLE';end if;
 select coalesce(sum(cantidad),0)::integer into v_total from public.sgp_linea_plan_ejecuciones where asignacion_id=p_asignacion;
 if v_total+p_cantidad>v_a.cantidad then raise exception 'EJECUCION_SUPERA_PROGRAMADO';end if;
 v_remaining:=v_a.cantidad-v_total-p_cantidad;
 if v_remaining>0 and nullif(trim(coalesce(p_observacion,'')),'') is null then raise exception 'OBSERVACION_OBLIGATORIA';end if;
 insert into public.sgp_linea_plan_ejecuciones(asignacion_id,cantidad,observacion,usuario) values(p_asignacion,p_cantidad,p_observacion,v_user);
 update public.sgp_linea_plan_asignaciones set estado=case when v_remaining=0 then 'FINALIZADA' else 'ABIERTA' end,actualizado_en=now() where id=p_asignacion;
 return jsonb_build_object('ejecutado',v_total+p_cantidad,'pendiente',v_remaining);
end $function$

