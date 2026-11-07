CREATE OR REPLACE FUNCTION sgp_lp_operacion.periodo(d date, t integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE h jsonb;slot jsonb;inicio time;fin time;BEGIN
 SELECT valor INTO h FROM public.sgp_configuracion_general WHERE clave='HORARIOS_TURNOS' FOR SHARE;
 slot:=h->CASE WHEN extract(isodow FROM d)=7 THEN 'domingo' ELSE 'lunes_sabado' END->('turno'||t);
 IF d IS NULL OR t IS NULL OR t NOT IN(1,2) OR coalesce(slot->>'inicio','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' OR coalesce(slot->>'fin','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN RAISE EXCEPTION 'HORARIO_OPERATIVO_NO_CONFIGURADO'; END IF;
 inicio:=(slot->>'inicio')::time;fin:=(slot->>'fin')::time;
 IF inicio=fin THEN RAISE EXCEPTION 'HORARIO_OPERATIVO_AMBIGUO'; END IF;
 RETURN jsonb_build_object('date',d,'shift',t,'start',(d+inicio) AT TIME ZONE 'America/Bogota','end',((d+CASE WHEN fin<inicio THEN 1 ELSE 0 END)+fin) AT TIME ZONE 'America/Bogota');
END $function$

