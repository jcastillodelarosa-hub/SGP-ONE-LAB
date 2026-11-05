-- RECOVERY ONLY: restore exact pre13 reader; no data, flags or grants changed.
-- Requires new reader MD5 and unchanged owner/ACL/configuration.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $guard$ DECLARE p pg_proc; BEGIN
 SELECT * INTO p FROM pg_proc WHERE oid=to_regprocedure('public.sgp_lp_afectaciones_consultar_v2(text,text,text)');
 IF p.oid IS NULL OR md5(p.prosrc) IS DISTINCT FROM 'a74f14fefe3a3d91201423fdc3111d7a' OR NOT p.prosecdef OR p.proowner IS DISTINCT FROM (SELECT oid FROM pg_roles WHERE rolname='postgres') OR current_user<>'postgres' OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[]
 OR NOT has_function_privilege('anon',p.oid,'EXECUTE')
 OR (SELECT count(*) FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))))<>2
 OR EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee=(SELECT oid FROM pg_roles WHERE rolname='anon') AND a.is_grantable)
 OR EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE a.privilege_type='EXECUTE' AND a.grantee NOT IN(p.proowner,(SELECT oid FROM pg_roles WHERE rolname='anon')))
 THEN RAISE EXCEPTION 'LECTOR_PDT_BASELINE_INCOMPATIBLE';END IF;
END $guard$;
CREATE OR REPLACE FUNCTION public.sgp_lp_afectaciones_consultar_v2(p_token text,p_key text,p_stage text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;s jsonb;pending jsonb;allowed boolean:=false;cfg sgp_lp_afectaciones.config%rowtype;BEGIN
 result:=public.sgp_lp_afectaciones_consultar_v1(p_token,p_key,p_stage);
 s:=sgp_lp_afectaciones.actor(p_token,p_key,p_stage,'LEER');
 -- Same native metadata read roles. No role aliases or supervisor escalation.
 IF s->>'rol'=ANY(ARRAY['ADMINISTRADOR','COORDINADOR','PATINADOR','PICKING','SUPERVISOR DE PICKING','LIDER','LIDER LINEA','LIDER MECANIZADO','RECEPCION','CONSULTA']) THEN
  PERFORM public.sgp_pdt_validar_rol_real(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','PATINADOR','PICKING','SUPERVISOR DE PICKING','LIDER','LIDER LINEA','LIDER MECANIZADO','RECEPCION','CONSULTA']);
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id_pendiente,'linked',EXISTS(SELECT 1 FROM sgp_lp_afectaciones.fuentes f WHERE f.contrato='V4' AND f.fuente_id=p.id_pendiente),'contract',p.contrato_pdt,'key',p.key_produccion,'origin',p.origen,'reference',p.perfil,'fabrication',p.fabricacion,'length',p.longitud,'reserve',p.reserva,'finish',p.acabado_pendiente,'pieceQuantity',p.cantidad,'state',p.estado,'replacementState',p.estado_repo,'validationState',p.validacion_estado,'nc',p.nc,'reportedAt',p.fecha_reporte) ORDER BY p.fecha_reporte,p.id_pendiente),'[]') INTO pending FROM public.sgp_aluminio_pendientes p WHERE p.key_produccion=p_key AND p.origen='PICKING';
 ELSE pending:=NULL;END IF;
 SELECT * INTO cfg FROM sgp_lp_afectaciones.config WHERE id;
 IF cfg.writes AND cfg.atomic_pdt AND cfg.pdt_links AND result->'capabilities' ? 'REPORT' AND s->>'rol' IN('ADMINISTRADOR','COORDINADOR','LIDER','LIDER LINEA') THEN
  allowed:=sgp_pdt_multiorigen.actor(p_token,p_stage)=s->>'usuario';
 END IF;
 RETURN result||jsonb_build_object('contract','LP-AFFECTATIONS-2','capabilities',(result->'capabilities')||CASE WHEN allowed THEN '["REPORT_ALUMINUM"]'::jsonb ELSE '[]'::jsonb END||CASE WHEN cfg.writes AND result->'capabilities' ? 'REPORT' AND s->>'rol'='COORDINADOR' AND sgp_lp_operacion.puede_operar(s->>'usuario',p_stage,'VALIDAR') THEN '["RECONCILE"]'::jsonb ELSE '[]'::jsonb END,'pickingPending',jsonb_build_object('status',CASE WHEN pending IS NULL THEN 'UNAUTHORIZED' ELSE 'AVAILABLE' END,'rows',coalesce(pending,'[]')));
END $$;
COMMIT;
