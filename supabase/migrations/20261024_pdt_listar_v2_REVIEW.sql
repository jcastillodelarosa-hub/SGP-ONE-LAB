-- SGP_ONE PR91 - REVIEW ONLY. Aggregated read contract.
-- Roles aligned with existing sgp_aluminio_pendientes_listar: do not grant new read privileges implicitly.
-- This response is NOT a drop-in replacement for the legacy list contract.
BEGIN;
CREATE OR REPLACE FUNCTION public.sgp_aluminio_pendientes_listar_v2(
 p_token text,p_solo_abiertos boolean DEFAULT true
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE u text; resultado jsonb;
BEGIN
 u:=public.sgp_validar_sesion_rol(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','PATINADOR','LIDER MECANIZADO','LIDER','LIDER LINEA','SUPERVISOR DE PICKING','CONSULTA']);
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'id_pendiente',p.id_pendiente,'produccion',p.produccion,'perfil',p.perfil,
  'estado',p.estado,'estado_repo',p.estado_repo,'validacion_estado',p.validacion_estado,
  'cantidad',p.cantidad,'fecha_reporte',p.fecha_reporte,
  'detalles',coalesce((SELECT jsonb_agg(jsonb_build_object(
   'id_detalle',d.id_detalle,'fabricacion',d.fabricacion,'longitud',d.longitud,
   'acabado',d.acabado,'validada',d.cantidad_validada,
   'avanzada',coalesce((SELECT sum(CASE WHEN m.tipo='AVANCE' THEN m.cantidad ELSE -m.cantidad END)
    FROM public.sgp_aluminio_pendiente_movimientos m WHERE m.id_detalle=d.id_detalle),0),
   'saldo',d.cantidad_validada-coalesce((SELECT sum(CASE WHEN m.tipo='AVANCE' THEN m.cantidad ELSE -m.cantidad END)
    FROM public.sgp_aluminio_pendiente_movimientos m WHERE m.id_detalle=d.id_detalle),0)
  )) FROM public.sgp_aluminio_pendiente_detalles d WHERE d.id_pendiente=p.id_pendiente),'[]'::jsonb),
  'ncs',coalesce((SELECT jsonb_agg(jsonb_build_object('consecutivo',n.consecutivo,'estado',(SELECT nc.estado FROM public.sgp_nc_aluminio nc WHERE nc.activo=true AND (nc.consecutivo=n.consecutivo OR nc.cod_nc=n.consecutivo) ORDER BY nc.fecha_actualizacion DESC NULLS LAST,nc.creacion DESC NULLS LAST LIMIT 1),'responsable',(SELECT nc.responsable FROM public.sgp_nc_aluminio nc WHERE nc.consecutivo=n.consecutivo ORDER BY nc.fecha_actualizacion DESC NULLS LAST,nc.creacion DESC NULLS LAST LIMIT 1),'creacion',(SELECT nc.creacion FROM public.sgp_nc_aluminio nc WHERE nc.consecutivo=n.consecutivo ORDER BY nc.fecha_actualizacion DESC NULLS LAST,nc.creacion DESC NULLS LAST LIMIT 1)) ORDER BY n.consecutivo)
   FROM public.sgp_aluminio_pendiente_ncs n WHERE n.id_pendiente=p.id_pendiente),'[]'::jsonb)
  )),'[]'::jsonb)
 INTO resultado FROM public.sgp_aluminio_pendientes p
 WHERE p.estado IN ('PENDIENTE','RESUELTO') AND (NOT coalesce(p_solo_abiertos,true) OR (p.estado='PENDIENTE' AND coalesce(p.estado_repo,'PENDIENTE')<>'PICKING'));
 RETURN jsonb_build_object('ok',true,'pendientes',resultado);
END $fn$;
REVOKE ALL ON FUNCTION public.sgp_aluminio_pendientes_listar_v2(text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgp_aluminio_pendientes_listar_v2(text,boolean) TO anon,authenticated;
COMMIT;
