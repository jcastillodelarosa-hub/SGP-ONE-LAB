CREATE OR REPLACE FUNCTION sgp_lp_operacion.turno_vacio(et text, line_id text, d date, t integer)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 SELECT NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.ordenes a WHERE a.etapa=et AND a.linea=line_id AND a.fecha=d AND a.turno=t)
 AND NOT EXISTS(SELECT 1 FROM public.sgp_linea_plan_asignaciones a JOIN public.sgp_producciones p ON p.key_produccion=a.key_produccion WHERE p.id_linea=line_id AND a.fecha=d AND a.turno=t AND a.estado IS DISTINCT FROM 'CANCELADA')
 AND NOT EXISTS(SELECT 1 FROM (SELECT DISTINCT ON(key,parte) a.* FROM sgp_lp_operacion.ordenes a WHERE a.etapa=et AND a.linea=line_id AND(a.fecha,a.turno)<(d,t) ORDER BY key,parte,fecha DESC,turno DESC) prior_order LEFT JOIN public.sgp_linea_plan_asignaciones root ON root.id=prior_order.parte AND root.key_produccion=prior_order.key
 WHERE root.cantidad IS NULL OR (SELECT coalesce(sum(q.ejecutado),0) FROM sgp_lp_operacion.ordenes q WHERE q.etapa=et AND q.key=prior_order.key AND q.parte=prior_order.parte AND(q.fecha,q.turno)<=(d,t))<root.cantidad)
 AND NOT EXISTS(SELECT 1 FROM public.sgp_linea_plan_asignaciones a JOIN public.sgp_producciones p ON p.key_produccion=a.key_produccion JOIN sgp_lp_operacion.turnos period ON period.etapa=et AND period.linea=line_id AND period.fecha=a.fecha AND period.turno=a.turno LEFT JOIN public.sgp_linea_plan_asignaciones root ON root.id=sgp_lp_operacion.raiz(a.id,a.key_produccion) WHERE p.id_linea=line_id AND(a.fecha,a.turno)<(d,t) AND a.estado IS DISTINCT FROM 'CANCELADA' AND(root.cantidad IS NULL OR (SELECT coalesce(sum(q.ejecutado),0) FROM sgp_lp_operacion.ordenes q WHERE q.etapa=et AND q.key=a.key_produccion AND q.parte=root.id AND(q.fecha,q.turno)<=(d,t))<root.cantidad));
$function$

