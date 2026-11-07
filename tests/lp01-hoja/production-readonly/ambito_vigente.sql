CREATE OR REPLACE FUNCTION sgp_lp_operacion.ambito_vigente(desde timestamp with time zone, hasta timestamp with time zone, instante timestamp with time zone)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
 SELECT coalesce(desde<=instante AND instante<hasta,false)
$function$

