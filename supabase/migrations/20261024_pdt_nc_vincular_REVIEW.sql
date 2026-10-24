-- SGP_ONE PR91 - REVIEW ONLY. No automatic migration.
BEGIN;
CREATE OR REPLACE FUNCTION public.sgp_aluminio_pendiente_nc_vincular_v1(
 p_token text,p_id uuid,p_ncs text[]
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE
 u text; p public.sgp_aluminio_pendientes%rowtype;
 n text; ncs text[]:=ARRAY[]::text[];
BEGIN
 u:=public.sgp_validar_sesion_rol(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','PATINADOR']);
 IF p_id IS NULL OR p_ncs IS NULL OR cardinality(p_ncs) NOT BETWEEN 1 AND 30
 THEN RAISE EXCEPTION 'Listado NC invalido'; END IF;
 SELECT * INTO p FROM public.sgp_aluminio_pendientes WHERE id_pendiente=p_id FOR UPDATE;
 IF NOT FOUND OR p.fecha_cierre IS NOT NULL OR p.estado_repo='PICKING' OR p.estado='PICKING' THEN RAISE EXCEPTION 'Pendiente no activo'; END IF;
 FOREACH n IN ARRAY p_ncs LOOP
  n:=btrim(n);
  IF n IS NULL OR n !~ '^[0-9]{1,20}  IF NOT (n=ANY(ncs)) THEN ncs:=array_append(ncs,n); END IF;
 END LOOP;
 FOREACH n IN ARRAY ncs LOOP
  INSERT INTO public.sgp_aluminio_pendiente_ncs(id_pendiente,consecutivo,enlazado_por)
  VALUES(p_id,n,u) ON CONFLICT DO NOTHING;
 END LOOP;
 INSERT INTO public.sgp_aluminio_pendientes_historial(id_pendiente,usuario,tipo_evento,datos_nuevos)
 VALUES(p_id,u,'VINCULACION_NC_PDT',jsonb_build_object('ncs',ncs));
 RETURN jsonb_build_object('ok',true,'ncs',ncs);
END $fn$;
REVOKE ALL ON FUNCTION public.sgp_aluminio_pendiente_nc_vincular_v1(text,uuid,text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgp_aluminio_pendiente_nc_vincular_v1(text,uuid,text[]) TO anon,authenticated;
COMMIT; THEN RAISE EXCEPTION 'Consecutivo NC invalido'; END IF;
  IF NOT (n=ANY(ncs)) THEN ncs:=array_append(ncs,n); END IF;
 END LOOP;
 FOREACH n IN ARRAY ncs LOOP
  INSERT INTO public.sgp_aluminio_pendiente_ncs(id_pendiente,consecutivo,enlazado_por)
  VALUES(p_id,n,u) ON CONFLICT DO NOTHING;
 END LOOP;
 INSERT INTO public.sgp_aluminio_pendientes_historial(id_pendiente,usuario,tipo_evento,datos_nuevos)
 VALUES(p_id,u,'VINCULACION_NC_PDT',jsonb_build_object('ncs',ncs));
 RETURN jsonb_build_object('ok',true,'ncs',ncs);
END $fn$;
REVOKE ALL ON FUNCTION public.sgp_aluminio_pendiente_nc_vincular_v1(text,uuid,text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgp_aluminio_pendiente_nc_vincular_v1(text,uuid,text[]) TO anon,authenticated;
COMMIT;