-- Added immediately after the existing revision check, under existing locks.
 IF v2 THEN
  IF et IS DISTINCT FROM 'ENSAMBLE' OR line_id IS DISTINCT FROM 'PANELES_2' THEN RAISE EXCEPTION 'EXPORT_V2_FUERA_DE_PILOTO'; END IF;
  IF NOT coalesce((SELECT export_production_v2 FROM sgp_lp_operacion.config WHERE id),false) THEN RAISE EXCEPTION 'EXPORT_V2_NO_HABILITADO'; END IF;
  IF jsonb_typeof(p_contexto->'shift') IS DISTINCT FROM 'number' OR jsonb_typeof(p_contexto->'revision') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'EXPORT_V2_CONTEXTO_INVALIDO'; END IF;
  -- Planner and Export writers do not share the LP mutex: fail instead of waiting
  -- in reverse lock order; SHARE freezes canonical identity/planning until COMMIT.
  BEGIN
   LOCK TABLE public.sgp_producciones,public.sgp_linea_plan_asignaciones IN SHARE MODE NOWAIT;
  EXCEPTION WHEN lock_not_available THEN RAISE EXCEPTION USING ERRCODE='55P03',MESSAGE='EXPORT_V2_FUENTES_EN_ACTUALIZACION_RECONSULTAR'; END;
  s:=sgp_lp_operacion.sesion(p_token,et,NULL,line_id);
  PERFORM sgp_lp_operacion.verificar_temporal(u,et,line_id,d,t,NULL,'IMPORTAR_XLSX');
  IF s->>'usuario' IS DISTINCT FROM u THEN RAISE EXCEPTION 'EXPORT_V2_SESION_CAMBIO'; END IF;
  IF tr.estado='EN_REVISION' AND s->>'rol' NOT IN('ADMINISTRADOR','COORDINADOR') THEN RAISE EXCEPTION 'CORRECCION_REQUIERE_COORDINADOR'; END IF;
  -- A scheduled root in this period cannot vanish because it is not incorporated.
  IF EXISTS(SELECT 1 FROM public.sgp_linea_plan_asignaciones a JOIN public.sgp_producciones p USING(key_produccion)
   WHERE p.id_linea=line_id AND a.fecha=d AND a.turno=t AND a.estado IS DISTINCT FROM 'CANCELADA'
   AND NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.ordenes o WHERE o.etapa=et AND o.linea=line_id AND o.fecha=d AND o.turno=t
    AND o.key=a.key_produccion AND o.parte=sgp_lp_operacion.raiz(a.id,a.key_produccion)))
  THEN RAISE EXCEPTION 'EXPORT_V2_INCORPORACION_EXPLICITA_REQUERIDA'; END IF;
  -- Fingerprint server-read source, including order revisions, roots and identity.
  SELECT jsonb_build_object('stage',et,'line',line_id,'date',d,'shift',t,
   'orders',coalesce((SELECT jsonb_agg(to_jsonb(o) ORDER BY o.key,o.parte) FROM sgp_lp_operacion.ordenes o
    WHERE o.etapa=et AND o.linea=line_id AND o.fecha=d AND o.turno=t),'[]'::jsonb),
   'productions',coalesce((SELECT jsonb_agg(jsonb_build_object('key',p.key_produccion,'name',p.produccion,'line',p.id_linea) ORDER BY p.key_produccion)
    FROM public.sgp_producciones p WHERE EXISTS(SELECT 1 FROM sgp_lp_operacion.ordenes o WHERE o.etapa=et AND o.linea=line_id AND o.fecha=d AND o.turno=t AND o.key=p.key_produccion)),'[]'::jsonb),
   'scheduled',coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.key_produccion,a.id) FROM public.sgp_linea_plan_asignaciones a
    JOIN public.sgp_producciones p USING(key_produccion) WHERE p.id_linea=line_id AND a.fecha=d AND a.turno=t AND a.estado IS DISTINCT FROM 'CANCELADA'),'[]'::jsonb)) INTO universe;
  universe_sha:=encode(sha256(convert_to(universe::text,'UTF8')),'hex');
 END IF;
