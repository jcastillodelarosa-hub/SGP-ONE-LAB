CREATE OR REPLACE FUNCTION sgp_lp_operacion.contener_ambitos()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$ BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'AISLAMIENTO_AMBITOS_NO_ADMITIDO'; END IF;
 LOCK TABLE sgp_lp_operacion.perfil_roles,public.sgp_usuarios,public.sgp_sesiones_app,public.sgp_rol_accesos,public.sgp_usuario_accesos,sgp_lp_operacion.permisos IN SHARE MODE;
END $function$

