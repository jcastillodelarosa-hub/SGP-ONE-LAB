-- REVIEW / NO APLICADO. PR98, LABv355. Ejecutar únicamente tras revisión/autorización.
-- Una transacción; no concede SELECT ni cambia RLS, políticas, datos o RPC existentes.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $preflight$
BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'Requiere ejecutor postgres autorizado'; END IF;
 IF to_regprocedure('public.sgp_mecanizado_reprogramaciones_listar(text)') IS NOT NULL
 THEN RAISE EXCEPTION 'RPC ya existe: contrastar definición antes de sustituir'; END IF;
 IF to_regprocedure('public.sgp_validar_sesion_rol(text,text[])') IS NULL
 OR to_regprocedure('public.sgp_sesion_actual(text)') IS NULL
 THEN RAISE EXCEPTION 'Faltan contratos de autorización SGP'; END IF;
 IF (SELECT prorettype FROM pg_proc WHERE oid=to_regprocedure('public.sgp_sesion_actual(text)'))<>'jsonb'::regtype
 THEN RAISE EXCEPTION 'Contrato de sesión distinto de JSONB'; END IF;
 IF EXISTS (SELECT 1 FROM (VALUES ('id_origen','uuid'::regtype),('id_destino','uuid'::regtype),('produccion','text'::regtype)) expected(name,typ)
 WHERE NOT EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid=to_regclass('public.sgp_mecanizado_reprogramaciones') AND a.attname=expected.name AND a.atttypid=expected.typ AND NOT a.attisdropped))
 OR NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=to_regclass('public.sgp_mecanizado_reprogramaciones') AND attname='creado_en' AND NOT attisdropped)
 THEN RAISE EXCEPTION 'Estructura de reprogramaciones incompatible; detener y contrastar'; END IF;
END $preflight$;

CREATE FUNCTION public.sgp_mecanizado_reprogramaciones_listar(p_token text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $function$
DECLARE sesion jsonb; rol_real text;
BEGIN
 IF p_token IS NULL OR btrim(p_token)='' THEN
  RAISE EXCEPTION 'Sesión SGP inválida' USING ERRCODE='28000';
 END IF;
 PERFORM public.sgp_validar_sesion_rol(p_token,ARRAY[
  'ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO','LIDER','LIDER LINEA','CONSULTA']);
 sesion:=public.sgp_sesion_actual(p_token);
 IF sesion->'valida' IS DISTINCT FROM 'true'::jsonb OR nullif(btrim(sesion->>'usuario'),'') IS NULL
 THEN RAISE EXCEPTION 'Sesión SGP inválida' USING ERRCODE='28000'; END IF;
 rol_real:=upper(btrim(sesion->>'rol'));
 IF coalesce(rol_real,'') NOT IN ('ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO','LIDER','LIDER LINEA','CONSULTA')
 THEN RAISE EXCEPTION 'Rol SGP no autorizado para consultar reprogramaciones' USING ERRCODE='42501'; END IF;
 RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object(
  'id_origen',r.id_origen,'id_destino',r.id_destino,
  'produccion',r.produccion,'creado_en',r.creado_en)
  ORDER BY r.creado_en,r.id_origen,r.id_destino,r.produccion),'[]'::jsonb)
 FROM public.sgp_mecanizado_reprogramaciones r);
END $function$;
ALTER FUNCTION public.sgp_mecanizado_reprogramaciones_listar(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.sgp_mecanizado_reprogramaciones_listar(text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.sgp_mecanizado_reprogramaciones_listar(text) TO anon,authenticated;
COMMENT ON FUNCTION public.sgp_mecanizado_reprogramaciones_listar(text) IS
 'LABv355 PR98: lectura mínima autorizada con rol real SGP; sin acceso directo a la tabla';
DO $acl_check$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_proc p,LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
 WHERE p.oid='public.sgp_mecanizado_reprogramaciones_listar(text)'::regprocedure
 AND a.privilege_type='EXECUTE'
 AND a.grantee NOT IN(SELECT oid FROM pg_roles WHERE rolname IN('postgres','anon','authenticated')))
 THEN RAISE EXCEPTION 'Permisos EXECUTE inesperados: detener y revisar'; END IF;
END $acl_check$;
NOTIFY pgrst,'reload schema';
COMMIT;
