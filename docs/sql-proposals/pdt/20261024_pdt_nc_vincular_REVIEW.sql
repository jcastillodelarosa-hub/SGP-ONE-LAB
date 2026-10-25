-- SGP_ONE PR91 - REVIEW ONLY. No automatic migration.
BEGIN;
CREATE OR REPLACE FUNCTION public.sgp_aluminio_pendiente_nc_vincular_v1(
 p_token text,p_id uuid,p_ncs text[]
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE
 u text; p public.sgp_aluminio_pendientes%rowtype;
 snap jsonb; n text; canonical text; matches integer; inserted integer; added text[]:=ARRAY[]::text[]; ncs text[]:=ARRAY[]::text[];
BEGIN
 u:=public.sgp_validar_sesion_rol(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','PATINADOR']);
 IF p_id IS NULL OR p_ncs IS NULL OR cardinality(p_ncs) NOT BETWEEN 1 AND 30
 THEN RAISE EXCEPTION 'Listado NC invalido'; END IF;
 SELECT * INTO p FROM public.sgp_aluminio_pendientes WHERE id_pendiente=p_id FOR UPDATE;
 IF NOT FOUND OR p.estado <> 'PENDIENTE' OR p.fecha_cierre IS NOT NULL OR p.estado_repo='PICKING' THEN RAISE EXCEPTION 'Pendiente no activo'; END IF;
 FOREACH n IN ARRAY p_ncs LOOP
  n:=btrim(n);
  IF n IS NULL OR length(n) NOT BETWEEN 1 AND 120 OR n ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'Consecutivo NC invalido'; END IF;
  SELECT count(DISTINCT nc.consecutivo),min(nc.consecutivo) INTO matches,canonical
 FROM public.sgp_nc_aluminio nc WHERE nc.consecutivo=n OR nc.cod_nc=n;
 IF matches<>1 THEN RAISE EXCEPTION 'NC inexistente o ambigua: %',n; END IF;
 n:=canonical;
  IF NOT (n=ANY(ncs)) THEN ncs:=array_append(ncs,n); END IF;
 END LOOP;
 FOREACH n IN ARRAY ncs LOOP
  SELECT to_jsonb(nc) INTO snap FROM public.sgp_nc_aluminio nc WHERE nc.consecutivo=n
  ORDER BY nc.fecha_actualizacion DESC NULLS LAST,nc.creacion DESC NULLS LAST LIMIT 1;
  INSERT INTO public.sgp_aluminio_pendiente_ncs(id_pendiente,consecutivo,enlazado_por,snapshot)
  VALUES(p_id,n,u,snap) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS inserted=ROW_COUNT;
  IF inserted=1 THEN added:=array_append(added,n); END IF;
 END LOOP;
 IF cardinality(added)>0 THEN
 INSERT INTO public.sgp_aluminio_pendientes_historial(id_pendiente,usuario,tipo_evento,datos_nuevos)
 VALUES(p_id,u,'VINCULACION_NC_PDT',jsonb_build_object('ncs',added,'referencias_solicitadas',p_ncs));
 END IF;
 RETURN jsonb_build_object('ok',true,'ncs',ncs,'agregadas',added,'duplicado',cardinality(added)=0);
END $fn$;
REVOKE ALL ON FUNCTION public.sgp_aluminio_pendiente_nc_vincular_v1(text,uuid,text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgp_aluminio_pendiente_nc_vincular_v1(text,uuid,text[]) TO anon,authenticated;
COMMIT;
