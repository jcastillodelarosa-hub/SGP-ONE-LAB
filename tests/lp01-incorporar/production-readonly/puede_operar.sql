CREATE OR REPLACE FUNCTION sgp_lp_operacion.puede_operar(u text, et text, op text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 SELECT EXISTS(SELECT 1 FROM public.sgp_usuarios a WHERE a.usuario=u AND a.activo AND op=ANY(sgp_lp_operacion.operaciones_rol(a.rol,et)) AND sgp_lp_operacion.acceso_rol(u,et))
$function$

