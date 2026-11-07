CREATE OR REPLACE FUNCTION sgp_lp_operacion.siguiente(d date, t integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE current_period jsonb;next_period jsonb;BEGIN
 current_period:=sgp_lp_operacion.periodo(d,t);
 next_period:=sgp_lp_operacion.periodo(d+CASE WHEN t=2 THEN 1 ELSE 0 END,CASE WHEN t=1 THEN 2 ELSE 1 END);
 IF (next_period->>'start')::timestamptz<(current_period->>'end')::timestamptz THEN RAISE EXCEPTION 'HORARIOS_OPERATIVOS_SUPERPUESTOS'; END IF;
 RETURN next_period;
END $function$

