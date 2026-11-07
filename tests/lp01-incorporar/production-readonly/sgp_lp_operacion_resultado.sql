CREATE OR REPLACE FUNCTION public.sgp_lp_operacion_resultado(p_token text, p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE a sgp_lp_operacion.auditoria%rowtype;s jsonb;BEGIN
 s:=public.sgp_sesion_actual(p_token);
 IF s->>'valida' IS DISTINCT FROM 'true' OR coalesce(s->>'rol','') NOT IN('LIDER','LIDER LINEA','COORDINADOR','ADMINISTRADOR','CONSULTA') THEN RAISE EXCEPTION 'SESION_NO_AUTORIZADA'; END IF;
 SELECT * INTO a FROM sgp_lp_operacion.auditoria WHERE id=p_id;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',true,'committed',false); END IF;
 s:=sgp_lp_operacion.sesion(p_token,a.etapa,a.key,a.linea); PERFORM sgp_lp_operacion.verificar_temporal(s->>'usuario',a.etapa,a.linea,a.fecha,a.turno,a.key,'LEER');
 IF a.usuario<>s->>'usuario' OR (a.key IS NULL AND EXISTS(SELECT 1 FROM sgp_lp_operacion.ordenes o WHERE o.etapa=a.etapa AND o.linea=a.linea AND o.fecha=a.fecha AND o.turno=a.turno AND NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.permisos_en_periodo(a.fecha,a.turno) q WHERE q.usuario=s->>'usuario' AND q.etapa=o.etapa AND q.key=o.key))) THEN RAISE EXCEPTION 'AMBITO_DENEGADO'; END IF;
 RETURN jsonb_build_object('ok',true,'committed',true,'result',a.respuesta);
END $function$

