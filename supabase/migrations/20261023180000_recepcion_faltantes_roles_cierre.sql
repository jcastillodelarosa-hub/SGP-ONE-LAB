-- SGP_ONE: permitir cierre auditado de pendientes a RECEPCION y LIDER MECANIZADO.
-- La firma antigua de tres parametros no se modifica: carece de fecha y turno.
CREATE OR REPLACE FUNCTION public.sgp_recepcion_faltante_estado(
 p_token text, p_id_faltante uuid, p_estado text,
 p_fecha_recibido date DEFAULT NULL::date, p_turno text DEFAULT NULL::text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare u text; st text := upper(p_estado);
begin
 if st = 'CERRADO' then
   u := sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR','LIDER','LIDER MECANIZADO','RECEPCION']);
 else
   u := sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR','LIDER']);
 end if;
 if st not in ('PENDIENTE','REPORTADO_BODEGA','CERRADO') then raise exception 'ESTADO_INVALIDO'; end if;
 if st='CERRADO' and p_fecha_recibido is null then raise exception 'FECHA_RECIBIDO_REQUERIDA'; end if;
 if st='CERRADO' and coalesce(trim(p_turno),'') not in ('TURNO 1','TURNO 2') then raise exception 'TURNO_RECIBIDO_REQUERIDO'; end if;
 update sgp_recepcion_faltantes set
   estado=st,
   fecha_reporte_bodega=case when st='REPORTADO_BODEGA' then coalesce(fecha_reporte_bodega,now()) else fecha_reporte_bodega end,
   usuario_reporte=case when st='REPORTADO_BODEGA' then u else usuario_reporte end,
   fecha_recibido=case when st='CERRADO' then now() else fecha_recibido end,
   fecha_recibido_operativa=case when st='CERRADO' then p_fecha_recibido else fecha_recibido_operativa end,
   turno_recibido=case when st='CERRADO' then p_turno else turno_recibido end,
   usuario_cierre=case when st='CERRADO' then u else usuario_cierre end,
   fecha_actualizacion=now()
 where id_faltante=p_id_faltante;
 return jsonb_build_object('ok',true);
end $function$;
