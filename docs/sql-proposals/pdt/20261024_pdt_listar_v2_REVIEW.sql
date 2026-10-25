-- SGP_ONE PR91 - REVIEW ONLY. Aggregated read contract.
-- Adds the approved RECEPCION read role for the dedicated validation workflow.
-- This response is NOT a drop-in replacement for the legacy list contract.
BEGIN;
CREATE OR REPLACE FUNCTION public.sgp_aluminio_pendientes_listar_v2(
 p_token text,p_solo_abiertos boolean DEFAULT true
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE u text; resultado jsonb;
BEGIN
 u:=public.sgp_validar_sesion_rol(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','PATINADOR','LIDER MECANIZADO','LIDER','LIDER LINEA','SUPERVISOR DE PICKING','CONSULTA','RECEPCION','PICKING']);
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'contrato_pdt',p.contrato_pdt,'id_pendiente',p.id_pendiente,'produccion',p.produccion,'perfil',p.perfil,
  'estado',p.estado,'estado_repo',p.estado_repo,'validacion_estado',p.validacion_estado,
  'cantidad_reportada',p.cantidad,'nc_historica',p.nc,
  'reserva',p.reserva,'key_produccion',p.key_produccion,'acabado',p.acabado_pendiente,
  'semana',(SELECT coalesce(to_jsonb(r)->>'semana_reserva',to_jsonb(r)->>'semana_produccion') FROM public.sgp_produccion_reservas_v r WHERE r.key_produccion=p.key_produccion AND r.reserva=p.reserva LIMIT 1),
  'picking',jsonb_build_object('cobertura','NO_VERIFICADA'),'cierre_habilitado',false,'fecha_reporte',p.fecha_reporte,
  'movimientos',coalesce((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.registrado_en) FROM public.sgp_aluminio_pendiente_movimientos m WHERE m.id_pendiente=p.id_pendiente),'[]'::jsonb),
  'detalles',coalesce((SELECT jsonb_agg(jsonb_build_object(
   'id_detalle',d.id_detalle,'id_pieza',d.id_pieza,'fabricacion',d.fabricacion,'longitud',d.longitud::text,
   'acabado',d.acabado,'cantidad_validada',d.cantidad_validada,
   'avance_neto',coalesce((SELECT sum(CASE WHEN m.tipo='AVANCE' THEN m.cantidad ELSE -m.cantidad END)
    FROM public.sgp_aluminio_pendiente_movimientos m WHERE m.id_detalle=d.id_detalle),0),
   'saldo',d.cantidad_validada-coalesce((SELECT sum(CASE WHEN m.tipo='AVANCE' THEN m.cantidad ELSE -m.cantidad END)
    FROM public.sgp_aluminio_pendiente_movimientos m WHERE m.id_detalle=d.id_detalle),0)
  )) FROM public.sgp_aluminio_pendiente_detalles d WHERE d.id_pendiente=p.id_pendiente),'[]'::jsonb),
  'ncs',coalesce((SELECT jsonb_agg(jsonb_build_object(
    'referencia',refs.ref,'consecutivo',nc.consecutivo,'cod_nc',nc.cod_nc,
    'estado',nc.estado,'responsable',nc.responsable,'creacion',nc.creacion,
    'resolucion',CASE WHEN matching.total>1 THEN 'AMBIGUA' WHEN nc.consecutivo IS NULL THEN 'NO_ENCONTRADA'
      WHEN nc.activo IS TRUE THEN 'ACTIVA' ELSE 'INACTIVA' END,
    'ultimo_estado_conocido',refs.snapshot->>'estado','snapshot_enlace',refs.snapshot,
    'finalizada_en',NULL,'origen',refs.origen) ORDER BY refs.ref)
   FROM (
    SELECT n.consecutivo ref,'VINCULO'::text origen,n.snapshot FROM public.sgp_aluminio_pendiente_ncs n WHERE n.id_pendiente=p.id_pendiente
    UNION ALL
    SELECT DISTINCT btrim(x),'HISTORICA',NULL::jsonb FROM regexp_split_to_table(coalesce(p.nc,''),'[,;\n]+') x
    WHERE btrim(x)<>'' AND NOT EXISTS (SELECT 1 FROM public.sgp_aluminio_pendiente_ncs n
     WHERE n.id_pendiente=p.id_pendiente AND n.consecutivo=btrim(x))
   ) refs
   CROSS JOIN LATERAL (
    SELECT count(DISTINCT n.consecutivo) total FROM public.sgp_nc_aluminio n
    WHERE n.consecutivo=refs.ref OR n.cod_nc=refs.ref
   ) matching
   LEFT JOIN LATERAL (
    SELECT n.* FROM public.sgp_nc_aluminio n WHERE matching.total=1 AND (n.consecutivo=refs.ref OR n.cod_nc=refs.ref)
    ORDER BY n.fecha_actualizacion DESC NULLS LAST,n.creacion DESC NULLS LAST,n.consecutivo LIMIT 1
   ) nc ON true),'[]'::jsonb)
  )),'[]'::jsonb)
 INTO resultado FROM public.sgp_aluminio_pendientes p
 WHERE p.estado IN ('PENDIENTE','RESUELTO') AND (NOT coalesce(p_solo_abiertos,true) OR (p.estado='PENDIENTE' AND coalesce(p.estado_repo,'PENDIENTE')<>'PICKING'));
 RETURN jsonb_build_object('ok',true,'contract_version',2,'pendientes',resultado);
END $fn$;
REVOKE ALL ON FUNCTION public.sgp_aluminio_pendientes_listar_v2(text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgp_aluminio_pendientes_listar_v2(text,boolean) TO anon,authenticated;
COMMIT;
