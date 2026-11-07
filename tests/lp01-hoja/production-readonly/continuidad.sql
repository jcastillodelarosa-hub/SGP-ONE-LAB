CREATE OR REPLACE FUNCTION sgp_lp_operacion.continuidad(d date, t integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN RETURN jsonb_build_object('ready',true,'next',sgp_lp_operacion.siguiente(d,t),'admission','COORDINADOR_ABRIR');
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('ready',false,'reason',SQLERRM);
END $function$

