-- Private dual-stage source adapters. No endpoint, grant, activation or data mutation.
BEGIN;
CREATE FUNCTION sgp_lp_operacion.export_dual_ordenes(et text,ln text,d date,t integer)
RETURNS SETOF sgp_lp_operacion.ordenes LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF et IS NULL OR et NOT IN('ENSAMBLE','EMPAQUE') OR ln IS DISTINCT FROM 'PANELES_2' OR d IS NULL OR t IS NULL OR t NOT IN(1,2) THEN RAISE EXCEPTION 'EXPORT_DUAL_SCOPE';END IF;
 IF et='ENSAMBLE' THEN
  RETURN QUERY SELECT o.* FROM sgp_lp_operacion.ordenes o JOIN public.sgp_producciones p ON p.key_produccion=o.key
   WHERE o.etapa=et AND o.linea=ln AND o.fecha=d AND o.turno=t AND p.id_linea=ln AND NOT p.excluida_export;
 ELSE
  -- Legacy packing roots have no accredited packing target. Do not silently omit them.
  IF EXISTS(SELECT 1 FROM sgp_lp_operacion.ordenes o JOIN public.sgp_producciones p ON p.key_produccion=o.key
   WHERE o.etapa=et AND o.linea=ln AND o.fecha=d AND o.turno=t AND p.id_linea=ln AND NOT p.excluida_export
    AND NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.inclusiones_empaque i WHERE i.linea=ln AND i.fecha=d AND i.turno=t AND i.key=o.key))
  THEN RAISE EXCEPTION 'EXPORT_DUAL_LEGACY_PACKING_REQUIRES_EXPLICIT_INCLUSION';END IF;
  RETURN QUERY SELECT (jsonb_populate_record(NULL::sgp_lp_operacion.ordenes,jsonb_build_object(
   'etapa','EMPAQUE','linea',i.linea,'fecha',i.fecha,'turno',i.turno,'key',i.key,'parte',i.id,
   'prioridad',i.prioridad,'observacion',i.motivo,'revision',0))).*
   FROM sgp_lp_operacion.inclusiones_empaque i JOIN public.sgp_producciones p ON p.key_produccion=i.key
   WHERE i.linea=ln AND i.fecha=d AND i.turno=t AND p.id_linea=ln AND NOT p.excluida_export;
 END IF;
END $$;
CREATE FUNCTION sgp_lp_operacion.export_dual_plan_empaque(ln text,d date,t integer) RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE src jsonb;targets jsonb;
BEGIN
 IF ln IS DISTINCT FROM 'PANELES_2' OR d IS NULL OR t IS NULL OR t NOT IN(1,2) THEN RAISE EXCEPTION 'EXPORT_DUAL_SCOPE';END IF;
 BEGIN LOCK TABLE public.sgp_producciones,sgp_lp_operacion.inclusiones_empaque IN SHARE MODE NOWAIT;
 EXCEPTION WHEN lock_not_available THEN RAISE EXCEPTION USING ERRCODE='55P03',MESSAGE='EXPORT_DUAL_SOURCE_BUSY';END;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',i.id,'linea',i.linea,'fecha',i.fecha,'turno',i.turno,'key',i.key,
  'cantidad',i.cantidad,'prioridad',i.prioridad,'motivo',i.motivo,'usuario',i.usuario,'creado_en',i.creado_en) ORDER BY i.key,i.id),'[]'::jsonb),
  coalesce(jsonb_agg(jsonb_build_object('key',i.key,'quantity',i.cantidad,'assignmentIds',jsonb_build_array(i.id)) ORDER BY i.key,i.id),'[]'::jsonb)
 INTO src,targets FROM sgp_lp_operacion.inclusiones_empaque i JOIN public.sgp_producciones p ON p.key_produccion=i.key
 WHERE i.linea=ln AND i.fecha=d AND i.turno=t AND p.id_linea=ln AND NOT p.excluida_export;
 RETURN jsonb_build_object('contract','LP-EMPAQUE-PLAN-1','status','ACCREDITED_CURRENT','source','PROGRAMACION_EMPAQUE',
 'stage','EMPAQUE','line',ln,'date',d,'shift',t,'capturedAt',clock_timestamp(),'fingerprint',encode(sha256(convert_to(src::text,'UTF8')),'hex'),
 'sourceRows',src,'targets',targets,'historyComplete',false,'historySource','IMMUTABLE_INCLUSIONS');
