CREATE OR REPLACE FUNCTION sgp_lp_operacion.cierre_valido(et text, line_id text, d date, t integer)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 SELECT jsonb_build_object('id',c.id,'version',c.version,'type',c.tipo)
 FROM sgp_lp_operacion.cierres c JOIN sgp_lp_operacion.auditoria a ON a.id=c.id AND a.operacion='CERRAR' AND a.respuesta=c.snapshot AND a.usuario=c.usuario
 WHERE c.id=(SELECT latest.id FROM sgp_lp_operacion.cierres latest WHERE latest.etapa=et AND latest.linea=line_id AND latest.fecha=d AND latest.turno=t ORDER BY latest.version DESC LIMIT 1);
$function$

