-- Phase A, REVIEW ONLY. Install capabilities LAST after all phase-A definitions.
BEGIN;
DO $phase$ BEGIN
 IF to_regclass('public.sgp_pdt_entrega_lineas') IS NOT NULL THEN RAISE EXCEPTION 'Fase B ya instalada: no degradar capacidades'; END IF;
END $phase$;

CREATE OR REPLACE FUNCTION public.sgp_pdt_fuentes_v2(p_token text,p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE p public.sgp_aluminio_pendientes%rowtype;
BEGIN
 PERFORM public.sgp_validar_sesion_rol(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','RECEPCION','LIDER LINEA','SUPERVISOR DE PICKING']);
 SELECT * INTO STRICT p FROM public.sgp_aluminio_pendientes WHERE id_pendiente=p_id;
 IF p.key_produccion IS NULL THEN RAISE EXCEPTION 'Producción sin identidad'; END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id_pieza',a.id_pieza,'fabricacion',a.fabricacion,
  'longitud',a.longitud::text,'acabado',a.acabado,'marca',a.marca,'uso',a.uso,'cantidad',a.cantidad))
 FROM public.sgp_aluminio a JOIN public.sgp_producciones prod ON prod.key_produccion=a.key_produccion
 WHERE a.key_produccion=p.key_produccion AND a.activo='SI' AND a.tipo_pieza='PANEL'
 AND upper(btrim(a.sistema))=upper(btrim(prod.sistema)) AND btrim(a.codigo_sap)=btrim(p.perfil)),'[]'::jsonb);
END $fn$;
CREATE OR REPLACE FUNCTION public.sgp_pdt_estado_v2(p_token text,p_id uuid,p_estado text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE p public.sgp_aluminio_pendientes%rowtype; u text;
BEGIN
 u:=public.sgp_validar_sesion_rol(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO','LIDER']);
 SELECT * INTO STRICT p FROM public.sgp_aluminio_pendientes WHERE id_pendiente=p_id FOR UPDATE;
 IF p.contrato_pdt<>'V2' OR p.estado<>'PENDIENTE' THEN RAISE EXCEPTION 'PDT no activo V2'; END IF;
 IF p_estado IS NULL OR p_estado NOT IN ('CORTE','MECANIZADO','PROCESADO') THEN RAISE EXCEPTION 'Etapa inválida'; END IF;
 IF p.estado_repo=p_estado THEN RETURN jsonb_build_object('ok',true,'duplicado',true,'estado_repo',p_estado); END IF;
 UPDATE public.sgp_aluminio_pendientes SET estado_repo=p_estado,usuario_estado=u,fecha_estado=now() WHERE id_pendiente=p_id;
 INSERT INTO public.sgp_aluminio_pendientes_historial(id_pendiente,usuario,tipo_evento,datos_anteriores,datos_nuevos)
 VALUES(p_id,u,'ETAPA_V2',jsonb_build_object('estado',p.estado_repo),jsonb_build_object('estado',p_estado));
 RETURN jsonb_build_object('ok',true,'estado_repo',p_estado);
END $fn$;
CREATE OR REPLACE FUNCTION public.sgp_pdt_capacidades_v2(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
 PERFORM public.sgp_validar_sesion_rol(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','RECEPCION','PATINADOR','LIDER','LIDER MECANIZADO','LIDER LINEA','SUPERVISOR DE PICKING','CONSULTA','PICKING']);
 RETURN jsonb_build_object('ok',true,'contract_version',2,'picking_cuantitativo',false,'cierre_v2',false,
 'operations',jsonb_build_array('sgp_aluminio_pendiente_validar_detalles_v1',
 'sgp_aluminio_pendiente_registrar_avance_v1','sgp_aluminio_pendiente_revertir_avance_v1',
 'sgp_aluminio_pendiente_nc_vincular_v1','sgp_pdt_estado_v2'));
END $fn$;
REVOKE ALL ON FUNCTION public.sgp_pdt_fuentes_v2(text,uuid),public.sgp_pdt_estado_v2(text,uuid,text),public.sgp_pdt_capacidades_v2(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgp_pdt_fuentes_v2(text,uuid),public.sgp_pdt_estado_v2(text,uuid,text),public.sgp_pdt_capacidades_v2(text) TO anon,authenticated;
COMMIT;