END $$;
CREATE FUNCTION sgp_lp_operacion.export_dual_comparar(et text,ln text,d date,t integer,actual jsonb) RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE plan jsonb;rows jsonb;complete boolean;generation bigint;
BEGIN
 IF ln IS DISTINCT FROM 'PANELES_2' OR et NOT IN('ENSAMBLE','EMPAQUE') OR d IS NULL OR t IS NULL OR t NOT IN(1,2) THEN RAISE EXCEPTION 'EXPORT_DUAL_SCOPE';END IF;
 IF et='ENSAMBLE' THEN
  SELECT c.generation INTO generation FROM sgp_lp_operacion.plan_control c WHERE c.id AND c.enabled FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PLAN_DISABLED';END IF;
  BEGIN LOCK TABLE public.sgp_producciones,public.sgp_linea_plan_asignaciones IN SHARE ROW EXCLUSIVE MODE NOWAIT;
  EXCEPTION WHEN lock_not_available THEN RAISE EXCEPTION USING ERRCODE='55P03',MESSAGE='PLAN_SOURCE_BUSY';END;
  PERFORM sgp_lp_operacion.plan_base(d,t,generation);
  RETURN sgp_lp_operacion.plan_comparar(d,t,actual);
 END IF;
 plan:=sgp_lp_operacion.export_dual_plan_empaque(ln,d,t);
 IF jsonb_typeof(actual) IS DISTINCT FROM 'array' OR EXISTS(SELECT 1 FROM jsonb_array_elements(actual) x
 WHERE jsonb_typeof(x) IS DISTINCT FROM 'object' OR nullif(x->>'key','') IS NULL OR NOT x ? 'realized'
 OR jsonb_typeof(x->'realized') NOT IN('number','null') OR EXISTS(SELECT 1 FROM jsonb_object_keys(x) k WHERE k NOT IN('key','realized')))
 OR (SELECT count(DISTINCT x->>'key') FROM jsonb_array_elements(actual) x)<>jsonb_array_length(actual) THEN RAISE EXCEPTION 'EXPORT_DUAL_ACTUAL_INVALID';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(actual) x WHERE jsonb_typeof(x->'realized')='number' AND ((x->>'realized')::numeric<0 OR (x->>'realized')::numeric>9007199254740991 OR (x->>'realized')::numeric<>trunc((x->>'realized')::numeric))) THEN RAISE EXCEPTION 'EXPORT_DUAL_ACTUAL_INVALID';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(actual) x WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(plan->'targets') y WHERE y->>'key'=x->>'key')) THEN RAISE EXCEPTION 'EXPORT_DUAL_ACTUAL_OUTSIDE_PLAN';END IF;
 WITH a AS(SELECT x->>'key' key,(x->>'realized')::numeric quantity FROM jsonb_array_elements(actual) x),
 p AS(SELECT x->>'key' key,(x->>'quantity')::numeric quantity FROM jsonb_array_elements(plan->'targets') x)
 SELECT coalesce(jsonb_agg(jsonb_build_object('key',p.key,'plan',p.quantity,'planStatus','ACCREDITED_CURRENT','realized',a.quantity,
 'difference',a.quantity-p.quantity,'pendingAgainstPlan',CASE WHEN a.quantity IS NULL THEN NULL ELSE greatest(p.quantity-a.quantity,0) END) ORDER BY p.key),'[]'::jsonb),coalesce(bool_and(a.quantity IS NOT NULL),false)
 INTO rows,complete FROM p LEFT JOIN a USING(key);
 RETURN jsonb_build_object('contract','LP-EMPAQUE-PLAN-COMPARISON-1','planSnapshot',plan,'planComparison','ACCREDITED_CURRENT','comparisonComplete',complete,'rows',rows);
