CREATE OR REPLACE FUNCTION sgp_lp_operacion.auditar_rol()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$ BEGIN
 SELECT rol INTO NEW.rol_efectivo FROM public.sgp_usuarios WHERE usuario=NEW.usuario AND activo;
 NEW.responsabilidad_servidor:=NEW.rol_efectivo;RETURN NEW; END $function$

