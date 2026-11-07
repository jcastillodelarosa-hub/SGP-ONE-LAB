CREATE OR REPLACE FUNCTION sgp_lp_operacion.permisos_en_periodo(d date DEFAULT NULL::date, t integer DEFAULT NULL::integer)
 RETURNS SETOF sgp_lp_operacion.permisos
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE h jsonb; instante timestamptz; BEGIN
 IF d IS NOT NULL OR t IS NOT NULL THEN h:=sgp_lp_operacion.periodo(d,t); END IF;
 instante:=clock_timestamp(); -- después de toda espera de configuración horaria
 IF (SELECT habilitado FROM sgp_lp_operacion.perfil_roles WHERE id) THEN
 RETURN QUERY SELECT (jsonb_populate_record(NULL::sgp_lp_operacion.permisos,jsonb_build_object('usuario',a.usuario,'etapa',e,'key',x.key_produccion,'valid_from','-infinity','valid_until','infinity','duty','OPERATOR'))).* FROM public.sgp_usuarios a CROSS JOIN unnest(ARRAY['ENSAMBLE','EMPAQUE']) e CROSS JOIN public.sgp_producciones x WHERE x.id_linea='PANELES_2' AND sgp_lp_operacion.acceso_rol(a.usuario,e); RETURN; END IF;
 RETURN QUERY SELECT p.* FROM sgp_lp_operacion.permisos p
 WHERE p.revoked_at IS NULL AND sgp_lp_operacion.ambito_vigente(p.valid_from,p.valid_until,instante)
 AND (h IS NULL OR (p.valid_from<=(h->>'start')::timestamptz AND p.valid_until>=(h->>'end')::timestamptz));
END $function$

