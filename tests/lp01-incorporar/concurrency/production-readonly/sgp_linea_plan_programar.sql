CREATE OR REPLACE FUNCTION public.sgp_linea_plan_programar(p_token text, p_key_produccion text, p_fecha date, p_turno integer, p_cantidad integer, p_prioridad integer DEFAULT 50)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_user text;v_p public.sgp_producciones%rowtype;v_total integer;v_id uuid;
begin
 v_user:=public.sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR']);
 if p_fecha is null or p_turno is null or p_turno not in (1,2) or p_cantidad is null or p_cantidad<=0 or p_prioridad is null or p_prioridad<=0 then raise exception 'PARAMETROS_INVALIDOS';end if;
 select * into v_p from public.sgp_producciones where key_produccion=p_key_produccion and activa='SI' for update;
 if not found then raise exception 'PRODUCCION_NO_ENCONTRADA';end if;
 if coalesce(v_p.saldos_inicializados,false)=false or v_p.saldo_ensamble is null or v_p.saldo_ensamble<0 then raise exception 'SALDO_EXPORT_NO_VALIDADO';end if;
 select coalesce(sum(cantidad),0)::integer into v_total from public.sgp_linea_plan_asignaciones where key_produccion=p_key_produccion and estado<>'CANCELADA';
 if v_total+p_cantidad>v_p.saldo_ensamble then raise exception 'CANTIDAD_SUPERA_SALDO_EXPORT';end if;
 insert into public.sgp_linea_plan_asignaciones(key_produccion,fecha,turno,cantidad,prioridad,creado_por) values(p_key_produccion,p_fecha,p_turno,p_cantidad,p_prioridad,v_user) returning id into v_id;
 return v_id;
end $function$
