CREATE OR REPLACE FUNCTION sgp_lp_operacion.admitir()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE enabled boolean;BEGIN
 SELECT escrituras INTO enabled FROM sgp_lp_operacion.config WHERE id FOR SHARE;
 IF enabled IS DISTINCT FROM true THEN RAISE EXCEPTION 'ESCRITURA_NO_HABILITADA'; END IF;
END $function$