END $$;
REVOKE ALL ON FUNCTION sgp_lp_operacion.export_dual_ordenes(text,text,date,integer),sgp_lp_operacion.export_dual_plan_empaque(text,date,integer),sgp_lp_operacion.export_dual_comparar(text,text,date,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION sgp_lp_operacion.export_dual_universo(et text,ln text,d date,t integer) RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE orders jsonb;productions jsonb;scheduled jsonb;
BEGIN
 BEGIN LOCK TABLE public.sgp_producciones,public.sgp_linea_plan_asignaciones,sgp_lp_operacion.inclusiones_empaque IN SHARE MODE NOWAIT;
 EXCEPTION WHEN lock_not_available THEN RAISE EXCEPTION USING ERRCODE='55P03',MESSAGE='EXPORT_DUAL_SOURCE_BUSY';END;
 SELECT coalesce(jsonb_agg(to_jsonb(o) ORDER BY o.key,o.parte),'[]'::jsonb) INTO orders FROM sgp_lp_operacion.export_dual_ordenes(et,ln,d,t) o;
 SELECT coalesce(jsonb_agg(jsonb_build_object('key',p.key_produccion,'name',p.produccion,'line',p.id_linea) ORDER BY p.key_produccion),'[]'::jsonb) INTO productions FROM public.sgp_producciones p WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(orders) o WHERE o->>'key'=p.key_produccion);
 IF et='ENSAMBLE' THEN
  IF EXISTS(SELECT 1 FROM public.sgp_linea_plan_asignaciones a JOIN public.sgp_producciones p USING(key_produccion) WHERE p.id_linea=ln AND NOT p.excluida_export AND a.fecha=d AND a.turno=t AND a.estado IS DISTINCT FROM 'CANCELADA' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(orders) o WHERE o->>'key'=a.key_produccion AND o->>'parte'=sgp_lp_operacion.raiz(a.id,a.key_produccion)::text)) THEN RAISE EXCEPTION 'EXPORT_V2_INCORPORACION_EXPLICITA_REQUERIDA';END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.key_produccion,a.id),'[]'::jsonb) INTO scheduled FROM public.sgp_linea_plan_asignaciones a JOIN public.sgp_producciones p USING(key_produccion) WHERE p.id_linea=ln AND NOT p.excluida_export AND a.fecha=d AND a.turno=t AND a.estado IS DISTINCT FROM 'CANCELADA';
 ELSE
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',i.id,'key_produccion',i.key,'fecha',i.fecha,'turno',i.turno,'cantidad',i.cantidad,'prioridad',i.prioridad,'estado','PROGRAMADA') ORDER BY i.key,i.id),'[]'::jsonb) INTO scheduled FROM sgp_lp_operacion.inclusiones_empaque i JOIN public.sgp_producciones p ON p.key_produccion=i.key WHERE i.linea=ln AND i.fecha=d AND i.turno=t AND p.id_linea=ln AND NOT p.excluida_export;
 END IF;
 RETURN jsonb_build_object('stage',et,'line',ln,'date',d,'shift',t,'orders',orders,'productions',productions,'scheduled',scheduled);
END $$;
CREATE FUNCTION sgp_lp_operacion.export_dual_motivos(et text,ln text,d date,t integer,coverage jsonb) RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE comparison jsonb;result jsonb;
BEGIN
 comparison:=sgp_lp_operacion.export_dual_comparar(et,ln,d,t,(SELECT jsonb_agg(jsonb_build_object('key',x->>'key','realized',x->'quantity') ORDER BY x->>'key') FROM jsonb_array_elements(coverage) x));
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(comparison->'rows') r WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coverage) c WHERE c->>'key'=r->>'key')) THEN RAISE EXCEPTION 'EXPORT_DUAL_PLAN_UNIVERSE_NOT_ENROLLED';END IF;
 SELECT coalesce(jsonb_agg(c||jsonb_build_object('plan',p->'plan','pendingAgainstPlan',p->'pendingAgainstPlan','reasonRequired',c->>'coverage'='ABSENT' OR coalesce((p->>'pendingAgainstPlan')::numeric>0,false)) ORDER BY c->>'key'),'[]'::jsonb) INTO result FROM jsonb_array_elements(coverage)c JOIN jsonb_array_elements(comparison->'rows')p ON c->>'key'=p->>'key';
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION sgp_lp_operacion.export_dual_universo(text,text,date,integer),sgp_lp_operacion.export_dual_motivos(text,text,date,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION sgp_lp_operacion.export_dual_ordenes_condicional(et text,ln text,d date,t integer,on_export boolean) RETURNS SETOF sgp_lp_operacion.ordenes LANGUAGE plpgsql SET search_path='' AS $$BEGIN IF on_export THEN RETURN QUERY SELECT * FROM sgp_lp_operacion.export_dual_ordenes(et,ln,d,t);ELSE RETURN QUERY SELECT o.* FROM sgp_lp_operacion.ordenes o WHERE o.etapa=et AND o.linea=ln AND o.fecha=d AND o.turno=t;END IF;END $$;
REVOKE ALL ON FUNCTION sgp_lp_operacion.export_dual_ordenes_condicional(text,text,date,integer,boolean) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
