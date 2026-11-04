-- Lector PRIVADO de propuesta: no API pública, no grants, sin mutaciones.
-- No reemplaza sgp_lp_operacion_consultar ni crea asignaciones/turnos.
BEGIN;
CREATE FUNCTION sgp_lp_operacion.seguimiento_prototipo(token text,et text,line_id text)
RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE s jsonb; result jsonb;
BEGIN
 s:=sgp_lp_operacion.sesion(token,et,NULL,line_id);
 IF s->>'rol' NOT IN('COORDINADOR','ADMINISTRADOR') THEN RAISE EXCEPTION 'SEGUIMIENTO_NO_AUTORIZADO'; END IF;
 SELECT jsonb_build_object('contract','LP-SEGUIMIENTO-1','role',s->>'rol','line',line_id,'stage',et,
 'productions',coalesce(jsonb_agg(jsonb_build_object(
 'identity',jsonb_build_array(p.key_produccion,et),'key',p.key_produccion,'line',p.id_linea,'stage',et,
 'oficial',jsonb_build_object('key_produccion',to_jsonb(p)->'key_produccion','produccion',to_jsonb(p)->'produccion','id_linea',to_jsonb(p)->'id_linea','sistema',to_jsonb(p)->'sistema','reserva_al',to_jsonb(p)->'reserva_al','saldos_inicializados',to_jsonb(p)->'saldos_inicializados','presente_ultimo_export',to_jsonb(p)->'presente_ultimo_export','saldo_ensamble',to_jsonb(p)->'saldo_ensamble','saldo_empaque',to_jsonb(p)->'saldo_empaque','semana_base',to_jsonb(p)->'semana_base','anio',to_jsonb(p)->'anio','ultima_carga_diaria',to_jsonb(p)->'ultima_carga_diaria','ultima_vez_export',to_jsonb(p)->'ultima_vez_export'),'saldo',q.saldo,'classification',CASE WHEN q.saldo>0 THEN 'ABIERTA' ELSE 'PENDIENTE_CONCILIACION' END,
 'history',coalesce((SELECT jsonb_agg(jsonb_build_object('id',to_jsonb(h)->'id','key',to_jsonb(h)->'key','parte',to_jsonb(h)->'parte','linea',to_jsonb(h)->'linea','etapa',to_jsonb(h)->'etapa','fecha',to_jsonb(h)->'fecha','turno',to_jsonb(h)->'turno','operacion',to_jsonb(h)->'operacion','usuario',to_jsonb(h)->'usuario','creado_en',to_jsonb(h)->'creado_en','payload',jsonb_build_object('observation',h.payload->'observation')) ORDER BY h.creado_en) FROM sgp_lp_operacion.auditoria h WHERE h.key=p.key_produccion AND h.etapa=et AND h.linea=line_id),'[]'::jsonb),
 'assignments',coalesce((SELECT jsonb_agg(jsonb_build_object('id',to_jsonb(a)->'id','key_produccion',to_jsonb(a)->'key_produccion','fecha',to_jsonb(a)->'fecha','turno',to_jsonb(a)->'turno','cantidad',to_jsonb(a)->'cantidad','prioridad',to_jsonb(a)->'prioridad','estado',to_jsonb(a)->'estado','origen_id',to_jsonb(a)->'origen_id') ORDER BY a.fecha,a.turno,a.id) FROM public.sgp_linea_plan_asignaciones a WHERE a.key_produccion=p.key_produccion),'[]'::jsonb),
 'operations',coalesce((SELECT jsonb_agg(jsonb_build_object('key',to_jsonb(o)->'key','parte',to_jsonb(o)->'parte','linea',to_jsonb(o)->'linea','etapa',to_jsonb(o)->'etapa','fecha',to_jsonb(o)->'fecha','turno',to_jsonb(o)->'turno','sale',to_jsonb(o)->'sale','ejecutado',to_jsonb(o)->'ejecutado','revision',to_jsonb(o)->'revision','prioridad',to_jsonb(o)->'prioridad','origen_fecha',to_jsonb(o)->'origen_fecha','origen_turno',to_jsonb(o)->'origen_turno','antiguedad_fecha',to_jsonb(o)->'antiguedad_fecha','antiguedad_turno',to_jsonb(o)->'antiguedad_turno','afectaciones',to_jsonb(o)->'afectaciones','consolidado',to_jsonb(o)->'consolidado','validado',to_jsonb(o)->'validado','observacion',to_jsonb(o)->'observacion','sale_fuente',to_jsonb(o)->'sale_fuente','sale_estado',to_jsonb(o)->'sale_estado') ORDER BY o.fecha,o.turno,o.parte) FROM sgp_lp_operacion.ordenes o WHERE o.key=p.key_produccion AND o.linea=line_id AND o.etapa=et),'[]'::jsonb)
 ) ORDER BY p.key_produccion),'[]'::jsonb)) INTO result
 FROM public.sgp_producciones p
 CROSS JOIN LATERAL (SELECT CASE WHEN p.saldos_inicializados AND p.presente_ultimo_export AND
 (CASE et WHEN 'ENSAMBLE' THEN p.saldo_ensamble ELSE p.saldo_empaque END)>=0 AND
 trunc(CASE et WHEN 'ENSAMBLE' THEN p.saldo_ensamble ELSE p.saldo_empaque END)=(CASE et WHEN 'ENSAMBLE' THEN p.saldo_ensamble ELSE p.saldo_empaque END)
 THEN CASE et WHEN 'ENSAMBLE' THEN p.saldo_ensamble ELSE p.saldo_empaque END ELSE NULL END AS saldo) q
 WHERE p.id_linea=line_id AND EXISTS(SELECT 1 FROM sgp_lp_operacion.permisos_en_periodo() a WHERE a.usuario=s->>'usuario' AND a.etapa=et AND a.key=p.key_produccion)
 AND (q.saldo IS NULL OR q.saldo>0 OR EXISTS(
 SELECT 1 FROM public.sgp_linea_plan_asignaciones a
 LEFT JOIN public.sgp_linea_plan_asignaciones root ON root.id=sgp_lp_operacion.raiz(a.id,a.key_produccion)
 WHERE a.key_produccion=p.key_produccion AND a.estado IS DISTINCT FROM 'CANCELADA'
 AND (root.cantidad IS NULL OR root.cantidad>(SELECT coalesce(sum(o.ejecutado),0) FROM sgp_lp_operacion.ordenes o WHERE o.key=p.key_produccion AND o.etapa=et AND o.parte=root.id))
 ) OR EXISTS(
 SELECT 1 FROM (SELECT DISTINCT ON(o.parte) o.* FROM sgp_lp_operacion.ordenes o
 WHERE o.key=p.key_produccion AND o.linea=line_id AND o.etapa=et ORDER BY o.parte,o.fecha DESC,o.turno DESC) latest
 WHERE latest.sale>latest.ejecutado OR coalesce(latest.consolidado,0)>0
 OR EXISTS(SELECT 1 FROM jsonb_each_text(latest.afectaciones) a WHERE a.value::numeric>0)
 ));
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION sgp_lp_operacion.seguimiento_prototipo(text,text,text) FROM PUBLIC,anon,authenticated;
-- Facade prepared for future reviewed deployment. No API grant in this prototype.
CREATE FUNCTION public.sgp_lp_seguimiento_consultar(p_token text,p_etapa text,p_linea text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT sgp_lp_operacion.seguimiento_prototipo(p_token,p_etapa,p_linea)
$$;
REVOKE ALL ON FUNCTION public.sgp_lp_seguimiento_consultar(text,text,text) FROM PUBLIC,anon,authenticated;
COMMIT;
